import type { TrinityAnchor, TrinityDecision } from '@/lib/stock-structure-types';

export interface TrinityDecisionViewModel {
  title: string;
  levelLabel: string | null;
  actionLabel: string | null;
  structureLabel: string | null;
  spacetimeLabel: string | null;
  maLabel: string | null;
  volumeLabel: string | null;
  gateReason: string | null;
  waitReason: string | null;
  backgroundOriginLabel: string | null;
  focusOriginLabel: string | null;
  executionOriginLabel: string | null;
  triggerLabels: string[];
  invalidationLabels: string[];
}

const LEVEL_LABELS: Record<TrinityDecision['level'], string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

const FAMILY_LABELS: Record<TrinityDecision['structure']['family'], string> = {
  standard: '标准结构',
  extended: '延伸结构',
  channel: '通道结构',
  range: '平台震荡',
  unfinished: '未完成结构',
  complex: '复杂结构',
};

const BIAS_LABELS: Record<TrinityDecision['spacetime']['direction_bias'], string> = {
  bullish: '偏多',
  bearish: '偏空',
  neutral: '中性',
};

const MA55_ROLE_LABELS: Record<TrinityDecision['moving_average']['ma55_role'], string> = {
  support: '支撑',
  resistance: '压制',
  neutral: '中性',
};

const BREAKTHROUGH_LABELS: Record<TrinityDecision['moving_average']['breakthrough_state'], string> = {
  none: '无突破',
  breakout_pending: '突破待确认',
  valid_breakout: '有效突破',
  pullback_confirmed: '回抽确认',
  false_breakout: '假突破',
  breakdown_pending: '跌破待确认',
  valid_breakdown: '有效跌破',
  pullback_breakdown_confirmed: '跌破回抽确认',
  false_breakdown: '假跌破',
};

const VOLUME_STATE_LABELS: Record<TrinityDecision['volume_confirmation']['volume_state'], string> = {
  shrinking: '缩量',
  normal: '量能正常',
  expanding: '放量',
  climax: '放量过热',
  unknown: '量能未知',
};

const BREAKOUT_VOLUME_LABELS: Record<TrinityDecision['volume_confirmation']['breakout_volume'], string> = {
  confirmed: '突破量能确认',
  weak: '突破量能偏弱',
  climax_risk: '突破量能过热',
  not_applicable: '无突破量能要求',
};

function formatPrice(price?: number | null): string | null {
  return typeof price === 'number' && Number.isFinite(price) ? price.toFixed(2) : null;
}

function formatAnchor(anchor?: TrinityAnchor | null): string | null {
  if (!anchor) {
    return null;
  }

  const priceLabel = formatPrice(anchor.price);
  if (anchor.point_id && priceLabel) {
    return `${anchor.point_id} @ ${priceLabel}`;
  }
  if (anchor.point_id) {
    return anchor.point_id;
  }
  if (anchor.date && priceLabel) {
    return `${anchor.date.slice(0, 10)} @ ${priceLabel}`;
  }
  return anchor.date?.slice(0, 10) ?? priceLabel;
}

export function buildTrinityDecisionViewModel(
  decision?: TrinityDecision | null
): TrinityDecisionViewModel {
  if (!decision) {
    return {
      title: '三位一体判定',
      levelLabel: null,
      actionLabel: null,
      structureLabel: null,
      spacetimeLabel: null,
      maLabel: null,
      volumeLabel: null,
      gateReason: null,
      waitReason: null,
      backgroundOriginLabel: null,
      focusOriginLabel: null,
      executionOriginLabel: null,
      triggerLabels: [],
      invalidationLabels: [],
    };
  }

  return {
    title: '三位一体判定',
    levelLabel: LEVEL_LABELS[decision.level],
    actionLabel: decision.conclusion.action_label,
    structureLabel: `${decision.structure.type} / ${FAMILY_LABELS[decision.structure.family]}`,
    spacetimeLabel: `${decision.spacetime.status} / ${BIAS_LABELS[decision.spacetime.direction_bias]}`,
    maLabel: `MA55${MA55_ROLE_LABELS[decision.moving_average.ma55_role]} / ${BREAKTHROUGH_LABELS[decision.moving_average.breakthrough_state]}`,
    volumeLabel: `${VOLUME_STATE_LABELS[decision.volume_confirmation.volume_state]} / ${BREAKOUT_VOLUME_LABELS[decision.volume_confirmation.breakout_volume]}`,
    gateReason: decision.level_nesting?.permission.reason ?? null,
    waitReason: decision.conclusion.wait_reason ?? null,
    backgroundOriginLabel: formatAnchor(decision.structure.background_origin),
    focusOriginLabel: formatAnchor(decision.structure.focus_origin),
    executionOriginLabel: formatAnchor(decision.structure.execution_origin),
    triggerLabels: decision.execution.triggers,
    invalidationLabels: decision.execution.invalidation,
  };
}
