import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const mainRouteSource = await fs.readFile('src/app/api/stock/ai-analysis/route.ts', 'utf8');

test('ai-analysis route source upgrades phase3 output contract and session snapshot response', () => {
  assert.match(mainRouteSource, /judgment/);
  assert.match(mainRouteSource, /critical_reason/);
  assert.match(mainRouteSource, /spacetime_summary/);
  assert.match(mainRouteSource, /structure_summary/);
  assert.match(mainRouteSource, /execution_summary/);
  assert.match(mainRouteSource, /candidate_structure/);
  assert.match(mainRouteSource, /wait_state/);
  assert.match(mainRouteSource, /judgment_warning/);
  assert.match(mainRouteSource, /当前综合判断/);
  assert.match(mainRouteSource, /时空怎么看/);
  assert.match(mainRouteSource, /结构怎么看/);
  assert.match(mainRouteSource, /现在怎么做/);
  assert.match(mainRouteSource, /风险与应对/);
  assert.match(mainRouteSource, /runCodexStrategyAnalysisWithSession/);
  assert.match(mainRouteSource, /snapshotKey/);
  assert.match(mainRouteSource, /session/);
});

const mainRouteModule = await import(
  new URL('../src/app/api/stock/ai-analysis/route.ts', import.meta.url).href
);
const followUpRouteModule = await import(
  new URL('../src/app/api/stock/ai-analysis/follow-up/route.ts', import.meta.url).href
);

const { buildAnalysisSnapshotKey } = mainRouteModule;
const { POST, buildAiFollowUpPrompt, followUpRouteDependencies } = followUpRouteModule;

test('buildAnalysisSnapshotKey stays stable for equivalent payloads', () => {
  const left = buildAnalysisSnapshotKey('600000', {
    meta: {
      code: '600000',
      name: '浦发银行',
    },
    periods: [
      {
        name: 'day',
        action: 'wait',
      },
    ],
  });

  const right = buildAnalysisSnapshotKey('600000', {
    periods: [
      {
        action: 'wait',
        name: 'day',
      },
    ],
    meta: {
      name: '浦发银行',
      code: '600000',
    },
  });

  const changed = buildAnalysisSnapshotKey('600000', {
    meta: {
      code: '600000',
      name: '浦发银行',
    },
    periods: [
      {
        name: 'day',
        action: 'buy',
      },
    ],
  });

  assert.equal(left, right);
  assert.notEqual(left, changed);
});

test('buildAiFollowUpPrompt binds resume answer to snapshot and markdown-only boundary', () => {
  const prompt = buildAiFollowUpPrompt({
    snapshotKey: 'snapshot-1',
    question: '现在最关键要看什么确认条件？',
  });

  assert.match(prompt, /snapshot-1/);
  assert.match(prompt, /基于当前会话继续回答/);
  assert.match(prompt, /只输出 Markdown/);
  assert.match(prompt, /若X则可升级|若满足条件则可升级/);
  assert.match(prompt, /不能直接改写后端正式动作边界/);
});

test('follow-up route returns 400 when required params are missing', async () => {
  const response = await POST(
    new Request('http://localhost/api/stock/ai-analysis/follow-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session-1',
        question: '',
      }),
    }) as never
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'sessionId、snapshotKey、question 为必填项',
  });
});

test('follow-up route resumes codex session and returns markdown only', async (t) => {
  const originalResume = followUpRouteDependencies.resumeCodexStrategyAnalysis;

  t.after(() => {
    followUpRouteDependencies.resumeCodexStrategyAnalysis = originalResume;
  });

  let capturedOptions:
    | {
        sessionId: string;
        systemPrompt: string;
        userPrompt: string;
        timeoutMs?: number;
        configOverrides?: string[];
      }
    | undefined;

  followUpRouteDependencies.resumeCodexStrategyAnalysis = async (options) => {
    capturedOptions = options;

    return [
      '```json',
      JSON.stringify({
        headline: '旧摘要',
      }),
      '```',
      '',
      '# 追问回答',
      '',
      '- 继续观察30分钟止跌确认',
    ].join('\n');
  };

  const response = await POST(
    new Request('http://localhost/api/stock/ai-analysis/follow-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session-1',
        snapshotKey: 'snapshot-1',
        question: '现在最关键要看什么确认条件？',
      }),
    }) as never
  );

  assert.equal(response.status, 200);
  assert.equal(capturedOptions?.sessionId, 'session-1');
  assert.match(capturedOptions?.userPrompt || '', /snapshot-1/);
  assert.match(capturedOptions?.userPrompt || '', /现在最关键要看什么确认条件/);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      markdown: '# 追问回答\n\n- 继续观察30分钟止跌确认',
    },
  });
});
