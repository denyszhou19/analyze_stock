export interface IntegrityLevelDefinition {
  key: string;
  name: string;
  icon: string;
  minRecords: number;
  description: string;
}

export interface DataIntegrityLevelStatus {
  key: string;
  name: string;
  icon: string;
  description: string;
  status: 'ok' | 'stale' | 'missing' | 'error' | 'pending';
  statusText: string;
  lastDate: string | null;
  recordCount: number;
  expectedRecords: number;
  expectedDescription: string;
  completeness: number;
  minRecords: number;
  needsSync: boolean;
  issues: string[];
}

export interface DataIntegritySummary {
  overallStatus: 'ok' | 'warning' | 'error' | 'syncing';
  overallText: string;
  okCount: number;
  staleCount: number;
  missingCount: number;
  errorCount: number;
  pendingCount: number;
  totalLevels: number;
  needsSyncLevels: string[];
  canAnalyze: boolean;
  analyzeWarning: string | null;
}

export interface DataIntegritySnapshot {
  code: string;
  levels: DataIntegrityLevelStatus[];
  baostockLatestDate: string | null;
  currentTime: string;
  isWeekend: boolean;
  summary: DataIntegritySummary;
}

export interface IntegritySyncStatus {
  sync_status?: string | null;
  last_sync_error?: string | null;
}

export interface IntegrityFreshnessResult {
  isFresh: boolean;
  reason: string;
}

export interface EvaluateIntegrityLevelStatusParams {
  level: IntegrityLevelDefinition;
  recordCount: number;
  expectedRecords: number;
  lastDateStr: string | null;
  freshnessResult?: IntegrityFreshnessResult | null;
  syncStatus?: IntegritySyncStatus | null;
}

export interface IntegrityLevelStatusResult {
  status: 'ok' | 'stale' | 'missing' | 'error' | 'pending';
  statusText: string;
  needsSync: boolean;
  issues: string[];
}

export function evaluateIntegrityLevelStatus({
  level,
  recordCount,
  freshnessResult,
  syncStatus,
}: EvaluateIntegrityLevelStatusParams): IntegrityLevelStatusResult {
  let status: IntegrityLevelStatusResult['status'] = 'missing';
  let statusText = '无数据';
  let needsSync = true;
  const issues: string[] = [];

  if (syncStatus?.sync_status === 'syncing') {
    return {
      status: 'pending',
      statusText: '同步中...',
      needsSync: false,
      issues,
    };
  }

  let hasUsableLocalData = false;

  if (recordCount > 0) {
    const currentFreshness = freshnessResult ?? {
      isFresh: false,
      reason: '数据状态未知',
    };
    const hasMinimumRecords = recordCount >= level.minRecords;
    hasUsableLocalData = currentFreshness.isFresh && hasMinimumRecords;

    if (hasUsableLocalData) {
      status = 'ok';
      statusText = currentFreshness.reason;
      needsSync = false;
    } else if (!hasMinimumRecords) {
      status = 'stale';
      statusText = '记录不足';
      issues.push(`记录数不足: ${recordCount}/${level.minRecords}`);
    } else {
      status = 'stale';
      statusText = currentFreshness.reason;
      issues.push(`${level.name}数据过期`);
    }
  }

  if (syncStatus?.sync_status === 'failed' && syncStatus.last_sync_error && !hasUsableLocalData) {
    return {
      status: 'error',
      statusText: '同步错误',
      needsSync: true,
      issues: [syncStatus.last_sync_error],
    };
  }

  if (recordCount === 0) {
    issues.push('需要同步数据');
    return {
      status: 'missing',
      statusText: '无数据',
      needsSync,
      issues,
    };
  }

  return {
    status,
    statusText,
    needsSync,
    issues,
  };
}
