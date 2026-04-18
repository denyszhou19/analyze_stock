import test from 'node:test';
import assert from 'node:assert/strict';
import type { AnalysisResultData, TrinityDecision } from '../src/lib/stock-structure-types.ts';

const {
  buildAiDecisionPayload,
} = await import(new URL('../src/lib/ai-analysis-payload.ts', import.meta.url).href);

const sampleAnalysisData: AnalysisResultData = {
  stock_code: '300274',
  stock_name: '阳光电源',
  analysis_time: '2026-03-30 10:00:00',
  periods: {
    weekly: {
      latest_price: 163.35,
      price_change_pct: -1.6,
      moving_averages: {
        MA55: 150,
        MA233: 120,
        price_vs_ma55: 'above',
        price_vs_ma233: 'above',
        ma_status: '多头排列',
      },
      macd: {
        status: '中偏弱',
        description: '周线中偏弱',
        divergence_note: '',
      },
      ma_physics: {
        support_pressure: { status: 'MA55支撑有效' },
        traction: { traction_force: '弱' },
        resonance: { convergence_strength: '弱' },
        key_signals: ['周线信号'],
      },
      breakthrough: {
        pattern_type: '反向突破',
        direction: 'up',
        target_ma: 'MA55',
        is_valid: true,
        confidence: '高',
        t0_date: '2026-03-11 00:00:00',
        key_signals: ['周线突破'],
      },
      structure: {
        structure_type: 'C单平台式',
        structure_stage: '中继整理',
        trend_direction: '震荡',
        inflection_points: 11,
        segment_count: 10,
        description: '周线整理',
        interpretation: {
          spacetime_gate: {
            parent_status: null,
            allowed_child_structures: [],
            child_structure_match: null,
            resonance_enabled: null,
            wait_reason: null,
            required_confirmation: null,
          },
        },
        structure_details: {
          prediction: {
            current_stage: 'c3',
            next_stage: 'c4',
            prediction_alert: '周线等待选择方向',
            key_price_levels: [
              { price: 160, type: 'support', note: '周线支撑观察' },
              { price: 170, type: 'resistance', note: '周线阻力观察' },
            ],
            confidence: 'medium',
            action_hint: '等待',
          },
          strokes: [{ from_price: 1, to_price: 2 }],
          render_payload: { points: [{ x: 1 }] },
        },
      },
      key_alerts: ['周线提醒'],
    },
    daily: {
      latest_price: 163.35,
      price_change_pct: -1.6,
      moving_averages: {
        MA55: 159.99,
        MA233: 123.6,
        price_vs_ma55: 'above',
        price_vs_ma233: 'above',
        ma_status: '多头排列',
      },
      macd: {
        status: '中偏弱',
        description: '高位死叉，上涨动能减弱，注意背离',
        divergence_note: '注意顶背离',
      },
      ma_physics: {
        support_pressure: {
          status: 'MA55支撑有效',
          ma55_role: '支撑',
          ma55_value: 159.99,
        },
        traction: {
          deviation_ma55_pct: 2.1,
          traction_force: '弱',
          pullback_expected: false,
        },
        resonance: {
          convergence_strength: '弱',
          resonance_zone: null,
        },
        key_signals: ['近期触及MA55，支撑有效'],
      },
      breakthrough: {
        pattern_type: '反向突破',
        direction: 'up',
        target_ma: 'MA55',
        is_valid: true,
        confidence: '高',
        t0_date: '2026-03-11 00:00:00',
        key_signals: ['先测试被拒 -> 以更大动能反向击穿'],
      },
      structure: {
        structure_type: 'A五段式',
        structure_stage: '趋势启动阶段',
        trend_direction: '上涨',
        inflection_points: 21,
        segment_count: 20,
        description: '识别为A五段式，上涨趋势',
        archetype: {
          primary: 'A五段式',
          maturity: 'late',
          confidence: 'medium',
          reason: 'Impulse -> Pullback -> Impulse',
          alternatives: [
            {
              type: 'C单平台式',
              confidence: 0.35,
              reason: '平台段占比仍高',
            },
          ],
        },
        execution_phase: {
          code: 'pullback_confirm',
          label: '回抽确认',
          bias: 'bullish',
          tradable: true,
          maturity: 'mid',
          reason: 'MA55支撑有效',
        },
        execution: {
          can_trade: true,
          action: 'buy',
          direction: 'long',
          setup_quality: 'A',
          rationale: '日线回抽确认，执行条件满足',
          timing_timeframe: 'daily',
          timeframe_cap_ratio: 0.5,
          trigger: ['MA55支撑有效后重新转强'],
          invalidation: ['跌破同级别止损位 159.99 立即退出'],
          confirmation: ['突破形态有效', '次级别结构继续共振'],
          position_sizing: { initial: '20%-30%' },
          t_trade_rule: { mode: 'positive_only' },
          risk_rules: { stop_loss_basis: 'same_timeframe' },
          take_profit_plan: { model: 'inverted_pyramid' },
          key_levels: [{ price: 159.99, type: 'stop', note: '最近确认底分型' }],
          risk_flags: [],
          wait_reason: null,
        },
        interpretation: {
          macro_background: {
            label: '偏多',
            direction: 'bullish',
            basis: ['价格在 MA55 / MA233 上方', 'MA55 高于 MA233'],
          },
          focus_structure: {
            archetype_label: 'A五段式原型',
            maturity: 'developing',
            directional_bias: 'up',
            summary: '当前可能处于上涨中的修正段',
          },
          current_leg: {
            label: 'a3→live 下行形成中',
            direction: 'down',
            status: 'forming',
          },
          next_confirmation: {
            label: '等待 a4 拐点',
            type: 'pivot',
            trigger: '等待新的确认拐点',
          },
          spacetime_gate: {
            parent_status: '中偏弱',
            allowed_child_structures: ['C'],
            child_structure_match: false,
            resonance_enabled: false,
            wait_reason: '中偏弱仅接受C结构，当前A原型暂不操作',
            required_confirmation: '等待匹配结构完成关键确认或重新识别',
          },
          scenario_paths: [
            {
              code: 'trend_continue',
              label: '延续推进',
              trigger: '重新站稳并突破 171.99',
              effect: '趋势推进继续，保持 A 原型',
            },
          ],
        },
        structure_details: {
          prediction: {
            current_stage: 'a3',
            next_stage: 'a4',
            prediction_alert: '当前可能处于上涨中的修正段',
            key_price_levels: [
              { price: 159.99, type: 'support', note: 'MA55 支撑' },
              { price: 156.89, type: 'stop', note: '确认止损位' },
            ],
            confidence: 'high',
            action_hint: '回踩确认后再看加仓',
            unstable_point: {
              is_unstable: false,
              type: null,
            },
            structure_perfect: {
              is_perfect: false,
            },
          },
          top_fractals: [{ high: 180 }],
          bottom_fractals: [{ low: 150 }],
          strokes: [{ from_price: 1, to_price: 2 }],
          line_geometry: { points: [{ x: 1 }] },
          render_payload: { points: [{ x: 1 }] },
          pipeline: { lookback_used: 233 },
        },
      },
      key_alerts: ['日线提醒'],
      volume: 1000000,
      key_levels: { support: 150 },
    },
    hour30: {
      latest_price: 163.35,
      price_change_pct: -0.2,
      moving_averages: {
        MA55: 162,
        MA233: 155,
        price_vs_ma55: 'above',
        price_vs_ma233: 'above',
        ma_status: '多头排列',
      },
      macd: {
        status: '弱',
        description: '30分钟弱',
        divergence_note: '',
      },
      structure: {
        structure_type: '复杂结构',
        structure_stage: '震荡阶段',
        trend_direction: '上涨',
        inflection_points: 9,
        description: '30分钟复杂震荡',
        interpretation: {
          macro_background: {
            label: '偏多',
            direction: 'bullish',
          },
          focus_structure: {
            archetype_label: '复杂结构',
            maturity: 'developing',
            directional_bias: 'two_way',
            summary: '接近方向选择位',
          },
          current_leg: {
            label: 'p3→live 震荡进行中',
            direction: 'down',
            status: 'forming',
          },
          next_confirmation: {
            label: '等待方向选择',
            type: 'direction_choice',
            trigger: '等待方向确认',
          },
          spacetime_gate: {
            parent_status: '中偏弱',
            allowed_child_structures: ['C'],
            child_structure_match: false,
            resonance_enabled: false,
            wait_reason: '中偏弱背景下当前仍属复杂/未完成结构，暂不操作',
            required_confirmation: '等待结构明确为标准 A/B/C/D 后再判断',
          },
          scenario_paths: [],
        },
        structure_details: {
          prediction: {
            current_stage: '震荡末端',
            next_stage: '方向选择',
            prediction_alert: '接近方向选择位',
            key_price_levels: [
              { price: 161.2, type: 'support', note: '下沿观察' },
              { price: 165.8, type: 'resistance', note: '上沿观察' },
            ],
            confidence: 'medium',
            action_hint: '等突破确认',
          },
          strokes: [{ from_price: 1, to_price: 2 }],
        },
      },
      ma_physics: {
        support_pressure: { status: '30分钟支撑' },
      },
      breakthrough: {
        pattern_type: '普通突破',
      },
      key_alerts: ['30分钟提醒'],
    },
  },
  level_nesting: {
    summary: '周线中偏弱 / 日线中偏弱 / 30分钟弱 / 60分钟弱',
    dimension1: { analysis: '旧的长分析，不应该再给 AI' },
    spacetime_confirmation: {
      space_confirmed: false,
      time_confirmed: false,
      spacetime_resonance: false,
      analysis: '时空均未确认，调整可能尚未结束。',
      time_analysis: { description: '时间未确认' },
    },
    trading_decision: {
      decision_type: '观望',
      t_type: null,
      analysis: '当前条件不满足做T或加仓，建议观望。',
      action_hint: '等待更明确信号',
      analysis_order: 'top_down',
      execution_order: 'bottom_up',
      core_questions: {
        major_resonance: {
          description: '周线与日线未共振向上',
        },
      },
    },
  },
  multi_dimension_operation: {
    dimension1: {
      major_level: 'weekly',
      major_level_name: '周线',
      major_status: '中偏弱',
      minor_level: 'daily',
      minor_level_name: '日线',
      minor_structure: 'A五段式',
      minor_trend: '上涨',
      advice: {
        operation_advice: '中枢底部可试仓，但要注意严格止损',
        structure_match: false,
        structure_direction: '上涨结构',
        explanation: '当前结构不符合操作条件。',
        matched_structures: ['C'],
      },
    },
  },
};

