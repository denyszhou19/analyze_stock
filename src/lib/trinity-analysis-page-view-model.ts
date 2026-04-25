import type { DataIntegritySnapshot } from '@/lib/stock-data-integrity';
import type {
  AiSummaryCard,
  AnalysisResultData,
  PeriodAnalysisData,
  TrinityJudgmentCriterion,
  TrinityDecision,
} from '@/lib/stock-structure-types';
import {
  formatDecisionActionLabel,
  preferChineseList,
  preferChineseText,
} from './trinity-decision-labels.ts';
import {
  buildExecutionPreview,
  resolveJudgmentLabel,
  resolveRelationLabel,
} from './trinity-judgment-display.ts';
import {
  buildDecisionSignalTags,
  type TrinitySignalTag,
} from './trinity-signal-tags.ts';
import {
  buildStatusExplanation,
  directionFromBias,
  directionFromStructure,
  getActionStatusMeta,
  getDirectionMeta,
  getStructureTagMeta,
  normalizeTradingDisplayText,
  type DirectionTone,
} from './trinity-display-vocabulary.ts';

type TrinityLevel = TrinityDecision['level'];

export type AnalysisPageAiState =
  | { status: 'idle' }
  | { status: 'loading'; label?: string | null }
  | { status: 'error'; message?: string | null }
  | {
      status: 'ready';
      summary: AiSummaryCard;
    };

export interface AnalysisPageDataRangeViewModel {
  level: TrinityLevel;
  label: string;
  countLabel: string;
  coverageLabel: string;
}

export interface AnalysisPageStatusBarViewModel {
  stockLabel: string;
  analysisTimeLabel: string;
  integrityStatus: {
    label: string;
    detail: string | null;
  };
  aiStatus: {
    label: string;
    tone: 'muted' | 'loading' | 'success' | 'danger';
  };
  dataRanges: AnalysisPageDataRangeViewModel[];
}

export interface AnalysisPageHardGateDescription {
  title: string;
  meaning: string;
  tradeImpact: string;
  source: string;
}

export interface AnalysisPageSummaryGate {
  label: string;
  value: string;
  description: AnalysisPageHardGateDescription;
}

export interface AnalysisPageCandidateStructureSummary {
  label?: string | null;
  currentLeg?: string | null;
  upgradeCondition?: string | null;
  invalidation?: string | null;
}

export interface AnalysisPageWaitStateSummary {
  label?: string | null;
  currentBlock?: string | null;
  nextAction?: string | null;
}

export interface AnalysisPageSummaryViewModel {
  mode: AnalysisPageAiState['status'];
  errorMessage?: string | null;
  headline: string;
  primaryActionLabel: string;
  judgmentLabel: string;
  relationLabel: string;
  primaryReason: string;
  triggerLabels: string[];
  riskLabels: string[];
  guardrail: string;
  spacetimeSummary: string;
  structureSummary: string;
  executionSummary: string;
  judgmentWarning?: string | null;
  candidateStructureSummary?: AnalysisPageCandidateStructureSummary | null;
  waitStateSummary?: AnalysisPageWaitStateSummary | null;
  signalTags: AnalysisPageSignalTagViewModel[];
  hardGateTitle: string;
  hardGateSourceLabel: string;
  hardGates: AnalysisPageSummaryGate[];
}

export interface AnalysisPageBusDimension {
  title: string;
  primary: string;
  detail: string;
}

export interface AnalysisPageHoverItem {
  label: string;
  value: string;
}

export interface AnalysisPageExplainableField {
  label: string;
  value: string;
  hoverTitle: string;
  hoverItems: AnalysisPageHoverItem[];
}

export interface AnalysisPageSignalTagViewModel extends TrinitySignalTag {}

export type TradingCombinationKey = 'midline' | 'shortline' | 'intraday_t';

export interface AnalysisPageGlobalStrategyViewModel {
  scopeLabel: string;
  primaryCombination: TradingCombinationKey;
  primaryCombinationLabel: string;
  primaryConstraintLevel: TrinityLevel;
  primaryConstraintLevelLabel: string;
  triggerLevel: TrinityLevel;
  triggerLevelLabel: string;
  direction: DirectionTone;
  directionLabel: string;
  actionLabel: string;
  headline: string;
  primaryReason: string;
  triggerLabels: string[];
  riskLabels: string[];
  guardrail: string;
}

export interface AnalysisPageTradingCombinationViewModel {
  key: TradingCombinationKey;
  label: string;
  levels: [TrinityLevel, TrinityLevel];
  direction: DirectionTone;
  directionLabel: string;
  actionLabel: string;
  judgmentLabel: string;
  relationLabel: string;
  relationHint: string;
  summary: string;
  recommendation: string;
  signalTags: AnalysisPageSignalTagViewModel[];
  actionStateTags: AnalysisPageSignalTagViewModel[];
  judgmentBasisTags: AnalysisPageSignalTagViewModel[];
  parentConstraintTags: AnalysisPageSignalTagViewModel[];
  parentSignalTags: AnalysisPageSignalTagViewModel[];
  parentConstraint: AnalysisPageExplainableField;
  triggerLevel: AnalysisPageExplainableField;
  triggerLevelLabel: string;
  suitableAction: AnalysisPageExplainableField;
  majorRisk: AnalysisPageExplainableField;
  explanation: string;
}

interface BuiltTradingCombination extends AnalysisPageTradingCombinationViewModel {
  status: TrinityJudgmentCriterion['status'];
}

export interface AnalysisPageRuleChainItem {
  title: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  displayStatusLabel: string;
  displayStatusIcon: string;
  direction: DirectionTone;
  directionLabel: string;
  detail: string;
  reason: string;
  summary: string;
  recommendation: string;
  signalTags: AnalysisPageSignalTagViewModel[];
  detailHover: {
    title: string;
    items: AnalysisPageHoverItem[];
  };
  statusExplanation: ReturnType<typeof buildStatusExplanation>;
}

export interface AnalysisPageViewModel {
  statusBar: AnalysisPageStatusBarViewModel;
  globalStrategy: AnalysisPageGlobalStrategyViewModel;
  summary: AnalysisPageSummaryViewModel;
  tradingCombinations: AnalysisPageTradingCombinationViewModel[];
  bus: {
    dimensions: AnalysisPageBusDimension[];
  };
  ruleChain: {
    sourceLabel: string;
    items: AnalysisPageRuleChainItem[];
  };
}

const PRIMARY_DECISION_ORDER: TrinityLevel[] = ['daily', 'weekly', 'hour60', 'hour30', 'hour15'];
const DATA_RANGE_ORDER: TrinityLevel[] = ['weekly', 'daily', 'hour60', 'hour30', 'hour15'];

const LEVEL_LABELS: Record<TrinityLevel, string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

const BIAS_LABELS: Record<TrinityDecision['conclusion']['bias'], string> = {
  bullish: '偏多',
  bearish: '偏空',
  neutral: '中性',
};

const STRUCTURE_QUALIFICATION_LABELS: Record<TrinityDecision['structure']['qualification'], string> = {
  standard: '标准结构',
  extended: '延伸可观察',
  over_limit: '超限降级',
  unfinished: '未完成',
  failed: '不合格',
};

const TRADE_MODE_LABELS: Record<TrinityDecision['trade_qualification']['trade_mode'], string> = {
  standard_node_trade: '标准节点交易',
  conditional_boundary_trade: '条件边界交易',
  wait_confirmation: '等待确认',
  risk_control: '风险控制',
  no_trade: '不交易',
};

const POSITION_PERMISSION_LABELS: Record<
  TrinityDecision['trade_qualification']['position_permission'],
  string
> = {
  full_signal: '完整信号',
  half_position: '半仓以内',
  light_probe: '轻仓试探',
  t_trade_only: '仅做 T',
  reduce_only: '仅减仓',
  no_position: '空仓等待',
};

const MA55_ROLE_LABELS: Record<TrinityDecision['moving_average']['ma55_role'], string> = {
  support: '支撑',
  resistance: '压制',
  neutral: '中性',
};

const MA233_ROLE_LABELS: Record<TrinityDecision['moving_average']['ma233_role'], string> = {
  support: '支撑',
  resistance: '压制',
  neutral: '中性',
};

const BREAKTHROUGH_STATE_LABELS: Record<
  TrinityDecision['moving_average']['breakthrough_state'],
  string
