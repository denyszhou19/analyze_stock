import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrinityDecision, TrinityLevelNestingDecision } from '../src/lib/stock-structure-types.ts';

const judgmentDisplay = await import(
  new URL('../src/lib/trinity-judgment-display.ts', import.meta.url).href
) as typeof import('../src/lib/trinity-judgment-display.ts');

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
      wait_reason: '等待确认',
    },
    structure: {
      background_origin: null,
      focus_origin: null,
      execution_origin: null,
      family: 'standard',
      type: 'A五段式',
      standard_candidate: 'A五段式',
      qualification: 'standard',
      direction: 'up',
      boundaries: {},
      node_map: {},
      can_trade_by_structure_nodes: false,
      can_trade_by_boundaries: false,
      explainability: {
        status: 'passed',
        reason: 'A原型成立',
        evidence: ['五段式成立'],
      },
    },
    spacetime: {
      status: '中性',
      direction_bias: 'neutral',
      expected_structures: { up: ['A五段式'], down: ['D三段式'] },
      structure_match: false,
      mismatch_reason: '等待确认',
      divergence_policy: {
        top_divergence_valid: false,
        bottom_divergence_valid: false,
        reason: '无背离确认',
      },
    },
    moving_average: {
      ma55_role: 'neutral',
      ma233_role: 'neutral',
      price_position: { above_ma55: false, above_ma233: false },
      breakthrough_state: 'breakout_pending',
      ma_gate: {
        allow_long: false,
        allow_short: false,
        reason: '等待均线确认',
      },
    },
    volume_confirmation: {
      volume_state: 'unknown',
      breakout_volume: 'not_applicable',
      breakdown_volume: 'not_applicable',
      pullback_volume: 'not_applicable',
      volume_gate: {
        supports_breakout: false,
        supports_breakdown: false,
        supports_pullback_confirmation: false,
        confidence_adjustment: 'neutral',
        reason: '量能未确认',
      },
    },
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
        reason: '等待父级确认',
      },
    },
    trade_qualification: {
      trade_mode: 'wait_confirmation',
      position_permission: 'light_probe',
      confidence: 'medium',
      reason: ['等待确认'],
    },
    execution: {
      entry_style: 'none',
      triggers: ['重新站上平台上沿'],
      invalidation: ['跌回平台下沿'],
      confirmation: ['回踩 MA55 不破'],
      position_sizing: { max_ratio: null, reason: '等待确认' },
      risk_flags: ['不追高'],
    },
    judgment_criteria: [],
    ai_summary_facts: [],
  };

  return { ...base, ...overrides };
}

function createLevelNesting(
  overrides: Partial<TrinityLevelNestingDecision> = {}
): TrinityLevelNestingDecision {
  const base: TrinityLevelNestingDecision = {
    parent_level: 'weekly',
    child_level: 'daily',
    parent_bias: 'bullish',
    child_signal: 'wait',
    resonance: 'parent_unclear',
    permission: {
      allow_position_increase: false,
      allow_t_trade: false,
      allow_only_light_probe: true,
      reason: '等待确认',
    },
  };

  return { ...base, ...overrides };
}

test('resolveJudgmentLabel maps wait, probe, and full execution states', () => {
  assert.equal(judgmentDisplay.resolveJudgmentLabel(createDecision()), '候选可试');

  assert.equal(
    judgmentDisplay.resolveJudgmentLabel(
      createDecision({
        conclusion: {
          action: 'buy',
          action_label: '买入',
          bias: 'bullish',
          confidence: 'high',
          can_trade: true,
        },
        trade_qualification: {
          trade_mode: 'standard_node_trade',
          position_permission: 'full_signal',
          confidence: 'high',
          reason: ['条件齐备'],
        },
      })
    ),
    '确认执行'
  );

  assert.equal(judgmentDisplay.resolveJudgmentLabel(undefined), '严格等待');
});

test('resolveRelationLabel compresses parent-child resonance into fixed short copy', () => {
  assert.equal(
    judgmentDisplay.resolveRelationLabel(createLevelNesting({ resonance: 'child_countertrend' })),
    '父级强冲突，子级逆父级'
  );
  assert.equal(
    judgmentDisplay.resolveRelationLabel(createLevelNesting({ resonance: 'conflict' })),
    '父级强冲突，子级逆父级'
  );
  assert.equal(
    judgmentDisplay.resolveRelationLabel(createLevelNesting({ resonance: 'aligned' })),
    '父级支持，子级顺父级'
  );
});

test('buildExecutionPreview returns fallback-safe execution copy', () => {
  assert.deepEqual(judgmentDisplay.buildExecutionPreview(createDecision()), {
    probeEntry: '重新站上平台上沿',
    confirmEntry: '回踩 MA55 不破',
    invalidation: '跌回平台下沿',
  });
});

test('buildExecutionPreview falls back when execution arrays are missing', () => {
  assert.deepEqual(
    judgmentDisplay.buildExecutionPreview(
      createDecision({
        execution: {
          entry_style: 'none',
          triggers: [],
          invalidation: [],
          confirmation: [],
          position_sizing: { max_ratio: null, reason: '等待确认' },
          risk_flags: [],
        },
      })
    ),
    {
      probeEntry: '继续等待触发',
      confirmEntry: '等待进一步确认',
      invalidation: '若条件失效则取消',
    }
  );
});
