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
  assert.equal(
    vm.ruleChain.sourceLabel,
    '本规则链默认按日线主判定展示；若日线缺失，则依次降级为周线、60分钟、30分钟、15分钟。'
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

test('rule chain sanitizes backend field names and avoids undefined execution labels', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }

  decision.judgment_criteria = decision.judgment_criteria
    .map((criterion) =>
      criterion.category === 'structure'
        ? {
            ...criterion,
            status: 'warning' as const,
            detail:
              '延伸结构停止标准编号，仅突出起点与当前段；current_stage 无法映射，已回退到最后确认点',
          }
        : criterion
    )
    .filter((criterion) => criterion.category !== 'execution');
  (decision.execution as { entry_style: string }).entry_style = 'wait';
  decision.execution.triggers = ['等待确认性触发'];
  decision.execution.invalidation = ['原建仓级别失效立即退出'];
  decision.execution.position_sizing.reason = '偏离均线过大';

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const structureRule = vm.ruleChain.items.find((item) => item.title === '结构资格');
  const executionRule = vm.ruleChain.items.find((item) => item.title === '执行计划');
  assert.ok(structureRule);
  assert.ok(executionRule);
  assert.equal(
    structureRule.detail,
    '延伸结构停止标准编号，仅突出起点与当前段；当前阶段无法映射，已回退到最后确认点'
  );
  assert.equal(
    executionRule.detail,
    '等待触发｜触发：等待确认性触发｜失效：原建仓级别失效立即退出'
  );
  assert.doesNotMatch(executionRule.detail, /undefined/);
});