> = {
  none: '无突破',
  breakout_pending: '突破待确认',
  valid_breakout: '有效突破',
  pullback_confirmed: '回踩确认',
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

const BREAKOUT_VOLUME_LABELS: Record<
  TrinityDecision['volume_confirmation']['breakout_volume'],
  string
> = {
  confirmed: '突破放量确认',
  weak: '突破量能偏弱',
  climax_risk: '突破量能过热',
  not_applicable: '无突破量能要求',
};

const BREAKDOWN_VOLUME_LABELS: Record<
  TrinityDecision['volume_confirmation']['breakdown_volume'],
  string
> = {
  confirmed: '跌破放量确认',
  weak: '跌破量能偏弱',
  climax_risk: '跌破量能过热',
  not_applicable: '无跌破量能要求',
};

const PULLBACK_VOLUME_LABELS: Record<
  TrinityDecision['volume_confirmation']['pullback_volume'],
  string
> = {
  healthy_shrink: '回踩健康缩量',
  danger_expand: '回踩放量风险',
  normal: '回踩量能正常',
  not_applicable: '无回踩量能要求',
};

const ENTRY_STYLE_LABELS: Record<string, string> = {
  node: '节点执行',
  boundary: '边界执行',
  pullback: '回踩执行',
  breakout: '突破执行',
  pullback_confirm: '回抽确认执行',
  trend_hold: '趋势持有',
  t_trade: 'T 交易',
  none: '不执行',
  wait: '等待触发',
  待执行: '等待触发',
  等待执行: '等待触发',
};

const RESONANCE_LABELS: Record<NonNullable<TrinityDecision['level_nesting']>['resonance'], string> = {
  aligned: '共振一致',
  conflict: '级别冲突',
  child_countertrend: '子级逆势',
  parent_unclear: '父级不明',
  boundary_probe: '边界试探',
  structure_mismatch: '结构错配',
  blocked: '父级未放行',
};

const COMBINATION_RESONANCE_LABELS: Record<NonNullable<TrinityDecision['level_nesting']>['resonance'], string> = {
  aligned: '支持',
  conflict: '级别冲突',
  child_countertrend: '逆父级',
  parent_unclear: '父级不明',
  boundary_probe: '边界试探',
  structure_mismatch: '结构错配',
  blocked: '父级未放行',
};

const EXECUTION_STRENGTH_LABELS: Record<string, string> = {
  normal: '按确认执行',
  light_probe: '等待边界确认',
  wait_confirmation: '等待确认',
  observe_only: '只观察',
  risk_control_first: '风控优先',
};


function pickPrimaryDecision(result: AnalysisResultData): TrinityDecision {
  for (const level of PRIMARY_DECISION_ORDER) {
    const decision = result.periods[level]?.trinity_decision;
    if (decision) {
      return decision;
    }
  }

  throw new Error('缺少可用的三位一体判定');
}

function formatList(items?: string[] | null, fallback = '无'): string {
  return items?.filter(Boolean).join('、') || fallback;
}

function normalizeRuleChainText(value?: string | null): string {
  if (!value) {
    return '';
  }

  return normalizeTradingDisplayText(value);
}

function formatEntryStyleLabel(entryStyle?: string | null): string {
  const normalized = entryStyle?.trim();
  if (!normalized) {
    return '等待执行';
  }

  return ENTRY_STYLE_LABELS[normalized] ?? (/[一-鿿]/.test(normalized) ? normalized : '等待执行');
}

function normalizeExecutionDetail(detail?: string | null): string {
  const normalized = normalizeRuleChainText(detail);
  if (!normalized) {
    return '等待执行';
  }

  const [entryStyle, ...rest] = normalized.split('｜');
  const entryStyleLabel = formatEntryStyleLabel(entryStyle);
  return rest.length ? [entryStyleLabel, ...rest].join('｜') : entryStyleLabel;
}

function createHoverItem(label: string, value?: string | null, fallback = '暂无补充说明'): AnalysisPageHoverItem {
  const normalizedValue = normalizeRuleChainText(value);
  return {
    label,
    value: normalizedValue || fallback,
  };
}

function buildExplainableField({
  label,
  value,
  hoverTitle,
  hoverItems,
}: {
  label: string;
  value?: string | null;
  hoverTitle: string;
  hoverItems: AnalysisPageHoverItem[];
}): AnalysisPageExplainableField {
  return {
    label,
    value: normalizeRuleChainText(value) || '暂无明确说明',
    hoverTitle,
    hoverItems,
  };
}

function compactTriggerText(trigger?: string | null): string {
  const normalized = normalizeRuleChainText(trigger);
  if (!normalized) {
    return '等待确认信号';
  }

  return normalized.replace(/^(周线|日线|60分钟|30分钟|15分钟)/, '').trim();
}

function buildCombinationSummary(
  majorLevel: TrinityLevel,
  minorLevel: TrinityLevel,
  major: TrinityDecision | null,
  minor: TrinityDecision | null
): string {
  const majorLabel = LEVEL_LABELS[majorLevel];
  const minorLabel = LEVEL_LABELS[minorLevel];

  if (!major) {
    return `${majorLabel}缺失，${minorLabel}先不单独执行`;
  }

  if (!major.conclusion.can_trade || major.trade_qualification.position_permission === 'no_position') {
    return `${majorLabel}还没完全放行，${minorLabel}先看确认`;
  }

  if (minor?.conclusion.can_trade) {
    return `${majorLabel}给背景，${minorLabel}可按触发执行`;
  }

  return `${majorLabel}定背景，${minorLabel}继续等触发`;
}

function buildCombinationRecommendation(
  majorLevel: TrinityLevel,
  major: TrinityDecision | null,
  minor: TrinityDecision | null
): string {
  if (!major) {
    return `先等${LEVEL_LABELS[majorLevel]}数据补齐`;
  }

  const triggerDecision = minor ?? major;
  const triggerLevelLabel = minor ? LEVEL_LABELS[minor.level] : LEVEL_LABELS[major.level];
  const levelCondition = firstLevelNestingCondition(
    triggerDecision.level_nesting,
    'wait_conditions',
    triggerLevelLabel
  );
  const primaryTrigger = levelCondition || resolveCombinationTriggerText(triggerDecision, triggerLevelLabel);
  if (primaryTrigger.startsWith('等待')) {
    return `先${primaryTrigger}`;
  }
  return `先等${primaryTrigger}`;
}

function buildCombinationSignalTags(
  major: TrinityDecision | null,
  minor: TrinityDecision | null
): AnalysisPageSignalTagViewModel[] {
  const majorTags = buildDecisionSignalTags(major);
  const minorTags = buildDecisionSignalTags(minor).filter(
    (tag) => !majorTags.some((majorTag) => majorTag.key === tag.key && majorTag.label === tag.label)
  );
  return [...majorTags, ...minorTags];
}

function filterSignalTagsByKeys(
  tags: AnalysisPageSignalTagViewModel[],
  keys: TrinitySignalTag['key'][]
): AnalysisPageSignalTagViewModel[] {
  return tags.filter((tag) => keys.includes(tag.key));
}

function buildCustomSignalTag(
  key: TrinitySignalTag['key'],
  category: TrinitySignalTag['category'],
  result: string,
  tone: TrinitySignalTag['tone'],
  items: Array<{ label: string; value: string }>
): AnalysisPageSignalTagViewModel {
  const label = `${category}｜${result}`;
  return {
    key,
    category,
    result,
    label,
    tone,
    hover: {
      title: `${label}说明`,
      items,
    },
  };
}

function replaceAbstractLevelText(value: string, levelLabel: string): string {
  return value.replace(/次级别/g, levelLabel);
}

function ensureLevelPrefix(value: string, levelLabel: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return `${levelLabel}等待确认信号`;
  }
  return normalized.startsWith(levelLabel) ? normalized : `${levelLabel}${normalized}`;
}

function stripLevelPrefix(value: string, levelLabel: string): string {
  return value.startsWith(levelLabel) ? value.slice(levelLabel.length).trim() : value;
}

function resolveCombinationTriggerText(
  decision: TrinityDecision | null | undefined,
  levelLabel: string
): string {
  return ensureLevelPrefix(replaceAbstractLevelText(resolvePrimaryTriggerText(decision), levelLabel), levelLabel);
}

function resolveScopedCombinationTriggerText(
  decision: TrinityDecision | null | undefined,
  levelLabel: string
): string {
  return stripLevelPrefix(resolveCombinationTriggerText(decision, levelLabel), levelLabel) || '等待确认信号';
}

