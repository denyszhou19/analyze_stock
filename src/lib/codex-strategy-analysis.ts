import { spawn } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

export const DEFAULT_CODEX_ANALYSIS_TIMEOUT_MS = 120_000;

export interface BuildCodexExecArgsParams {
  outputPath: string;
  workingDir: string;
  configOverrides?: string[];
  json?: boolean;
}

export interface CodexStrategyAnalysisExecutionResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  report: string | null;
  timedOut: boolean;
}

export interface CodexSessionRef {
  sessionId: string;
}

export interface CodexStrategyAnalysisResult {
  report: string;
  session?: CodexSessionRef;
}

export interface RunCodexStrategyAnalysisOptions {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
  configOverrides?: string[];
  executor?: CodexStrategyAnalysisExecutor;
}

export type CodexStrategyAnalysisExecutor = (
  prompt: string,
  options: {
    timeoutMs: number;
    configOverrides?: string[];
    json?: boolean;
    sessionId?: string;
  }
) => Promise<CodexStrategyAnalysisExecutionResult>;

export function buildCodexExecPrompt(systemPrompt: string, userPrompt: string): string {
  return [
    '你是一个独立运行的本地 Codex 分析代理。',
    '请严格遵守以下系统指令完成任务，不要暴露推理过程。',
    '',
    '## 系统指令',
    systemPrompt,
    '',
    '## 用户任务',
    userPrompt,
    '',
    '## 输出要求',
    '严格按以下顺序输出：先输出 JSON 摘要，再输出 Markdown 正文。',
    '除 JSON 摘要与 Markdown 正文外，不要添加额外解释。',
  ].join('\n');
}

export function buildCodexExecArgs({
  outputPath,
  workingDir,
  configOverrides = [],
  json = false,
}: BuildCodexExecArgsParams): string[] {
  return [
    '-a',
    'never',
    'exec',
    '-s',
    'read-only',
    '--skip-git-repo-check',
    '--color',
    'never',
    '--cd',
    workingDir,
    ...(json ? ['--json'] : []),
    '--output-last-message',
    outputPath,
    ...configOverrides.flatMap((override) => ['-c', override]),
    '-',
  ];
}

export function buildCodexExecResumeArgs({
  sessionId,
  outputPath,
  workingDir,
  configOverrides = [],
}: {
  sessionId: string;
  outputPath: string;
  workingDir: string;
  configOverrides?: string[];
}): string[] {
  return [
    '-a',
    'never',
    'exec',
    'resume',
    '--skip-git-repo-check',
    '--color',
    'never',
    '--cd',
    workingDir,
    '--output-last-message',
    outputPath,
    ...configOverrides.flatMap((override) => ['-c', override]),
    sessionId,
    '-',
  ];
}

export function extractCodexSessionIdFromJsonl(stdout: string): string | null {
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      const session =
        (typeof event.session_id === 'string' && event.session_id) ||
        (typeof event.thread_id === 'string' && event.thread_id) ||
        (typeof event.session === 'object' && event.session !== null
          ? (event.session as Record<string, unknown>).id
          : null) ||
        (typeof event.thread === 'object' && event.thread !== null
          ? (event.thread as Record<string, unknown>).id
          : null);

      if (typeof session === 'string' && session) {
        return session;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeDetail(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function formatCodexExecFailure(result: CodexStrategyAnalysisExecutionResult): string {
  const detail =
    normalizeDetail(result.stderr) ||
    normalizeDetail(result.stdout) ||
    (result.signal ? `signal ${result.signal}` : '未知错误');

  const statusLabel = result.exitCode === null ? 'no exit code' : `exit ${result.exitCode}`;
  const signalLabel = result.signal ? `, signal ${result.signal}` : '';

  return `Codex CLI 执行失败 (${statusLabel}${signalLabel}): ${detail}`;
}

export async function runCodexStrategyAnalysis({
  systemPrompt,
  userPrompt,
  timeoutMs = DEFAULT_CODEX_ANALYSIS_TIMEOUT_MS,
  configOverrides = [],
  executor = executeCodexCli,
}: RunCodexStrategyAnalysisOptions): Promise<string> {
  const prompt = buildCodexExecPrompt(systemPrompt, userPrompt);
  const result = await executor(prompt, { timeoutMs, configOverrides });
  return ensureCodexReport(result, timeoutMs);
}

function ensureCodexReport(
  result: CodexStrategyAnalysisExecutionResult,
  timeoutMs: number
): string {
  if (result.timedOut) {
    throw new Error(`Codex 分析超时 (${timeoutMs}ms)`);
  }

  if (result.exitCode !== 0) {
    throw new Error(formatCodexExecFailure(result));
  }

  const report = result.report?.trim();
  if (!report) {
    throw new Error('Codex 未返回分析报告');
  }

  return report;
}

export async function runCodexStrategyAnalysisWithSession({
  systemPrompt,
  userPrompt,
  timeoutMs = DEFAULT_CODEX_ANALYSIS_TIMEOUT_MS,
  configOverrides = [],
  executor = executeCodexCli,
}: RunCodexStrategyAnalysisOptions): Promise<CodexStrategyAnalysisResult> {
  const prompt = buildCodexExecPrompt(systemPrompt, userPrompt);
  const result = await executor(prompt, { timeoutMs, configOverrides, json: true });
  const report = ensureCodexReport(result, timeoutMs);
  const sessionId = extractCodexSessionIdFromJsonl(result.stdout);

  return {
    report,
    session: sessionId ? { sessionId } : undefined,
  };
}

export async function resumeCodexStrategyAnalysis({
  sessionId,
  systemPrompt,
  userPrompt,
  timeoutMs = DEFAULT_CODEX_ANALYSIS_TIMEOUT_MS,
  configOverrides = [],
  executor = executeCodexCli,
}: RunCodexStrategyAnalysisOptions & { sessionId: string }): Promise<string> {
  const prompt = buildCodexExecPrompt(systemPrompt, userPrompt);
  const result = await executor(prompt, { timeoutMs, configOverrides, sessionId });
  return ensureCodexReport(result, timeoutMs);
}

export const executeCodexCli: CodexStrategyAnalysisExecutor = async (
  prompt,
  { timeoutMs, configOverrides = [], json = false, sessionId }
) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'analyze-stock-codex-'));
  const outputPath = path.join(tempDir, 'last-message.md');
  let killTimer: NodeJS.Timeout | null = null;

  try {
    const args = sessionId
      ? buildCodexExecResumeArgs({
          sessionId,
          outputPath,
          workingDir: tempDir,
          configOverrides,
        })
      : buildCodexExecArgs({
          outputPath,
          workingDir: tempDir,
          configOverrides,
          json,
        });

    const result = await new Promise<CodexStrategyAnalysisExecutionResult>((resolve, reject) => {
      const child = spawn(process.env.CODEX_BIN || 'codex', args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => {
          child.kill('SIGKILL');
        }, 5_000);
      }, timeoutMs);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timeoutHandle);
        if (killTimer) {
          clearTimeout(killTimer);
        }
        reject(new Error(`无法启动 Codex CLI: ${error.message}`));
      });

      child.on('close', async (exitCode, signal) => {
        clearTimeout(timeoutHandle);
        if (killTimer) {
          clearTimeout(killTimer);
        }

        let report: string | null = null;
        try {
          report = await readFile(outputPath, 'utf8');
        } catch {
          report = null;
        }

        resolve({
          exitCode,
          signal,
          stdout,
          stderr,
          report,
          timedOut,
        });
      });

      child.stdin.end(prompt);
    });

    return result;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};
