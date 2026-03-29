import test from 'node:test';
import assert from 'node:assert/strict';

const {
  collectFailedSyncLogs,
  formatPrepareAnalysisFailureMessage,
  buildPrepareAnalysisPayload,
} = await import(
  new URL('../src/lib/prepare-analysis-response.ts', import.meta.url).href
);

test('collectFailedSyncLogs keeps frequency-scoped failure messages', () => {
  const result = collectFailedSyncLogs([
    { frequency: '30', success: false, message: 'Command failed: python3 scripts/stock_data_sync.py ... 30' },
    { frequency: '15', success: true, message: '同步完成，新增 200 条记录' },
    { frequency: '60', success: false, message: '同步繁忙，请稍后重试' },
  ]);

  assert.deepEqual(result, [
    { frequency: '30', message: 'Command failed: python3 scripts/stock_data_sync.py ... 30' },
    { frequency: '60', message: '同步繁忙，请稍后重试' },
  ]);
});

test('formatPrepareAnalysisFailureMessage renders readable details for UI', () => {
  const result = formatPrepareAnalysisFailureMessage([
    { frequency: '30', success: false, message: 'Command failed: python3 scripts/stock_data_sync.py ... 30' },
    { frequency: '60', success: false, message: '同步繁忙，请稍后重试' },
  ]);

  assert.equal(
    result,
    '数据同步失败: 30: Command failed: python3 scripts/stock_data_sync.py ... 30；60: 同步繁忙，请稍后重试'
  );
});

test('buildPrepareAnalysisPayload attaches bootstrap data when analysis is ready', () => {
  const result = buildPrepareAnalysisPayload({
    ready: true,
    code: '300274',
    phase: 'ready',
    summary: {
      canAnalyze: true,
      overallText: '数据完整，可以分析',
      analyzeWarning: null,
      needsSyncLevels: [],
    },
    levels: [],
    integrity: {
      code: '300274',
      levels: [],
      baostockLatestDate: '2026-03-27',
      currentTime: '2026-03-29',
      isWeekend: true,
      summary: {
        overallStatus: 'ok',
        overallText: '数据完整，可以分析',
        okCount: 5,
        staleCount: 0,
        missingCount: 0,
        errorCount: 0,
        pendingCount: 0,
        totalLevels: 5,
        needsSyncLevels: [],
        canAnalyze: true,
        analyzeWarning: null,
      },
    },
    syncResults: null,
    retries: 0,
    analysisData: {
      stock_code: '300274',
      stock_name: '阳光电源',
      analysis_time: '2026-03-29 21:00:00',
      analyzed_levels: ['weekly'],
      periods: {},
      level_nesting: { summary: '' },
      multi_dimension_operation: {},
    },
    stockInfo: {
      code: '300274',
      name: '阳光电源',
    },
  });

  assert.equal(result.ready, true);
  assert.equal(result.bootstrap?.stockInfo?.name, '阳光电源');
  assert.equal(result.bootstrap?.analysisData?.stock_code, '300274');
});