test('buildAiDecisionPayload keeps strategy-critical summaries and trims heavy structure details', () => {
  const result = buildAiDecisionPayload(sampleAnalysisData);

  assert.equal(result.stock_code, '300274');
  assert.equal(result.level_nesting?.summary, '周线中偏弱 / 日线中偏弱 / 30分钟弱 / 60分钟弱');
  assert.equal(result.level_nesting?.trading_decision?.decision_type, '观望');
  assert.equal(
    result.multi_dimension_operation?.dimension1?.advice?.operation_advice,
    '中枢底部可试仓，但要注意严格止损'
  );

  assert.deepEqual(result.key_alerts, ['【weekly】周线提醒', '【daily】日线提醒', '【hour30】30分钟提醒']);

  assert.equal(result.periods?.daily?.macd?.status, '中偏弱');
  assert.equal(
    result.periods?.daily?.structure?.interpretation?.spacetime_gate?.parent_status,
    '中偏弱'
  );
  assert.equal(
    result.periods?.hour30?.structure?.interpretation?.spacetime_gate?.child_structure_match,
    false
  );
  assert.equal(result.periods?.daily?.structure?.type, 'A五段式');
  assert.deepEqual(result.periods?.daily?.structure?.archetype, {
    primary: 'A五段式',
    maturity: 'late',
    confidence: 'medium',
    reason: 'Impulse -> Pullback -> Impulse',
    alternatives: [
      {
        type: 'C单平台式',
        confidence: 0.35,
        reason: '平台段占比仍高',
      },
    ],
  });
  assert.deepEqual(result.periods?.daily?.execution_phase, {
    code: 'pullback_confirm',
    label: '回抽确认',
    bias: 'bullish',
    tradable: true,
    maturity: 'mid',
    reason: 'MA55支撑有效',
  });
  assert.equal(result.periods?.daily?.execution?.action, 'buy');
  assert.equal(result.periods?.daily?.execution?.timeframe_cap_ratio, 0.5);
  assert.equal(result.periods?.daily?.latest_price, 163.35);
  assert.equal(result.periods?.daily?.price_change_pct, -1.6);
  assert.equal(result.periods?.daily?.ma_physics?.support_pressure_status, 'MA55支撑有效');
  assert.equal(result.periods?.daily?.breakthrough?.pattern_type, '反向突破');
  assert.equal(result.periods?.daily?.prediction?.current_stage, 'a3');
  assert.equal(result.level_nesting?.trading_decision?.analysis_order, 'top_down');
  assert.equal(result.level_nesting?.trading_decision?.execution_order, 'bottom_up');

  assert.equal(result.periods?.hour30?.prediction?.prediction_alert, '接近方向选择位');

  assert.equal('ma_physics' in (result.periods?.weekly || {}), false);
  assert.equal('breakthrough' in (result.periods?.weekly || {}), false);
  assert.equal('prediction' in (result.periods?.weekly || {}), false);
  assert.equal((result.level_nesting as Record<string, unknown>).dimension1, undefined);
  assert.equal((result.periods?.daily as Record<string, unknown>).volume, undefined);
});

