import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  AiSummaryCard,
  AnalysisResultData,
  TrinityDecision,
} from '../src/lib/stock-structure-types.ts';
import type { DataIntegritySnapshot } from '../src/lib/stock-data-integrity.ts';

const { buildAnalysisPageViewModel } = await import(
  new URL('../src/lib/trinity-analysis-page-view-model.ts', import.meta.url).href
) as typeof import('../src/lib/trinity-analysis-page-view-model.ts');

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
      family: 'standard',
      type: 'A五段式',
      standard_candidate: 'A五段式',
      qualification: 'standard',
      direction: 'up',
      boundaries: {},
      node_map: { last_confirmed: 10.8 },
      can_trade_by_structure_nodes: true,
      can_trade_by_boundaries: true,
      explainability: { status: 'passed', reason: 'A原型成立', evidence: ['五段式成立'] },
    },
    spacetime: {
      status: '中偏强',
      direction_bias: 'bullish',
      expected_structures: { up: ['A五段式'], down: ['D三段式'] },
      structure_match: false,
      mismatch_reason: '等待 C 结构边界确认',
      divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: '无背离确认' },
    },
    moving_average: {
      ma55_role: 'support',
      ma233_role: 'support',
      price_position: { above_ma55: true, above_ma233: true },
      breakthrough_state: 'valid_breakout',
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
    judgment_criteria: [
      {
        category: 'structure',
        label: '结构资格',
        status: 'passed',
        detail: 'A 原型成立',
      },
      {
        category: 'spacetime',
        label: 'MACD 时空',
        status: 'warning',
        detail: '等待时空共振补齐',
      },
      {
        category: 'moving_average',
        label: '55 / 233 线关系',
        status: 'passed',
        detail: 'MA55 支撑，MA233 同向',
      },
      {
        category: 'volume',
        label: '量能确认',
        status: 'info',
        detail: '量能尚未形成强确认',
      },
      {
        category: 'level_nesting',
        label: '级别权限',
        status: 'warning',
        detail: '父级偏多但子级等待确认',
      },
      {
        category: 'execution',
        label: '执行计划',
        status: 'info',
        detail: '等待回踩 MA55 后再执行',
      },
    ],
    ai_summary_facts: ['A五段式原型'],
  };

  return { ...base, ...overrides };
}

function createResult(): AnalysisResultData {
  const dailyDecision = createDecision();
  const weeklyDecision = createDecision({
    level: 'weekly',
    conclusion: {
      action: 'hold',
      action_label: '持有观察',
      bias: 'bullish',
      confidence: 'medium',
      can_trade: true,
    },
  });

  return {
    stock_code: 'SH600000',
    stock_name: '浦发银行',
    analysis_time: '2026-04-18 15:00:00',
    periods: {
      daily: {
        period: 'daily',
        analysis_date: '2026-04-18',
        trinity_decision: dailyDecision,
        structure: {
          structure_type: 'A五段式',
          structure_details: {
            valid_range: {
              start_date: '2025-05-12',
              end_date: '2026-04-18',
              start_price: 9.8,
              end_price: 10.8,
              origin_type: 'peak_extreme',
              break_type: 'up',
            },
            pipeline_debug: {
              analysis_kline_count: 240,
              processed_kline_count: 238,
              valid_range_applied: true,
              render_window_size: 160,
            },
          },
        },
      },
      weekly: {
        period: 'weekly',
        trinity_decision: weeklyDecision,
        structure: {
          structure_type: '上升通道',
          structure_details: {
            valid_range: { start_date: '2024-01-05', end_date: '2026-04-17' },
            pipeline_debug: { analysis_kline_count: 120 },
          },
        },
      },
    },
  };
}

function createIntegrity(): DataIntegritySnapshot {
  return {
    code: 'SH600000',
    baostockLatestDate: '2026-04-18',
    currentTime: '2026-04-18T15:00:00+08:00',
    isWeekend: false,
    levels: [],
    summary: {
      overallStatus: 'ok',
      overallText: '数据完整',
      okCount: 5,
      staleCount: 0,
      missingCount: 0,
      errorCount: 0,
      pendingCount: 0,
      totalLevels: 5,
      needsSyncLevels: [],
      canAnalyze: true,
      analyzeWarning: null,
    },
  };
}

test('AI idle uses backend conclusion and builds fixed gates, bus, and rule chain', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(vm.statusBar.aiStatus.label, '未生成');
  assert.equal(vm.summary.mode, 'idle');
  assert.equal(vm.summary.headline, '等待');
  assert.equal(vm.summary.primaryActionLabel, '等待');
  assert.deepEqual(vm.summary.triggerLabels, ['重新站上平台上沿']);
  assert.equal(vm.summary.guardrail, '等待 C 结构边界确认');
  assert.equal(vm.summary.hardGates[0].label, '后端最终动作');
  assert.equal(vm.summary.hardGates[0].value, '等待');
  assert.equal(vm.bus.dimensions.length, 3);
  assert.deepEqual(
    vm.bus.dimensions.map((dimension) => dimension.title),
    ['维度一｜周线 → 日线', '维度二｜日线 → 30分钟', '维度三｜60分钟 → 15分钟']
  );
  assert.equal(vm.ruleChain.items.length, 6);
  assert.deepEqual(
    vm.ruleChain.items.map((item) => item.title),
    ['结构资格', 'MACD 时空', '55 / 233 线关系', '量能确认', '级别权限', '执行计划']
  );
  assert.deepEqual(
    vm.ruleChain.items.map((item) => item.status),
    ['passed', 'warning', 'passed', 'info', 'warning', 'info']
  );
});

