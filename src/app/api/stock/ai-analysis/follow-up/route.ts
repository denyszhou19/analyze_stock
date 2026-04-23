import { NextRequest, NextResponse } from 'next/server.js';
import { resumeCodexStrategyAnalysis } from '../../../../../lib/codex-strategy-analysis.ts';
import { TRINITY_SYSTEM_PROMPT } from '../route.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AiAnalysisFollowUpRequest {
  sessionId: string;
  snapshotKey: string;
  question: string;
}

function parseRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractFollowUpMarkdown(report: string): string {
  const trimmed = report.trim();
  const match = trimmed.match(/^\s*```json\s*[\s\S]*?\s*```\s*([\s\S]*)$/i);
  const markdown = match?.[1]?.trim() || trimmed;

  if (!markdown) {
    throw new Error('AI 追问未返回 Markdown');
  }

  return markdown;
}

function parseFollowUpRequest(value: unknown): AiAnalysisFollowUpRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const sessionId = parseRequiredString(candidate.sessionId);
  const snapshotKey = parseRequiredString(candidate.snapshotKey);
  const question = parseRequiredString(candidate.question);

  if (!sessionId || !snapshotKey || !question) {
    return null;
  }

  return {
    sessionId,
    snapshotKey,
    question,
  };
}

export function buildAiFollowUpPrompt({
  snapshotKey,
  question,
}: {
  snapshotKey: string;
  question: string;
}) {
  return `## AI 追问任务

- 基于当前会话继续回答，不要重新生成整份主报告
- 本次追问严格绑定当前分析快照：snapshotKey = ${snapshotKey}
- 你的回答只能基于这个分析快照和当前会话上下文，不能把它泛化成仅基于股票代码的通用回答
- 若用户问题需要新的分析数据、不同快照或更新后的行情，必须明确说明需要重新发起主报告
- 只输出 Markdown，不要输出 JSON 摘要，不要输出代码块包装的 JSON
- 继续遵守后端硬边界与条件性越权规则：
  - 可以写“若满足条件则可升级”
  - 可以指出后端判断疑点或输入张力
  - 不能直接改写后端正式动作边界

## 用户问题

${question}`;
}

export const followUpRouteDependencies = {
  resumeCodexStrategyAnalysis,
};

export async function POST(request: NextRequest) {
  try {
    const parsed = parseFollowUpRequest(await request.json());

    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: 'sessionId、snapshotKey、question 为必填项',
        },
        { status: 400 }
      );
    }

    const timeoutMs = Number.parseInt(process.env.AI_ANALYSIS_CODEX_TIMEOUT_MS || '', 10);
    const report = await followUpRouteDependencies.resumeCodexStrategyAnalysis({
      sessionId: parsed.sessionId,
      systemPrompt: TRINITY_SYSTEM_PROMPT,
      userPrompt: buildAiFollowUpPrompt({
        snapshotKey: parsed.snapshotKey,
        question: parsed.question,
      }),
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        markdown: extractFollowUpMarkdown(report),
      },
    });
  } catch (err) {
    console.error('[AI Analysis Follow-up] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'AI追问失败' },
      { status: 500 }
    );
  }
}
