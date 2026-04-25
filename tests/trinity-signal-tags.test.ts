import test from 'node:test';
import assert from 'node:assert/strict';
import type { PeriodAnalysisData, TrinityDecision } from '../src/lib/stock-structure-types.ts';

const signalTags = await import(
  new URL('../src/lib/trinity-signal-tags.ts', import.meta.url).href
) as typeof import('../src/lib/trinity-signal-tags.ts');

function createDecision(overrides: Partial<TrinityDecision> = {}): TrinityDecision {
  const base: TrinityDecision = {
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
      background_origin: null,
      focus_origin: { point_id: 'a1', price: 10.5, date: '2025-05-12', source: 'peak_extreme' },
      execution_origin: null,
      family: 'extended',
      type: '延伸C',
      standard_candidate: 'C单平台式',
      qualification: 'extended',
      direction: 'up',
      boundaries: {},
      node_map: { last_confirmed: 10.8 },
      can_trade_by_structure_nodes: true,
      can_trade_by_boundaries: true,
      explainability: { status: 'passed', reason: 'C 原型延伸成立', evidence: ['平台边界仍有效'] },
    },
    spacetime: {
      status: '中偏强',
      direction_bias: 'bullish',
      expected_structures: { up: ['C单平台式'], down: ['D三段式'] },
      structure_match: false,
      mismatch_reason: '等待 C 结构边界确认',
      divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: '无背离确认' },
    },
    moving_average: {
      ma55_role: 'support',
      ma233_role: 'support',
      price_position: { above_ma55: true, above_ma233: true },
      breakthrough_state: 'breakout_pending',
      ma_gate: { allow_long: true, allow_short: false, reason: 'MA55 上方运行' },
    },
    volume_confirmation: {
      volume_state: 'unknown',
      breakout_volume: 'weak',
      breakdown_volume: 'not_applicable',
      pullback_volume: 'healthy_shrink',
      volume_gate: {
        supports_breakout: false,
        supports_breakdown: false,
        supports_pullback_confirmation: true,
        confidence_adjustment: 'neutral',
        reason: '突破量能偏弱',
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
        reason: '父级偏多但子级等待确认',
      },
    },
    trade_qualification: {
      trade_mode: 'wait_confirmation',
      position_permission: 'no_position',
      confidence: 'medium',
      reason: ['等待确认', '结构边界未触发'],
    },
    execution: {
      entry_style: 'pullback',
      triggers: ['重新站上平台上沿'],
      invalidation: ['跌回平台下沿'],
      confirmation: ['回踩 MA55 不破'],
      position_sizing: { max_ratio: null, reason: '等待 C 结构边界确认' },
      risk_flags: ['不追高'],
    },
    judgment_criteria: [],
    ai_summary_facts: ['延伸 C 结构成立'],
  };

  return { ...base, ...overrides };
}

function createPeriod(overrides: Partial<PeriodAnalysisData> = {}): PeriodAnalysisData {
  const base: PeriodAnalysisData = {
    period: 'daily',
    macd: {
      status: '中偏弱',
      description: '动能转弱',
      divergence_note: '注意顶背离',
    },
    breakthrough: {
      pattern_type: '假突破',
      direction: 'up',
      is_valid: false,
      confidence: '中',
      key_signals: ['冲高后回落'],
    },
    trinity_decision: createDecision({
      spacetime: {
        status: '中偏弱',
        direction_bias: 'bearish',
        expected_structures: { up: ['C单平台式'], down: ['D三段式'] },
        structure_match: true,
        mismatch_reason: null,
        divergence_policy: {
          top_divergence_valid: true,
          bottom_divergence_valid: false,
          reason: '顶背离成立',
        },
      },
    }),
  };

  return { ...base, ...overrides };
}

test('buildDecisionSignalTags builds short structured tags with stable hover payloads', () => {
  const tags = signalTags.buildDecisionSignalTags(createDecision(), { max: 5 });

  assert.deepEqual(
    tags.map((tag) => tag.label),
    ['时空｜中偏强', '突破/跌破｜突破候选', '量能｜突破量弱', '均线｜MA55支撑', '结构｜延伸C']
  );
  assert.equal(tags[0]?.key, 'spacetime');
  assert.equal(tags[0]?.tone, 'bullish');
  assert.equal(tags[1]?.key, 'breakthrough');
  assert.equal(tags[1]?.tone, 'warning');
  assert.equal(tags[2]?.hover.title, '量能｜突破量弱');
  assert.deepEqual(tags[2]?.hover.items, [{ label: '说明', value: '突破量能偏弱' }]);
});

