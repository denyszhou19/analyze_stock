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

const DISPLAY_TOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bdeterministic_decision\b/gi, '后端当前结论'],
  [/\bposition_permission\b/gi, '仓位权限'],
  [/\btrade_qualification\b/gi, '交易资格'],
  [/\bexecution_summary\b/gi, '执行摘要'],
  [/\bexecution\b/gi, '执行预案'],
  [/\bcurrent_position_action\b/gi, '当前仓位动作'],
  [/\bno_position\b/gi, '空仓等待'],
  [/\blight_probe\b/gi, '轻仓试探'],
  [/\bwait_confirmation\b/gi, '等待确认'],
  [/\bstandard_node_trade\b/gi, '标准节点交易'],
  [/\bconditional_boundary_trade\b/gi, '条件边界交易'],
  [/\brisk_control\b/gi, '风控优先'],
  [/\bt_trade_only\b/gi, '仅做T'],
  [/\bfull_signal\b/gi, '完整信号'],
  [/\bhalf_position\b/gi, '半仓'],
  [/\breduce_only\b/gi, '只减仓'],
  [/\bbuy\b/gi, '买入'],
  [/\badd\b/gi, '加仓'],
  [/\bhold\b/gi, '持有'],
  [/\breduce\b/gi, '减仓'],
  [/\bsell\b/gi, '卖出'],
  [/\bt_trade\b/gi, '做T'],
  [/\bwait\b/gi, '等待'],
  [/\bavoid\b/gi, '回避'],
];

export function normalizeVisibleDecisionText(value?: string | null): string {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return '';
  }

  return DISPLAY_TOKEN_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    cleaned
  )
    .replace(/执行预案\s+字段/g, '执行预案字段')
    .replace(/给出\s+买入/g, '给出买入')
    .replace(/但\s+后端当前结论/g, '但后端当前结论')
    .replace(/后端当前结论\s+为/g, '后端当前结论为')
    .replace(/为\s+等待/g, '为等待')
    .replace(/且\s+仓位权限/g, '且仓位权限')
    .replace(/仓位权限\s+为/g, '仓位权限为')
    .replace(/仓位权限为\s+空仓等待/g, '仓位权限为空仓等待')
    .replace(/买入\s+含义/g, '买入含义')
    .replace(/等待\s+且/g, '等待且')
    .replace(/空仓等待\s*([，。；])/g, '空仓等待$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  const rawCandidate = cleanText(candidate);
  const cleanedCandidate = normalizeVisibleDecisionText(candidate);
  if (containsChinese(rawCandidate)) {
    return cleanedCandidate;
  }

  const cleanedFallback = normalizeVisibleDecisionText(fallback);
  return cleanedFallback || cleanedCandidate;
}

export function preferChineseList(
  candidate?: Array<string | null | undefined> | null,
  fallback?: Array<string | null | undefined> | null
): string[] {
  const rawCandidate = (candidate ?? []).map((item) => cleanText(item)).filter(Boolean);
  const cleanedCandidate = rawCandidate.map((item) => normalizeVisibleDecisionText(item)).filter(Boolean);
  if (cleanedCandidate.length && rawCandidate.every((item) => containsChinese(item))) {
    return cleanedCandidate;
  }

  const cleanedFallback = (fallback ?? [])
    .map((item) => normalizeVisibleDecisionText(item))
    .filter(Boolean);
  return cleanedFallback.length ? cleanedFallback : cleanedCandidate;
}
