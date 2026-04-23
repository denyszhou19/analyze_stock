import type {
  AiSummaryCard,
  TrinityDecisionAction,
  TrinityDecisionBias,
} from '@/lib/stock-structure-types';

const AI_REPORT_JSON_BLOCK_PATTERN = /^\s*```json\s*([\s\S]*?)\s*```\s*([\s\S]*)$/i;

const SUMMARY_ACTIONS = new Set<TrinityDecisionAction>([
  'buy',
  'add',
  'hold',
  'reduce',
  'sell',
  't_trade',
  'wait',
  'avoid',
]);

const SUMMARY_BIASES = new Set<TrinityDecisionBias>(['bullish', 'bearish', 'neutral']);

const ACTION_ALIASES: Record<string, TrinityDecisionAction> = {
  buy: 'buy',
  买入: 'buy',
  add: 'add',
  加仓: 'add',
  hold: 'hold',
  持有: 'hold',
  reduce: 'reduce',
  减仓: 'reduce',
  sell: 'sell',
  卖出: 'sell',
  t_trade: 't_trade',
  '做t': 't_trade',
  '做T': 't_trade',
  wait: 'wait',
  等待: 'wait',
  观望: 'wait',
  avoid: 'avoid',
  规避: 'avoid',
  回避: 'avoid',
};

const BIAS_ALIASES: Record<string, TrinityDecisionBias> = {
  bullish: 'bullish',
  偏多: 'bullish',
  看多: 'bullish',
  中性偏多: 'bullish',
  neutral_to_bullish: 'bullish',
  'neutral-to-bullish': 'bullish',
  bearish: 'bearish',
  偏空: 'bearish',
  看空: 'bearish',
  中性偏空: 'bearish',
  neutral_to_bearish: 'bearish',
  'neutral-to-bearish': 'bearish',
  neutral: 'neutral',
  中性: 'neutral',
};

function parseStringField(
  value: unknown,
  fieldName: keyof AiSummaryCard
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`AI 报告 JSON 摘要字段无效: ${fieldName}`);
  }

  return value.trim();
}

function parseStringListField(
  value: unknown,
  fieldName: 'triggers' | 'risks'
): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`AI 报告 JSON 摘要字段无效: ${fieldName}`);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalJudgment(
  value: unknown
): AiSummaryCard['judgment'] | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) {
    return undefined;
  }

  if (parsed === '严格等待' || parsed === '候选可试' || parsed === '确认执行') {
    return parsed;
  }

  return undefined;
}

function parseOptionalCandidateStructure(
  value: unknown
): AiSummaryCard['candidate_structure'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const parsed = {
    label: parseOptionalString(candidate.label),
    current_leg: parseOptionalString(candidate.current_leg),
    upgrade_condition: parseOptionalString(candidate.upgrade_condition),
    invalidation: parseOptionalString(candidate.invalidation),
  };

  return Object.values(parsed).some((item) => item !== undefined)
    ? parsed
    : undefined;
}

function parseOptionalWaitState(
  value: unknown
): AiSummaryCard['wait_state'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const parsed = {
    label: parseOptionalString(candidate.label),
    current_block: parseOptionalString(candidate.current_block),
    next_action: parseOptionalString(candidate.next_action),
  };

  return Object.values(parsed).some((item) => item !== undefined)
    ? parsed
    : undefined;
}

function normalizeAction(value: unknown): TrinityDecisionAction | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return ACTION_ALIASES[normalized] ?? null;
}

function normalizeBias(value: unknown): TrinityDecisionBias | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return BIAS_ALIASES[normalized] ?? null;
}

function parseAiSummaryCard(value: unknown): AiSummaryCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI 报告 JSON 摘要必须是对象');
  }

  const candidate = value as Record<string, unknown>;
  const action = normalizeAction(candidate.action);
  const bias = normalizeBias(candidate.bias);

  if (!action || !SUMMARY_ACTIONS.has(action)) {
    throw new Error('AI 报告 JSON 摘要字段无效: action');
  }

  if (!bias || !SUMMARY_BIASES.has(bias)) {
    throw new Error('AI 报告 JSON 摘要字段无效: bias');
  }

  return {
    headline: parseStringField(candidate.headline, 'headline'),
    action,
    bias,
    primary_reason: parseStringField(candidate.primary_reason, 'primary_reason'),
    triggers: parseStringListField(candidate.triggers, 'triggers'),
    risks: parseStringListField(candidate.risks, 'risks'),
    guardrail: parseStringField(candidate.guardrail, 'guardrail'),
    judgment: parseOptionalJudgment(candidate.judgment),
    critical_reason: parseOptionalString(candidate.critical_reason),
    spacetime_summary: parseOptionalString(candidate.spacetime_summary),
    structure_summary: parseOptionalString(candidate.structure_summary),
    execution_summary: parseOptionalString(candidate.execution_summary),
    candidate_structure: parseOptionalCandidateStructure(candidate.candidate_structure),
    wait_state: parseOptionalWaitState(candidate.wait_state),
    judgment_warning: parseOptionalString(candidate.judgment_warning),
  };
}

export function parseAiReportContract(report: string): {
  summary: AiSummaryCard;
  markdown: string;
} {
  const match = report.match(AI_REPORT_JSON_BLOCK_PATTERN);

  if (!match) {
    throw new Error('AI 报告缺少 JSON 摘要');
  }

  const [, jsonBlock, markdownBlock] = match;

  let parsedSummary: unknown;
  try {
    parsedSummary = JSON.parse(jsonBlock);
  } catch {
    throw new Error('AI 报告 JSON 摘要解析失败');
  }

  const markdown = markdownBlock.trim();
  if (!markdown) {
    throw new Error('AI 报告缺少 Markdown 正文');
  }

  return {
    summary: parseAiSummaryCard(parsedSummary),
    markdown,
  };
}