test('buildDecisionSignalTags includes level nesting and execution tags by default', () => {
  const tags = signalTags.buildDecisionSignalTags(createDecision());

  assert.deepEqual(
    tags.map((tag) => tag.label),
    [
      '时空｜中偏强',
      '突破/跌破｜突破候选',
      '量能｜突破量弱',
      '均线｜MA55支撑',
      '结构｜延伸C',
      '级别｜子级逆势',
      '执行｜回踩执行',
    ]
  );
  assert.equal(tags[5]?.key, 'level_nesting');
  assert.deepEqual(tags[5]?.hover.items, [
    { label: '父级偏向', value: '父级偏多' },
    { label: '关系状态', value: '子级逆势' },
    { label: '节点语义', value: '暂无补充说明' },
    { label: '节点原因', value: '暂无补充说明' },
    { label: '说明', value: '父级偏多但子级等待确认' },
  ]);
  assert.ok(tags[5]?.hover.items.every((item) => !['先手点', '确认点', '失效点'].includes(item.label)));
  assert.equal(tags[6]?.key, 'execution');
  assert.deepEqual(tags[6]?.hover.items, [
    { label: '说明', value: '等待 C 结构边界确认' },
    { label: '先手点', value: '重新站上平台上沿' },
    { label: '确认点', value: '回踩 MA55 不破' },
    { label: '失效点', value: '跌回平台下沿' },
  ]);
});

test('buildDecisionSignalTags maps boundary entry style to explicit execution label', () => {
  const tags = signalTags.buildDecisionSignalTags(
    createDecision({
      conclusion: {
        action: 'hold',
        action_label: '持有',
        bias: 'bullish',
        confidence: 'medium',
        can_trade: true,
      },
      execution: {
        entry_style: 'boundary',
        triggers: ['等待平台边界确认'],
        invalidation: ['边界失效'],
        confirmation: ['边界确认后再执行'],
        position_sizing: { max_ratio: 0.3, reason: '按边界执行' },
        risk_flags: ['边界失败重新等待'],
      },
    })
  );

  assert.equal(tags.at(-1)?.key, 'execution');
  assert.equal(tags.at(-1)?.label, '执行｜边界执行');
  assert.deepEqual(tags.at(-1)?.hover.items, [
    { label: '说明', value: '按边界执行' },
    { label: '先手点', value: '等待平台边界确认' },
    { label: '确认点', value: '边界确认后再执行' },
    { label: '失效点', value: '边界失效' },
  ]);
});

test('buildDecisionSignalTags keeps parent bias hover labels in Chinese across branches', () => {
  const bearishTags = signalTags.buildDecisionSignalTags(
    createDecision({
      level_nesting: {
        parent_level: 'weekly',
        child_level: 'daily',
        parent_bias: 'bearish',
        child_signal: 'short',
        resonance: 'conflict',
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '父级偏空，子级仍需确认',
        },
      },
    })
  );
  const neutralTags = signalTags.buildDecisionSignalTags(
    createDecision({
      level_nesting: {
        parent_level: 'weekly',
        child_level: 'daily',
        parent_bias: 'neutral',
        child_signal: 'wait',
        resonance: 'parent_unclear',
        permission: {
          allow_position_increase: false,
          allow_t_trade: false,
          allow_only_light_probe: false,
          reason: '父级方向不明',
        },
      },
    })
  );
  const fallbackTags = signalTags.buildDecisionSignalTags(
    createDecision({
      level_nesting: undefined,
    })
  );

  assert.equal(bearishTags[5]?.hover.items[0]?.value, '父级偏空');
  assert.equal(neutralTags[5]?.hover.items[0]?.value, '父级中性');
  assert.ok(!fallbackTags.some((tag) => tag.key === 'level_nesting'));
});

