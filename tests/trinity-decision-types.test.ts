import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  AiSummaryCard,
  PeriodAnalysisData,
  TrinityDecision,
} from '../src/lib/stock-structure-types.ts';

const sampleDecision: TrinityDecision = {
  version: 'v2',
  level: 'daily',
  conclusion: {
    action: 'wait',
    action_label: '等待',
    bias: 'neutral',
    confidence: 'medium',
    can_trade: false,
    wait_reason: '等待 C 结构边界确认',
  },
  structure: {
    background_origin: {
      price: 9.8,
      date: '2026-02-10 00:00:00',
      source: 'macro_origin',
      semantic: 'background_origin',
    },
    focus_origin: {
      point_id: 'a1',
      price: 10.5,
      date: '2026-02-10 00:00:00',
      source: 'peak_extreme',
      semantic: 'focus_origin',
    },
    execution_origin: {
      point_id: 'a4',
      price: null,
      date: null,
      source: 'current_structure',
      semantic: 'execution_origin',
    },
    family: 'standard',
    type: 'A五段式',
    standard_candidate: 'A五段式',
    qualification: 'standard',
    direction: 'up',
    boundaries: {
      upper: null,
      lower: null,
      mid: null,
      breakout_trigger: null,
      breakdown_trigger: null,
      stop_loss: null,
    },
    node_map: { a4: 10.8, last_confirmed: 10.8 },
    can_trade_by_structure_nodes: true,
    can_trade_by_boundaries: true,
    explainability: {
      status: 'passed',
      reason: 'A原型成立',
      evidence: ['A五段式，趋势 + 中继平台 + 趋势'],
    },
  },
  spacetime: {
    status: '中偏强',
    direction_bias: 'bullish',
    expected_structures: { up: ['A五段式'], down: ['D三段式'] },
    structure_match: false,
    mismatch_reason: '等待 C 结构边界确认',
    divergence_policy: {
      top_divergence_valid: false,
      bottom_divergence_valid: false,
      reason: '沿用现有 MACD 背离字段',
    },
  },
  moving_average: {
    ma55_role: 'support',
    ma233_role: 'support',
    price_position: {
      above_ma55: true,
      above_ma233: true,
      deviation_ma55_pct: null,
      deviation_ma233_pct: null,
    },
    breakthrough_state: 'valid_breakout',
    ma_gate: {
      allow_long: true,
      allow_short: false,
      reason: '沿用现有 MA55 / MA233 相对位置与突破字段',
    },
  },
  volume_confirmation: {
    volume_ratio_5: null,
    volume_ratio_20: null,
    amount_ratio_20: null,
    turnover_rate: null,
    volume_state: 'unknown',
    breakout_volume: 'weak',
    breakdown_volume: 'not_applicable',
    pullback_volume: 'not_applicable',
    volume_gate: {
      supports_breakout: false,
      supports_breakdown: false,
      supports_pullback_confirmation: false,
      confidence_adjustment: 'neutral',
      reason: 'Phase 1 先保留字段，后续阶段接入均量比和成交额比',
    },
  },
  level_nesting: {
    parent_level: 'weekly',
    child_level: 'daily',
    parent_bias: 'bullish',
    child_signal: 'wait',
    resonance: 'child_countertrend',
    permission: {
      allow_position_increase: false,
      allow_t_trade: false,
      allow_only_light_probe: true,
      reason: '父子级别冲突，降级执行',
    },
  },
  trade_qualification: {
    trade_mode: 'wait_confirmation',
    position_permission: 'no_position',
    confidence: 'medium',
    reason: ['A原型成立', '等待 C 结构边界确认'],
  },
  execution: {
    entry_style: 'pullback',
    triggers: ['重新站上平台上沿'],
    invalidation: ['跌回平台下沿'],
    confirmation: ['回踩 MA55 不破'],
    position_sizing: {
      max_ratio: null,
      reason: '等待 C 结构边界确认',
      upgrade_condition: null,
      downgrade_condition: '等待 C 结构边界确认',
    },
    risk_flags: ['等待确认'],
  },
  candidate_structure: {
    candidate_type: 'trend_continuation',
    candidate_label: 'A延续候选',
    current_leg: '30分钟回抽段',
    direction: 'up',
    reason: '父级支持，但次级别仍在等待回抽确认',
    upgrade_condition: '30分钟回抽不破并重新放量上拐',
    invalidation: '30分钟回抽跌破关键确认低点',
  },
  wait_state: {
    wait_type: '等待回抽确认',
    wait_label: '等待回抽确认',
    current_block: '30分钟回抽段尚未完成止跌确认',
    next_confirmation_action: '观察30分钟止跌并重新转强',
    reason: '30分钟结构尚未完成确认',
  },
  zero_axis_signal: {
    formed: true,
    signal_type: 'zero_axis_pullback',
    signal_label: '零轴上方回抽',
    reason: '零轴上方回抽后若再度上拐，通常有利于延续',
    impact_on_judgment: 'promote',
  },
  resonance_state: {
    status: 'supportive',
    reason: '周线支持日线，但30分钟信号尚未闭合',
    impact_on_judgment: 'promote',
    is_hard_constraint: false,
  },
  divergence_weight: {
    status: 'neutral',
    label: '背离影响中性',
    reason: '暂无足够背离强化或削弱信号',
    impact_on_judgment: 'neutral',
  },
  judgment: {
    level: 'candidate_probe',
    label: '候选可试',
    current_best_action: '轻仓试探，等待30分钟确认后再加仓',
    critical_reason: '父级支持但30分钟仍待确认',
    supporting_factors: ['周线方向支持', '日线结构仍有延续可能', '零轴信号偏正向'],
    limiting_factors: ['30分钟尚未确认止跌', '回抽完成前不能放大仓位'],
  },
  execution_plan: {
    probe_entry: '日线支撑位附近轻仓试探',
    confirm_entry: '30分钟回抽确认后加仓',
    invalidation: '跌破日线确认低点离场',
    current_position_action: '维持轻仓观察，不提前追价',
  },
  judgment_criteria: [],
  ai_summary_facts: ['A五段式，趋势 + 中继平台 + 趋势'],
};

