import test from 'node:test';
import assert from 'node:assert/strict';

const { getAnalysisLoadingStageMeta } = await import(
  new URL('../src/lib/analysis-loading-stage.ts', import.meta.url).href
);

test('checking stage should map to deterministic integrity-check progress', () => {
  const result = getAnalysisLoadingStageMeta('checking');

  assert.equal(result.progress, 15);
  assert.equal(result.title, '正在检查数据完整性...');
  assert.match(result.detail, /完整性/);
});

test('requesting-analysis stage should map to real analysis progress instead of timer creep', () => {
  const result = getAnalysisLoadingStageMeta('requesting-analysis');

  assert.equal(result.progress, 72);
  assert.equal(result.title, '正在执行三位一体技术分析...');
  assert.match(result.detail, /周线/);
});

test('finalizing stage should stay near completion without pretending to reach 98 percent', () => {
  const result = getAnalysisLoadingStageMeta('finalizing');

  assert.equal(result.progress, 92);
  assert.equal(result.title, '正在整理分析结果...');
  assert.match(result.detail, /结果/);
});
