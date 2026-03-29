import { stockDataService, type Frequency } from '@/services/stock-data.service';
import { clearBaostockCache } from '@/lib/stock-freshness';
import { getDataIntegritySnapshot } from '@/lib/stock-data-integrity-service';
import {
  buildPrepareAnalysisPayload,
  formatPrepareAnalysisFailureMessage,
  type PrepareAnalysisSyncResult,
} from '@/lib/prepare-analysis-response';
import {
  getStockInfoSnapshot,
  runStockAnalysis,
} from '@/lib/stock-analysis-runtime';

export type BootstrapStage =
  | 'checking'
  | 'syncing'
  | 'requesting-analysis'
  | 'finalizing';

export interface PrepareStockAnalysisBootstrapOptions {
  code: string;
  forceSync?: boolean;
  maxRetries?: number;
  levels?: Frequency[];
  onStage?: (stage: BootstrapStage, meta?: Record<string, unknown>) => void | Promise<void>;
}

const REQUIRED_FREQUENCIES: Frequency[] = ['w', 'd', '60', '30', '15'];

async function emitStage(
  onStage: PrepareStockAnalysisBootstrapOptions['onStage'],
  stage: BootstrapStage,
  meta?: Record<string, unknown>
) {
  if (onStage) {
    await onStage(stage, meta);
  }
}

