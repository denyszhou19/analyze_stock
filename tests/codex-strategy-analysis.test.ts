import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  buildCodexExecArgs,
  buildCodexExecResumeArgs,
  buildCodexExecPrompt,
  extractCodexSessionIdFromJsonl,
  formatCodexExecFailure,
  runCodexStrategyAnalysis,
  runCodexStrategyAnalysisWithSession,
  resumeCodexStrategyAnalysis,
} = await import(
  new URL('../src/lib/codex-strategy-analysis.ts', import.meta.url).href
);

test('buildCodexExecPrompt keeps system and user prompts in one stdin payload', () => {
  const prompt = buildCodexExecPrompt('SYSTEM_PROMPT', 'USER_PROMPT');

  assert.match(prompt, /SYSTEM_PROMPT/);
  assert.match(prompt, /USER_PROMPT/);
  assert.match(prompt, /系统指令/);
  assert.match(prompt, /用户任务/);
  assert.match(prompt, /先输出 JSON 摘要/);
  assert.match(prompt, /再输出 Markdown 正文/);
});

test('ai-analysis route prompt enforces deterministic_decision hard boundary for summary action', () => {
  const routeSource = readFileSync(
    new URL('../src/app/api/stock/ai-analysis/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /deterministic_decision/);
  assert.match(routeSource, /先输出 JSON 摘要，再输出 Markdown 正文/);
  assert.match(routeSource, /wait\s*\/\s*avoid/);
  assert.match(routeSource, /摘要 action 不能升级为 buy\s*\/\s*add/);
  assert.match(routeSource, /headline\s*\/\s*action\s*\/\s*bias\s*\/\s*primary_reason/);
  assert.match(routeSource, /periods\.\*\.deterministic_decision\.conclusion\.action/);
  assert.match(routeSource, /action[^\n]*buy\s*\/\s*add\s*\/\s*hold\s*\/\s*reduce\s*\/\s*sell\s*\/\s*t_trade\s*\/\s*wait\s*\/\s*avoid/);
  assert.match(routeSource, /bias[^\n]*bullish\s*\/\s*bearish\s*\/\s*neutral/);
  assert.match(routeSource, /禁止输出中文值/);
  assert.match(routeSource, /所有自然语言内容必须使用简体中文/);
  assert.doesNotMatch(routeSource, /deterministic_decision\.action/);
  assert.match(routeSource, /不得突破后端硬边界/);
  assert.match(routeSource, /trade_qualification/);
  assert.match(routeSource, /position_permission/);
  assert.match(routeSource, /优先级高于/);
  assert.ok(
    routeSource.indexOf('不得突破后端硬边界') < routeSource.indexOf('## 均线系统物理性质'),
    '后端硬边界约束应出现在 legacy 激进策略表述之前'
  );
});

test('buildCodexExecArgs runs codex in read-only exec mode and captures last message to file', () => {
  assert.deepEqual(
    buildCodexExecArgs({
      outputPath: '/tmp/codex-output.txt',
      workingDir: '/tmp/codex-workdir',
    }),
    [
      '-a',
      'never',
      'exec',
      '-s',
      'read-only',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--cd',
      '/tmp/codex-workdir',
      '--output-last-message',
      '/tmp/codex-output.txt',
      '-',
    ]
  );
});

test('buildCodexExecArgs appends config overrides for AI-specific reasoning control', () => {
  assert.deepEqual(
    buildCodexExecArgs({
      outputPath: '/tmp/codex-output.txt',
      workingDir: '/tmp/codex-workdir',
      configOverrides: ['model_reasoning_effort="medium"', 'model="gpt-5.4"'],
    }),
    [
      '-a',
      'never',
      'exec',
      '-s',
      'read-only',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--cd',
      '/tmp/codex-workdir',
      '--output-last-message',
      '/tmp/codex-output.txt',
      '-c',
      'model_reasoning_effort="medium"',
      '-c',
      'model="gpt-5.4"',
      '-',
    ]
  );
});

test('buildCodexExecArgs enables json event mode for session capture', () => {
  assert.deepEqual(
    buildCodexExecArgs({
      outputPath: '/tmp/codex-output.txt',
      workingDir: '/tmp/codex-workdir',
      json: true,
    }),
    [
      '-a',
      'never',
      'exec',
      '-s',
      'read-only',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--cd',
      '/tmp/codex-workdir',
      '--json',
      '--output-last-message',
      '/tmp/codex-output.txt',
      '-',
    ]
  );
});

test('extractCodexSessionIdFromJsonl tolerates multiple event shapes', () => {
  const stdout = [
    JSON.stringify({ type: 'session.started', session_id: 'session-1' }),
    JSON.stringify({ type: 'turn.completed', thread_id: 'thread-ignored' }),
  ].join('\n');

  assert.equal(extractCodexSessionIdFromJsonl(stdout), 'session-1');
});

test('buildCodexExecResumeArgs resumes an existing exec session and keeps output capture', () => {
  assert.deepEqual(
    buildCodexExecResumeArgs({
      sessionId: 'session-1',
      outputPath: '/tmp/codex-output.txt',
      workingDir: '/tmp/codex-workdir',
    }),
    [
      '-a',
      'never',
      'exec',
      'resume',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--cd',
      '/tmp/codex-workdir',
      '--output-last-message',
      '/tmp/codex-output.txt',
      'session-1',
      '-',
    ]
  );
});

test('runCodexStrategyAnalysisWithSession returns report and extracted session id', async () => {
  const result = await runCodexStrategyAnalysisWithSession({
    systemPrompt: 'SYSTEM_PROMPT',
    userPrompt: 'USER_PROMPT',
    executor: async (prompt: string, options) => {
      assert.match(prompt, /SYSTEM_PROMPT/);
      assert.match(prompt, /USER_PROMPT/);
      assert.equal(options.json, true);

      return {
        exitCode: 0,
        signal: null,
        stdout: [
          JSON.stringify({ type: 'session.started', session_id: 'session-1' }),
          JSON.stringify({ type: 'turn.completed' }),
        ].join('\n'),
        stderr: '',
        report: '\n# 分析报告\n- 继续观察\n',
        timedOut: false,
      };
    },
  });

  assert.deepEqual(result, {
    report: '# 分析报告\n- 继续观察',
    session: { sessionId: 'session-1' },
  });
});

test('resumeCodexStrategyAnalysis resumes an existing session and returns trimmed report', async () => {
  const report = await resumeCodexStrategyAnalysis({
    sessionId: 'session-1',
    systemPrompt: 'SYSTEM_PROMPT',
    userPrompt: 'FOLLOW_UP_PROMPT',
    executor: async (prompt: string, options) => {
      assert.match(prompt, /FOLLOW_UP_PROMPT/);
      assert.equal(options.sessionId, 'session-1');

      return {
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        report: '\n# 追问报告\n- 继续观察\n',
        timedOut: false,
      };
    },
  });

  assert.equal(report, '# 追问报告\n- 继续观察');
});

test('formatCodexExecFailure prefers stderr details', () => {
  const message = formatCodexExecFailure({
    exitCode: 2,
    signal: null,
    stdout: 'stdout log',
    stderr: 'stderr detail',
    report: null,
    timedOut: false,
  });

  assert.equal(message, 'Codex CLI 执行失败 (exit 2): stderr detail');
});

test('runCodexStrategyAnalysis returns trimmed report from executor output', async () => {
  let receivedPrompt = '';

  const report = await runCodexStrategyAnalysis({
    systemPrompt: 'SYSTEM_PROMPT',
    userPrompt: 'USER_PROMPT',
    executor: async (prompt: string) => {
      receivedPrompt = prompt;
      return {
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        report: '\n# 分析报告\n- 继续观察\n',
        timedOut: false,
      };
    },
  });

  assert.equal(report, '# 分析报告\n- 继续观察');
  assert.match(receivedPrompt, /SYSTEM_PROMPT/);
  assert.match(receivedPrompt, /USER_PROMPT/);
});

test('runCodexStrategyAnalysis surfaces timeout as a readable error', async () => {
  await assert.rejects(
    () =>
      runCodexStrategyAnalysis({
        systemPrompt: 'SYSTEM_PROMPT',
        userPrompt: 'USER_PROMPT',
        timeoutMs: 45000,
        executor: async () => ({
          exitCode: null,
          signal: 'SIGTERM',
          stdout: '',
          stderr: '',
          report: null,
          timedOut: true,
        }),
      }),
    /Codex 分析超时 \(45000ms\)/
  );
});

test('runCodexStrategyAnalysis surfaces codex stderr when execution fails', async () => {
  await assert.rejects(
    () =>
      runCodexStrategyAnalysis({
        systemPrompt: 'SYSTEM_PROMPT',
        userPrompt: 'USER_PROMPT',
        executor: async () => ({
          exitCode: 1,
          signal: null,
          stdout: 'stdout detail',
          stderr: 'stderr detail',
          report: null,
          timedOut: false,
        }),
      }),
    /Codex CLI 执行失败 \(exit 1\): stderr detail/
  );
});

test('runCodexStrategyAnalysis rejects empty final messages', async () => {
  await assert.rejects(
    () =>
      runCodexStrategyAnalysis({
        systemPrompt: 'SYSTEM_PROMPT',
        userPrompt: 'USER_PROMPT',
        executor: async () => ({
          exitCode: 0,
          signal: null,
          stdout: '',
          stderr: '',
          report: '   ',
          timedOut: false,
        }),
      }),
    /Codex 未返回分析报告/
  );
});