function normalizeLevelCondition(value: string | undefined, levelLabel: string): string {
  if (!value) {
    return '';
  }
  const cleaned = replaceAbstractLevelText(normalizeRuleChainText(value), levelLabel);
  if (!cleaned) {
    return '';
  }
  if (cleaned.startsWith(levelLabel) || cleaned.startsWith(`等待${levelLabel}`)) {
    return cleaned;
  }
  return `${levelLabel}${cleaned}`;
}

function firstLevelNestingCondition(
  nesting: TrinityDecision['level_nesting'] | undefined,
  key: 'wait_conditions' | 'confirm_conditions' | 'invalidation_conditions',
  levelLabel: string
): string {
  const value = nesting?.[key]?.find((item) => Boolean(item?.trim()));
  return normalizeLevelCondition(value, levelLabel);
}

function levelNestingConditions(
  nesting: TrinityDecision['level_nesting'] | undefined,
  key: 'wait_conditions' | 'confirm_conditions' | 'invalidation_conditions',
  levelLabel: string
): string[] {
  const items =
    nesting?.[key]
      ?.map((item) => normalizeLevelCondition(item, levelLabel))
      .filter((item): item is string => Boolean(item)) ?? [];
  return [...new Set(items)].slice(0, 3);
}

function scopedLevelCondition(
  value: string,
  levelLabel: string
): string {
  if (value.startsWith(`等待${levelLabel}`)) {
    return value.slice(`等待${levelLabel}`.length).trim();
  }
  return value.startsWith(levelLabel) ? value.slice(levelLabel.length).trim() : value;
}
function formatCombinationList(
  items: string[],
  fallback: string,
  levelLabel: string
): string {
  return replaceAbstractLevelText(formatList(items, fallback), levelLabel);
}

function buildParentConstraintTags(decision: TrinityDecision | null): AnalysisPageSignalTagViewModel[] {
  return filterSignalTagsByKeys(buildDecisionSignalTags(decision), [
    'spacetime',
    'divergence',
    'breakthrough',
    'volume',
    'moving_average',
    'structure',
  ]);
}

function buildCombinationActionStateTags(
  majorLabel: string,
  minorLabel: string,
  major: TrinityDecision | null,
  minor: TrinityDecision | null
): AnalysisPageSignalTagViewModel[] {
  const majorBlocked = !major || major.trade_qualification.position_permission === 'no_position';
  const nesting = minor?.level_nesting ?? major?.level_nesting;
  const relationCopy = nesting ? COMBINATION_RESONANCE_LABELS[nesting.resonance] : '';
  const levelResult = majorBlocked
    ? `${majorLabel}未放行`
    : nesting?.resonance === 'boundary_probe'
      ? `${minorLabel}${relationCopy}`
      : nesting?.resonance === 'structure_mismatch'
        ? `${minorLabel}${relationCopy}`
        : nesting?.resonance === 'blocked'
          ? `${majorLabel}未放行`
          : nesting?.resonance === 'aligned'
            ? `${majorLabel}${relationCopy}${minorLabel}`
            : nesting?.resonance === 'child_countertrend' || nesting?.resonance === 'conflict'
              ? `${minorLabel}逆${majorLabel}`
              : `${majorLabel}未放行`;
  const waitCondition = firstLevelNestingCondition(minor?.level_nesting, 'wait_conditions', minorLabel);
  const trigger = waitCondition || (minor ? resolveCombinationTriggerText(minor, minorLabel) : '');
  const executionResult = `${minorLabel}${EXECUTION_STRENGTH_LABELS[nesting?.execution_strength ?? ''] ?? '等待触发'}`;
  const levelTone =
    majorBlocked || nesting?.resonance === 'boundary_probe' || nesting?.resonance === 'structure_mismatch' || nesting?.resonance === 'blocked'
      ? 'warning'
      : 'neutral';

  return [
    buildCustomSignalTag(
      'level_nesting',
      '级别',
      levelResult,
      levelTone,
      [
        { label: '父级别', value: majorLabel },
        { label: '子级别', value: minorLabel },
        { label: '节点语义', value: nesting?.node_semantic?.label },
        {
          label: '说明',
          value:
            nesting?.permission.reason ??
            `${majorLabel}未完全放行，${minorLabel}只能等待确认。`,
        },
      ].filter((item): item is { label: string; value: string } => Boolean(item.value))
    ),
    buildCustomSignalTag('execution', '执行', executionResult, 'neutral', [
      { label: '执行级别', value: minorLabel },
      { label: '当前动作', value: '继续等待' },
      { label: '等待条件', value: trigger || `${minorLabel}等待更明确确认` },
    ]),
  ];
}

function buildCombinationBasisTags(decision: TrinityDecision | null): AnalysisPageSignalTagViewModel[] {
  return filterSignalTagsByKeys(buildDecisionSignalTags(decision), [
    'spacetime',
    'divergence',
    'breakthrough',
    'volume',
    'moving_average',
    'structure',
  ]);
}

function buildCategorySignalTags(
  category: TrinityJudgmentCriterion['category'],
  decision: TrinityDecision
): AnalysisPageSignalTagViewModel[] {
  const tags = buildDecisionSignalTags(decision);
  const byCategory: Partial<Record<TrinityJudgmentCriterion['category'], TrinitySignalTag['key'][]>> = {
    structure: ['structure'],
    spacetime: ['spacetime'],
    moving_average: ['breakthrough', 'moving_average'],
    volume: ['volume'],
    level_nesting: ['level_nesting'],
    execution: ['execution'],
  };
  const keys = byCategory[category];
  if (!keys) {
    return [];
  }

  return tags.filter((tag) => keys.includes(tag.key));
}

function buildStructureRuleSummary(decision: TrinityDecision): string {
  if (decision.structure.explainability.status === 'passed') {
    return 'A原型成立，但仍需等待更明确确认';
  }
  if (decision.structure.explainability.status === 'failed') {
    return '结构条件不成立，当前不能按结构交易';
  }
  return '延伸结构可观察，但不能按标准节点操作';
}

function buildStructureRuleRecommendation(decision: TrinityDecision): string {
  const canTradeByNodes =
    decision.trade_qualification.trade_mode === 'standard_node_trade' &&
    decision.structure.can_trade_by_structure_nodes;
  return canTradeByNodes ? '先沿结构确认节奏继续跟踪' : '先按结构边界和确认节奏继续跟踪';
}

function buildRuleDetailHover(
  title: string,
  summary: string,
  detail: string,
  reason: string,
  decision: TrinityDecision,
  basis: string
): { title: string; items: AnalysisPageHoverItem[] } {
  return {
    title: `${title}说明`,
    items: [
      createHoverItem('这句话是什么意思', summary),
      createHoverItem('为什么这么判断', detail || reason),
      createHoverItem(
        '当前限制',
        resolveChineseReason(
          [
            decision.wait_state?.current_block,
            decision.wait_state?.reason,
            decision.judgment?.critical_reason,
            decision.conclusion.wait_reason,
            decision.trade_qualification.reason?.[0],
            decision.execution.position_sizing.reason,
          ],
          '暂无明确限制'
        )
      ),
      createHoverItem(
        '下一步条件',
        formatList(
          [...resolveDecisionTriggerLabels(decision), ...resolveDecisionConfirmationLabels(decision)],
          '继续等待下一步信号'
        )
      ),
      createHoverItem(
        '判定依据',
        basis || reason || '以后端判定链为准'
      ),
    ],
  };
}

function buildRuleChainSourceLabel(level: TrinityLevel): string {
  const levelIndex = PRIMARY_DECISION_ORDER.indexOf(level);
  if (levelIndex <= 0) {
    return '本规则链默认按日线主判定展示；若日线缺失，则依次降级为周线、60分钟、30分钟、15分钟。';
  }

  const missingLevels = PRIMARY_DECISION_ORDER.slice(0, levelIndex).map((item) => LEVEL_LABELS[item]);
  return `本规则链当前按${LEVEL_LABELS[level]}主判定展示；因${missingLevels.join('、')}主判定缺失，已自动降级。`;
}

function decorateRuleChainItem({
  title,
  status,
  direction,
  detail,
  reason,
  summary,
  recommendation,
  signalTags,
  detailHover,
}: {
  title: string;
  status: TrinityJudgmentCriterion['status'];
  direction: DirectionTone;
  detail: string;
  reason: string;
  summary: string;
  recommendation: string;
  signalTags: AnalysisPageSignalTagViewModel[];
  detailHover: {
    title: string;
    items: AnalysisPageHoverItem[];
  };
}): AnalysisPageRuleChainItem {
  const statusMeta = getActionStatusMeta(status);

  return {
    title,
    status,
    displayStatusLabel: statusMeta.label,
    displayStatusIcon: statusMeta.icon,
    direction,
    directionLabel: getDirectionMeta(direction).label,
    detail,
    reason,
    summary,
    recommendation,
    signalTags,
    detailHover,
    statusExplanation: buildStatusExplanation({ status, direction, reason }),
  };
}