test('buildAiDecisionPayload includes interpretation summary for downstream strategy analysis', () => {
  const payload = buildAiDecisionPayload({
    periods: {
      daily: {
        latest_price: 163.35,
        structure: {
          structure_type: 'C单平台式',
          structure_stage: '峰值209.88后C单平台式',
          trend_direction: '上涨',
          description: '旧描述',
          interpretation: {
            macro_background: {
              label: '偏多',
              direction: 'bullish',
              basis: ['价格在 MA55 上方', 'MA55 高于 MA233'],
            },
            focus_structure: {
              focus_mode: 'peak_slice_right',
              archetype_label: 'C平台原型',
              archetype_family: 'C',
              standard_qualification: 'standard',
              maturity: 'developing',
              directional_bias: 'range',
              summary: '峰值后右侧平台整理',
            },
            current_leg: {
              label: 'c3→live 下行形成中',
              direction: 'down',
              status: 'forming',
            },
            next_confirmation: {
              label: '等待 c4 确认',
              type: 'pivot',
              trigger: '等待底分型确认',
            },
            scenario_paths: [
              {
                code: 'up_break',
                label: '上破上沿',
                trigger: '突破 181.99',
                effect: '升级为推进结构',
              },
            ],
          },
        },
      },
    },
  });

  assert.equal(payload.periods.daily.structure.interpretation.macro_background.label, '偏多');
  assert.equal(
    payload.periods.daily.structure.interpretation.focus_structure.archetype_label,
    'C平台原型'
  );
  assert.equal(
    payload.periods.daily.structure.interpretation.focus_structure.standard_qualification,
    'standard'
  );
  assert.equal(
    payload.periods.daily.structure.interpretation.current_leg.label,
    'c3→live 下行形成中'
  );
  assert.equal(
    payload.periods.daily.structure.interpretation.next_confirmation.trigger,
    '等待底分型确认'
  );
  assert.deepEqual(payload.periods.daily.structure.interpretation.scenario_paths, [
    {
      code: 'up_break',
      label: '上破上沿',
      trigger: '突破 181.99',
      effect: '升级为推进结构',
    },
  ]);
});

