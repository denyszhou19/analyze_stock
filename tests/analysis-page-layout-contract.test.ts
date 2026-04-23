import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const pageSource = await fs.readFile('src/app/stock/[code]/analysis/page.tsx', 'utf8');

test('analysis page composes the confirmed IA sections', () => {
  assert.match(pageSource, /AnalysisSummaryPanel/);
  assert.match(pageSource, /AiFollowupPanel/);
  assert.match(pageSource, /TradingCycleBus/);
  assert.match(pageSource, /TrinityRuleChain/);
  assert.match(pageSource, /AnalysisPeriodDetails/);
  assert.match(pageSource, /parseAiReportContract/);
  assert.match(pageSource, /pageViewModel\.tradingCombinations/);
  assert.doesNotMatch(pageSource, /LevelDecisionBus/);
  assert.doesNotMatch(pageSource, /StructureExplainabilityPanel/);
  assert.doesNotMatch(pageSource, /<AnalysisStatusBar/);
});

test('analysis page keeps AI summary panel before follow-up panel', () => {
  const summaryIndex = pageSource.indexOf('<AnalysisSummaryPanel');
  const followupIndex = pageSource.indexOf('<AiFollowupPanel');
  const busIndex = pageSource.indexOf('<TradingCycleBus');
  const markdownIndex = pageSource.indexOf('AI 正文');

  assert.notEqual(summaryIndex, -1);
  assert.notEqual(followupIndex, -1);
  assert.notEqual(busIndex, -1);
  assert.ok(summaryIndex < followupIndex);
  assert.ok(followupIndex < busIndex);
  assert.ok(markdownIndex === -1 || followupIndex < markdownIndex);
});

test('analysis page stores ai follow-up session and turn state', () => {
  assert.match(
    pageSource,
    /const \[aiSession, setAiSession\] = useState<\{ sessionId: string; snapshotKey: string \} \| null>\(null\);/
  );
  assert.match(pageSource, /const \[aiFollowupDraft, setAiFollowupDraft\] = useState\(''\);/);
  assert.match(pageSource, /const \[aiFollowupLoading, setAiFollowupLoading\] = useState\(false\);/);
  assert.match(pageSource, /const \[aiFollowupTurns, setAiFollowupTurns\] = useState/);
  assert.match(pageSource, /fetch\('\/api\/stock\/ai-analysis\/follow-up'/);
  assert.match(pageSource, /sessionId: aiSession\.sessionId/);
  assert.match(pageSource, /snapshotKey: aiSession\.snapshotKey/);
});

test('analysis page narrows follow-up payload before reading markdown', () => {
  assert.match(pageSource, /const followupPayload = data\.data;/);
  assert.match(pageSource, /if \(!data\.success \|\| !followupPayload\?\.markdown\)/);
  assert.match(pageSource, /markdown: followupPayload\.markdown,/);
});

test('analysis page guards AI summary writes behind its own run id and invalidates stale requests', () => {
  assert.match(pageSource, /const aiSummaryRunGuardRef = useRef\(createRequestRunGuard\(\)\);/);
  assert.match(pageSource, /const aiSummaryRunId = beginRequestRun\(aiSummaryRunGuardRef\.current\);/);
  assert.match(pageSource, /if \(!isCurrentRequestRun\(aiSummaryRunGuardRef\.current, aiSummaryRunId\)\) \{\s*return;\s*\}/);
  assert.match(pageSource, /if \(isCurrentRequestRun\(aiSummaryRunGuardRef\.current, aiSummaryRunId\)\) \{\s*setAiMarkdown\(parsed\.markdown\);/);
  assert.match(pageSource, /setAiState\(\{\s*status: 'ready',/);
  assert.match(pageSource, /setAiSession\(\{\s*sessionId: aiPayload\.session\.sessionId,/);
  assert.match(pageSource, /invalidateRequestRun\(aiSummaryRunGuardRef\.current\);/);
});

test('analysis page no longer keeps old first-screen duplicate sections', () => {
  assert.doesNotMatch(pageSource, /AI 智能分析报告/);
  assert.doesNotMatch(pageSource, /多维度跨级别操作建议/);
  assert.doesNotMatch(pageSource, /当前分析窗口/);
  assert.doesNotMatch(pageSource, /周期详情补充/);
});
