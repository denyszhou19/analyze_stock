import { NextRequest, NextResponse } from 'next/server';
import { stockDataService, Frequency } from '@/services/stock-data.service';
import { clearBaostockCache } from '@/lib/stock-freshness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 三位一体分析必需的级别
const REQUIRED_FREQUENCIES: Frequency[] = ['w', 'd', '60', '30', '15'];

/**
 * POST /api/stock/prepare-analysis - 分析前数据准备
 * 
 * P2优化：收敛分析前准备数据为单一 API
 * 
 * 内部流程：
 * 1. 检查数据完整性
 * 2. 如有缺失，同步数据
 * 3. 复检数据完整性
 * 4. 返回准备结果
 * 
 * 请求体：
 * - code: 股票代码（必填）
 * - forceSync: 是否强制同步（默认 false）
 * - maxRetries: 最大重试次数（默认 2）
 * 
 * 返回：
 * - ready: 是否可以分析
 * - summary: 数据完整性摘要
 * - syncResults: 同步结果（如果执行了同步）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      code,
      forceSync: initialForceSync = false,
      maxRetries = 2,
      levels: requestedLevelsRaw = [],
    } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    const requestedLevels = Array.isArray(requestedLevelsRaw)
      ? requestedLevelsRaw.filter((level): level is Frequency => REQUIRED_FREQUENCIES.includes(level as Frequency))
      : [];

    console.log(`[Prepare Analysis] 开始准备 ${code} 的分析数据，forceSync: ${initialForceSync}`);

    // 辅助函数：调用 data-integrity 接口
    const checkIntegrity = async (): Promise<{
      success: boolean;
      canAnalyze: boolean;
      needsSyncLevels: string[];
      summary: any;
      levels: any[];
    }> => {
      const integrityUrl = new URL('/api/stock/data-integrity', request.url);
      integrityUrl.searchParams.set('code', code);
      
      const res = await fetch(integrityUrl.toString());
      const data = await res.json();
      
      if (!data.success) {
        return {
          success: false,
          canAnalyze: false,
          needsSyncLevels: REQUIRED_FREQUENCIES,
          summary: null,
          levels: [],
        };
      }
      
      return {
        success: true,
        canAnalyze: data.data.summary.canAnalyze,
        needsSyncLevels: data.data.summary.needsSyncLevels || [],
        summary: data.data.summary,
        levels: data.data.levels,
      };
    };

    // 辅助函数：执行同步
    const doSync = async (
      levels: Frequency[],
      integrityLevels: Array<{ key: string; recordCount: number; minRecords: number }>,
      forceFullAll: boolean = false
    ): Promise<any[]> => {
      console.log(`[Prepare Analysis] 同步 ${code}，级别: ${levels.join(',')}`);
      
      // P2修复：清除 baostock 缓存，确保使用最新数据
      clearBaostockCache(code);

      const repairLevels = forceFullAll
        ? levels
        : levels.filter(level => {
            const matchedLevel = integrityLevels.find(item => item.key === level);
            return !matchedLevel || matchedLevel.recordCount < matchedLevel.minRecords;
          });
      const repairLevelSet = new Set(repairLevels);
      const incrementalLevels = levels.filter(level => !repairLevelSet.has(level));

      const results: Array<{
        frequency: Frequency;
        success: boolean;
        count: number;
        newRecords: number;
        message?: string;
      }> = [];

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

      return results.map(r => ({
        frequency: r.frequency,
        success: r.success,
        count: r.count,
        newRecords: r.newRecords,
        message: r.message,
      }));
    };

    // 步骤 1：初始检查
    let integrityResult = await checkIntegrity();
    
    if (!integrityResult.success) {
      return NextResponse.json({
        success: false,
        error: '数据完整性检查失败',
        data: {
          ready: false,
          code,
          phase: 'check_failed',
        },
      });
    }

    // 如果数据已准备好且非强制同步，直接返回
    if (integrityResult.canAnalyze && !initialForceSync) {
      console.log(`[Prepare Analysis] ${code} 数据已准备好，无需同步`);
      return NextResponse.json({
        success: true,
        data: {
          ready: true,
          code,
          phase: 'ready',
          summary: integrityResult.summary,
          levels: integrityResult.levels,
          syncResults: null,
        },
      });
    }

    // 步骤 2：同步循环（带重试）
    let syncResults: any[] = [];
    let retryCount = 0;
    let shouldForceSync = initialForceSync;  // 使用可变变量跟踪强制同步状态
    
    while (
      (!integrityResult.canAnalyze || shouldForceSync) && 
      retryCount < maxRetries
    ) {
      retryCount++;
      
      // 确定需要同步的级别
      const levelsToSync = (
        shouldForceSync && retryCount === 1
          ? (requestedLevels.length > 0 ? requestedLevels : REQUIRED_FREQUENCIES)
          : integrityResult.needsSyncLevels.filter((level: string) => {
              if (requestedLevels.length === 0) return true;
              return requestedLevels.includes(level as Frequency);
            })
      ) as Frequency[];
      
      if (levelsToSync.length === 0) {
        break;
      }
      
      console.log(`[Prepare Analysis] 第 ${retryCount} 次同步尝试，级别: ${levelsToSync.join(',')}`);
      
      // 执行同步
      const results = await doSync(
        levelsToSync,
        integrityResult.levels,
        shouldForceSync && retryCount === 1
      );
      syncResults.push(...results);
      
      // 检查同步结果
      const failedSyncs = results.filter((r: { success: boolean; frequency: string }) => !r.success);
      if (failedSyncs.length > 0) {
        console.warn(`[Prepare Analysis] 同步失败: ${failedSyncs.map((r: { frequency: string }) => r.frequency).join(',')}`);
      }
      
      // 步骤 3：复检
      console.log(`[Prepare Analysis] 复检数据完整性...`);
      integrityResult = await checkIntegrity();
      
      // 如果复检通过或没有更多需要同步的级别，退出循环
      if (integrityResult.canAnalyze) {
        console.log(`[Prepare Analysis] 复检通过，数据已准备好`);
        break;
      }
      
      // 如果需要同步的级别与上次相同，说明同步无效，退出循环
      const newNeedsSync = [...integrityResult.needsSyncLevels].sort().join(',');
      const oldNeedsSync = [...levelsToSync].sort().join(',');
      if (newNeedsSync === oldNeedsSync) {
        console.warn(`[Prepare Analysis] 同步后仍需同步相同级别，可能数据源问题: ${newNeedsSync}`);
        break;
      }
      
      // 强制同步只执行一次
      shouldForceSync = false;
    }

    // 步骤 4：返回最终结果
    const ready = integrityResult.canAnalyze;
    
    console.log(`[Prepare Analysis] ${code} 准备完成，ready: ${ready}，重试次数: ${retryCount}`);
    
    return NextResponse.json({
      success: true,
      data: {
        ready,
        code,
        phase: ready ? 'ready' : 'incomplete',
        summary: integrityResult.summary,
        levels: integrityResult.levels,
        syncResults: syncResults.length > 0 ? syncResults : null,
        retries: retryCount,
      },
    });

  } catch (err) {
    console.error('[Prepare Analysis API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '准备失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stock/prepare-analysis - 快速检查分析准备状态
 * 
 * 查询参数：
 * - code: 股票代码（必填）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    // 调用 data-integrity 获取状态
    const integrityUrl = new URL('/api/stock/data-integrity', request.url);
    integrityUrl.searchParams.set('code', code);
    
    const res = await fetch(integrityUrl.toString());
    const data = await res.json();
    
    if (!data.success) {
      return NextResponse.json({
        success: false,
        error: data.error || '检查失败',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ready: data.data.summary.canAnalyze,
        code,
        needsSync: data.data.summary.needsSyncLevels,
        summary: data.data.summary,
        levels: data.data.levels,
      },
    });

  } catch (err) {
    console.error('[Prepare Analysis API] GET Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '检查失败' },
      { status: 500 }
    );
  }
}