test('buildDecisionSignalTags renders executable level nesting conditions in Chinese', () => {
  const tags = signalTags.buildDecisionSignalTags(
    createDecision({
      level_nesting: {
        parent_level: 'daily',
        child_level: 'hour30',
        parent_spacetime_status: '中偏强',
        child_structure_type: '延伸C类',
        child_structure_family: 'C',
        child_structure_qualification: 'extended',
        child_structure_direction: 'up',
        structure_match: true,
        parent_bias: 'bullish',
        child_signal: 'long',
        resonance: 'boundary_probe',
        operation_bias: 'long',
        operation_frame: 'platform_boundary',
        execution_strength: 'light_probe',
        downgrade_reason: '延伸C沿用C类边界逻辑，但拐点偏多，需等待确认',
        wait_conditions: ['30分钟延伸C等待平台边界突破'],
        confirm_conditions: ['30分钟回踩平台上沿不破'],
        invalidation_conditions: ['30分钟跌破平台下沿失效'],
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '日线中偏强，30分钟延伸C只允许边界轻仓试探',
        },
      },
    })
  );

  const levelTag = tags.find((tag) => tag.key === 'level_nesting');
  assert.equal(levelTag?.label, '级别｜边界试探');
  assert.equal(levelTag?.tone, 'warning');
  assert.deepEqual(levelTag?.hover.items, [
    { label: '父级偏向', value: '父级偏多' },
    { label: '关系状态', value: '边界试探' },
    { label: '结构原型', value: 'C' },
    { label: '结构资格', value: '延伸结构' },
    { label: '节点语义', value: '暂无补充说明' },
    { label: '节点原因', value: '暂无补充说明' },
    { label: '等待条件', value: '30分钟延伸C等待平台边界突破' },
    { label: '确认条件', value: '30分钟回踩平台上沿不破' },
    { label: '失效条件', value: '30分钟跌破平台下沿失效' },
    { label: '说明', value: '日线中偏强，30分钟延伸C只允许边界轻仓试探' },
  ]);
});

test('buildDecisionSignalTags shows node semantic copy without leaking internal field names', () => {
  const tags = signalTags.buildDecisionSignalTags(
    createDecision({
      level_nesting: {
        parent_level: 'daily',
        child_level: 'hour30',
        parent_spacetime_status: '强',
        child_structure_type: 'B双平台式',
        child_structure_family: 'B',
        child_structure_qualification: 'standard',
        child_structure_direction: 'up',
        structure_match: true,
        parent_bias: 'bullish',
        child_signal: 'long',
        resonance: 'aligned',
        operation_bias: 'long',
        operation_frame: 'swing_platform',
        execution_strength: 'normal',
        node_semantic: {
          family: 'B',
          actionable_node: 'b3',
          label: 'B类b3回踩确认',
          reason: '30分钟当前处于B类b3回踩确认阶段，等待回踩后重新转强',
          evidence: ['b2→live 下行形成中'],
        },
        wait_conditions: ['等待30分钟B类b3回踩确认'],
        confirm_conditions: ['30分钟回踩平台上沿不破'],
        invalidation_conditions: ['30分钟回踩跌回平台下沿失效'],
        permission: {
          allow_position_increase: true,
          allow_t_trade: true,
          allow_only_light_probe: false,
          reason: '日线强支持30分钟B类b3回踩确认，但仍需按节点确认节奏执行',
        },
      },
    })
  );

  const levelTag = tags.find((tag) => tag.key === 'level_nesting');
  assert.ok(levelTag);
  assert.ok(levelTag.hover.items.some((item) => item.label === '节点语义' && item.value === 'B类b3回踩确认'));
  assert.ok(
    levelTag.hover.items.some(
      (item) => item.label === '节点原因' && item.value === '30分钟当前处于B类b3回踩确认阶段，等待回踩后重新转强'
    )
  );
  assert.ok(levelTag.hover.items.every((item) => item.label !== 'actionable_node'));
  assert.ok(levelTag.hover.items.every((item) => item.label !== 'node_semantic'));
});

test('buildDecisionSignalTags exposes zero-axis and divergence decisions from phase2 blocks', () => {
  const tags = signalTags.buildDecisionSignalTags(
    createDecision({
      zero_axis_signal: {
        formed: true,
        signal_type: 'zero_axis_golden_cross',
        signal_label: '零轴金叉',
        reason: '零轴附近快速金叉',
        impact_on_judgment: 'promote',
      },
      divergence_weight: {
        status: 'suppressive',
        label: '顶背离压制',
        reason: '顶背离仍在压制',
        impact_on_judgment: 'suppress',
      },
    })
  );

  assert.ok(tags.some((tag) => tag.label === '时空｜零轴金叉'));
  assert.ok(tags.some((tag) => tag.label === '背离｜顶背离压制'));
});

test('buildDecisionSignalTags prefers candidate structure label and hover details from phase2 block', () => {
  const tags = signalTags.buildDecisionSignalTags(
    createDecision({
      candidate_structure: {
        candidate_type: 'A延续',
        candidate_label: 'A延续候选',
        current_leg: 'a3进行中',
        direction: 'up',
        reason: 'live 段仍按上涨原型处理',
        upgrade_condition: '确认 a4 后继续突破前高',
        invalidation: '跌破 a3 起涨低点',
      },
    })
  );

  const structureTag = tags.find((tag) => tag.key === 'structure');
  assert.ok(structureTag);
  assert.equal(structureTag.label, '结构｜A延续候选');
  assert.ok(structureTag.hover.items.some((item) => item.label === '当前阶段' && item.value === 'a3进行中'));
  assert.ok(
    structureTag.hover.items.some((item) => item.label === '升级条件' && item.value === '确认 a4 后继续突破前高')
  );
});