test('status bar renders data ranges by configured level order and daily valid range', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.deepEqual(
    vm.statusBar.dataRanges.map((range) => range.level),
    ['weekly', 'daily']
  );

  const dailyRange = vm.statusBar.dataRanges.find((range) => range.level === 'daily');
  assert.ok(dailyRange);
  assert.equal(dailyRange.label, '日线');
  assert.equal(dailyRange.countLabel, '近 240 根');
  assert.match(dailyRange.coverageLabel, /2025-05-12/);
  assert.match(dailyRange.coverageLabel, /2026-04-18/);
});

test('AI ready summary accepts AiSummaryCard shape directly', () => {
  const aiSummary: AiSummaryCard = {
    headline: 'AI 判断：等待缩量回踩后的二次确认',
    action: 'wait',
    bias: 'neutral',
    primary_reason: '回踩确认前不追价',
    triggers: ['缩量回踩 MA55 并重新放量上攻'],
    risks: ['跌破平台下沿'],
    guardrail: '仅接受缩量回踩后的二次确认',
  };

  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: {
      status: 'ready',
      summary: aiSummary,
    },
  });

  assert.equal(vm.summary.mode, 'ready');
  assert.equal(vm.summary.headline, 'AI 判断：等待缩量回踩后的二次确认');
  assert.equal(vm.summary.primaryActionLabel, '等待');
  assert.equal(vm.summary.primaryReason, '回踩确认前不追价');
  assert.deepEqual(vm.summary.triggerLabels, ['缩量回踩 MA55 并重新放量上攻']);
  assert.deepEqual(vm.summary.riskLabels, ['跌破平台下沿']);
  assert.equal(vm.summary.guardrail, '仅接受缩量回踩后的二次确认');
});

test('AI ready summary falls back to backend Chinese copy when AI summary is English', () => {
  const result = createResult();
  if (!result.periods.daily.trinity_decision) {
    throw new Error('missing daily decision');
  }

  result.periods.daily.trinity_decision.conclusion = {
    action: 'wait',
    action_label: 'wait',
    bias: 'neutral',
    confidence: 'medium',
    can_trade: false,
    wait_reason: '等待 C 结构边界确认',
  };

  const aiSummary: AiSummaryCard = {
    headline: 'Signals remain unconfirmed; stay in observation mode.',
    action: 'wait',
    bias: 'neutral',
    primary_reason: 'Execution stays capped at wait with no_position.',
    triggers: ['Daily closes back above 135.78.'],
    risks: ['Spacetime confirmation is not complete.'],
    guardrail: 'Respect deterministic wait and no_position.',
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: {
      status: 'ready',
      summary: aiSummary,
    },
  });

  assert.equal(vm.summary.headline, '等待');
  assert.equal(vm.summary.primaryActionLabel, '等待');
  assert.equal(vm.summary.primaryReason, '等待 C 结构边界确认');
  assert.deepEqual(vm.summary.triggerLabels, ['重新站上平台上沿']);
  assert.deepEqual(vm.summary.riskLabels, ['不追高']);
  assert.equal(vm.summary.guardrail, '等待 C 结构边界确认');
  assert.equal(vm.summary.hardGates[0].value, '等待');
});

test('rule chain preserves failed status from judgment criteria', () => {
  const result = createResult();
  if (!result.periods.daily.trinity_decision) {
    throw new Error('missing daily decision');
  }

  result.periods.daily.trinity_decision.judgment_criteria = result.periods.daily.trinity_decision.judgment_criteria.map(
    (criterion) =>
      criterion.category === 'volume'
        ? {
            ...criterion,
            status: 'failed',
            detail: '放量失衡，不满足确认条件',
          }
        : criterion
  );

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const volumeRule = vm.ruleChain.items.find((item) => item.title === '量能确认');
  assert.ok(volumeRule);
  assert.equal(volumeRule.status, 'failed');
  assert.equal(volumeRule.detail, '放量失衡，不满足确认条件');
});

test('loading and error states use unified Chinese labels', () => {
  const loadingVm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'loading', label: 'streaming' },
  });
  const errorVm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'error', message: 'generation_failed' },
  });

  assert.equal(loadingVm.statusBar.aiStatus.label, '生成中');
  assert.equal(errorVm.statusBar.aiStatus.label, '生成失败');
});
