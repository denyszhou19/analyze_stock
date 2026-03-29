import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveSyncStatusPresentation } = await import(
  new URL('../src/lib/stock-sync-status.ts', import.meta.url).href
);

test('resolveSyncStatusPresentation prefers active syncing over stale failures', () => {
  const result = resolveSyncStatusPresentation({
    code: '300274',
    data: [
      {
        code: '300274',
        frequency: '30',
        lastSyncDate: '2026-03-27',
        lastSyncAt: '2026-03-29T12:47:14.497',
        recordCount: 920,
        syncType: 'full',
        syncStatus: 'syncing',
        lastSyncError: null,
        retryCount: 0,
      },
      {
        code: '300274',
        frequency: '15',
        lastSyncDate: '2026-03-27',
        lastSyncAt: '2026-03-29T12:47:22.793',
        recordCount: 912,
        syncType: 'full',
        syncStatus: 'failed',
        lastSyncError: '同步繁忙，请稍后重试',
        retryCount: 1,
      },
    ],
    summary: {
      total: 2,
      failed: 1,
      syncing: 1,
      success: 0,
      pending: 0,
    },
    hasErrors: true,
    errorCodes: ['300274'],
  });

  assert.equal(result.variant, 'syncing');
  assert.equal(result.syncingItems.length, 1);
  assert.equal(result.errorItems.length, 1);
});

test('resolveSyncStatusPresentation filters to required frequencies and current code', () => {
  const result = resolveSyncStatusPresentation({
    code: '300274',
    data: [
      {
        code: '300274',
        frequency: '5',
        lastSyncDate: null,
        lastSyncAt: null,
        recordCount: 0,
        syncType: 'unknown',
        syncStatus: 'failed',
        lastSyncError: '5分钟失败',
        retryCount: 1,
      },
      {
        code: '300274',
        frequency: '30',
        lastSyncDate: '2026-03-27',
        lastSyncAt: '2026-03-29T12:47:14.497',
        recordCount: 920,
        syncType: 'full',
        syncStatus: 'failed',
        lastSyncError: '30分钟失败',
        retryCount: 1,
      },
      {
        code: '600000',
        frequency: '30',
        lastSyncDate: '2026-03-27',
        lastSyncAt: '2026-03-29T12:47:14.497',
        recordCount: 920,
        syncType: 'full',
        syncStatus: 'failed',
        lastSyncError: '其他股票失败',
        retryCount: 1,
      },
    ],
    summary: {
      total: 3,
      failed: 3,
      syncing: 0,
      success: 0,
      pending: 0,
    },
    hasErrors: true,
    errorCodes: ['300274', '600000'],
  });

  assert.equal(result.variant, 'error');
  assert.deepEqual(
    result.errorItems.map((item: { frequency: string }) => item.frequency),
    ['30']
  );
});