test('buildPeriodSummarySignalTags prefers phase2 divergence weight over legacy macd divergence note', () => {
  const tags = signalTags.buildPeriodSummarySignalTags(
    createPeriod({
      macd: {
        status: '中偏弱',
        description: '动能转弱',
        divergence_note: '注意顶背离',
      },
      trinity_decision: createDecision({
        divergence_weight: {
          status: 'neutral',
          label: '无背离压制',
          reason: '当前未检测到顶底背离',
          impact_on_judgment: 'neutral',
        },
      }),
    })
  );

  const divergenceTag = tags.find((tag) => tag.key === 'divergence');
  assert.ok(divergenceTag);
  assert.equal(divergenceTag.label, '背离｜无背离压制');
});

test('buildPeriodSignalTags combines period signals into capped tags', () => {
  const tags = signalTags.buildPeriodSignalTags(createPeriod(), { max: 4 });

  assert.deepEqual(tags.map((tag) => tag.label), [
    '背离｜顶背离',
    '突破/跌破｜假突破风险',
    '时空｜中偏弱',
  ]);
  assert.equal(tags[0]?.tone, 'bearish');
  assert.equal(tags[0]?.key, 'divergence');
  assert.equal(tags[1]?.tone, 'warning');
  assert.equal(tags[1]?.key, 'breakthrough');
  assert.deepEqual(tags[1]?.hover.items, [{ label: '信号', value: '冲高后回落' }]);
});

test('buildDecisionSignalTags obeys options.max when natural output is longer', () => {
  const tags = signalTags.buildDecisionSignalTags(createDecision(), { max: 3 });

  assert.deepEqual(tags.map((tag) => tag.label), ['时空｜中偏强', '突破/跌破｜突破候选', '量能｜突破量弱']);
  assert.equal(tags.length, 3);
});

test('buildDecisionSignalTags keeps unified order stable when max truncates later tags', () => {
  const tags = signalTags.buildDecisionSignalTags(createDecision(), { max: 6 });

  assert.deepEqual(tags.map((tag) => tag.key), [
    'spacetime',
    'breakthrough',
    'volume',
    'moving_average',
    'structure',
    'level_nesting',
  ]);
  assert.equal(tags.at(-1)?.label, '级别｜子级逆势');
});

test('buildPeriodSignalTags falls back to neutral tone when valid breakthrough direction is missing or unknown', () => {
  const missingDirectionTags = signalTags.buildPeriodSignalTags(
    createPeriod({
      breakthrough: {
        pattern_type: '放量突破',
        is_valid: true,
        direction: '',
        key_signals: ['突破成立'],
      },
    }),
    { max: 4 }
  );

  const unknownDirectionTags = signalTags.buildPeriodSignalTags(
    createPeriod({
      breakthrough: {
        pattern_type: '放量突破',
        is_valid: true,
        direction: 'sideways',
        key_signals: ['突破成立'],
      },
    }),
    { max: 4 }
  );

  assert.equal(missingDirectionTags[1]?.tone, 'neutral');
  assert.equal(unknownDirectionTags[1]?.tone, 'neutral');
});

test('buildPeriodSignalTags applies max after keeping period ordering stable', () => {
  const tags = signalTags.buildPeriodSignalTags(createPeriod(), { max: 2 });

  assert.deepEqual(tags.map((tag) => tag.key), ['divergence', 'breakthrough']);
  assert.deepEqual(tags.map((tag) => tag.label), ['背离｜顶背离', '突破/跌破｜假突破风险']);
});

test('buildPeriodSignalTags falls back hover items to conclusion when no structured items remain', () => {
  const tags = signalTags.buildPeriodSignalTags(
    createPeriod({
      macd: {
        status: '中偏弱',
        description: '   ',
        divergence_note: '',
      },
      breakthrough: undefined,
      trinity_decision: createDecision({
        spacetime: {
          status: '中偏弱',
          direction_bias: 'bearish',
          expected_structures: { up: ['C单平台式'], down: ['D三段式'] },
          structure_match: true,
          mismatch_reason: null,
          divergence_policy: {
            top_divergence_valid: false,
            bottom_divergence_valid: false,
            reason: '',
          },
        },
      }),
    }),
    { max: 4 }
  );

  assert.deepEqual(tags.map((tag) => tag.label), ['时空｜中偏弱']);
  assert.deepEqual(tags[0]?.hover.items, [{ label: '结论', value: '中偏弱' }]);
});
