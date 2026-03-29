export interface SyncStatusFreshnessResult {
  isFresh: boolean;
  reason: string;
}

export interface SyncStatusItem {
  code: string;
  frequency: string;
  lastSyncDate: string | null;
  lastSyncAt: string | null;
  recordCount: number;
  syncType: string;
  syncStatus: string;
  lastSyncError: string | null;
  retryCount: number;
  rawSyncStatus?: string;
  resolvedFromLocalData?: boolean;
}

export interface SyncStatusSummary {
  total: number;
  failed: number;
  syncing: number;
  success: number;
  pending: number;
}

export interface SyncStatusResponse {
  success: boolean;
  data: SyncStatusItem[];
  summary: SyncStatusSummary;
  hasErrors: boolean;
  errorCodes: string[];
}

export interface RawSyncStatusRecord {
  sync_status?: string | null;
  last_sync_error?: string | null;
}

export interface ResolveEffectiveSyncStatusParams {
  frequency: string;
  recordCount: number;
  minRecords: number;
  freshnessResult?: SyncStatusFreshnessResult | null;
  syncStatus?: RawSyncStatusRecord | null;
}

export interface EffectiveSyncStatusResult {
  syncStatus: 'success' | 'failed' | 'syncing' | 'pending';
  lastSyncError: string | null;
  hasError: boolean;
  resolvedFromLocalData: boolean;
  rawSyncStatus: string;
}

export interface SyncStatusPresentation {
  variant: 'hidden' | 'syncing' | 'error';
  errorItems: SyncStatusItem[];
  syncingItems: SyncStatusItem[];
}

const REQUIRED_FREQUENCIES = new Set(['w', 'd', '60', '30', '15']);

export function resolveEffectiveSyncStatus({
  recordCount,
  minRecords,
  freshnessResult,
  syncStatus,
}: ResolveEffectiveSyncStatusParams): EffectiveSyncStatusResult {
  const rawSyncStatus = syncStatus?.sync_status || 'pending';
  const rawLastSyncError = syncStatus?.last_sync_error || null;
  const hasUsableLocalData = recordCount >= minRecords && freshnessResult?.isFresh === true;

  if (rawSyncStatus === 'syncing') {
    return {
      syncStatus: 'syncing',
      lastSyncError: null,
      hasError: false,
      resolvedFromLocalData: false,
      rawSyncStatus,
    };
  }

  if (hasUsableLocalData) {
    return {
      syncStatus: 'success',
      lastSyncError: null,
      hasError: false,
      resolvedFromLocalData: rawSyncStatus === 'failed' || rawSyncStatus === 'pending',
      rawSyncStatus,
    };
  }

  if (rawSyncStatus === 'failed') {
    return {
      syncStatus: 'failed',
      lastSyncError: rawLastSyncError,
      hasError: true,
      resolvedFromLocalData: false,
      rawSyncStatus,
    };
  }

  return {
    syncStatus: rawSyncStatus === 'success' ? 'success' : 'pending',
    lastSyncError: null,
    hasError: false,
    resolvedFromLocalData: false,
    rawSyncStatus,
  };
}

export function resolveSyncStatusPresentation(
  syncStatus: SyncStatusResponse & { code?: string },
  code?: string
): SyncStatusPresentation {
  const targetCode = code ?? syncStatus.code;
  const relevantItems = syncStatus.data.filter(item => {
    if (targetCode && item.code !== targetCode) {
      return false;
    }

    return REQUIRED_FREQUENCIES.has(item.frequency);
  });

  const errorItems = relevantItems.filter(item => item.syncStatus === 'failed');
  const syncingItems = relevantItems.filter(item => item.syncStatus === 'syncing');

  if (syncingItems.length > 0) {
    return {
      variant: 'syncing',
      errorItems,
      syncingItems,
    };
  }

  if (errorItems.length > 0) {
    return {
      variant: 'error',
      errorItems,
      syncingItems,
    };
  }

  return {
    variant: 'hidden',
    errorItems,
    syncingItems,
  };
}