test('buildAiDecisionPayload includes focus-origin downgrade facts for daily structure', () => {
  const payload = buildAiDecisionPayload({
    periods: {
      daily: {
        structure: {
          structure_type: '复杂结构',
          structure_stage: '等待确认',
          trend_direction: '下跌',
          description: '当前聚焦区间无法诚实解释为标准结构，已降级',
          interpretation: {
            focus_structure: {
              archetype_label: '复杂结构',
              start_anchor_source: 'peak_extreme',
              explainability_status: 'downgraded',
              downgrade_reason: '标准点数上限超出',
            },
          },
          structure_details: {
            focus_origin_analysis: {
              selected_origin_kind: 'peak_extreme',
              explainability_status: 'downgraded',
              explainability_reason: '标准点数上限超出',
            },
            raw_classification: {
              type: 'A五段式',
              stage: '趋势启动阶段',
              description: 'A五段式，趋势启动 + 平台整理',
              component_summary: ['Directional(1笔)', 'Platform(14笔)'],
            },
          },
        },
      },
    },
  });

  const daily = payload.periods.daily;
  assert.equal(
    daily.structure.interpretation.focus_structure.start_anchor_source,
    'peak_extreme'
  );
  assert.equal(
    daily.structure.interpretation.focus_structure.explainability_status,
    'downgraded'
  );
  assert.equal(daily.structure.raw_classification.type, 'A五段式');
  assert.equal(daily.structure.focus_origin_analysis.selected_origin_kind, 'peak_extreme');
});

