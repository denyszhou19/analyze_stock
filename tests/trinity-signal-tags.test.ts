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
