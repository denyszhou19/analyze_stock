import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const pageSource = await fs.readFile('src/app/stock/[code]/analysis/page.tsx', 'utf8');

test('analysis page composes the confirmed IA sections', () => {
  assert.match(pageSource, /AnalysisSummaryPanel/);
  assert.match(pageSource, /AiFollowupPanel/);
  assert.match(pageSource, /TradingCycleBus/);
  assert.match(pageSource, /AnalysisPeriodDetails/);
  assert.match(pageSource, /parseAiReportContract/);
  assert.match(pageSource, /pageViewModel\.tradingCombinations/);
  assert.doesNotMatch(pageSource, /LevelDecisionBus/);
  assert.doesNotMatch(pageSource, /TrinityRuleChain/);
  assert.doesNotMatch(pageSource, /StructureExplainabilityPanel/);
  assert.doesNotMatch(pageSource, /<AnalysisStatusBar/);
});

test('analysis page keeps AI summary panel before follow-up panel', () => {
  const summaryIndex = pageSource.indexOf('<AnalysisSummaryPanel');
  const busIndex = pageSource.indexOf('<TradingCycleBus');
  const periodIndex = pageSource.indexOf('<AnalysisPeriodDetails');
  const followupIndex = pageSource.indexOf('<AiFollowupPanel');
  const markdownIndex = pageSource.indexOf('AI 正文');

  assert.notEqual(summaryIndex, -1);
  assert.notEqual(busIndex, -1);
  assert.notEqual(periodIndex, -1);
  assert.ok(summaryIndex < busIndex);
  assert.ok(busIndex < periodIndex);
  if (followupIndex !== -1) {
    assert.ok(periodIndex < followupIndex);
  }
  assert.ok(markdownIndex === -1 || busIndex < markdownIndex);
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
  assert.match(pageSource, /markdown: normalizeVisibleDecisionText\(followupPayload\.markdown\),/);
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

test('analysis page exposes a sticky in-page navigation for the main analysis sections', () => {
  assert.match(pageSource, /sticky top-3/);
  assert.match(pageSource, /结论总览/);
  assert.match(pageSource, /交易总线/);
  assert.match(pageSource, /周期详情/);
  assert.match(pageSource, /id="analysis-summary"/);
  assert.match(pageSource, /id="analysis-bus"/);
  assert.match(pageSource, /id="analysis-periods"/);
});

test('analysis page sticky navigation tracks the active section and avoids hollow pills', () => {
  assert.match(pageSource, /const \[activeSectionId, setActiveSectionId\] = useState<string>\('analysis-summary'\);/);
  assert.match(pageSource, /new IntersectionObserver\(/);
  assert.match(pageSource, /aria-current=\{item\.id === activeSectionId \? 'page' : undefined\}/);
  assert.match(pageSource, /data-active=\{item\.id === activeSectionId \? 'true' : 'false'\}/);
  assert.doesNotMatch(
    pageSource,
    /className="whitespace-nowrap rounded-lg border border-border\/70 bg-background\/80 px-3 py-1\.5 text-sm text-muted-foreground transition-colors hover:border-foreground\/20 hover:text-foreground"/
  );
});
