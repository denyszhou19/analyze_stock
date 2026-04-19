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
  buildStatusExplanation,
  directionFromBias,
  getActionStatusMeta,
  getDirectionMeta,
  getStructureTagMeta,
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

export interface AnalysisPageSummaryViewModel {
  mode: AnalysisPageAiState['status'];
  errorMessage?: string | null;
  headline: string;
  primaryActionLabel: string;
  primaryReason: string;
  triggerLabels: string[];
  riskLabels: string[];
  guardrail: string;
  hardGateTitle: string;
  hardGateSourceLabel: string;
  hardGates: AnalysisPageSummaryGate[];
}

export interface AnalysisPageBusDimension {
  title: string;
  primary: string;
  detail: string;
}

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
  parentConstraint: string;
  triggerLevelLabel: string;
  suitableAction: string;
  majorRisk: string;
  explanation: string;
}

interface BuiltTradingCombination extends AnalysisPageTradingCombinationViewModel {
  status: TrinityJudgmentCriterion['status'];
}

export interface AnalysisPageRuleChainItem {
  title: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  detail: string;
  reason: string;
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

  return value
    .replace(/current_stage\s*/g, '当前阶段')
    .replace(/next_stage\s*/g, '下一阶段');
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

function buildRuleChainSourceLabel(level: TrinityLevel): string {
  const levelIndex = PRIMARY_DECISION_ORDER.indexOf(level);
  if (levelIndex <= 0) {
    return '本规则链默认按日线主判定展示；若日线缺失，则依次降级为周线、60分钟、30分钟、15分钟。';
  }

  const missingLevels = PRIMARY_DECISION_ORDER.slice(0, levelIndex).map((item) => LEVEL_LABELS[item]);
  return `本规则链当前按${LEVEL_LABELS[level]}主判定展示；因${missingLevels.join('、')}主判定缺失，已自动降级。`;
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

function resolveChineseReason(candidate?: string | null, fallback = '暂无明确结论约束'): string {
  const resolved = preferChineseText(candidate, fallback).trim();
  return /[\u4e00-\u9fff]/.test(resolved) ? resolved : fallback;
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
  const rawGuardrailValue = decision.conclusion.wait_reason ?? decision.execution.position_sizing.reason;
  const guardrailValue = resolveChineseReason(rawGuardrailValue, '暂无明确结论约束');

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
  const backendReason = resolveChineseReason(
    decision.conclusion.wait_reason ||
      decision.trade_qualification.reason[0] ||
      decision.execution.position_sizing.reason
  );

  return {
    mode: aiState.status,
    errorMessage,
    headline: preferChineseText(readySummary?.headline, actionLabel),
    primaryActionLabel: actionLabel,
    primaryReason: resolveChineseReason(readySummary?.primary_reason, backendReason),
    triggerLabels: preferChineseList(readySummary?.triggers, decision.execution.triggers),
    riskLabels: preferChineseList(readySummary?.risks, decision.execution.risk_flags),
    guardrail: resolveChineseReason(readySummary?.guardrail, backendReason),
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

  return {
    key,
    label,
    levels,
    status,
    direction,
    directionLabel,
    actionLabel: statusMeta.label,
    parentConstraint: major
      ? `${majorLabel}：${resolveChineseReason(
          major.conclusion.wait_reason ?? major.trade_qualification.reason[0],
          '暂无额外约束'
        )}`
      : `${majorLabel}缺失`,
    triggerLevelLabel: minorLabel,
    suitableAction: minor
      ? formatDecisionActionLabel(minor.conclusion.action, minor.conclusion.action_label)
      : '等待数据补齐',
    majorRisk: minor?.execution.risk_flags?.[0] ?? major?.execution.risk_flags?.[0] ?? '暂无明确风险',
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
    reason: resolveChineseReason(
      triggerDecision?.conclusion.wait_reason ??
        triggerDecision?.trade_qualification.reason?.[0] ??
        constraintDecision?.conclusion.wait_reason ??
        constraintDecision?.trade_qualification.reason?.[0]
    ),
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
    triggerLabels: triggerDecision?.execution.triggers ?? [],
    riskLabels: triggerDecision?.execution.risk_flags ?? constraintDecision?.execution.risk_flags ?? [],
    guardrail: resolveChineseReason(
      constraintDecision?.conclusion.wait_reason ??
        constraintDecision?.execution.position_sizing.reason ??
        triggerDecision?.execution.position_sizing.reason,
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

  return {
    sourceLabel: buildRuleChainSourceLabel(decision.level),
    items: RULE_CHAIN_CATEGORY_ORDER.map(({ title, category }) => {
      const criterion = findCriterion(decision, category);
      if (criterion) {
        return {
          title,
          status: criterion.status,
          detail:
            category === 'execution'
              ? normalizeExecutionDetail(criterion.detail)
              : normalizeRuleChainText(criterion.detail),
          reason: normalizeRuleChainText(criterion.label),
        };
      }

      if (category === 'structure') {
        return {
          title,
          status: decision.structure.explainability.status === 'failed' ? 'failed' : decision.structure.explainability.status === 'passed' ? 'passed' : 'warning',
          detail: normalizeRuleChainText(
            `${STRUCTURE_QUALIFICATION_LABELS[decision.structure.qualification]}｜${decision.structure.explainability.reason}`
          ),
          reason: normalizeRuleChainText(decision.structure.explainability.reason),
        };
      }
      if (category === 'spacetime') {
        return {
          title,
          status: decision.spacetime.structure_match ? 'passed' : 'warning',
          detail: normalizeRuleChainText(
            `${decision.spacetime.status}｜${BIAS_LABELS[decision.spacetime.direction_bias]}｜${decision.spacetime.mismatch_reason ?? decision.spacetime.divergence_policy.reason}`
          ),
          reason: normalizeRuleChainText(
            decision.spacetime.mismatch_reason ?? decision.spacetime.divergence_policy.reason
          ),
        };
      }
      if (category === 'moving_average') {
        return {
          title,
          status:
            decision.moving_average.ma_gate.allow_long || decision.moving_average.ma_gate.allow_short
              ? 'passed'
              : 'warning',
          detail: normalizeRuleChainText(
            `MA55 ${MA55_ROLE_LABELS[decision.moving_average.ma55_role]}｜MA233 ${MA233_ROLE_LABELS[decision.moving_average.ma233_role]}｜${BREAKTHROUGH_STATE_LABELS[decision.moving_average.breakthrough_state]}｜${decision.moving_average.ma_gate.reason}`
          ),
          reason: normalizeRuleChainText(decision.moving_average.ma_gate.reason),
        };
      }
      if (category === 'volume') {
        return {
          title,
          status: decision.volume_confirmation.volume_gate.confidence_adjustment === 'downgrade' ? 'warning' : 'info',
          detail: normalizeRuleChainText(
            `${VOLUME_STATE_LABELS[decision.volume_confirmation.volume_state]}｜${BREAKOUT_VOLUME_LABELS[decision.volume_confirmation.breakout_volume]}｜${BREAKDOWN_VOLUME_LABELS[decision.volume_confirmation.breakdown_volume]}｜${PULLBACK_VOLUME_LABELS[decision.volume_confirmation.pullback_volume]}`
          ),
          reason: normalizeRuleChainText(decision.volume_confirmation.volume_gate.reason),
        };
      }
      if (category === 'level_nesting') {
        return {
          title,
          status: nesting?.resonance === 'aligned' ? 'passed' : 'warning',
          detail: normalizeRuleChainText(
            nesting
              ? `${RESONANCE_LABELS[nesting.resonance]}｜${nesting.permission.reason}`
              : '暂无父子级别权限约束'
          ),
          reason: normalizeRuleChainText(nesting?.permission.reason ?? '暂无父子级别权限约束'),
        };
      }

      return {
        title,
        status: decision.conclusion.can_trade ? 'passed' : 'info',
        detail: normalizeExecutionDetail(
          `${decision.execution.entry_style}｜触发：${formatList(decision.execution.triggers)}｜失效：${formatList(decision.execution.invalidation)}`
        ),
        reason: normalizeRuleChainText(decision.execution.position_sizing.reason),
      };
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
