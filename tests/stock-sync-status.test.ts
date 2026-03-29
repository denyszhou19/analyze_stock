import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveEffectiveSyncStatus } = await import(
  new URL('../src/lib/stock-sync-status.ts', import.meta.url).href
);

test('failed sync should be resolved when local data is already fresh and sufficient', () => {
  const result = resolveEffectiveSyncStatus({
    frequency: '30',
    recordCount: 1600,
    minRecords: 233,
    freshnessResult: {
      isFresh: true,
      reason: '数据最新',
    },
    syncStatus: {
      sync_status: 'failed',
      last_sync_error: 'Command failed: python3 scripts/stock_data_sync.py ...',
    },
  });

  assert.equal(result.syncStatus, 'success');
  assert.equal(result.lastSyncError, null);
  assert.equal(result.hasError, false);
  assert.equal(result.resolvedFromLocalData, true);
});

test('failed sync should stay failed when local data is stale or insufficient', () => {
  const result = resolveEffectiveSyncStatus({
    frequency: '30',
    recordCount: 120,
    minRecords: 233,
    freshnessResult: {
      isFresh: false,
      reason: '30分钟过期 (2026-03-20 < 2026-03-27)',
    },
    syncStatus: {
      sync_status: 'failed',
      last_sync_error: 'Command failed: python3 scripts/stock_data_sync.py ...',
    },
  });

  assert.equal(result.syncStatus, 'failed');
  assert.equal(result.lastSyncError, 'Command failed: python3 scripts/stock_data_sync.py ...');
  assert.equal(result.hasError, true);
  assert.equal(result.resolvedFromLocalData, false);
});

test('syncing state should stay syncing while a live sync is in progress', () => {
  const result = resolveEffectiveSyncStatus({
    frequency: '15',
    recordCount: 1600,
    minRecords: 233,
    freshnessResult: {
      isFresh: true,
      reason: '数据最新',
    },
    syncStatus: {
      sync_status: 'syncing',
      last_sync_error: null,
    },
  });

  assert.equal(result.syncStatus, 'syncing');
  assert.equal(result.hasError, false);
  assert.equal(result.resolvedFromLocalData, false);
});