function formatCoverage(startDate?: string | null, endDate?: string | null): string {
  if (startDate && endDate) {
    return `${startDate.slice(0, 10)} 至 ${endDate.slice(0, 10)}`;
  }
  if (startDate) {
    return `自 ${startDate.slice(0, 10)}`;
  }
  if (endDate) {
    return `至 ${endDate.slice(0, 10)}`;
  }
  return '覆盖区间未知';
}

function buildDataRanges(result: AnalysisResultData): AnalysisPageDataRangeViewModel[] {
  return DATA_RANGE_ORDER.flatMap((level) => {
    const period = result.periods[level];
    if (!period) {
      return [];
    }

    const details = period.structure?.structure_details;
    const count = details?.pipeline_debug?.analysis_kline_count;

    return [
      {
        level,
        label: LEVEL_LABELS[level],
        countLabel: typeof count === 'number' && Number.isFinite(count) ? `近 ${count} 根` : '根数未知',
        coverageLabel: formatCoverage(details?.valid_range?.start_date, details?.valid_range?.end_date),
      },
    ];
  });
}

function formatAiStatus(aiState: AnalysisPageAiState): AnalysisPageStatusBarViewModel['aiStatus'] {
  if (aiState.status === 'ready') {
    return { label: '已生成', tone: 'success' };
  }
  if (aiState.status === 'loading') {
    return { label: '生成中', tone: 'loading' };
  }
  if (aiState.status === 'error') {
    return { label: '生成失败', tone: 'danger' };
  }
  return { label: '未生成', tone: 'muted' };
}

function buildStatusBar(
  result: AnalysisResultData,
  integrity: DataIntegritySnapshot,
  aiState: AnalysisPageAiState
): AnalysisPageStatusBarViewModel {
  return {
    stockLabel: [result.stock_name, result.stock_code].filter(Boolean).join('｜') || '未知标的',
    analysisTimeLabel: result.analysis_time ?? '分析时间未知',
    integrityStatus: {
      label: integrity.summary.overallText,
      detail: integrity.summary.analyzeWarning,
    },
    aiStatus: formatAiStatus(aiState),
    dataRanges: buildDataRanges(result),
  };
}

function gateDescription(
  label: string,
  value: string,
  source: string
): AnalysisPageHardGateDescription {
  const meanings: Record<string, string> = {
    后端最终动作: '后端确定性链路给出的当前最大动作。',
    交易模式: '当前策略允许采用的交易模式。',
    仓位权限: '后端允许的最大仓位动作范围。',
    结构资格: '当前结构是否具备交易解释力。',
    聚焦结构: '当前主策略正在跟踪的结构类型。',
    执行级别: '当前硬门控来自哪个主判定级别。',
    量能状态: '突破、跌破或回踩是否获得量能支持。',
    结论约束: '当前策略不能突破的主要限制。',
  };

  return {
    title: label,
    meaning: meanings[label] ?? '当前硬门控字段。',
    tradeImpact: `当前值为「${value}」，AI 和页面结论不能突破这个限制。`,
    source,
  };
}

function resolveChineseReason(
  candidates: Array<string | null | undefined>,
  fallback = '暂无明确结论约束'
): string {
  const chineseCandidate = candidates.find((candidate) => {
    const value = preferChineseText(candidate, '').trim();
    return /[\u4e00-\u9fff]/.test(value);
  });
  if (chineseCandidate) {
    return preferChineseText(chineseCandidate, fallback).trim();
  }

  const firstNonEmpty = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  if (firstNonEmpty) {
    return fallback;
  }

  return fallback;
}

function primaryLevelSourceLabel(
  decision: TrinityDecision,
  primaryCombination: AnalysisPageTradingCombinationViewModel,
  preferredLevel: TrinityLevel
): string {
  const combinationLabel = `；当前优先组合：${primaryCombination.label}`;
  if (decision.level === preferredLevel) {
    return `当前硬门控来自主判定级别：${LEVEL_LABELS[decision.level]}${combinationLabel}`;
  }

  return `当前硬门控来自主判定级别：${LEVEL_LABELS[decision.level]}${combinationLabel}；因${LEVEL_LABELS[preferredLevel]}主判定缺失，已自动降级。`;
}

function buildHardGates(decision: TrinityDecision): AnalysisPageSummaryGate[] {
  const actionLabel = formatDecisionActionLabel(
    decision.conclusion.action,
    decision.conclusion.action_label
  );
  const volumeValue = `${VOLUME_STATE_LABELS[decision.volume_confirmation.volume_state]}｜${BREAKOUT_VOLUME_LABELS[decision.volume_confirmation.breakout_volume]}`;
  const guardrailValue = resolveChineseReason(
    [decision.conclusion.wait_reason, decision.execution.position_sizing.reason],
    '暂无明确结论约束'
  );

  return [
    {
      label: '后端最终动作',
      value: actionLabel,
      description: gateDescription('后端最终动作', actionLabel, 'trinity_decision.conclusion.action'),
    },
    {
      label: '交易模式',
      value: TRADE_MODE_LABELS[decision.trade_qualification.trade_mode],
      description: gateDescription(
        '交易模式',
        TRADE_MODE_LABELS[decision.trade_qualification.trade_mode],
        'trinity_decision.trade_qualification.trade_mode'
      ),
    },
    {
      label: '仓位权限',
      value: POSITION_PERMISSION_LABELS[decision.trade_qualification.position_permission],
      description: gateDescription(
        '仓位权限',
        POSITION_PERMISSION_LABELS[decision.trade_qualification.position_permission],
        'trinity_decision.trade_qualification.position_permission'
      ),
    },
    {
      label: '结构资格',
      value: STRUCTURE_QUALIFICATION_LABELS[decision.structure.qualification],
      description: gateDescription(
        '结构资格',
        STRUCTURE_QUALIFICATION_LABELS[decision.structure.qualification],
        'trinity_decision.structure.qualification'
      ),
    },
    {
      label: '聚焦结构',
      value: decision.structure.type,
      description: gateDescription('聚焦结构', decision.structure.type, 'trinity_decision.structure.type'),
    },
    {
      label: '执行级别',
      value: LEVEL_LABELS[decision.level],
      description: gateDescription('执行级别', LEVEL_LABELS[decision.level], 'trinity_decision.level'),
    },
    {
      label: '量能状态',
      value: volumeValue,
      description: gateDescription(
        '量能状态',
        volumeValue,
        'trinity_decision.volume_confirmation.volume_state'
      ),
    },
    {
      label: '结论约束',
      value: guardrailValue,
      description: gateDescription(
        '结论约束',
        guardrailValue,
        decision.conclusion.wait_reason
          ? 'trinity_decision.conclusion.wait_reason'
          : 'trinity_decision.execution.position_sizing.reason'
      ),
    },
  ];
}

function buildSpacetimeSummary(decision: TrinityDecision): string {
  const detail = resolveChineseReason(
    [
      decision.zero_axis_signal?.reason,
      decision.divergence_weight?.reason,
      decision.spacetime.mismatch_reason,
      decision.spacetime.divergence_policy.reason,
    ],
    '继续等待时空共振确认'
  );
  return `时空：${decision.zero_axis_signal?.signal_label ?? decision.spacetime.status}，${detail}`;
}

function buildStructureSummary(decision: TrinityDecision): string {
  const candidateStructure = decision.candidate_structure;
  if (candidateStructure?.candidate_label) {
    const structureLabel = [candidateStructure.candidate_label, candidateStructure.current_leg]
      .map((item) => normalizeRuleChainText(item))
      .filter(Boolean)
      .join('｜');
    const detail = resolveChineseReason(
      [candidateStructure.reason, decision.structure.explainability.reason],
      '继续等待结构确认'
    );
    return `结构：${structureLabel}，${detail}`;
  }

  const detail = resolveChineseReason(
    [decision.structure.explainability.reason],
    '继续等待结构确认'
  );
  return `结构：${decision.structure.type}，${detail}`;
}