test('buildAiDecisionPayload includes focus classification and extended qualification facts', () => {
  const payload = buildAiDecisionPayload({
    periods: {
      daily: {
        structure: {
          structure_type: '延伸C类',
          structure_stage: '超出标准点数，按延伸C类跟踪',
          trend_direction: '下跌',
          description: '当前聚焦区间仍属C类原型，但已超出标准点数',
          interpretation: {
            focus_structure: {
              archetype_label: '延伸C类原型',
              archetype_family: 'C',
              standard_qualification: 'extended',
              explainability_status: 'extended',
              qualification_reason: '超出标准点数，按延伸C类跟踪',
            },
          },
          structure_details: {
            focus_classification: {
              type: '延伸C类',
              stage: '超出标准点数，按延伸C类跟踪',
              archetype_family: 'C',
              standard_qualification: 'extended',
              qualification_reason: '超出标准点数，按延伸C类跟踪',
            },
          },
        },
      },
    },
  });

  const daily = payload.periods.daily;
  assert.equal(daily.structure.interpretation.focus_structure.archetype_family, 'C');
  assert.equal(
    daily.structure.interpretation.focus_structure.standard_qualification,
    'extended'
  );
  assert.equal(daily.structure.focus_classification.standard_qualification, 'extended');
});

  const dailyTrinityDecision: TrinityDecision = {
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
      focus_origin: {
        point_id: 'a1',
        price: 10.5,
        date: '2026-02-10 00:00:00',
        source: 'peak_extreme',
        semantic: 'focus_origin',
      },
      execution_origin: null,
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
      divergence_policy: {
        top_divergence_valid: false,
        bottom_divergence_valid: false,
        reason: 'none',
      },
    },
    moving_average: {
      ma55_role: 'support',
      ma233_role: 'support',
      price_position: { above_ma55: true, above_ma233: true },
      breakthrough_state: 'valid_breakout',
      ma_gate: { allow_long: true, allow_short: false, reason: 'ok' },
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
      reason: ['A原型成立'],
    },
    execution: {
      entry_style: 'pullback',
      triggers: ['重新站上平台上沿'],
      invalidation: ['跌回平台下沿'],
      confirmation: ['回踩 MA55 不破'],
      position_sizing: { reason: '等待' },
      risk_flags: [],
    },
    judgment_criteria: [],
    ai_summary_facts: ['A五段式'],
  };

test('buildAiDecisionPayload preserves deterministic_decision for daily period', () => {
  const payload = buildAiDecisionPayload({
    stock_code: '300274',
    periods: {
      daily: {
        trinity_decision: dailyTrinityDecision,
      },
    },
  });

  const daily = payload.periods.daily;

  assert.equal(daily.deterministic_decision?.level, 'daily');
  assert.equal(
    daily.deterministic_decision?.structure.focus_origin?.source,
    'peak_extreme'
  );
  assert.equal(
    daily.deterministic_decision?.level_nesting?.permission.allow_only_light_probe,
    true
  );
});
