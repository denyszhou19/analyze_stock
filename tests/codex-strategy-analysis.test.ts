import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  buildCodexExecArgs,
  buildCodexExecPrompt,
  formatCodexExecFailure,
  runCodexStrategyAnalysis,
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
