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
  assert.match(
    mainRouteSource,
    /candidate_structure\s*\/\s*wait_state\s*\/\s*judgment_warning[\s\S]*有则按约定输出|candidate_structure[\s\S]*wait_state[\s\S]*judgment_warning[\s\S]*有则按约定输出/
  );
  assert.match(mainRouteSource, /当前综合判断/);
  assert.match(mainRouteSource, /时空怎么看/);
  assert.match(mainRouteSource, /结构怎么看/);
  assert.match(mainRouteSource, /现在怎么做/);
  assert.match(mainRouteSource, /风险与应对/);
  assert.match(mainRouteSource, /不能直接改写后端当前正式动作/);
  assert.match(mainRouteSource, /若\s*X\s*则可升级|若.*则可升级|条件升级预案/);
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
const sessionBindingModule = await import(
  new URL('../src/app/api/stock/ai-analysis/session-store.ts', import.meta.url).href
);

const {
  POST: mainRoutePost,
} = mainRouteModule;
const {
  POST: followUpRoutePost,
} = followUpRouteModule;
const {
  bindAiAnalysisSessionSnapshot,
  clearAiAnalysisSessionSnapshots,
  getAiAnalysisSessionBinding,
  getAiAnalysisSnapshotForSession,
} = sessionBindingModule;

interface MainRouteRunOptions {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
  configOverrides?: string[];
}

interface FollowUpResumeOptions {
  sessionId: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
  configOverrides?: string[];
}

type MainRouteDependencies = {
  buildAiDecisionPayload: (analysisData: unknown) => Record<string, unknown>;
  runCodexStrategyAnalysisWithSession: (
    options: MainRouteRunOptions
  ) => Promise<{ report: string; session?: { sessionId: string } }>;
  bindAiAnalysisSessionSnapshot: (
    sessionId: string,
    bindingInput: { code: string; snapshotKey: string }
  ) => void;
};

type MainRouteModuleWithHooks = typeof mainRouteModule & {
  POST: typeof mainRoutePost & {
    aiAnalysisRouteDependencies: MainRouteDependencies;
    buildAnalysisSnapshotKey: (code: string, payload: unknown) => string;
  };
};

type FollowUpRouteModuleWithHooks = typeof followUpRouteModule & {
  POST: typeof followUpRoutePost & {
    buildAiFollowUpPrompt: (options: {
      snapshotKey: string;
      question: string;
    }) => string;
    followUpRouteDependencies: {
      resumeCodexStrategyAnalysis: (
        options: FollowUpResumeOptions
      ) => Promise<string>;
      getAiAnalysisSessionBinding: (
        sessionId: string
      ) => ReturnType<typeof getAiAnalysisSessionBinding>;
    };
  };
};

const mainRouteHooks = (mainRouteModule as MainRouteModuleWithHooks).POST.aiAnalysisRouteDependencies;
const buildAnalysisSnapshotKey = (mainRouteModule as MainRouteModuleWithHooks).POST.buildAnalysisSnapshotKey;
const followUpRouteHooks = (followUpRouteModule as FollowUpRouteModuleWithHooks).POST.followUpRouteDependencies;
const buildAiFollowUpPrompt = (followUpRouteModule as FollowUpRouteModuleWithHooks).POST.buildAiFollowUpPrompt;

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

test('main route returns report session snapshot metadata and stores snapshot binding', async (t) => {
  const dependencies = mainRouteHooks as MainRouteDependencies;
  const originalBuildPayload = dependencies.buildAiDecisionPayload;
  const originalRunAnalysis = dependencies.runCodexStrategyAnalysisWithSession;

  t.after(() => {
    dependencies.buildAiDecisionPayload = originalBuildPayload;
    dependencies.runCodexStrategyAnalysisWithSession = originalRunAnalysis;
    clearAiAnalysisSessionSnapshots();
  });

  clearAiAnalysisSessionSnapshots();

  const stubPayload = {
    stock_name: '浦发银行',
    analysis_time: '2026-04-23T10:00:00.000Z',
    periods: {
      day: {
        deterministic_decision: {
          conclusion: {
            action: 'wait',
          },
        },
      },
    },
    key_alerts: ['等待确认'],
  };

  let capturedOptions: MainRouteRunOptions | undefined;

  dependencies.buildAiDecisionPayload = () => stubPayload;
  dependencies.runCodexStrategyAnalysisWithSession = async (
    options: MainRouteRunOptions
  ) => {
    capturedOptions = options;

    return {
      report: '```json\n{"headline":"等待确认"}\n```\n\n# 当前综合判断\n\n- 继续观察',
      session: { sessionId: 'session-main-1' },
    };
  };

  const response = await mainRoutePost(
    new Request('http://localhost/api/stock/ai-analysis', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        code: '600000',
        analysisData: {
          anything: true,
        },
      }),
    }) as never
  );

  assert.equal(response.status, 200);
  assert.ok(capturedOptions);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.code, '600000');
  assert.equal(payload.data.report, '```json\n{"headline":"等待确认"}\n```\n\n# 当前综合判断\n\n- 继续观察');
  assert.deepEqual(payload.data.session, { sessionId: 'session-main-1' });
  assert.equal(
    payload.data.snapshotKey,
    buildAnalysisSnapshotKey('600000', stubPayload)
  );
  assert.equal(
    getAiAnalysisSnapshotForSession('session-main-1'),
    payload.data.snapshotKey
  );
  const binding = getAiAnalysisSessionBinding('session-main-1');
  assert.deepEqual(binding, {
    sessionId: 'session-main-1',
    code: '600000',
    snapshotKey: payload.data.snapshotKey,
    createdAt: binding?.createdAt,
    updatedAt: binding?.updatedAt,
  });
  assert.match(payload.data.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('main route succeeds when codex returns report without session id', async (t) => {
  const dependencies = mainRouteHooks as MainRouteDependencies;
  const originalBuildPayload = dependencies.buildAiDecisionPayload;
  const originalRunAnalysis = dependencies.runCodexStrategyAnalysisWithSession;
  const originalBindSnapshot = dependencies.bindAiAnalysisSessionSnapshot;

  t.after(() => {
    dependencies.buildAiDecisionPayload = originalBuildPayload;
    dependencies.runCodexStrategyAnalysisWithSession = originalRunAnalysis;
    dependencies.bindAiAnalysisSessionSnapshot = originalBindSnapshot;
    clearAiAnalysisSessionSnapshots();
  });

  clearAiAnalysisSessionSnapshots();

  dependencies.buildAiDecisionPayload = () => ({
    stock_name: '浦发银行',
    analysis_time: '2026-04-23T10:00:00.000Z',
  });
  dependencies.runCodexStrategyAnalysisWithSession = async () => ({
    report: '# 主报告\n- session 缺失也应成功',
  });

  let boundSnapshotCalls = 0;
  dependencies.bindAiAnalysisSessionSnapshot = () => {
    boundSnapshotCalls += 1;
  };

  const response = await mainRoutePost(
    new Request('http://localhost/api/stock/ai-analysis', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        code: '600000',
        analysisData: {
          anything: true,
        },
      }),
    }) as never
  );

  assert.equal(response.status, 200);
  assert.equal(boundSnapshotCalls, 0);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.report, '# 主报告\n- session 缺失也应成功');
  assert.equal(payload.data.session, undefined);
});

