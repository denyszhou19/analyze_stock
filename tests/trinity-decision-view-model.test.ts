import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTrinityDecisionViewModel } = await import(
  new URL('../src/lib/trinity-decision-view-model.ts', import.meta.url).href
);

test('buildTrinityDecisionViewModel renders summary rows from deterministic decision', () => {
  const vm = buildTrinityDecisionViewModel({
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
      boundaries: {},
      node_map: {},
      can_trade_by_structure_nodes: true,
      can_trade_by_boundaries: true,
      explainability: { status: 'passed', reason: 'A原型成立', evidence: ['A五段式'] },
    },
    spacetime: {
      status: '中偏强',
      direction_bias: 'bullish',
      expected_structures: { up: ['A五段式'], down: ['D三段式'] },
      structure_match: false,
      mismatch_reason: '等待 C 结构边界确认',
      divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: 'none' },
    },
    moving_average: {
      ma55_role: 'support',
      ma233_role: 'support',
      price_position: { above_ma55: true, above_ma233: true },
      breakthrough_state: 'valid_breakout',
      ma_gate: { allow_long: true, allow_short: false, reason: 'MA55 上方' },
    },
    volume_confirmation: {
      volume_state: 'unknown',
      breakout_volume: 'weak',
      breakdown_volume: 'not_applicable',
      pullback_volume: 'not_applicable',
      volume_gate: {
        supports_breakout: false,
        supports_breakdown: false,
        supports_pullback_confirmation: false,
        confidence_adjustment: 'neutral',
        reason: 'phase1',
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
      position_sizing: { reason: '等待 C 结构边界确认' },
      risk_flags: ['等待确认'],
    },
    judgment_criteria: [],
    ai_summary_facts: ['A五段式原型'],
  });

  assert.equal(vm.title, '三位一体判定');
  assert.equal(vm.levelLabel, '日线');
  assert.equal(vm.actionLabel, '等待');
  assert.equal(vm.structureLabel, 'A五段式 / 标准结构');
  assert.equal(vm.focusOriginLabel, 'a1 @ 10.50');
  assert.equal(vm.backgroundOriginLabel, '2026-02-10 @ 9.80');
  assert.equal(vm.executionOriginLabel, 'a4');
  assert.equal(vm.waitReason, '等待 C 结构边界确认');
  assert.deepEqual(vm.triggerLabels, ['重新站上平台上沿']);
  assert.deepEqual(vm.invalidationLabels, ['跌回平台下沿']);
  assert.match(vm.gateReason ?? '', /父子级别冲突/);
});

test('buildTrinityDecisionViewModel returns empty defaults when decision missing', () => {
  const vm = buildTrinityDecisionViewModel(null);

  assert.equal(vm.title, '三位一体判定');
  assert.equal(vm.levelLabel, null);
  assert.equal(vm.gateReason, null);
  assert.deepEqual(vm.triggerLabels, []);
  assert.deepEqual(vm.invalidationLabels, []);
});

test('buildTrinityDecisionViewModel formats anchors and missing nesting safely', () => {
  const vm = buildTrinityDecisionViewModel({
    version: 'v2',
    level: 'hour30',
    conclusion: {
      action: 'buy',
      action_label: '试仓',
      bias: 'bullish',
      confidence: 'medium',
      can_trade: true,
    },
    structure: {
      background_origin: { date: '2026-03-01 00:00:00', price: 8.1, source: 'macro_origin', semantic: 'background_origin' },
      focus_origin: { price: 8.5, source: 'recent_component', semantic: 'focus_origin' },
      execution_origin: { point_id: 'c4', source: 'current_structure', semantic: 'execution_origin' },
      family: 'range',
      type: '大平台震荡',
      qualification: 'extended',
      direction: 'neutral',
      boundaries: {},
      node_map: {},
      can_trade_by_structure_nodes: false,
      can_trade_by_boundaries: true,
      explainability: { status: 'downgraded', reason: '平台仍在震荡', evidence: ['等待方向选择'] },
    },
    spacetime: {
      status: '中性',
      direction_bias: 'neutral',
      expected_structures: { up: ['A五段式'], down: ['D三段式'] },
      structure_match: true,
      divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: 'none' },
    },
    moving_average: {
      ma55_role: 'neutral',
      ma233_role: 'neutral',
      price_position: { above_ma55: false, above_ma233: false },
      breakthrough_state: 'none',
      ma_gate: { allow_long: false, allow_short: false, reason: '均线缠绕' },
    },
    volume_confirmation: {
      volume_state: 'normal',
      breakout_volume: 'not_applicable',
      breakdown_volume: 'not_applicable',
      pullback_volume: 'normal',
      volume_gate: {
        supports_breakout: false,
        supports_breakdown: false,
        supports_pullback_confirmation: false,
        confidence_adjustment: 'neutral',
        reason: '量能中性',
      },
    },
    trade_qualification: {
      trade_mode: 'wait_confirmation',
      position_permission: 'light_probe',
      confidence: 'low',
      reason: ['等待方向选择'],
    },
    execution: {
      entry_style: 'boundary',
      triggers: [],
      invalidation: [],
      confirmation: [],
      position_sizing: { reason: '轻仓观察' },
      risk_flags: [],
    },
    judgment_criteria: [],
    ai_summary_facts: [],
  });

  assert.equal(vm.levelLabel, '30分钟');
  assert.equal(vm.structureLabel, '大平台震荡 / 平台震荡');
  assert.equal(vm.backgroundOriginLabel, '2026-03-01 @ 8.10');
  assert.equal(vm.focusOriginLabel, '8.50');
  assert.equal(vm.executionOriginLabel, 'c4');
  assert.equal(vm.gateReason, null);
});