export async function prepareStockAnalysisBootstrap({
  code,
  forceSync: initialForceSync = false,
  maxRetries = 2,
  levels: requestedLevels = [],
  onStage,
}: PrepareStockAnalysisBootstrapOptions) {
  const filteredLevels = requestedLevels.length > 0
    ? requestedLevels.filter(level => REQUIRED_FREQUENCIES.includes(level))
    : [];

  console.log(`[Prepare Analysis] 开始准备 ${code} 的分析数据，forceSync: ${initialForceSync}`);

  const checkIntegrity = async () => {
    try {
      await emitStage(onStage, 'checking');
      const integrity = await getDataIntegritySnapshot(code);
      return {
        success: true as const,
        canAnalyze: integrity.summary.canAnalyze,
        needsSyncLevels: integrity.summary.needsSyncLevels || [],
        summary: integrity.summary,
        levels: integrity.levels,
        integrity,
      };
    } catch (error) {
      console.error('[Prepare Analysis] Integrity check failed:', error);
      return {
        success: false as const,
        canAnalyze: false,
        needsSyncLevels: REQUIRED_FREQUENCIES,
        summary: null,
        levels: [],
        integrity: null,
      };
    }
  };

  const doSync = async (
    levelsToSync: Frequency[],
    integrityLevels: Array<{ key: string; recordCount: number; minRecords: number }>,
    forceFullAll: boolean = false
  ): Promise<PrepareAnalysisSyncResult[]> => {
    await emitStage(onStage, 'syncing', { levels: levelsToSync });
    console.log(`[Prepare Analysis] 同步 ${code}，级别: ${levelsToSync.join(',')}`);

    clearBaostockCache(code);

    const repairLevels = forceFullAll
      ? levelsToSync
      : levelsToSync.filter(level => {
          const matchedLevel = integrityLevels.find(item => item.key === level);
          return !matchedLevel || matchedLevel.recordCount < matchedLevel.minRecords;
        });
    const repairLevelSet = new Set(repairLevels);
    const incrementalLevels = levelsToSync.filter(level => !repairLevelSet.has(level));

    const results: PrepareAnalysisSyncResult[] = [];

    if (incrementalLevels.length > 0) {
      const partialResults = await stockDataService.syncStockData(
        code,
        incrementalLevels,
        undefined,
        false
      );
      results.push(...partialResults);
    }

    if (repairLevels.length > 0) {
      console.log(`[Prepare Analysis] 对历史不足级别执行补齐同步: ${repairLevels.join(',')}`);
      const repairResults = await stockDataService.syncStockData(
        code,
        repairLevels,
        undefined,
        true
      );
      results.push(...repairResults);
    }

    return results.map(result => ({
      frequency: result.frequency,
      success: result.success,
      count: result.count,
      newRecords: result.newRecords,
      message: result.message,
    }));
  };

  let integrityResult = await checkIntegrity();

  if (!integrityResult.success) {
    return {
      success: false,
      status: 500,
      error: '数据完整性检查失败',
      data: buildPrepareAnalysisPayload({
        ready: false,
        code,
        phase: 'check_failed',
      }),
    };
  }

  if (integrityResult.canAnalyze && !initialForceSync) {
    await emitStage(onStage, 'requesting-analysis');
    const analysisResult = await runStockAnalysis({
      code,
      skipIntegrityCheck: true,
    });

    if (!analysisResult.success) {
      return {
        success: false,
        status: analysisResult.status,
        error: analysisResult.error || '分析失败',
        data: buildPrepareAnalysisPayload({
          ready: true,
          code,
          phase: 'ready',
          summary: integrityResult.summary,
          levels: integrityResult.levels,
          integrity: integrityResult.integrity,
          syncResults: null,
          retries: 0,
        }),
      };
    }

    await emitStage(onStage, 'finalizing');
    const stockInfo = await getStockInfoSnapshot(code);

    return {
      success: true,
      status: 200,
      data: buildPrepareAnalysisPayload({
        ready: true,
        code,
        phase: 'ready',
        summary: integrityResult.summary,
        levels: integrityResult.levels,
        integrity: integrityResult.integrity,
        syncResults: null,
        retries: 0,
        analysisData: analysisResult.data,
        stockInfo,
      }),
    };
  }

  let syncResults: PrepareAnalysisSyncResult[] = [];
  let retryCount = 0;
  let shouldForceSync = initialForceSync;

  while ((!integrityResult.canAnalyze || shouldForceSync) && retryCount < maxRetries) {
    retryCount++;

    const levelsToSync = (
      shouldForceSync && retryCount === 1
        ? (filteredLevels.length > 0 ? filteredLevels : REQUIRED_FREQUENCIES)
        : integrityResult.needsSyncLevels.filter((level: string) => {
            if (filteredLevels.length === 0) return true;
            return filteredLevels.includes(level as Frequency);
          })
    ) as Frequency[];

    if (levelsToSync.length === 0) {
      break;
    }

    console.log(`[Prepare Analysis] 第 ${retryCount} 次同步尝试，级别: ${levelsToSync.join(',')}`);

    const results = await doSync(
      levelsToSync,
      integrityResult.levels,
      shouldForceSync && retryCount === 1
    );
    syncResults.push(...results);

    const failedSyncs = results.filter(result => !result.success);
    if (failedSyncs.length > 0) {
      console.warn(`[Prepare Analysis] 同步失败: ${failedSyncs.map(result => result.frequency).join(',')}`);
    }

    integrityResult = await checkIntegrity();

    if (integrityResult.canAnalyze) {
      console.log('[Prepare Analysis] 复检通过，数据已准备好');
      break;
    }

    const newNeedsSync = [...integrityResult.needsSyncLevels].sort().join(',');
    const oldNeedsSync = [...levelsToSync].sort().join(',');
    if (newNeedsSync === oldNeedsSync) {
      console.warn(`[Prepare Analysis] 同步后仍需同步相同级别，可能数据源问题: ${newNeedsSync}`);
      break;
    }

    shouldForceSync = false;
  }

  if (!integrityResult.canAnalyze) {
    return {
      success: false,
      status: 409,
      error: formatPrepareAnalysisFailureMessage(syncResults)
        || integrityResult.summary?.analyzeWarning
        || '数据准备未完成',
      data: buildPrepareAnalysisPayload({
        ready: false,
        code,
        phase: 'incomplete',
        summary: integrityResult.summary,
        levels: integrityResult.levels,
        integrity: integrityResult.integrity,
        syncResults,
        retries: retryCount,
      }),
    };
  }

  await emitStage(onStage, 'requesting-analysis');
  const analysisResult = await runStockAnalysis({
    code,
    skipIntegrityCheck: true,
  });

  if (!analysisResult.success) {
    return {
      success: false,
      status: analysisResult.status,
      error: analysisResult.error || '分析失败',
      data: buildPrepareAnalysisPayload({
        ready: true,
        code,
        phase: 'ready',
        summary: integrityResult.summary,
        levels: integrityResult.levels,
        integrity: integrityResult.integrity,
        syncResults,
        retries: retryCount,
      }),
    };
  }

  await emitStage(onStage, 'finalizing');
  const stockInfo = await getStockInfoSnapshot(code);

  return {
    success: true,
    status: 200,
    data: buildPrepareAnalysisPayload({
      ready: true,
      code,
      phase: 'ready',
      summary: integrityResult.summary,
      levels: integrityResult.levels,
      integrity: integrityResult.integrity,
      syncResults,
      retries: retryCount,
      analysisData: analysisResult.data,
      stockInfo,
    }),
  };
}