function buildExecutionSummary(decision: TrinityDecision): string {
  const preview = buildExecutionPreview(decision);
  const probeEntry = decision.execution_plan?.probe_entry ?? compactTriggerText(preview.probeEntry);
  const confirmEntry = decision.execution_plan?.confirm_entry ?? compactTriggerText(preview.confirmEntry);
  const invalidation = decision.execution_plan?.invalidation ?? compactTriggerText(preview.invalidation);

  return `现在怎么做：先看${probeEntry}，确认看${confirmEntry}，失效看${invalidation}`;
}

function normalizeOptionalSummaryText(value?: string | null): string | null {
  const normalized = normalizeRuleChainText(value);
  return normalized || null;
}

function toCandidateStructureSummary(
  value?: AiSummaryCard['candidate_structure'] | null
): AnalysisPageCandidateStructureSummary | null {
  if (!value) {
    return null;
  }

  const summary: AnalysisPageCandidateStructureSummary = {
    label: normalizeOptionalSummaryText(value.label),
    currentLeg: normalizeOptionalSummaryText(value.current_leg),
    upgradeCondition: normalizeOptionalSummaryText(value.upgrade_condition),
    invalidation: normalizeOptionalSummaryText(value.invalidation),
  };

  return Object.values(summary).some(Boolean) ? summary : null;
}

function buildBackendCandidateStructureSummary(
  decision: TrinityDecision
): AnalysisPageCandidateStructureSummary | null {
  const candidateStructure = decision.candidate_structure;
  if (!candidateStructure) {
    return null;
  }

  return toCandidateStructureSummary({
    label: candidateStructure.candidate_label,
    current_leg: candidateStructure.current_leg,
    upgrade_condition: candidateStructure.upgrade_condition,
    invalidation: candidateStructure.invalidation,
  });
}

function preferCandidateStructureSummary(
  aiSummary: AnalysisPageCandidateStructureSummary | null,
  backendSummary: AnalysisPageCandidateStructureSummary | null
): AnalysisPageCandidateStructureSummary | null {
  if (!aiSummary && !backendSummary) {
    return null;
  }

  const merged: AnalysisPageCandidateStructureSummary = {
    label: aiSummary?.label ?? backendSummary?.label ?? null,
    currentLeg: aiSummary?.currentLeg ?? backendSummary?.currentLeg ?? null,
    upgradeCondition: aiSummary?.upgradeCondition ?? backendSummary?.upgradeCondition ?? null,
    invalidation: aiSummary?.invalidation ?? backendSummary?.invalidation ?? null,
  };

  return Object.values(merged).some(Boolean) ? merged : null;
}

function toWaitStateSummary(
  value?: AiSummaryCard['wait_state'] | null
): AnalysisPageWaitStateSummary | null {
  if (!value) {
    return null;
  }

  const summary: AnalysisPageWaitStateSummary = {
    label: normalizeOptionalSummaryText(value.label),
    currentBlock: normalizeOptionalSummaryText(value.current_block),
    nextAction: normalizeOptionalSummaryText(value.next_action),
  };

  return Object.values(summary).some(Boolean) ? summary : null;
}

function buildBackendWaitStateSummary(
  decision: TrinityDecision
): AnalysisPageWaitStateSummary | null {
  const waitState = decision.wait_state;
  if (!waitState) {
    return null;
  }

  return toWaitStateSummary({
    label: waitState.wait_label,
    current_block: waitState.current_block,
    next_action: waitState.next_confirmation_action,
  });
}

function preferWaitStateSummary(
  aiSummary: AnalysisPageWaitStateSummary | null,
  backendSummary: AnalysisPageWaitStateSummary | null
): AnalysisPageWaitStateSummary | null {
  if (!aiSummary && !backendSummary) {
    return null;
  }

  const merged: AnalysisPageWaitStateSummary = {
    label: aiSummary?.label ?? backendSummary?.label ?? null,
    currentBlock: aiSummary?.currentBlock ?? backendSummary?.currentBlock ?? null,
    nextAction: aiSummary?.nextAction ?? backendSummary?.nextAction ?? null,
  };

  return Object.values(merged).some(Boolean) ? merged : null;
}

function resolveDecisionTriggerLabels(decision?: TrinityDecision | null): string[] {
  if (!decision) {
    return [];
  }

  const phase2Triggers = [
    decision.execution_plan?.probe_entry,
    decision.execution_plan?.confirm_entry,
    decision.wait_state?.next_confirmation_action,
  ].filter((item): item is string => Boolean(item));

  if (phase2Triggers.length > 0) {
    return phase2Triggers;
  }

  return decision.execution.triggers;
}

function resolvePrimaryTriggerText(decision?: TrinityDecision | null): string {
  const primaryTrigger = resolveDecisionTriggerLabels(decision).at(0);
  if (!primaryTrigger) {
    return '等待确认信号';
  }

  if (
    decision?.execution_plan?.probe_entry ||
    decision?.execution_plan?.confirm_entry ||
    decision?.wait_state?.next_confirmation_action
  ) {
    return normalizeRuleChainText(primaryTrigger) || '等待确认信号';
  }

  return compactTriggerText(primaryTrigger);
}

function resolveDecisionConfirmationLabels(decision?: TrinityDecision | null): string[] {
  if (!decision) {
    return [];
  }

  const phase2Confirmations = [
    decision.execution_plan?.confirm_entry,
    decision.wait_state?.next_confirmation_action,
  ].filter((item): item is string => Boolean(item));

  if (phase2Confirmations.length > 0) {
    return phase2Confirmations;
  }

  return decision.execution.confirmation;
}

function resolveDecisionInvalidationLabels(decision?: TrinityDecision | null): string[] {
  if (!decision) {
    return [];
  }

  if (decision.execution_plan?.invalidation) {
    return [decision.execution_plan.invalidation];
  }

  return decision.execution.invalidation;
}

function resolveDecisionRiskLabels(decision?: TrinityDecision | null): string[] {
  if (!decision) {
    return [];
  }

  if (decision.execution_plan?.invalidation) {
    return [decision.execution_plan.invalidation];
  }

  return decision.execution.risk_flags;
}

function resolveDecisionActionReason(decision?: TrinityDecision | null): string {
  if (!decision) {
    return '';
  }

  const phase2ActionReason = [
    decision.execution_plan?.current_position_action,
    decision.wait_state?.reason,
    decision.wait_state?.current_block,
    decision.judgment?.critical_reason,
  ].filter((item): item is string => Boolean(item));

  if (phase2ActionReason.length > 0) {
    return phase2ActionReason.join('｜');
  }

  return decision.execution.position_sizing.reason;
}

function buildSummary(
  decision: TrinityDecision,
  hardGateDecision: TrinityDecision,
  aiState: AnalysisPageAiState,
  primaryCombination: AnalysisPageTradingCombinationViewModel
): AnalysisPageSummaryViewModel {
  const readySummary = aiState.status === 'ready' ? aiState.summary : null;
  const errorMessage = aiState.status === 'error' ? aiState.message : null;
  const actionLabel = formatDecisionActionLabel(
    decision.conclusion.action,
    decision.conclusion.action_label
  );
  const backendSpacetimeSummary = buildSpacetimeSummary(decision);
  const backendStructureSummary = buildStructureSummary(decision);
  const backendExecutionSummary = buildExecutionSummary(decision);
  const aiCandidateStructureSummary = toCandidateStructureSummary(readySummary?.candidate_structure);
  const backendCandidateStructureSummary = buildBackendCandidateStructureSummary(decision);
  const aiWaitStateSummary = toWaitStateSummary(readySummary?.wait_state);
  const backendWaitStateSummary = buildBackendWaitStateSummary(decision);
  const backendReason = resolveChineseReason([
    decision.judgment?.critical_reason,
    decision.wait_state?.current_block,
    decision.conclusion.wait_reason,
    decision.trade_qualification.reason[0],
    decision.execution.position_sizing.reason,
  ]);

  return {
    mode: aiState.status,
    errorMessage,
    headline: preferChineseText(readySummary?.headline, actionLabel),
    primaryActionLabel: actionLabel,
    judgmentLabel: readySummary?.judgment ?? resolveJudgmentLabel(decision),
    relationLabel: resolveRelationLabel(decision.level_nesting),
    primaryReason: resolveChineseReason(
      [readySummary?.critical_reason, readySummary?.primary_reason, backendReason],
      backendReason
    ),
    triggerLabels: preferChineseList(readySummary?.triggers, resolveDecisionTriggerLabels(decision)),
    riskLabels: preferChineseList(readySummary?.risks, resolveDecisionRiskLabels(decision)),
    guardrail: resolveChineseReason([readySummary?.guardrail, backendReason], backendReason),
    spacetimeSummary: resolveChineseReason(
      [readySummary?.spacetime_summary, backendSpacetimeSummary],
      backendSpacetimeSummary
    ),
    structureSummary: resolveChineseReason(
      [readySummary?.structure_summary, backendStructureSummary],
      backendStructureSummary
    ),
    executionSummary: resolveChineseReason(
      [readySummary?.execution_summary, backendExecutionSummary],
      backendExecutionSummary
    ),
    judgmentWarning: readySummary?.judgment_warning ?? null,
    candidateStructureSummary: preferCandidateStructureSummary(
      aiCandidateStructureSummary,
      backendCandidateStructureSummary
    ),
    waitStateSummary: preferWaitStateSummary(aiWaitStateSummary, backendWaitStateSummary),
    signalTags: buildDecisionSignalTags(decision),
    hardGateTitle: '主策略硬门控',
    hardGateSourceLabel: primaryLevelSourceLabel(
      hardGateDecision,
      primaryCombination,
      primaryCombination.levels[0]
    ),
    hardGates: buildHardGates(hardGateDecision),
  };
}

