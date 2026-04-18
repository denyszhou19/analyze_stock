import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const pageSource = await fs.readFile('src/app/stock/[code]/analysis/page.tsx', 'utf8');

test('analysis page composes the confirmed IA sections', () => {
  assert.match(pageSource, /AnalysisStatusBar/);
  assert.match(pageSource, /AnalysisSummaryPanel/);
  assert.match(pageSource, /LevelDecisionBus/);
  assert.match(pageSource, /TrinityRuleChain/);
  assert.match(pageSource, /AnalysisPeriodDetails/);
  assert.match(pageSource, /parseAiReportContract/);
});

test('analysis page keeps decision bus directly after summary panel', () => {
  const summaryIndex = pageSource.indexOf('<AnalysisSummaryPanel');
  const busIndex = pageSource.indexOf('<LevelDecisionBus');
  const markdownIndex = pageSource.indexOf('AI 正文');

  assert.notEqual(summaryIndex, -1);
  assert.notEqual(busIndex, -1);
  assert.ok(summaryIndex < busIndex);
  assert.ok(markdownIndex === -1 || busIndex < markdownIndex);
});

test('analysis page no longer keeps old first-screen duplicate sections', () => {
  assert.doesNotMatch(pageSource, /AI 智能分析报告/);
  assert.doesNotMatch(pageSource, /多维度跨级别操作建议/);
  assert.doesNotMatch(pageSource, /当前分析窗口/);
  assert.doesNotMatch(pageSource, /周期详情补充/);
});
