import type { DataIntegritySnapshot } from '@/lib/stock-data-integrity';

export interface PrepareAnalysisSummaryLike {
  canAnalyze: boolean;
  overallText: string;
  analyzeWarning: string | null;
  needsSyncLevels?: string[];
  pendingCount?: number;
}

export interface PrepareAnalysisLevelLike {
  key: string;
  name?: string;
  status: string;
}

export interface PrepareAnalysisSyncResult {
  frequency: string;
  success: boolean;
  message?: string;
  count?: number;
  newRecords?: number;
}

export interface PrepareAnalysisFailedSyncLog {
  frequency: string;
  message: string;
}

export interface PrepareAnalysisBootstrapPayload<TAnalysis = unknown, TStockInfo = unknown> {
  analysisData: TAnalysis;
  stockInfo: TStockInfo;
}

export interface BuildPrepareAnalysisPayloadParams<TAnalysis = unknown, TStockInfo = unknown> {
  ready: boolean;
  code: string;
  phase: string;
  summary?: PrepareAnalysisSummaryLike | null;
  levels?: PrepareAnalysisLevelLike[] | null;
  integrity?: DataIntegritySnapshot | null;
  syncResults?: PrepareAnalysisSyncResult[] | null;
  retries?: number;
  analysisData?: TAnalysis;
  stockInfo?: TStockInfo;
}

export function collectFailedSyncLogs(
  syncResults?: PrepareAnalysisSyncResult[] | null
): PrepareAnalysisFailedSyncLog[] {
  return (syncResults || [])
    .filter(result => !result.success)
    .map(result => ({
      frequency: result.frequency,
      message: result.message || '未返回失败详情',
    }));
}

export function formatPrepareAnalysisFailureMessage(
  syncResults?: PrepareAnalysisSyncResult[] | null
): string | null {
  const failedLogs = collectFailedSyncLogs(syncResults);
  if (failedLogs.length === 0) {
    return null;
  }

  return `数据同步失败: ${failedLogs.map(log => `${log.frequency}: ${log.message}`).join('；')}`;
}

export function buildPrepareAnalysisPayload<TAnalysis = unknown, TStockInfo = unknown>({
  ready,
  code,
  phase,
  summary,
  levels,
  integrity,
  syncResults,
  retries = 0,
  analysisData,
  stockInfo,
}: BuildPrepareAnalysisPayloadParams<TAnalysis, TStockInfo>) {
  return {
    ready,
    code,
    phase,
    summary: summary || undefined,
    levels: levels || undefined,
    integrity: integrity || null,
    syncResults: syncResults && syncResults.length > 0 ? syncResults : null,
    failedSyncs: collectFailedSyncLogs(syncResults),
    retries,
    bootstrap: ready && analysisData !== undefined && stockInfo !== undefined
      ? {
          analysisData,
          stockInfo,
        }
      : null,
  };
}