function findLevelDecision(result: AnalysisResultData, level: TrinityLevel): TrinityDecision | null {
  return result.periods[level]?.trinity_decision ?? null;
}

function describePeriod(period?: PeriodAnalysisData): string {
  return period?.structure?.structure_type || period?.trinity_decision?.structure.type || '未生成结构';
}

function resolveCombinationStatus(
  major: TrinityDecision | null,
  minor: TrinityDecision | null
): TrinityJudgmentCriterion['status'] {
  if (!major && !minor) {
    return 'failed';
  }
  if (!major) {
    return 'info';
  }
  if (major?.trade_qualification.position_permission === 'no_position') {
    return 'warning';
  }
  if (minor?.conclusion.can_trade && major.conclusion.bias !== 'bearish') {
    return 'passed';
  }
  return 'info';
}

function buildCombination({
  key,
  label,
  levels,
  result,
}: {
  key: TradingCombinationKey;
  label: string;
  levels: [TrinityLevel, TrinityLevel];
  result: AnalysisResultData;
}): BuiltTradingCombination {
  const [majorLevel, minorLevel] = levels;
  const major = findLevelDecision(result, majorLevel);
  const minor = findLevelDecision(result, minorLevel);
  const status = resolveCombinationStatus(major, minor);
  const statusMeta = getActionStatusMeta(status);
  const direction = directionFromBias(minor?.conclusion.bias ?? major?.conclusion.bias ?? 'neutral');
  const directionLabel = getDirectionMeta(direction).label;
  const majorLabel = LEVEL_LABELS[majorLevel];
  const minorLabel = LEVEL_LABELS[minorLevel];
  const parentConstraintValue = major
    ? `${majorLabel}：${resolveChineseReason(
        [
          major.wait_state?.current_block,
          major.wait_state?.reason,
          major.judgment?.critical_reason,
          major.conclusion.wait_reason,
          major.trade_qualification.reason[0],
          major.execution.position_sizing.reason,
        ],
        '暂无额外约束'
      )}`
    : `${majorLabel}缺失`;
  const suitableActionValue = minor
    ? formatDecisionActionLabel(minor.conclusion.action, minor.conclusion.action_label)
    : '等待数据补齐';
  const minorNestingRisk = minor ? firstLevelNestingCondition(minor.level_nesting, 'invalidation_conditions', minorLabel) : '';
  const majorNestingRisk = major ? firstLevelNestingCondition(major.level_nesting, 'invalidation_conditions', majorLabel) : '';
  const nestingRisk = minorNestingRisk || majorNestingRisk;
  const majorRiskValue =
    nestingRisk ||
    resolveDecisionRiskLabels(minor).at(0) ||
    resolveDecisionRiskLabels(major).at(0) ||
    '暂无明确风险';
  const minorNestingWait = minor ? firstLevelNestingCondition(minor.level_nesting, 'wait_conditions', minorLabel) : '';
  const majorNestingWait = major ? firstLevelNestingCondition(major.level_nesting, 'wait_conditions', majorLabel) : '';
  const triggerValue =
    (minorNestingWait ? scopedLevelCondition(minorNestingWait, minorLabel) : '') ||
    (majorNestingWait ? scopedLevelCondition(majorNestingWait, majorLabel) : '') ||
    (minor ? resolveScopedCombinationTriggerText(minor, minorLabel) : '') ||
    (major ? resolveScopedCombinationTriggerText(major, majorLabel) : '') ||
    `${minorLabel}等待触发`;
  const triggerHoverValue =
    minorNestingWait ||
    majorNestingWait ||
    (minor ? resolveCombinationTriggerText(minor, minorLabel) : '') ||
    (major ? resolveCombinationTriggerText(major, majorLabel) : '') ||
    `${minorLabel}等待触发`;
  const parentConstraintTags = buildParentConstraintTags(major);
  const parentSignalTags = parentConstraintTags;
  const relationLabel =
    major?.trade_qualification.position_permission === 'no_position'
      ? `${majorLabel}未放行，${minorLabel}先看确认`
      : resolveRelationLabel(minor?.level_nesting ?? major?.level_nesting);

  return {
    key,
    label,
    levels,
    status,
    direction,
    directionLabel,
    actionLabel: statusMeta.label,
    judgmentLabel: resolveJudgmentLabel(minor ?? major ?? undefined),
    relationLabel,
    relationHint: `${majorLabel}看背景，${minorLabel}看执行`,
    summary: buildCombinationSummary(majorLevel, minorLevel, major, minor),
    recommendation: buildCombinationRecommendation(majorLevel, major, minor),
    signalTags: buildCombinationSignalTags(major, minor),
    actionStateTags: buildCombinationActionStateTags(majorLabel, minorLabel, major, minor),
    judgmentBasisTags: buildCombinationBasisTags(minor ?? major),
    parentConstraintTags,
    parentSignalTags,
    parentConstraint: buildExplainableField({
      label: '父级约束',
      value: parentConstraintValue,
      hoverTitle: '父级约束说明',
      hoverItems: [
        createHoverItem('这句话是什么意思', `${majorLabel}负责决定这组交易能不能放行。`),
        createHoverItem(
          '为什么这么判断',
          major
            ? resolveChineseReason(
                [
                  major.wait_state?.current_block,
                  major.wait_state?.reason,
                  major.judgment?.critical_reason,
                  major.conclusion.wait_reason,
                  major.trade_qualification.reason[0],
                  major.execution.position_sizing.reason,
                ],
                '暂无额外约束'
              )
            : `${majorLabel}主判定缺失`
        ),
        createHoverItem(
          '当前限制',
          major ? formatList(major.trade_qualification.reason, parentConstraintValue) : `${majorLabel}缺失`
        ),
        createHoverItem(
          '下一步条件',
          major
            ? formatCombinationList(resolveDecisionTriggerLabels(major), `等待${majorLabel}确认信号`, majorLabel)
            : `先补齐${majorLabel}主判定`
        ),
      ],
    }),
    triggerLevel: buildExplainableField({
      label: '触发级别',
      value: `${minorLabel}：${triggerValue}`,
      hoverTitle: '触发级别说明',
      hoverItems: [
        createHoverItem('这句话是什么意思', `${minorLabel}负责给出更具体的执行触发。`),
        createHoverItem('为什么这么判断', minor?.level_nesting?.node_semantic?.reason ?? triggerHoverValue),
        createHoverItem('当前限制', major ? parentConstraintValue : `${majorLabel}缺失`),
        createHoverItem(
          '下一步条件',
          minor
            ? firstLevelNestingCondition(minor.level_nesting, 'confirm_conditions', minorLabel) ||
                formatCombinationList(resolveDecisionConfirmationLabels(minor), '等待更明确确认', minorLabel)
            : `先补齐${minorLabel}主判定`
        ),
      ],
    }),
    triggerLevelLabel: minorLabel,
    suitableAction: buildExplainableField({
      label: '适合动作',
      value: suitableActionValue,
      hoverTitle: '适合动作说明',
      hoverItems: [
        createHoverItem('这句话是什么意思', '这是在当前父子级别约束下更适合采用的动作。'),
        createHoverItem('为什么这么判断', resolveDecisionActionReason(minor) || resolveDecisionActionReason(major)),
        createHoverItem('当前限制', parentConstraintValue),
        createHoverItem(
          '下一步条件',
          formatList(
            [
              ...(minor ? levelNestingConditions(minor.level_nesting, 'confirm_conditions', minorLabel) : []),
              ...(major ? levelNestingConditions(major.level_nesting, 'confirm_conditions', majorLabel) : []),
              ...(resolveDecisionTriggerLabels(minor).length > 0
                ? resolveDecisionTriggerLabels(minor)
                : resolveDecisionTriggerLabels(major)),
            ],
            '等待进一步确认'
          )
        ),
      ],
    }),
    majorRisk: buildExplainableField({
      label: '主要风险',
      value: majorRiskValue,
      hoverTitle: '主要风险说明',
      hoverItems: [
        createHoverItem('这句话是什么意思', '这是当前组合最需要优先防守的风险点。'),
        createHoverItem(
          '为什么这么判断',
          formatList(
            [
              nestingRisk,
              ...(resolveDecisionRiskLabels(minor).length > 0
                ? resolveDecisionRiskLabels(minor)
                : resolveDecisionRiskLabels(major)),
            ],
            majorRiskValue
          )
        ),
        createHoverItem('当前限制', parentConstraintValue),
        createHoverItem(
          '下一步条件',
          formatList(
            [
              nestingRisk,
              ...(resolveDecisionInvalidationLabels(minor).length > 0
                ? resolveDecisionInvalidationLabels(minor)
                : resolveDecisionInvalidationLabels(major)),
            ],
            '等待失效条件明确'
          )
        ),
      ],
    }),
    explanation: `${majorLabel}定约束，${minorLabel}给触发；${statusMeta.tradeMeaning}`,
  };
}

