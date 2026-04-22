import type {
  PeriodAnalysisData,
  TrinityDecision,
  TrinityLevelNestingDecision,
} from '@/lib/stock-structure-types';
import type { SignalTagTone } from '@/lib/trinity-display-vocabulary';

export interface SignalTagHover {
  title: string;
  items: Array<{ label: string; value: string }>;
}

export interface TrinitySignalTag {
  key:
    | 'spacetime'
    | 'divergence'
    | 'breakthrough'
    | 'volume'
    | 'moving_average'
    | 'structure'
    | 'level_nesting'
    | 'execution';
  category: '时空' | '背离' | '突破/跌破' | '量能' | '均线' | '结构' | '级别' | '执行';
  result: string;
  label: string;
  tone: SignalTagTone;
  hover: SignalTagHover;
}

interface BuildSignalTagOptions {
  max?: number;
}

const SIGNAL_TAG_ORDER: TrinitySignalTag['key'][] = [
  'spacetime',
  'divergence',
  'breakthrough',
  'volume',
  'moving_average',
  'structure',
  'level_nesting',
  'execution',
];

const SIGNAL_TAG_ORDER_INDEX = new Map(SIGNAL_TAG_ORDER.map((key, index) => [key, index]));

function cleanText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildTag(
  key: TrinitySignalTag['key'],
  category: TrinitySignalTag['category'],
  result?: string | null,
  tone: SignalTagTone = 'neutral',
  items: Array<{ label: string; value?: string | null } | null | undefined> = []
): TrinitySignalTag | null {
  const cleanedResult = cleanText(result);
  if (!cleanedResult) {
    return null;
  }

  const cleanedItems = items
    .map((item) => {
      if (!item) {
        return null;
      }

      const label = cleanText(item.label);
      const value = cleanText(item.value);
      if (!label || !value) {
        return null;
      }

      return { label, value };
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
  const label = `${category}｜${cleanedResult}`;

  return {
    key,
    category,
    result: cleanedResult,
    label,
    tone,
    hover: {
      title: label,
      items: cleanedItems.length > 0 ? cleanedItems : [{ label: '结论', value: cleanedResult }],
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

export function sortSignalTags(tags: TrinitySignalTag[]): TrinitySignalTag[] {
  return [...tags].sort((left, right) => {
    const leftIndex = SIGNAL_TAG_ORDER_INDEX.get(left.key) ?? SIGNAL_TAG_ORDER.length;
    const rightIndex = SIGNAL_TAG_ORDER_INDEX.get(right.key) ?? SIGNAL_TAG_ORDER.length;
    return leftIndex - rightIndex;
  });
}

function structureLabel(type?: string | null): string {
  const cleaned = cleanText(type);
  return cleaned.endsWith('类') ? cleaned.slice(0, -1) : cleaned;
}

function structureTagResult(decision?: TrinityDecision | null): string {
  const candidateLabel = cleanText(decision?.candidate_structure?.candidate_label);
  if (candidateLabel) {
    return candidateLabel;
  }

  return structureLabel(decision?.structure.type);
}

function buildStructureHoverItems(decision: TrinityDecision): Array<{ label: string; value?: string | null }> {
  const candidateStructure = decision.candidate_structure;
  if (candidateStructure?.candidate_label) {
    return [
      { label: '当前阶段', value: candidateStructure.current_leg },
      { label: '说明', value: candidateStructure.reason ?? decision.structure.explainability.reason },
      { label: '升级条件', value: candidateStructure.upgrade_condition },
      { label: '失效条件', value: candidateStructure.invalidation },
    ];
  }

  return [
    { label: '解释', value: decision.structure.explainability.reason },
    ...decision.structure.explainability.evidence.map((item) => ({ label: '证据', value: item })),
  ];
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

function zeroAxisTone(
  impact?: NonNullable<TrinityDecision['zero_axis_signal']>['impact_on_judgment'],
  fallback: SignalTagTone = 'neutral'
): SignalTagTone {
  if (impact === 'promote') {
    return 'bullish';
  }
  if (impact === 'suppress') {
    return 'warning';
  }
  return fallback;
}

function divergenceDecisionTone(
  divergenceWeight?: TrinityDecision['divergence_weight']
): SignalTagTone {
  if (divergenceWeight?.status === 'supportive') {
    return 'bullish';
  }
  if (divergenceWeight?.status === 'neutral') {
    return 'neutral';
  }
  if (divergenceWeight) {
    return 'bearish';
  }
  return 'neutral';
}

function resolveExecutionPreview(decision: TrinityDecision): {
  probeEntry: string;
  confirmEntry: string;
  invalidation: string;
} {
  return {
    probeEntry: decision.execution_plan?.probe_entry ?? decision.execution.triggers[0] ?? '继续等待触发',
    confirmEntry:
      decision.execution_plan?.confirm_entry ??
      decision.execution.confirmation[0] ??
      '等待进一步确认',
    invalidation:
      decision.execution_plan?.invalidation ??
      decision.execution.invalidation[0] ??
      '若条件失效则取消',
  };
}

function normalizeBreakthroughPatternType(patternType?: string | null): string {
  const cleaned = cleanText(patternType);
  if (!cleaned) {
    return '';
  }
  if (cleaned === '假突破') {
    return '假突破风险';
  }
  if (cleaned === '假跌破') {
    return '假跌破风险';
  }
  return cleaned;
}

function breakthroughPeriodTone(patternType?: string | null, direction?: string | null, isValid?: boolean | null): SignalTagTone {
  const cleanedPattern = normalizeBreakthroughPatternType(patternType);
  if (cleanedPattern.includes('假')) {
    return 'warning';
  }

  if (isValid) {
    const normalizedDirection = cleanText(direction).toLowerCase();
    if (normalizedDirection === 'up') {
      return 'bullish';
    }
    if (normalizedDirection === 'down') {
      return 'bearish';
    }
    return 'neutral';
  }

  return 'neutral';
}

function levelNestingLabel(resonance?: TrinityLevelNestingDecision['resonance']): string {
  switch (resonance) {
    case 'aligned':
      return '共振一致';
    case 'child_countertrend':
      return '子级逆势';
    case 'conflict':
      return '级别冲突';
    case 'parent_unclear':
      return '父级不明';
    default:
      return '';
  }
}

function levelNestingTone(
  resonance?: TrinityLevelNestingDecision['resonance'],
  parentBias?: TrinityLevelNestingDecision['parent_bias']
): SignalTagTone {
  switch (resonance) {
    case 'aligned':
      if (parentBias === 'bullish') {
        return 'bullish';
      }
      if (parentBias === 'bearish') {
        return 'bearish';
      }
      return 'neutral';
    case 'child_countertrend':
    case 'conflict':
      return 'warning';
    case 'parent_unclear':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function parentBiasLabel(
  parentBias?: TrinityLevelNestingDecision['parent_bias']
): string {
  switch (parentBias) {
    case 'bullish':
      return '父级偏多';
    case 'bearish':
      return '父级偏空';
    case 'neutral':
      return '父级中性';
    default:
      return '父级未明';
  }
}

function executionLabel(
  entryStyle?: TrinityDecision['execution']['entry_style'],
  canTrade?: boolean
): string {
  switch (entryStyle) {
    case 'boundary':
      return '边界执行';
    case 'pullback':
      return '回踩执行';
    case 'breakout':
      return '突破执行';
    case 't_trade':
      return 'T交易';
    case 'node':
      return '节点执行';
    default:
      return canTrade ? '执行跟踪' : '等待触发';
  }
}

function executionTone(
  entryStyle?: TrinityDecision['execution']['entry_style'],
  canTrade?: boolean,
  bias?: TrinityDecision['conclusion']['bias']
): SignalTagTone {
  if (!canTrade) {
    return 'neutral';
  }

  if (entryStyle === 't_trade') {
    return 'warning';
  }

  if (bias === 'bullish') {
    return 'bullish';
  }
  if (bias === 'bearish') {
    return 'bearish';
  }
  return 'neutral';
}

function buildExecutionHoverItems(decision: TrinityDecision): Array<{ label: string; value?: string | null }> {
  const preview = resolveExecutionPreview(decision);

  return [
    {
      label: '说明',
      value:
        decision.execution_plan?.current_position_action ??
        decision.judgment?.current_best_action ??
        decision.wait_state?.reason ??
        decision.execution.position_sizing.reason ??
        decision.conclusion.wait_reason,
    },
    { label: '先手点', value: preview.probeEntry },
    { label: '确认点', value: preview.confirmEntry },
    { label: '失效点', value: preview.invalidation },
  ];
}

function buildLevelNestingHoverItems(
  decision: TrinityDecision
): Array<{ label: string; value?: string | null }> {
  const levelNesting = decision.level_nesting;
  return [
    { label: '父级偏向', value: parentBiasLabel(levelNesting?.parent_bias) },
    { label: '共振状态', value: levelNestingLabel(levelNesting?.resonance) },
    { label: '说明', value: levelNesting?.permission.reason ?? decision.conclusion.wait_reason },
  ];
}

function buildFallbackStructureTag(period?: PeriodAnalysisData | null): TrinitySignalTag | null {
  const structureType = cleanText(period?.structure?.structure_type);
  if (!structureType) {
    return null;
  }

  return buildTag('structure', '结构', structureLabel(structureType), 'neutral', [
    { label: '解释', value: period?.structure?.description },
  ]);
}

export function buildDecisionSignalTags(
  decision?: TrinityDecision | null,
  options?: BuildSignalTagOptions
): TrinitySignalTag[] {
  if (!decision) {
    return [];
  }

  const tags = [
    buildTag(
      'spacetime',
      '时空',
      decision.zero_axis_signal?.signal_label ?? decision.spacetime.status,
      zeroAxisTone(decision.zero_axis_signal?.impact_on_judgment, decision.spacetime.direction_bias),
      [
        {
          label: '说明',
          value: decision.zero_axis_signal?.reason ?? decision.spacetime.divergence_policy.reason,
        },
        decision.zero_axis_signal
          ? {
              label: '信号状态',
              value: decision.zero_axis_signal.formed ? '零轴强信号已形成' : '零轴强信号尚未形成',
            }
          : {
              label: '结构匹配',
              value: decision.spacetime.structure_match ? '时空与结构匹配' : decision.spacetime.mismatch_reason,
            },
      ]
    ),
    buildTag(
      'divergence',
      '背离',
      decision.divergence_weight?.label ?? divergenceLabel(decision.spacetime.divergence_policy.reason),
      decision.divergence_weight
        ? divergenceDecisionTone(decision.divergence_weight)
        : divergenceTone(divergenceLabel(decision.spacetime.divergence_policy.reason)),
      [{ label: '说明', value: decision.divergence_weight?.reason ?? decision.spacetime.divergence_policy.reason }]
    ),
    buildTag(
      'breakthrough',
      '突破/跌破',
      breakthroughDecisionLabel(decision.moving_average.breakthrough_state),
      breakthroughDecisionTone(decision.moving_average.breakthrough_state),
      [{ label: '说明', value: decision.moving_average.ma_gate.reason }]
    ),
    buildTag('volume', '量能', breakoutVolumeLabel(decision.volume_confirmation.breakout_volume), breakoutVolumeTone(decision.volume_confirmation.breakout_volume), [
      { label: '说明', value: decision.volume_confirmation.volume_gate.reason },
    ]),
    buildTag('moving_average', '均线', maRoleLabel(decision.moving_average.ma55_role), maRoleTone(decision.moving_average.ma55_role), [
      { label: '说明', value: decision.moving_average.ma_gate.reason },
    ]),
    buildTag('structure', '结构', structureTagResult(decision), 'neutral', buildStructureHoverItems(decision)),
    buildTag(
      'level_nesting',
      '级别',
      levelNestingLabel(decision.level_nesting?.resonance),
      levelNestingTone(decision.level_nesting?.resonance, decision.level_nesting?.parent_bias),
      buildLevelNestingHoverItems(decision)
    ),
    buildTag(
      'execution',
      '执行',
      executionLabel(decision.execution.entry_style, decision.conclusion.can_trade),
      executionTone(decision.execution.entry_style, decision.conclusion.can_trade, decision.conclusion.bias),
      buildExecutionHoverItems(decision)
    ),
  ].filter((tag): tag is TrinitySignalTag => Boolean(tag));

  return applyMax(sortSignalTags(tags), options);
}

export function buildPeriodSummarySignalTags(
  period?: PeriodAnalysisData | null,
  options?: BuildSignalTagOptions
): TrinitySignalTag[] {
  if (!period) {
    return [];
  }

  const periodTags = buildPeriodSignalTags(period);
  const decisionTags = buildDecisionSignalTags(period.trinity_decision);
  const tags = [
    decisionTags.find((tag) => tag.key === 'divergence') ?? periodTags.find((tag) => tag.key === 'divergence'),
    (() => {
      const periodTag = periodTags.find((tag) => tag.key === 'breakthrough');
      const decisionTag = decisionTags.find((tag) => tag.key === 'breakthrough');
      if (!periodTag) {
        return decisionTag;
      }
      if (!decisionTag) {
        return periodTag;
      }
      return periodTag.tone === 'neutral' ? decisionTag : periodTag;
    })(),
    periodTags.find((tag) => tag.key === 'spacetime') ?? decisionTags.find((tag) => tag.key === 'spacetime'),
    decisionTags.find((tag) => tag.key === 'volume') ?? periodTags.find((tag) => tag.key === 'volume'),
    decisionTags.find((tag) => tag.key === 'moving_average') ?? periodTags.find((tag) => tag.key === 'moving_average'),
    decisionTags.find((tag) => tag.key === 'structure') ?? buildFallbackStructureTag(period),
    decisionTags.find((tag) => tag.key === 'level_nesting') ?? periodTags.find((tag) => tag.key === 'level_nesting'),
    decisionTags.find((tag) => tag.key === 'execution') ?? periodTags.find((tag) => tag.key === 'execution'),
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
    buildTag('divergence', '背离', divergenceLabel(period.macd?.divergence_note), divergenceTone(divergenceLabel(period.macd?.divergence_note)), [
      { label: '说明', value: period.macd?.divergence_note },
      { label: '策略', value: period.trinity_decision?.spacetime.divergence_policy.reason },
    ]),
    buildTag(
      'breakthrough',
      '突破/跌破',
      normalizeBreakthroughPatternType(period.breakthrough?.pattern_type),
      breakthroughPeriodTone(period.breakthrough?.pattern_type, period.breakthrough?.direction, period.breakthrough?.is_valid),
      (period.breakthrough?.key_signals ?? []).map((item) => ({ label: '信号', value: item }))
    ),
    buildTag(
      'spacetime',
      '时空',
      period.trinity_decision?.zero_axis_signal?.signal_label ??
        period.trinity_decision?.spacetime.status ??
        period.macd?.status,
      zeroAxisTone(
        period.trinity_decision?.zero_axis_signal?.impact_on_judgment,
        period.trinity_decision?.spacetime.direction_bias ?? 'neutral'
      ),
      [
        {
          label: '说明',
          value:
            period.trinity_decision?.zero_axis_signal?.reason ??
            period.macd?.description ??
            period.trinity_decision?.spacetime.divergence_policy.reason,
        },
      ]
    ),
  ].filter((tag): tag is TrinitySignalTag => Boolean(tag));

  return applyMax(tags, options);
}