test('rule chain source label explains downgrade when daily decision is missing', () => {
  const result = createResult();
  delete result.periods.daily.trinity_decision;

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(
    vm.ruleChain.sourceLabel,
    '本规则链当前按周线主判定展示；因日线主判定缺失，已自动降级。'
  );
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

test('global strategy is derived from three trading combinations, not a single daily label', () => {
  const result = createResult();
  if (!result.periods.daily.trinity_decision) {
    throw new Error('missing daily decision');
  }
  result.periods.daily.trinity_decision.trade_qualification = {
    trade_mode: 'standard_node_trade',
    position_permission: 'light_probe',
    confidence: 'medium',
    reason: ['日线允许轻仓试探'],
  };
  result.periods.daily.trinity_decision.conclusion = {
    action: 'wait',
    action_label: '等待',
    bias: 'bullish',
    confidence: 'medium',
    can_trade: true,
    wait_reason: '日线允许轻仓跟踪',
  };
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'buy',
        action_label: '轻仓试探',
        bias: 'bullish',
        confidence: 'medium',
        can_trade: true,
      },
      execution: {
        entry_style: 'pullback_confirm' as never,
        triggers: ['30分钟放量突破平台上沿'],
        invalidation: ['30分钟跌回突破位'],
        confirmation: ['回踩不破突破位'],
        position_sizing: { max_ratio: 0.2, reason: '日线仍需确认，只允许轻仓试探' },
        risk_flags: ['日线结构未完全确认'],
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(vm.globalStrategy.scopeLabel, '综合范围：中线主策略组合、短线执行组合、超短线 / T 组合');
  assert.equal(vm.globalStrategy.primaryCombinationLabel, '短线执行组合｜日线 → 30分钟');
  assert.equal(vm.globalStrategy.primaryConstraintLevel, 'daily');
  assert.equal(vm.globalStrategy.primaryConstraintLevelLabel, '日线');
  assert.equal(vm.globalStrategy.triggerLevel, 'hour30');
  assert.equal(vm.globalStrategy.triggerLevelLabel, '30分钟');
  assert.equal(vm.globalStrategy.actionLabel, '可执行');
  assert.equal(vm.tradingCombinations.length, 3);
  assert.deepEqual(
    vm.tradingCombinations.map((item) => item.label),
    ['中线主策略组合｜周线 → 日线', '短线执行组合｜日线 → 30分钟', '超短线 / T 组合｜60分钟 → 15分钟']
  );
});

test('hard gates expose source and hover explanation', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(vm.summary.hardGateTitle, '主策略硬门控');
  assert.match(vm.summary.hardGateSourceLabel, /当前硬门控来自主判定级别：日线/);
  assert.match(vm.summary.hardGateSourceLabel, /当前优先组合：短线执行组合｜日线 → 30分钟/);
  const positionGate = vm.summary.hardGates.find((gate) => gate.label === '仓位权限');
  assert.ok(positionGate);
  assert.equal(positionGate.description.title, '仓位权限');
  assert.match(positionGate.description.tradeImpact, /不能突破/);
  assert.match(positionGate.description.source, /trade_qualification.position_permission/);
});

test('missing parent constraint downgrades combination and prevents false executable selection', () => {
  const result = createResult();
  delete result.periods.daily.trinity_decision;
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'buy',
        action_label: '轻仓试探',
        bias: 'bullish',
        confidence: 'medium',
        can_trade: true,
      },
      execution: {
        entry_style: 'pullback_confirm' as never,
        triggers: ['30分钟放量突破平台上沿'],
        invalidation: ['30分钟跌回突破位'],
        confirmation: ['回踩不破突破位'],
        position_sizing: { max_ratio: 0.2, reason: '日线缺失，仅能观察' },
        risk_flags: ['父级约束缺失'],
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const shortline = vm.tradingCombinations.find((item) => item.label === '短线执行组合｜日线 → 30分钟');
  assert.ok(shortline);
  assert.equal(shortline.actionLabel, '观察中');
  assert.equal(shortline.parentConstraint, '日线缺失');
  assert.notEqual(vm.globalStrategy.primaryCombinationLabel, '短线执行组合｜日线 → 30分钟');
});

test('summary hard gates bind to primary combination constraint level before fallback', () => {
  const result = createResult();
  if (!result.periods.weekly.trinity_decision) {
    throw new Error('missing weekly decision');
  }
  result.periods.weekly.trinity_decision.trade_qualification = {
    trade_mode: 'standard_node_trade',
    position_permission: 'half_position',
    confidence: 'medium',
    reason: ['周线允许按主趋势持有'],
  };
  result.periods.daily.trinity_decision = createDecision({
    level: 'daily',
    conclusion: {
      action: 'hold',
      action_label: '持有观察',
      bias: 'bullish',
      confidence: 'medium',
      can_trade: true,
      wait_reason: '日线跟随周线持有观察',
    },
    trade_qualification: {
      trade_mode: 'wait_confirmation',
      position_permission: 'no_position',
      confidence: 'medium',
      reason: ['日线未确认'],
    },
  });

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(vm.globalStrategy.primaryCombinationLabel, '中线主策略组合｜周线 → 日线');
  assert.equal(vm.globalStrategy.primaryConstraintLevel, 'weekly');
  assert.match(vm.summary.hardGateSourceLabel, /当前硬门控来自主判定级别：周线/);
  assert.doesNotMatch(vm.summary.hardGateSourceLabel, /当前硬门控来自主判定级别：日线/);
  const levelGate = vm.summary.hardGates.find((gate) => gate.label === '执行级别');
  assert.ok(levelGate);
  assert.equal(levelGate.value, '周线');
});

test('hard gate guardrail falls back to chinese copy when backend reason is english', () => {
  const result = createResult();
  if (!result.periods.daily.trinity_decision) {
    throw new Error('missing daily decision');
  }

  result.periods.daily.trinity_decision.conclusion.wait_reason = 'Wait for daily breakout';
  result.periods.daily.trinity_decision.execution.position_sizing.reason = 'Position sizing pending';
  result.periods.daily.trinity_decision.trade_qualification.reason = ['English trade qualification'];

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const guardrailGate = vm.summary.hardGates.find((gate) => gate.label === '结论约束');
  assert.ok(guardrailGate);
  assert.notEqual(guardrailGate.value, 'Wait for daily breakout');
  assert.notEqual(guardrailGate.value, 'Position sizing pending');
  assert.equal(guardrailGate.value, '暂无明确结论约束');
});

test('parent no_position blocks executable shortline even if child can trade', () => {
  const result = createResult();
  if (!result.periods.daily.trinity_decision) {
    throw new Error('missing daily decision');
  }

  result.periods.daily.trinity_decision.trade_qualification = {
    trade_mode: 'wait_confirmation',
    position_permission: 'no_position',
    confidence: 'medium',
    reason: ['日线禁止开仓'],
  };
  result.periods.daily.trinity_decision.conclusion = {
    action: 'wait',
    action_label: '等待',
    bias: 'bullish',
    confidence: 'medium',
    can_trade: false,
    wait_reason: '日线主约束禁止开仓',
  };
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'buy',
        action_label: '轻仓试探',
        bias: 'bullish',
        confidence: 'medium',
        can_trade: true,
      },
      execution: {
        entry_style: 'pullback_confirm' as never,
        triggers: ['30分钟放量突破平台上沿'],
        invalidation: ['30分钟跌回突破位'],
        confirmation: ['回踩不破突破位'],
        position_sizing: { max_ratio: 0.2, reason: '30分钟已有触发' },
        risk_flags: ['服从日线主约束'],
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const shortline = vm.tradingCombinations.find((item) => item.label === '短线执行组合｜日线 → 30分钟');
  assert.ok(shortline);
  assert.equal(shortline.actionLabel, '谨慎看');
  assert.notEqual(shortline.actionLabel, '可执行');
  assert.notEqual(vm.globalStrategy.actionLabel, '可执行');
});

test('english reasons are cleaned across summary global strategy and combinations', () => {
  const result = createResult();
  if (!result.periods.daily.trinity_decision) {
    throw new Error('missing daily decision');
  }

  result.periods.daily.trinity_decision.conclusion.wait_reason = 'Wait for daily breakout';
  result.periods.daily.trinity_decision.execution.position_sizing.reason = 'Position sizing pending';
  result.periods.daily.trinity_decision.trade_qualification.reason = ['English trade qualification'];

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const guardrailGate = vm.summary.hardGates.find((gate) => gate.label === '结论约束');
  const shortline = vm.tradingCombinations.find((item) => item.label === '短线执行组合｜日线 → 30分钟');
  assert.ok(guardrailGate);
  assert.ok(shortline);
  assert.notEqual(guardrailGate.value, 'Wait for daily breakout');
  assert.notEqual(vm.globalStrategy.primaryReason, 'Wait for daily breakout');
  assert.notEqual(vm.globalStrategy.guardrail, 'Wait for daily breakout');
  assert.doesNotMatch(shortline.parentConstraint, /Wait for daily breakout|English trade qualification|Position sizing pending/);
});

test('mixed language reason chain prefers later chinese candidate instead of generic fallback', () => {
  const result = createResult();
  if (!result.periods.daily.trinity_decision) {
    throw new Error('missing daily decision');
  }

  result.periods.daily.trinity_decision.conclusion.wait_reason = 'wait for confirmation';
  result.periods.daily.trinity_decision.trade_qualification.reason = ['parent not ready'];
  result.periods.daily.trinity_decision.execution.position_sizing.reason = '只允许轻仓等待确认';

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const guardrailGate = vm.summary.hardGates.find((gate) => gate.label === '结论约束');
  const shortline = vm.tradingCombinations.find((item) => item.label === '短线执行组合｜日线 → 30分钟');
  assert.ok(guardrailGate);
  assert.ok(shortline);
  assert.equal(vm.summary.primaryReason, '只允许轻仓等待确认');
  assert.equal(vm.summary.guardrail, '只允许轻仓等待确认');
  assert.equal(guardrailGate.value, '只允许轻仓等待确认');
  assert.equal(vm.globalStrategy.primaryReason, '只允许轻仓等待确认');
  assert.equal(vm.globalStrategy.guardrail, '只允许轻仓等待确认');
  assert.match(shortline.parentConstraint, /只允许轻仓等待确认/);
  assert.doesNotMatch(shortline.parentConstraint, /暂无额外约束/);
});

test('rule chain items expose trading labels, direction and status explanation', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const structureRule = vm.ruleChain.items.find((item) => item.title === '结构资格');
  const spacetimeRule = vm.ruleChain.items.find((item) => item.title === 'MACD 时空');

  assert.ok(structureRule);
  assert.ok(spacetimeRule);
  assert.equal(structureRule.displayStatusLabel, '可执行');
  assert.equal(spacetimeRule.displayStatusLabel, '谨慎看');
  assert.equal(spacetimeRule.directionLabel, '偏多');
  assert.equal(spacetimeRule.statusExplanation.ruleState, '有约束');
  assert.match(spacetimeRule.statusExplanation.reason, /MACD 时空|等待时空/);
});