function buildTradingCombinations(result: AnalysisResultData): BuiltTradingCombination[] {
  return [
    buildCombination({
      key: 'midline',
      label: '中线主策略组合｜周线 → 日线',
      levels: ['weekly', 'daily'],
      result,
    }),
    buildCombination({
      key: 'shortline',
      label: '短线执行组合｜日线 → 30分钟',
      levels: ['daily', 'hour30'],
      result,
    }),
    buildCombination({
      key: 'intraday_t',
      label: '超短线 / T 组合｜60分钟 → 15分钟',
      levels: ['hour60', 'hour15'],
      result,
    }),
  ];
}

function pickPrimaryCombination(
  combinations: BuiltTradingCombination[]
): BuiltTradingCombination {
  const score: Record<TrinityJudgmentCriterion['status'], number> = {
    passed: 4,
    warning: 3,
    info: 2,
    failed: 1,
  };
  const tieBreak: Record<TradingCombinationKey, number> = {
    shortline: 3,
    midline: 2,
    intraday_t: 1,
  };

  return [...combinations].sort((left, right) => {
    const scoreDiff = score[right.status] - score[left.status];
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return tieBreak[right.key] - tieBreak[left.key];
  })[0];
}

function buildGlobalStrategy({
  result,
  primaryCombination,
}: {
  result: AnalysisResultData;
  primaryCombination: AnalysisPageTradingCombinationViewModel;
}): AnalysisPageGlobalStrategyViewModel {
  const [primaryConstraintLevel, triggerLevel] = primaryCombination.levels;
  const constraintDecision = findLevelDecision(result, primaryConstraintLevel);
  const triggerDecision = findLevelDecision(result, triggerLevel);
  const status = resolveCombinationStatus(constraintDecision, triggerDecision);
  const explanation = buildStatusExplanation({
    status,
    direction: primaryCombination.direction,
    reason: resolveChineseReason([
      triggerDecision?.conclusion.wait_reason,
      triggerDecision?.trade_qualification.reason?.[0],
      triggerDecision?.execution.position_sizing.reason,
      constraintDecision?.conclusion.wait_reason,
      constraintDecision?.trade_qualification.reason?.[0],
      constraintDecision?.execution.position_sizing.reason,
    ]),
  });
  const structureMeta = getStructureTagMeta(
    triggerDecision?.structure.type ?? constraintDecision?.structure.type ?? ''
  );
  const combinationNames = ['中线主策略组合', '短线执行组合', '超短线 / T 组合'];

  return {
    scopeLabel: `综合范围：${combinationNames.join('、')}`,
    primaryCombination: primaryCombination.key,
    primaryCombinationLabel: primaryCombination.label,
    primaryConstraintLevel,
    primaryConstraintLevelLabel: LEVEL_LABELS[primaryConstraintLevel],
    triggerLevel,
    triggerLevelLabel: LEVEL_LABELS[triggerLevel],
    direction: primaryCombination.direction,
    directionLabel: primaryCombination.directionLabel,
    actionLabel: primaryCombination.actionLabel,
    headline: `${primaryCombination.label}｜${structureMeta.label}｜${primaryCombination.directionLabel}${primaryCombination.actionLabel}`,
    primaryReason: explanation.reason,
    triggerLabels: resolveDecisionTriggerLabels(triggerDecision),
    riskLabels: resolveDecisionRiskLabels(triggerDecision).length
      ? resolveDecisionRiskLabels(triggerDecision)
      : resolveDecisionRiskLabels(constraintDecision),
    guardrail: resolveChineseReason(
      [
        constraintDecision?.conclusion.wait_reason,
        constraintDecision?.execution.position_sizing.reason,
        triggerDecision?.conclusion.wait_reason,
        triggerDecision?.execution.position_sizing.reason,
      ],
      explanation.reason
    ),
  };
}

function buildBus(result: AnalysisResultData): AnalysisPageViewModel['bus'] {
  const weekly = findLevelDecision(result, 'weekly');
  const daily = findLevelDecision(result, 'daily');
  const hour60 = findLevelDecision(result, 'hour60');
  const hour30 = findLevelDecision(result, 'hour30');
  const hour15 = findLevelDecision(result, 'hour15');

  return {
    dimensions: [
      {
        title: '维度一｜周线 → 日线',
        primary: `${weekly ? BIAS_LABELS[weekly.conclusion.bias] : '周线缺失'} → ${daily ? BIAS_LABELS[daily.conclusion.bias] : '日线缺失'}`,
        detail: `${describePeriod(result.periods.weekly)} / ${describePeriod(result.periods.daily)}`,
      },
      {
        title: '维度二｜日线 → 30分钟',
        primary: `${daily ? BIAS_LABELS[daily.conclusion.bias] : '日线缺失'} → ${hour30 ? BIAS_LABELS[hour30.conclusion.bias] : '30分钟缺失'}`,
        detail: `${describePeriod(result.periods.daily)} / ${describePeriod(result.periods.hour30)}`,
      },
      {
        title: '维度三｜60分钟 → 15分钟',
        primary: `${hour60 ? BIAS_LABELS[hour60.conclusion.bias] : '60分钟缺失'} → ${hour15 ? BIAS_LABELS[hour15.conclusion.bias] : '15分钟缺失'}`,
        detail: `${describePeriod(result.periods.hour60)} / ${describePeriod(result.periods.hour15)}`,
      },
    ],
  };
}

const RULE_CHAIN_CATEGORY_ORDER: Array<{
  title: string;
  category: TrinityJudgmentCriterion['category'];
}> = [
  { title: '结构资格', category: 'structure' },
  { title: 'MACD 时空', category: 'spacetime' },
  { title: '55 / 233 线关系', category: 'moving_average' },
  { title: '量能确认', category: 'volume' },
  { title: '级别权限', category: 'level_nesting' },
  { title: '执行计划', category: 'execution' },
];

function findCriterion(
  decision: TrinityDecision,
  category: TrinityJudgmentCriterion['category']
): TrinityJudgmentCriterion | null {
  return decision.judgment_criteria.find((criterion) => criterion.category === category) ?? null;
}