test('TrinityDecision accepts all five levels', () => {
  const levels: TrinityDecision['level'][] = ['weekly', 'daily', 'hour60', 'hour30', 'hour15'];
  assert.equal(levels.length, 5);
  assert.equal(sampleDecision.level, 'daily');
});

test('PeriodAnalysisData carries trinity_decision contract', () => {
  const periodData: PeriodAnalysisData = {
    period: 'daily',
    analysis_date: '2026-02-10 00:00:00',
    latest_price: 10.8,
    price_change_pct: 1.2,
    volume: 1000,
    moving_averages: { MA55: 9.9 },
    macd: { status: '中偏强' },
    structure: {
      structure_type: 'A五段式',
      structure_stage: '趋势启动阶段',
      trend_direction: '上涨',
      inflection_points: 5,
      segment_count: 5,
      description: 'A五段式',
    },
    key_levels: { support_levels: [], resistance_levels: [] },
    trinity_decision: sampleDecision,
  };

  assert.equal(periodData.trinity_decision?.level, 'daily');
  assert.equal(periodData.trinity_decision?.structure.focus_origin?.source, 'peak_extreme');
});

test('TrinityDecision structure origins preserve three origin semantics', () => {
  assert.equal(sampleDecision.structure.background_origin?.semantic, 'background_origin');
  assert.equal(sampleDecision.structure.focus_origin?.semantic, 'focus_origin');
  assert.equal(sampleDecision.structure.execution_origin?.semantic, 'execution_origin');
});

test('AiSummaryCard action and bias stay aligned with TrinityDecision conclusion contract', () => {
  const summary = {
    headline: '等待结构边界确认',
    action: sampleDecision.conclusion.action,
    bias: sampleDecision.conclusion.bias,
    primary_reason: sampleDecision.conclusion.wait_reason ?? '等待确认',
    triggers: sampleDecision.execution.triggers,
    risks: sampleDecision.execution.risk_flags,
    guardrail: sampleDecision.execution.position_sizing.reason,
  } satisfies AiSummaryCard;

  assert.equal(summary.action, 'wait');
  assert.equal(summary.bias, 'neutral');
  assert.equal(summary.guardrail, '等待 C 结构边界确认');
});

test('TrinityDecision supports phase-two judgment contract fields', () => {
  assert.equal(sampleDecision.candidate_structure?.candidate_label, 'A延续候选');
  assert.equal(sampleDecision.candidate_structure?.current_leg, '30分钟回抽段');
  assert.equal(
    sampleDecision.candidate_structure?.upgrade_condition,
    '30分钟回抽不破并重新放量上拐'
  );
  assert.equal(
    sampleDecision.candidate_structure?.invalidation,
    '30分钟回抽跌破关键确认低点'
  );
  assert.equal(sampleDecision.wait_state?.wait_type, '等待回抽确认');
  assert.equal(sampleDecision.wait_state?.wait_label, '等待回抽确认');
  assert.equal(sampleDecision.wait_state?.current_block, '30分钟回抽段尚未完成止跌确认');
  assert.equal(sampleDecision.wait_state?.next_confirmation_action, '观察30分钟止跌并重新转强');
  assert.equal(sampleDecision.zero_axis_signal?.formed, true);
  assert.equal(sampleDecision.zero_axis_signal?.signal_type, 'zero_axis_pullback');
  assert.equal(sampleDecision.zero_axis_signal?.impact_on_judgment, 'promote');
  assert.equal(sampleDecision.resonance_state?.status, 'supportive');
  assert.equal(sampleDecision.divergence_weight?.label, '背离影响中性');
  assert.equal(sampleDecision.judgment?.label, '候选可试');
  assert.equal(sampleDecision.judgment?.level, 'candidate_probe');
  assert.equal(
    sampleDecision.judgment?.current_best_action,
    '轻仓试探，等待30分钟确认后再加仓'
  );
  assert.equal(sampleDecision.judgment?.critical_reason, '父级支持但30分钟仍待确认');
  assert.deepEqual(sampleDecision.judgment?.supporting_factors, [
    '周线方向支持',
    '日线结构仍有延续可能',
    '零轴信号偏正向',
  ]);
  assert.deepEqual(sampleDecision.judgment?.limiting_factors, [
    '30分钟尚未确认止跌',
    '回抽完成前不能放大仓位',
  ]);
  assert.equal(sampleDecision.execution_plan?.probe_entry, '日线支撑位附近轻仓试探');
  assert.equal(sampleDecision.execution_plan?.confirm_entry, '30分钟回抽确认后加仓');
  assert.equal(sampleDecision.execution_plan?.invalidation, '跌破日线确认低点离场');
  assert.equal(
    sampleDecision.execution_plan?.current_position_action,
    '维持轻仓观察，不提前追价'
  );
});
