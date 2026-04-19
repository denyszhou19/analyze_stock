import type { TrinityDecisionAction } from '@/lib/stock-structure-types';

const ACTION_LABELS: Record<TrinityDecisionAction, string> = {
  buy: '买入',
  add: '加仓',
  hold: '持有',
  reduce: '减仓',
  sell: '卖出',
  t_trade: '做 T',
  wait: '等待',
  avoid: '回避',
};

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
  回避: 'avoid',
  规避: 'avoid',
};

function cleanText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAction(value?: string | null): TrinityDecisionAction | null {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  return ACTION_ALIASES[normalized] ?? ACTION_ALIASES[normalized.toLowerCase()] ?? null;
}

export function containsChinese(value?: string | null): boolean {
  return /[\u4e00-\u9fff]/.test(cleanText(value));
}

export function formatDecisionActionLabel(
  action?: TrinityDecisionAction | string | null,
  actionLabel?: string | null
): string {
  const normalizedActionLabel = normalizeAction(actionLabel);
  if (normalizedActionLabel) {
    return ACTION_LABELS[normalizedActionLabel];
  }

  const cleanedActionLabel = cleanText(actionLabel);
  if (cleanedActionLabel) {
    return cleanedActionLabel;
  }

  const normalizedAction = normalizeAction(action);
  if (normalizedAction) {
    return ACTION_LABELS[normalizedAction];
  }

  return cleanText(action);
}

export function preferChineseText(candidate?: string | null, fallback?: string | null): string {
  const cleanedCandidate = cleanText(candidate);
  if (containsChinese(cleanedCandidate)) {
    return cleanedCandidate;
  }

  const cleanedFallback = cleanText(fallback);
  return cleanedFallback || cleanedCandidate;
}

export function preferChineseList(
  candidate?: Array<string | null | undefined> | null,
  fallback?: Array<string | null | undefined> | null
): string[] {
  const cleanedCandidate = (candidate ?? []).map((item) => cleanText(item)).filter(Boolean);
  if (cleanedCandidate.length && cleanedCandidate.every((item) => containsChinese(item))) {
    return cleanedCandidate;
  }

  const cleanedFallback = (fallback ?? []).map((item) => cleanText(item)).filter(Boolean);
  return cleanedFallback.length ? cleanedFallback : cleanedCandidate;
}
