import test from 'node:test';
import assert from 'node:assert/strict';

const { evaluateIntegrityLevelStatus } = await import(
  new URL('../src/lib/stock-data-integrity.ts', import.meta.url).href
);

const baseLevel = {
  key: '30',
  name: '30分钟',
  icon: '⏰',
  minRecords: 233,
  description: '短线交易级别，需满足MA233',
};

test('fresh and sufficient data should stay ok even if last sync failed previously', () => {
  const result = evaluateIntegrityLevelStatus({
    level: baseLevel,
    recordCount: 1600,
    expectedRecords: 1000,
    lastDateStr: '2026-03-27',
    freshnessResult: {
      isFresh: true,
      reason: '数据最新',
    },
    syncStatus: {
      sync_status: 'failed',
      last_sync_error: 'Command failed: python3 scripts/stock_data_sync.py ...',
    },
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.needsSync, false);
  assert.deepEqual(result.issues, []);
});

test('failed sync should remain error when local data is not yet usable', () => {
  const result = evaluateIntegrityLevelStatus({
    level: baseLevel,
    recordCount: 120,
    expectedRecords: 1000,
    lastDateStr: '2026-03-20',
    freshnessResult: {
      isFresh: false,
      reason: '30分钟过期 (2026-03-20 < 2026-03-27)',
    },
    syncStatus: {
      sync_status: 'failed',
      last_sync_error: 'Command failed: python3 scripts/stock_data_sync.py ...',
    },
  });

  assert.equal(result.status, 'error');
  assert.equal(result.statusText, '同步错误');
  assert.equal(result.needsSync, true);
  assert.match(result.issues[0], /Command failed/);
});
