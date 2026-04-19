import type { PeriodAnalysisData, TrinityDecision } from '@/lib/stock-structure-types';
import type { SignalTagTone } from '@/lib/trinity-display-vocabulary';

export interface SignalTagHover {
  title: string;
  items: string[];
}

export interface TrinitySignalTag {
  category: '时空' | '突破/跌破' | '量能' | '均线' | '结构' | '背离';
  result: string;
  label: string;
  tone: SignalTagTone;
  hover: SignalTagHover;
}

interface BuildSignalTagOptions {
  max?: number;
}

function cleanText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildTag(
  category: TrinitySignalTag['category'],
  result?: string | null,
  tone: SignalTagTone = 'neutral',
  items: Array<string | null | undefined> = []
): TrinitySignalTag | null {
  const cleanedResult = cleanText(result);
  if (!cleanedResult) {
    return null;
  }

  const cleanedItems = items.map((item) => cleanText(item)).filter(Boolean);
  const label = `${category}｜${cleanedResult}`;

  return {
    category,
    result: cleanedResult,
    label,
    tone,
    hover: {
      title: label,
      items: cleanedItems.length > 0 ? cleanedItems : [cleanedResult],
    },
  };
}

function applyMax(tags: TrinitySignalTag[], options?: BuildSignalTagOptions): TrinitySignalTag[] {
  const max = options?.max;
  if (typeof max !== 'number' || max <= 0) {
    return tags;
  }
  return tags.slice(0, max);
}

function structureLabel(type?: string | null): string {
  const cleaned = cleanText(type);
  return cleaned.endsWith('类') ? cleaned.slice(0, -1) : cleaned;
}

function maRoleLabel(role?: TrinityDecision['moving_average']['ma55_role']): string {
  if (role === 'support') {
    return 'MA55支撑';
  }
  if (role === 'resistance') {
    return 'MA55压制';
  }
  if (role === 'neutral') {
    return 'MA55中性';
  }
  return '';
}

function maRoleTone(role?: TrinityDecision['moving_average']['ma55_role']): SignalTagTone {
  if (role === 'support') {
    return 'bullish';
  }
  if (role === 'resistance') {
    return 'bearish';
  }
  return 'neutral';
}

function breakthroughDecisionLabel(state?: TrinityDecision['moving_average']['breakthrough_state']): string {
  switch (state) {
    case 'breakout_pending':
      return '突破候选';
    case 'valid_breakout':
      return '有效突破';
    case 'pullback_confirmed':
      return '突破后回踩确认';
    case 'false_breakout':
      return '假突破风险';
    case 'breakdown_pending':
      return '跌破候选';
    case 'valid_breakdown':
      return '有效跌破';
    case 'pullback_breakdown_confirmed':
      return '跌破后反抽确认';
    case 'false_breakdown':
      return '假跌破风险';
    default:
      return '';
  }
}

function breakthroughDecisionTone(state?: TrinityDecision['moving_average']['breakthrough_state']): SignalTagTone {
  switch (state) {
    case 'valid_breakout':
    case 'pullback_confirmed':
      return 'bullish';
    case 'valid_breakdown':
    case 'pullback_breakdown_confirmed':
      return 'bearish';
    case 'breakout_pending':
    case 'breakdown_pending':
    case 'false_breakout':
    case 'false_breakdown':
      return 'warning';
    default:
      return 'neutral';
  }
}

function breakoutVolumeLabel(volume?: TrinityDecision['volume_confirmation']['breakout_volume']): string {
  switch (volume) {
    case 'confirmed':
      return '突破放量确认';
    case 'weak':
      return '突破量弱';
    case 'climax_risk':
      return '突破量能过热';
    default:
      return '';
  }
}

function breakoutVolumeTone(volume?: TrinityDecision['volume_confirmation']['breakout_volume']): SignalTagTone {
  switch (volume) {
    case 'confirmed':
      return 'bullish';
    case 'weak':
    case 'climax_risk':
      return 'warning';
    default:
      return 'neutral';
  }
}

function divergenceLabel(note?: string | null): string {
  const cleaned = cleanText(note);
  if (cleaned.includes('顶背离')) {
    return '顶背离';
  }
  if (cleaned.includes('底背离')) {
    return '底背离';
  }
  return '';
}

function divergenceTone(label: string): SignalTagTone {
  if (label === '顶背离') {
    return 'bearish';
  }
  if (label === '底背离') {
    return 'bullish';
  }
  return 'neutral';
}

function breakthroughPeriodTone(patternType?: string | null, direction?: string | null, isValid?: boolean | null): SignalTagTone {
  const cleanedPattern = cleanText(patternType);
  if (cleanedPattern.includes('假')) {
    return 'warning';
  }

  if (isValid) {
    return cleanText(direction).toLowerCase() === 'down' ? 'bearish' : 'bullish';
  }

  return 'neutral';
}

export function buildDecisionSignalTags(
  decision?: TrinityDecision | null,
  options?: BuildSignalTagOptions
): TrinitySignalTag[] {
  if (!decision) {
    return [];
  }

  const tags = [
    buildTag('时空', decision.spacetime.status, decision.spacetime.direction_bias, [
      decision.spacetime.structure_match ? '时空与结构匹配' : decision.spacetime.mismatch_reason,
      decision.spacetime.divergence_policy.reason,
    ]),
    buildTag(
      '突破/跌破',
      breakthroughDecisionLabel(decision.moving_average.breakthrough_state),
      breakthroughDecisionTone(decision.moving_average.breakthrough_state),
      [decision.moving_average.ma_gate.reason]
    ),
    buildTag('量能', breakoutVolumeLabel(decision.volume_confirmation.breakout_volume), breakoutVolumeTone(decision.volume_confirmation.breakout_volume), [
      decision.volume_confirmation.volume_gate.reason,
    ]),
    buildTag('均线', maRoleLabel(decision.moving_average.ma55_role), maRoleTone(decision.moving_average.ma55_role), [
      decision.moving_average.ma_gate.reason,
    ]),
    buildTag('结构', structureLabel(decision.structure.type), 'neutral', [
      decision.structure.explainability.reason,
      ...decision.structure.explainability.evidence,
    ]),
  ].filter((tag): tag is TrinitySignalTag => Boolean(tag));

  return applyMax(tags, options);
}

export function buildPeriodSignalTags(
  period?: PeriodAnalysisData | null,
  options?: BuildSignalTagOptions
): TrinitySignalTag[] {
  if (!period) {
    return [];
  }

  const tags = [
    buildTag('背离', divergenceLabel(period.macd?.divergence_note), divergenceTone(divergenceLabel(period.macd?.divergence_note)), [
      period.macd?.divergence_note,
      period.trinity_decision?.spacetime.divergence_policy.reason,
    ]),
    buildTag(
      '突破/跌破',
      period.breakthrough?.pattern_type,
      breakthroughPeriodTone(period.breakthrough?.pattern_type, period.breakthrough?.direction, period.breakthrough?.is_valid),
      period.breakthrough?.key_signals ?? []
    ),
    buildTag(
      '时空',
      period.trinity_decision?.spacetime.status ?? period.macd?.status,
      period.trinity_decision?.spacetime.direction_bias ?? 'neutral',
      [period.macd?.description]
    ),
  ].filter((tag): tag is TrinitySignalTag => Boolean(tag));

  return applyMax(tags, options);
}