test('follow-up route returns 400 when required params are missing', async () => {
  const response = await followUpRoutePost(
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

test('follow-up route rejects snapshot keys that are not bound to the session', async (t) => {
  t.after(() => {
    clearAiAnalysisSessionSnapshots();
  });

  clearAiAnalysisSessionSnapshots();
  bindAiAnalysisSessionSnapshot('session-1', {
    code: '600000',
    snapshotKey: 'snapshot-bound',
  });

  const response = await followUpRoutePost(
    new Request('http://localhost/api/stock/ai-analysis/follow-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session-1',
        snapshotKey: 'snapshot-other',
        question: '现在最关键要看什么确认条件？',
      }),
    }) as never
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'snapshotKey 与会话绑定不匹配',
  });
});

test('follow-up route resumes codex session and returns markdown only', async (t) => {
  const originalResume = followUpRouteHooks.resumeCodexStrategyAnalysis;

  t.after(() => {
    followUpRouteHooks.resumeCodexStrategyAnalysis = originalResume;
    clearAiAnalysisSessionSnapshots();
  });

  clearAiAnalysisSessionSnapshots();
  bindAiAnalysisSessionSnapshot('session-1', {
    code: '600000',
    snapshotKey: 'snapshot-1',
  });

  let capturedOptions: FollowUpResumeOptions | undefined;

  followUpRouteHooks.resumeCodexStrategyAnalysis = async (
    options: FollowUpResumeOptions
  ) => {
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

  const response = await followUpRoutePost(
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

test('follow-up route fails when codex returns only a json block without markdown', async (t) => {
  const originalResume = followUpRouteHooks.resumeCodexStrategyAnalysis;

  t.after(() => {
    followUpRouteHooks.resumeCodexStrategyAnalysis = originalResume;
    clearAiAnalysisSessionSnapshots();
  });

  clearAiAnalysisSessionSnapshots();
  bindAiAnalysisSessionSnapshot('session-json-only', {
    code: '600000',
    snapshotKey: 'snapshot-json-only',
  });

  followUpRouteHooks.resumeCodexStrategyAnalysis = async () =>
    '```json\n{"headline":"只有摘要"}\n```';

  const response = await followUpRoutePost(
    new Request('http://localhost/api/stock/ai-analysis/follow-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session-json-only',
        snapshotKey: 'snapshot-json-only',
        question: '继续分析',
      }),
    }) as never
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'AI 追问未返回 Markdown',
  });
});

test('follow-up route fails when codex returns raw json without markdown', async (t) => {
  const originalResume = followUpRouteHooks.resumeCodexStrategyAnalysis;

  t.after(() => {
    followUpRouteHooks.resumeCodexStrategyAnalysis = originalResume;
    clearAiAnalysisSessionSnapshots();
  });

  clearAiAnalysisSessionSnapshots();
  bindAiAnalysisSessionSnapshot('session-raw-json', {
    code: '600000',
    snapshotKey: 'snapshot-raw-json',
  });

  followUpRouteHooks.resumeCodexStrategyAnalysis = async () =>
    '{"headline":"只有原始 JSON"}';

  const response = await followUpRoutePost(
    new Request('http://localhost/api/stock/ai-analysis/follow-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session-raw-json',
        snapshotKey: 'snapshot-raw-json',
        question: '继续分析',
      }),
    }) as never
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'AI 追问返回了纯 JSON 内容',
  });
});

test('session store keeps binding metadata for session code snapshot and timestamps', () => {
  clearAiAnalysisSessionSnapshots();

  bindAiAnalysisSessionSnapshot('session-meta', {
    code: '600000',
    snapshotKey: 'snapshot-meta',
  });

  const binding = getAiAnalysisSessionBinding('session-meta');

  assert.equal(binding?.sessionId, 'session-meta');
  assert.equal(binding?.code, '600000');
  assert.equal(binding?.snapshotKey, 'snapshot-meta');
  assert.match(binding?.createdAt || '', /^\d{4}-\d{2}-\d{2}T/);
  assert.match(binding?.updatedAt || '', /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(binding?.createdAt, binding?.updatedAt);
});
