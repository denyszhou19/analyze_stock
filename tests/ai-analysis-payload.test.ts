import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildAiDecisionPayload,
} = await import(new URL('../src/lib/ai-analysis-payload.ts', import.meta.url).href);

const sampleAnalysisData = {
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
        structure_details: {
          prediction: {
            current_stage: 'c3',
            next_stage: 'c4',
            prediction_alert: '周线等待选择方向',
            key_price_levels: [160, 170],
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
        structure_details: {
          prediction: {
            current_stage: 'a3',
            next_stage: 'a4',
            prediction_alert: '当前可能处于上涨中的修正段',
            key_price_levels: [159.99, 156.89],
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
        structure_details: {
          prediction: {
            current_stage: '震荡末端',
            next_stage: '方向选择',
            prediction_alert: '接近方向选择位',
            key_price_levels: [161.2, 165.8],
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
