import test from 'node:test';
import assert from 'node:assert/strict';
import type {
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
    node_map: { a4: 10.8, last_confirmed: 'a4' },
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