function buildRuleChain(decision: TrinityDecision): AnalysisPageViewModel['ruleChain'] {
  const nesting = decision.level_nesting;
  const decisionDirection = directionFromBias(decision.conclusion.bias);

  return {
    sourceLabel: buildRuleChainSourceLabel(decision.level),
    items: RULE_CHAIN_CATEGORY_ORDER.map(({ title, category }) => {
      const categoryDirection =
        category === 'spacetime'
          ? directionFromBias(decision.spacetime.direction_bias)
          : category === 'structure'
            ? directionFromStructure(decision.structure.direction)
            : decisionDirection;

      const criterion = findCriterion(decision, category);
      if (criterion) {
        const detail =
          category === 'execution'
            ? normalizeExecutionDetail(criterion.detail)
            : normalizeRuleChainText(criterion.detail);
        const reason = normalizeRuleChainText(criterion.label);
        const summary =
          category === 'structure' ? buildStructureRuleSummary(decision) : detail || reason || `${title}暂无摘要`;
        const recommendation =
          category === 'structure'
            ? buildStructureRuleRecommendation(decision)
            : `先按${title}继续跟踪`;
        const basis =
          category === 'structure'
            ? formatList(decision.structure.explainability.evidence, reason || detail)
            : detail || reason;

        return decorateRuleChainItem({
          title,
          status: criterion.status,
          direction: categoryDirection,
          detail,
          reason,
          summary,
          recommendation,
          signalTags: buildCategorySignalTags(category, decision),
          detailHover: buildRuleDetailHover(title, summary, detail, reason, decision, basis),
        });
      }

      if (category === 'structure') {
        const status =
          decision.structure.explainability.status === 'failed'
            ? 'failed'
            : decision.structure.explainability.status === 'passed'
              ? 'passed'
              : 'warning';
        const detail = normalizeRuleChainText(
          `${STRUCTURE_QUALIFICATION_LABELS[decision.structure.qualification]}｜${decision.structure.explainability.reason}`
        );
        const reason = normalizeRuleChainText(decision.structure.explainability.reason);
        const summary = buildStructureRuleSummary(decision);
        const recommendation = buildStructureRuleRecommendation(decision);
        const basis = formatList(decision.structure.explainability.evidence, reason || detail);
        return decorateRuleChainItem({
          title,
          status,
          direction: categoryDirection,
          detail,
          reason,
          summary,
          recommendation,
          signalTags: buildCategorySignalTags(category, decision),
          detailHover: buildRuleDetailHover(title, summary, detail, reason, decision, basis),
        });
      }
      if (category === 'spacetime') {
        const detail = normalizeRuleChainText(
          `${decision.spacetime.status}｜${BIAS_LABELS[decision.spacetime.direction_bias]}｜${decision.spacetime.mismatch_reason ?? decision.spacetime.divergence_policy.reason}`
        );
        const reason = normalizeRuleChainText(
          decision.spacetime.mismatch_reason ?? decision.spacetime.divergence_policy.reason
        );
        const basis = normalizeRuleChainText(
          `${decision.spacetime.mismatch_reason ?? ''}｜${decision.spacetime.divergence_policy.reason}`.replace(
            /^｜|｜$/g,
            ''
          )
        );
        return decorateRuleChainItem({
          title,
          status: decision.spacetime.structure_match ? 'passed' : 'warning',
          direction: categoryDirection,
          detail,
          reason,
          summary: detail,
          recommendation: '先等时空共振补齐后再推进动作',
          signalTags: buildCategorySignalTags(category, decision),
          detailHover: buildRuleDetailHover(title, detail, detail, reason, decision, basis),
        });
      }
      if (category === 'moving_average') {
        const detail = normalizeRuleChainText(
          `MA55 ${MA55_ROLE_LABELS[decision.moving_average.ma55_role]}｜MA233 ${MA233_ROLE_LABELS[decision.moving_average.ma233_role]}｜${BREAKTHROUGH_STATE_LABELS[decision.moving_average.breakthrough_state]}｜${decision.moving_average.ma_gate.reason}`
        );
        const reason = normalizeRuleChainText(decision.moving_average.ma_gate.reason);
        const basis = normalizeRuleChainText(
          `${BREAKTHROUGH_STATE_LABELS[decision.moving_average.breakthrough_state]}｜${decision.moving_average.ma_gate.reason}`
        );
        return decorateRuleChainItem({
          title,
          status:
            decision.moving_average.ma_gate.allow_long || decision.moving_average.ma_gate.allow_short
              ? 'passed'
              : 'warning',
          direction: categoryDirection,
          detail,
          reason,
          summary: detail,
          recommendation: '先按均线门槛继续观察突破质量',
          signalTags: buildCategorySignalTags(category, decision),
          detailHover: buildRuleDetailHover(title, detail, detail, reason, decision, basis),
        });
      }
      if (category === 'volume') {
        const detail = normalizeRuleChainText(
          `${VOLUME_STATE_LABELS[decision.volume_confirmation.volume_state]}｜${BREAKOUT_VOLUME_LABELS[decision.volume_confirmation.breakout_volume]}｜${BREAKDOWN_VOLUME_LABELS[decision.volume_confirmation.breakdown_volume]}｜${PULLBACK_VOLUME_LABELS[decision.volume_confirmation.pullback_volume]}`
        );
        const reason = normalizeRuleChainText(decision.volume_confirmation.volume_gate.reason);
        const basis = normalizeRuleChainText(
          `${decision.volume_confirmation.volume_gate.reason}｜${BREAKOUT_VOLUME_LABELS[decision.volume_confirmation.breakout_volume]}`
        );
        return decorateRuleChainItem({
          title,
          status: decision.volume_confirmation.volume_gate.confidence_adjustment === 'downgrade' ? 'warning' : 'info',
          direction: categoryDirection,
          detail,
          reason,
          summary: detail,
          recommendation: '先看量能是否补齐确认',
          signalTags: buildCategorySignalTags(category, decision),
          detailHover: buildRuleDetailHover(title, detail, detail, reason, decision, basis),
        });
      }
      if (category === 'level_nesting') {
        const detail = normalizeRuleChainText(
          nesting
            ? `${RESONANCE_LABELS[nesting.resonance]}｜${nesting.permission.reason}`
            : '暂无父子级别权限约束'
        );
        const reason = normalizeRuleChainText(nesting?.permission.reason ?? '暂无父子级别权限约束');
        const basis = normalizeRuleChainText(
          nesting ? `${RESONANCE_LABELS[nesting.resonance]}｜${nesting.permission.reason}` : reason
        );
        return decorateRuleChainItem({
          title,
          status: nesting?.resonance === 'aligned' ? 'passed' : 'warning',
          direction: categoryDirection,
          detail,
          reason,
          summary: detail,
          recommendation: '先服从父子级别权限再决定动作',
          signalTags: buildCategorySignalTags(category, decision),
          detailHover: buildRuleDetailHover(title, detail, detail, reason, decision, basis),
        });
      }

      const executionPreview = buildExecutionPreview(decision);
      const detail = normalizeExecutionDetail(
        `${decision.execution.entry_style}｜触发：${formatList(resolveDecisionTriggerLabels(decision), executionPreview.probeEntry)}｜失效：${formatList(resolveDecisionInvalidationLabels(decision), executionPreview.invalidation)}`
      );
      const reason = normalizeRuleChainText(resolveDecisionActionReason(decision));
      const basis = normalizeRuleChainText(
        `${resolveDecisionActionReason(decision)}｜触发：${formatList(resolveDecisionTriggerLabels(decision), executionPreview.probeEntry)}｜确认：${formatList(resolveDecisionConfirmationLabels(decision), executionPreview.confirmEntry)}｜失效：${formatList(resolveDecisionInvalidationLabels(decision), executionPreview.invalidation)}`
      );
      return decorateRuleChainItem({
        title,
        status: decision.conclusion.can_trade ? 'passed' : 'info',
        direction: categoryDirection,
        detail,
        reason,
        summary: detail,
        recommendation: `先等${resolvePrimaryTriggerText(decision)}`,
        signalTags: buildCategorySignalTags(category, decision),
        detailHover: buildRuleDetailHover(title, detail, detail, reason, decision, basis),
      });
    }),
  };
}

export function buildAnalysisPageViewModel({
  result,
  integrity,
  aiState,
}: {
  result: AnalysisResultData;
  integrity: DataIntegritySnapshot;
  aiState: AnalysisPageAiState;
}): AnalysisPageViewModel {
  const primaryDecision = pickPrimaryDecision(result);
  const tradingCombinations = buildTradingCombinations(result);
  const primaryCombination = pickPrimaryCombination(tradingCombinations);
  const hardGateDecision =
    findLevelDecision(result, primaryCombination.levels[0]) ?? primaryDecision;

  return {
    statusBar: buildStatusBar(result, integrity, aiState),
    globalStrategy: buildGlobalStrategy({ result, primaryCombination }),
    summary: buildSummary(primaryDecision, hardGateDecision, aiState, primaryCombination),
    tradingCombinations: tradingCombinations.map(({ status: _status, ...item }) => item),
    bus: buildBus(result),
    ruleChain: buildRuleChain(primaryDecision),
  };
}
