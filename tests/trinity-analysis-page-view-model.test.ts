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

function createTopologyRenderPayload() {
  return {
    version: 1,
    viewport: {
      width: 320,
      height: 180,
      padding: { top: 12, right: 12, bottom: 12, left: 12 },
      draw_width: 296,
      draw_height: 156,
      date_label_y: 168,
      label_box: { width: 44, height: 20, radius: 6 },
    },
    price_range: { min: 9.8, max: 11.2, range: 1.4 },
    points: [],
    segments: [],
    point_count: 0,
    segment_count: 0,
  };
}

function createTopologyExplainability(overrides: Record<string, unknown> = {}) {
  return {
    structure_family: 'A',
    standard_qualification: 'standard',
    structure_start_point_id: 'p1',
    current_point_id: 'p5',
    live_point_id: 'live',
    current_segment: {
      from_point_id: 'p4',
      to_point_id: 'p5',
      label: '主升段',
    },
    next_segment_preview: {
      from_point_id: 'p5',
      to_point_id: 'p6',
      label: '放量突破确认',
      status: 'completion',
    },
    point_labels: [],
    segment_labels: [],
    display_reason: '主升段推进中，等待放量突破确认',
    ...overrides,
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
  assert.equal(vm.summary.judgmentLabel, '严格等待');
  assert.equal(vm.summary.relationLabel, '父级强冲突，子级逆父级');
  assert.match(vm.summary.spacetimeSummary, /^时空：/);
  assert.match(vm.summary.structureSummary, /^结构：/);
  assert.match(vm.summary.executionSummary, /^现在怎么做：先看/);
  assert.deepEqual(vm.summary.triggerLabels, ['重新站上平台上沿']);
  assert.equal(vm.summary.guardrail, '等待 C 结构边界确认');
  assert.ok(vm.summary.signalTags.some((tag) => tag.label === '级别｜子级逆势'));
  assert.ok(vm.summary.signalTags.some((tag) => tag.label === '执行｜回踩执行'));
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

test('summary maps phase3 AI enhanced blocks before backend fallback', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }

  decision.candidate_structure = {
    candidate_type: 'A延续',
    candidate_label: '后端候选',
    current_leg: '后端当前段',
    direction: 'up',
    reason: '后端候选理由',
    upgrade_condition: '后端升级条件',
    invalidation: '后端失效条件',
  };
  decision.wait_state = {
    wait_type: '等待回抽确认',
    wait_label: '后端等待',
    current_block: '后端阻塞点',
    next_confirmation_action: '后端下一步',
    reason: '后端等待理由',
  };

  const aiSummary: AiSummaryCard = {
    headline: 'AI 判断：当前先等30分钟回抽确认',
    action: 'wait',
    bias: 'neutral',
    primary_reason: 'AI 主理由',
    critical_reason: 'AI 关键理由',
    triggers: ['AI 触发'],
    risks: ['AI 风险'],
    guardrail: 'AI 风控',
    judgment: '确认执行',
    candidate_structure: {
      label: 'AI D候选',
      current_leg: 'AI 30分钟回抽段',
      upgrade_condition: 'AI 升级条件',
      invalidation: 'AI 失效条件',
    },
    wait_state: {
      label: 'AI 等待回抽确认',
      current_block: 'AI 当前阻塞',
      next_action: 'AI 下一步',
    },
    judgment_warning: 'AI 判断疑点',
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: {
      status: 'ready',
      summary: aiSummary,
    },
  });

  assert.equal(vm.summary.judgmentLabel, '确认执行');
  assert.equal(vm.summary.primaryReason, 'AI 关键理由');
  assert.equal(vm.summary.judgmentWarning, 'AI 判断疑点');
  assert.deepEqual(vm.summary.candidateStructureSummary, {
    label: 'AI D候选',
    currentLeg: 'AI 30分钟回抽段',
    upgradeCondition: 'AI 升级条件',
    invalidation: 'AI 失效条件',
  });
  assert.deepEqual(vm.summary.waitStateSummary, {
    label: 'AI 等待回抽确认',
    currentBlock: 'AI 当前阻塞',
    nextAction: 'AI 下一步',
  });
});

test('summary falls back to backend candidate structure and wait state when AI omits them', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }

  decision.candidate_structure = {
    candidate_type: 'A延续',
    candidate_label: 'A延续候选',
    current_leg: 'a3进行中',
    direction: 'up',
    reason: 'live 段仍按上涨原型处理',
    upgrade_condition: '确认 a4 后继续突破前高',
    invalidation: '跌破 a3 起涨低点',
  };
  decision.wait_state = {
    wait_type: '等待回抽确认',
    wait_label: '等待回抽确认',
    current_block: '30分钟尚未给出回抽企稳',
    next_confirmation_action: '观察30分钟回抽不破 MA55',
    reason: '当前仍缺少确认回抽',
  };

  const aiSummary: AiSummaryCard = {
    headline: 'AI 判断：当前先等30分钟回抽确认',
    action: 'wait',
    bias: 'neutral',
    primary_reason: 'AI 仍建议等待',
    triggers: ['AI 触发'],
    risks: ['AI 风险'],
    guardrail: 'AI 风控',
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: {
      status: 'ready',
      summary: aiSummary,
    },
  });

  assert.equal(vm.summary.judgmentWarning, null);
  assert.deepEqual(vm.summary.candidateStructureSummary, {
    label: 'A延续候选',
    currentLeg: 'a3进行中',
    upgradeCondition: '确认 a4 后继续突破前高',
    invalidation: '跌破 a3 起涨低点',
  });
  assert.deepEqual(vm.summary.waitStateSummary, {
    label: '等待回抽确认',
    currentBlock: '30分钟尚未给出回抽企稳',
    nextAction: '观察30分钟回抽不破 MA55',
  });
});

test('summary prefers backend judgment critical reason and execution plan', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }

  decision.judgment = {
    level: 'candidate_probe',
    label: '候选可试',
    current_best_action: '轻仓试',
    critical_reason: '父级支持但30分钟仍待确认',
    supporting_factors: ['零轴金叉'],
    limiting_factors: ['等待回抽确认'],
  };
  decision.execution_plan = {
    probe_entry: '15分钟止跌后轻仓试',
    confirm_entry: '30分钟回抽确认后加仓',
    invalidation: '跌破15分钟确认低点',
    current_position_action: '轻仓试',
  };
  decision.wait_state = {
    wait_type: '等待回抽确认',
    wait_label: '等待回抽确认',
    current_block: '30分钟尚未给出回抽企稳',
    next_confirmation_action: '观察30分钟回抽不破 MA55',
    reason: '当前仍缺少确认回抽',
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(vm.summary.judgmentLabel, '候选可试');
  assert.equal(vm.summary.primaryReason, '父级支持但30分钟仍待确认');
  assert.match(vm.summary.executionSummary, /30分钟回抽确认后加仓/);
});

test('summary prefers candidate structure label and current leg over legacy structure copy', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }

  decision.candidate_structure = {
    candidate_type: 'A延续',
    candidate_label: 'A延续候选',
    current_leg: 'a3进行中',
    direction: 'up',
    reason: 'live 段仍按上涨原型处理',
    upgrade_condition: '确认 a4 后继续突破前高',
    invalidation: '跌破 a3 起涨低点',
  };
  decision.structure.type = 'A五段式';
  decision.structure.explainability.reason = '旧结构解释';

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(vm.summary.structureSummary, '结构：A延续候选｜a3进行中，live 段仍按上涨原型处理');
  assert.ok(vm.summary.signalTags.some((tag) => tag.label === '结构｜A延续候选'));
});

test('summary and global strategy prefer phase2 trigger and risk badges over legacy execution arrays', () => {
  const result = createResult();
  const dailyDecision = result.periods.daily.trinity_decision;
  if (!dailyDecision) {
    throw new Error('missing daily decision');
  }

  dailyDecision.execution.triggers = ['旧先手点'];
  dailyDecision.execution.risk_flags = ['旧风险'];
  dailyDecision.execution_plan = {
    probe_entry: '15分钟止跌后轻仓试',
    confirm_entry: '30分钟回抽确认后加仓',
    invalidation: '跌破15分钟确认低点',
    current_position_action: '轻仓试',
  };
  dailyDecision.wait_state = {
    wait_type: '等待回抽确认',
    wait_label: '等待回抽确认',
    current_block: '30分钟尚未给出回抽企稳',
    next_confirmation_action: '观察30分钟回抽不破 MA55',
    reason: '当前仍缺少确认回抽',
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
        entry_style: 'pullback',
        triggers: ['30分钟旧触发'],
        invalidation: ['30分钟旧风险'],
        confirmation: ['30分钟旧确认'],
        position_sizing: { max_ratio: 0.2, reason: '旧30分钟执行摘要' },
        risk_flags: ['30分钟旧风险'],
      },
      execution_plan: {
        probe_entry: '30分钟回抽确认后轻仓试',
        confirm_entry: '30分钟放量站稳后加仓',
        invalidation: '30分钟跌破确认低点',
        current_position_action: '轻仓试',
      },
      wait_state: {
        wait_type: '等待回抽确认',
        wait_label: '等待回抽确认',
        current_block: '30分钟仍待回抽企稳',
        next_confirmation_action: '观察30分钟回抽不破 MA55',
        reason: '当前仍缺少确认回抽',
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.deepEqual(vm.summary.triggerLabels, [
    '15分钟止跌后轻仓试',
    '30分钟回抽确认后加仓',
    '观察30分钟回抽不破 MA55',
  ]);
  assert.deepEqual(vm.summary.riskLabels, ['跌破15分钟确认低点']);
  assert.doesNotMatch(vm.summary.triggerLabels.join('｜'), /旧先手点/);
  assert.doesNotMatch(vm.summary.riskLabels.join('｜'), /旧风险/);
  assert.deepEqual(vm.globalStrategy.triggerLabels, [
    '30分钟回抽确认后轻仓试',
    '30分钟放量站稳后加仓',
    '观察30分钟回抽不破 MA55',
  ]);
  assert.deepEqual(vm.globalStrategy.riskLabels, ['30分钟跌破确认低点']);
  assert.doesNotMatch(vm.globalStrategy.triggerLabels.join('｜'), /30分钟旧触发/);
  assert.doesNotMatch(vm.globalStrategy.riskLabels.join('｜'), /30分钟旧风险/);
});

test('trading combinations and execution rule chain prefer phase2 execution copy over legacy arrays', () => {
  const result = createResult();
  const dailyDecision = result.periods.daily.trinity_decision;
  if (!dailyDecision) {
    throw new Error('missing daily decision');
  }

  dailyDecision.execution.triggers = ['日线旧触发'];
  dailyDecision.execution.confirmation = ['日线旧确认'];
  dailyDecision.execution.invalidation = ['日线旧失效'];
  dailyDecision.execution.risk_flags = ['日线旧风险'];
  dailyDecision.execution.position_sizing.reason = '日线旧执行摘要';
  dailyDecision.execution_plan = {
    probe_entry: '日线回抽确认后轻仓试',
    confirm_entry: '日线放量站稳后加仓',
    invalidation: '日线跌破确认低点',
    current_position_action: '轻仓试',
  };
  dailyDecision.wait_state = {
    wait_type: '等待回抽确认',
    wait_label: '等待回抽确认',
    current_block: '日线仍待回抽企稳',
    next_confirmation_action: '观察日线回抽不破 MA55',
    reason: '日线当前仍缺少确认回抽',
  };
  dailyDecision.judgment_criteria = dailyDecision.judgment_criteria.filter(
    (criterion) => criterion.category !== 'execution'
  );

  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'wait',
        action_label: '等待确认',
        bias: 'bullish',
        confidence: 'medium',
        can_trade: false,
        wait_reason: '等待 30 分钟确认触发',
      },
      execution: {
        entry_style: 'pullback_confirm' as never,
        triggers: ['30分钟旧触发'],
        invalidation: ['30分钟旧失效'],
        confirmation: ['30分钟旧确认'],
        position_sizing: { max_ratio: 0.2, reason: '30分钟旧执行摘要' },
        risk_flags: ['30分钟旧风险'],
      },
      execution_plan: {
        probe_entry: '30分钟回抽确认后轻仓试',
        confirm_entry: '30分钟放量站稳后加仓',
        invalidation: '30分钟跌破确认低点',
        current_position_action: '轻仓试',
      },
      wait_state: {
        wait_type: '等待回抽确认',
        wait_label: '等待回抽确认',
        current_block: '30分钟仍待回抽企稳',
        next_confirmation_action: '观察30分钟回抽不破 MA55',
        reason: '30分钟当前仍缺少确认回抽',
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');
  const executionRule = vm.ruleChain.items.find((item) => item.title === '执行计划');

  assert.ok(shortline);
  assert.ok(executionRule);
  assert.equal(shortline.recommendation, '先等30分钟回抽确认后轻仓试');
  assert.equal(shortline.triggerLevel.value, '30分钟：回抽确认后轻仓试');
  assert.match(shortline.triggerLevel.hoverItems[1].value, /30分钟回抽确认后轻仓试/);
  assert.match(shortline.triggerLevel.hoverItems[3].value, /30分钟放量站稳后加仓/);
  assert.match(shortline.suitableAction.hoverItems[1].value, /轻仓试|30分钟当前仍缺少确认回抽/);
  assert.match(shortline.suitableAction.hoverItems[3].value, /30分钟回抽确认后轻仓试/);
  assert.equal(shortline.majorRisk.value, '30分钟跌破确认低点');
  assert.match(executionRule.detail, /日线回抽确认后轻仓试/);
  assert.match(executionRule.detail, /日线跌破确认低点/);
  assert.equal(executionRule.recommendation, '先等日线回抽确认后轻仓试');
  assert.match(executionRule.detailHover.items[4].value, /日线回抽确认后轻仓试/);
  assert.match(executionRule.detailHover.items[4].value, /日线跌破确认低点/);
  assert.doesNotMatch(shortline.recommendation, /30分钟旧触发/);
  assert.doesNotMatch(shortline.majorRisk.value, /30分钟旧风险|30分钟旧失效/);
  assert.doesNotMatch(executionRule.detail, /日线旧触发|日线旧失效/);
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
  assert.equal(shortline.parentConstraint.value, '日线缺失');
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
  assert.doesNotMatch(
    shortline.parentConstraint.value,
    /Wait for daily breakout|English trade qualification|Position sizing pending/
  );
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
  assert.match(shortline.parentConstraint.value, /只允许轻仓等待确认/);
  assert.doesNotMatch(shortline.parentConstraint.value, /暂无额外约束/);
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

test('view model exposes concise summaries and hover payloads for combinations and rule chain', () => {
  const result = createResult();
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'wait',
        action_label: '等待确认',
        bias: 'bullish',
        confidence: 'medium',
        can_trade: false,
        wait_reason: '等待 30 分钟确认触发',
      },
      execution: {
        entry_style: 'pullback_confirm' as never,
        triggers: ['次级别重新站上平台上沿'],
        invalidation: ['30分钟跌回平台下沿'],
        confirmation: ['30分钟放量确认突破有效'],
        position_sizing: { max_ratio: 0.2, reason: '日线仍未完全放行' },
        risk_flags: ['30分钟确认失败会回到等待'],
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');
  const structureRule = vm.ruleChain.items.find((item) => item.title === '结构资格');

  assert.ok(shortline);
  assert.ok(structureRule);
  assert.equal(shortline.judgmentLabel, '严格等待');
  assert.equal(shortline.relationLabel, '日线未放行，30分钟先看确认');
  assert.equal(shortline.summary, '日线还没完全放行，30分钟先看确认');
  assert.equal(shortline.recommendation, '先等30分钟重新站上平台上沿');
  assert.deepEqual(shortline.actionStateTags?.map((tag) => tag.label), [
    '级别｜日线未放行',
    '执行｜30分钟等待触发',
  ]);
  assert.deepEqual(shortline.judgmentBasisTags?.map((tag) => tag.label), [
    '时空｜中偏强',
    '突破/跌破｜有效突破',
    '量能｜突破量弱',
    '均线｜MA55支撑',
    '结构｜A五段式',
  ]);
  assert.deepEqual(shortline.parentConstraintTags?.map((tag) => tag.label), [
    '时空｜中偏强',
    '突破/跌破｜有效突破',
    '量能｜突破量弱',
    '均线｜MA55支撑',
    '结构｜A五段式',
  ]);
  assert.ok(
    shortline.actionStateTags?.every((tag) =>
      tag.hover.items.every((item) => !item.value.includes('次级别'))
    )
  );
  assert.equal(
    shortline.actionStateTags
      ?.find((tag) => tag.category === '执行')
      ?.hover.items.find((item) => item.label === '等待条件')?.value,
    '30分钟重新站上平台上沿'
  );
  assert.ok(shortline.triggerLevel.hoverItems.every((item) => !item.value.includes('次级别')));
  assert.deepEqual(shortline.signalTags.map((tag) => tag.label), [
    '时空｜中偏强',
    '突破/跌破｜有效突破',
    '量能｜突破量弱',
    '均线｜MA55支撑',
    '结构｜A五段式',
    '级别｜子级逆势',
    '执行｜回踩执行',
    '执行｜等待触发',
  ]);
  assert.equal(shortline.parentConstraint.hoverTitle, '父级约束说明');
  assert.equal(shortline.parentConstraint.hoverItems[0].label, '这句话是什么意思');
  assert.match(shortline.parentConstraint.hoverItems[1].value, /等待 C 结构边界确认|结构边界未触发/);

  assert.equal(structureRule.summary, 'A原型成立，但仍需等待更明确确认');
  assert.equal(structureRule.recommendation, '先按结构边界和确认节奏继续跟踪');
  assert.ok(structureRule.signalTags.some((tag) => tag.label.startsWith('结构｜')));
  assert.equal(structureRule.detailHover.title, '结构资格说明');
  assert.equal(structureRule.detailHover.items[2].label, '当前限制');
});

test('trading bus uses executable level nesting conditions before legacy trigger text', () => {
  const result = createResult();
  const dailyDecision = result.periods.daily.trinity_decision;
  if (!dailyDecision) {
    throw new Error('missing daily decision');
  }
  dailyDecision.conclusion = {
    ...dailyDecision.conclusion,
    action: 'hold',
    action_label: '持有观察',
    can_trade: true,
  };
  dailyDecision.trade_qualification = {
    ...dailyDecision.trade_qualification,
    trade_mode: 'standard_node_trade',
    position_permission: 'half_position',
  };
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
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
        wait_conditions: ['30分钟延伸C等待平台上沿突破', '30分钟回踩平台边界不破'],
        confirm_conditions: ['30分钟放量突破平台上沿'],
        invalidation_conditions: ['30分钟跌破中枢下沿失效'],
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '日线中偏强，30分钟延伸C只允许边界轻仓试探',
        },
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.recommendation, '先等30分钟延伸C等待平台上沿突破');
  assert.match(shortline.triggerLevel.value, /30分钟：延伸C等待平台上沿突破/);
  assert.ok(
    shortline.actionStateTags.some((tag) => tag.label === '级别｜30分钟边界试探')
  );
  assert.ok(
    shortline.actionStateTags.some((tag) => tag.label === '执行｜30分钟等待边界确认')
  );
  assert.ok(shortline.triggerLevel.hoverItems.every((item) => !item.value.includes('boundary_probe')));
  assert.ok(shortline.triggerLevel.hoverItems.every((item) => !item.value.includes('extended')));
  assert.equal(shortline.majorRisk.value, '30分钟跌破中枢下沿失效');
  assert.match(shortline.suitableAction.hoverItems[3].value, /30分钟放量突破平台上沿/);
});

test('trading bus prefers node semantic reason and concrete B node conditions from backend contract', () => {
  const result = createResult();
  const dailyDecision = result.periods.daily.trinity_decision;
  if (!dailyDecision) {
    throw new Error('missing daily decision');
  }
  dailyDecision.conclusion = {
    ...dailyDecision.conclusion,
    action: 'hold',
    action_label: '持有观察',
    can_trade: true,
  };
  dailyDecision.trade_qualification = {
    ...dailyDecision.trade_qualification,
    trade_mode: 'standard_node_trade',
    position_permission: 'half_position',
  };
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'wait',
        action_label: '等待',
        bias: 'neutral',
        confidence: 'medium',
        can_trade: false,
        wait_reason: '旧的泛化等待文案',
      },
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
        wait_conditions: ['等待30分钟B类b3回踩确认', '30分钟平台边界回踩不破'],
        confirm_conditions: ['30分钟回踩平台上沿不破', '30分钟回踩后重新转强并放量确认'],
        invalidation_conditions: ['30分钟回踩跌回平台下沿失效'],
        permission: {
          allow_position_increase: true,
          allow_t_trade: true,
          allow_only_light_probe: false,
          reason: '日线强支持30分钟B类b3回踩确认，但仍需按节点确认节奏执行',
        },
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.recommendation, '先等待30分钟B类b3回踩确认');
  assert.equal(shortline.triggerLevel.value, '30分钟：B类b3回踩确认');
  assert.equal(
    shortline.triggerLevel.hoverItems.find((item) => item.label === '为什么这么判断')?.value,
    '30分钟当前处于B类b3回踩确认阶段，等待回踩后重新转强'
  );
  assert.equal(shortline.majorRisk.value, '30分钟回踩跌回平台下沿失效');
  assert.equal(
    shortline.suitableAction.hoverItems.find((item) => item.label === '下一步条件')?.value,
    '30分钟回踩平台上沿不破、30分钟回踩后重新转强并放量确认、重新站上平台上沿'
  );
  assert.equal(
    shortline.actionStateTags.find((tag) => tag.category === '级别')?.hover.items.find((item) => item.label === '节点语义')
      ?.value,
    'B类b3回踩确认'
  );
});

test('combination level hover hides node semantic row when backend did not provide it', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.ok(
    shortline.actionStateTags
      .find((tag) => tag.category === '级别')
      ?.hover.items.every((item) => item.label !== '节点语义')
  );
});

test('trading combinations prefer backend boundary conditions and boundary semantic reason', () => {
  const result = createResult();
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'wait',
        action_label: '等待',
        bias: 'neutral',
        confidence: 'medium',
        can_trade: false,
        wait_reason: '旧的泛化等待文案',
      },
      level_nesting: {
        parent_level: 'daily',
        child_level: 'hour30',
        parent_spacetime_status: '强',
        child_structure_type: '箱体震荡',
        child_structure_family: 'C',
        child_structure_qualification: 'range',
        child_structure_direction: 'neutral',
        structure_match: true,
        parent_bias: 'bullish',
        child_signal: 'wait',
        resonance: 'boundary_probe',
        operation_bias: 'long',
        operation_frame: 'range_boundary',
        execution_strength: 'light_probe',
        boundary_semantic: {
          mode: 'range_box',
          label: '箱体边界等待突破',
          upper: 11.2,
          lower: 10.4,
          mid: 10.8,
          breakout_trigger: 11.2,
          breakdown_trigger: 10.4,
          stop_loss: 10.4,
          reason: '30分钟当前处于箱体震荡，必须等真实边界价位被触发后再行动',
        },
        wait_conditions: ['等待30分钟突破箱体上沿11.20或跌破箱体下沿10.40'],
        confirm_conditions: ['30分钟突破11.20后回踩不破再确认'],
        invalidation_conditions: ['30分钟重新回到10.40-11.20区间内，按假突破/假跌破处理'],
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '日线偏多，但30分钟箱体只允许按边界轻仓试探',
        },
      },
      execution: {
        entry_style: 'boundary',
        triggers: ['30分钟旧边界等待'],
        invalidation: ['30分钟旧边界风险'],
        confirmation: ['30分钟旧边界确认'],
        position_sizing: { max_ratio: 0.2, reason: '旧的边界执行摘要' },
        risk_flags: ['30分钟旧边界风险'],
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.recommendation, '先等待30分钟突破箱体上沿11.20或跌破箱体下沿10.40');
  assert.equal(shortline.triggerLevel.value, '30分钟：突破箱体上沿11.20或跌破箱体下沿10.40');
  assert.equal(
    shortline.triggerLevel.hoverItems.find((item) => item.label === '为什么这么判断')?.value,
    '30分钟当前处于箱体震荡，必须等真实边界价位被触发后再行动'
  );
  assert.equal(
    shortline.triggerLevel.hoverItems.find((item) => item.label === '下一步条件')?.value,
    '30分钟突破11.20后回踩不破再确认'
  );
  assert.equal(shortline.majorRisk.value, '30分钟重新回到10.40-11.20区间内，按假突破/假跌破处理');
  assert.equal(
    shortline.actionStateTags.find((tag) => tag.category === '级别')?.hover.items.find((item) => item.label === '边界语义')
      ?.value,
    '箱体边界等待突破'
  );
  assert.equal(
    shortline.actionStateTags.find((tag) => tag.category === '级别')?.hover.items.find((item) => item.label === '边界原因')
      ?.value,
    '30分钟当前处于箱体震荡，必须等真实边界价位被触发后再行动'
  );
  assert.equal(
    shortline.actionStateTags.find((tag) => tag.category === '级别')?.hover.items.find((item) => item.label === '边界价位')
      ?.value,
    '上沿 11.20 / 下沿 10.40 / 中轴 10.80'
  );
  assert.doesNotMatch(shortline.recommendation, /30分钟旧边界等待/);
  assert.doesNotMatch(shortline.majorRisk.value, /30分钟旧边界风险/);
});

test('trading combinations prefer backend final Chinese modifier conditions over legacy execution arrays', () => {
  const result = createResult();
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'wait',
        action_label: '等待',
        bias: 'neutral',
        confidence: 'medium',
        can_trade: false,
        wait_reason: '旧的等待文案',
      },
      moving_average: {
        ma55_role: 'resistance',
        ma233_role: 'neutral',
        price_position: { above_ma55: false, above_ma233: false },
        breakthrough_state: 'breakout_pending',
        ma_gate: { allow_long: false, allow_short: false, reason: '站上MA55前仍需确认' },
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
          reason: '突破量弱，等待二次放量确认',
        },
      },
      divergence_weight: {
        status: 'suppressive',
        label: '顶背离压制',
        reason: '顶背离仍在压制，先不追高',
        impact_on_judgment: 'suppress',
      },
      level_nesting: {
        parent_level: 'daily',
        child_level: 'hour30',
        parent_spacetime_status: '中偏强',
        child_structure_type: 'C单平台式',
        child_structure_family: 'C',
        child_structure_qualification: 'standard',
        child_structure_direction: 'up',
        structure_match: true,
        parent_bias: 'bullish',
        child_signal: 'wait',
        resonance: 'boundary_probe',
        operation_bias: 'long',
        operation_frame: 'platform_boundary',
        execution_strength: 'light_probe',
        wait_conditions: ['等待30分钟突破平台上沿11.20', '顶背离压制时不追高'],
        confirm_conditions: ['突破量弱，等待二次放量确认', '站上30分钟MA55后回踩不破再确认'],
        invalidation_conditions: ['跌破30分钟MA55且反抽不过失效'],
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '日线偏多，但30分钟仍需先等修饰层确认补齐',
        },
      },
      execution: {
        entry_style: 'pullback',
        triggers: ['旧触发数组'],
        invalidation: ['旧失效数组'],
        confirmation: ['旧确认数组'],
        position_sizing: { max_ratio: 0.2, reason: '旧执行摘要' },
        risk_flags: ['旧风险数组'],
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.recommendation, '先等待30分钟突破平台上沿11.20');
  assert.equal(shortline.triggerLevel.value, '30分钟：突破平台上沿11.20');
  assert.equal(
    shortline.triggerLevel.hoverItems.find((item) => item.label === '下一步条件')?.value,
    '30分钟突破量弱，等待二次放量确认'
  );
  const suitableActionNextStep =
    shortline.suitableAction.hoverItems.find((item) => item.label === '下一步条件')?.value ?? '';
  assert.match(suitableActionNextStep, /30分钟突破量弱，等待二次放量确认/);
  assert.match(suitableActionNextStep, /30分钟站上30分钟MA55后回踩不破再确认/);
  assert.equal(shortline.majorRisk.value, '30分钟跌破30分钟MA55且反抽不过失效');
  assert.ok(shortline.signalTags.some((tag) => tag.label === '背离｜顶背离压制'));
  assert.ok(shortline.signalTags.some((tag) => tag.label === '量能｜突破量弱'));
  assert.ok(shortline.signalTags.some((tag) => tag.label === '均线｜MA55压制'));
  assert.ok(shortline.judgmentBasisTags.some((tag) => tag.label === '背离｜顶背离压制'));
  assert.ok(shortline.judgmentBasisTags.some((tag) => tag.label === '量能｜突破量弱'));
  assert.ok(shortline.judgmentBasisTags.some((tag) => tag.label === '均线｜MA55压制'));
  assert.ok(
    [
      shortline.recommendation,
      shortline.triggerLevel.value,
      shortline.majorRisk.value,
      ...shortline.signalTags.map((tag) => tag.label),
      ...shortline.judgmentBasisTags.map((tag) => tag.label),
      ...shortline.triggerLevel.hoverItems.map((item) => item.value),
      ...shortline.suitableAction.hoverItems.map((item) => item.value),
    ].every(
      (value) =>
        !value.includes('supports_breakout') &&
        !value.includes('hard_block') &&
        !value.includes('suppressive')
    )
  );
});

test('view model normalizes candidate structure english fragments into Chinese display', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }

  decision.candidate_structure = {
    candidate_type: 'complex_candidate',
    candidate_label: 'complex候选',
    current_leg: 'p16→live 下行形成中',
    direction: 'down',
    upgrade_condition: '有效跌破后延续下行',
    invalidation: '重新站回平台上沿',
    reason: '结构复杂，需人工确认方向',
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(
    vm.summary.structureSummary,
    '结构：复杂结构候选｜p16→进行中 下行形成中，结构复杂，需人工确认方向'
  );
  assert.ok(vm.summary.signalTags.some((tag) => tag.label === '结构｜复杂结构候选'));
});

test('failed structure rule uses blocking summary instead of observable wording', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }

  decision.structure.explainability = {
    status: 'failed',
    reason: '关键结构条件不成立',
    evidence: ['关键节点缺失'],
  };
  decision.judgment_criteria = decision.judgment_criteria.filter((criterion) => criterion.category !== 'structure');

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const structureRule = vm.ruleChain.items.find((item) => item.title === '结构资格');
  assert.ok(structureRule);
  assert.equal(structureRule.status, 'failed');
  assert.doesNotMatch(structureRule.summary, /可观察/);
  assert.match(structureRule.summary, /不成立|不放行|不能按结构交易/);
});

test('non-structure rule hover basis and signal tags stay category-safe', () => {
  const result = createResult();
  const decision = result.periods.daily.trinity_decision;
  if (!decision) {
    throw new Error('missing daily decision');
  }
  if (!decision.level_nesting) {
    throw new Error('missing level nesting');
  }

  decision.structure.explainability.evidence = ['结构证据：五段式成立'];
  decision.level_nesting.permission.reason = '父级未放行，子级只能等待';
  decision.execution.position_sizing.reason = '执行层先控制仓位';
  decision.judgment_criteria = decision.judgment_criteria.filter(
    (criterion) => criterion.category !== 'level_nesting' && criterion.category !== 'execution'
  );

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const levelRule = vm.ruleChain.items.find((item) => item.title === '级别权限');
  const executionRule = vm.ruleChain.items.find((item) => item.title === '执行计划');

  assert.ok(levelRule);
  assert.ok(executionRule);
  assert.deepEqual(levelRule.signalTags.map((tag) => tag.label), ['级别｜子级逆势']);
  assert.deepEqual(executionRule.signalTags.map((tag) => tag.label), ['执行｜回踩执行']);
  assert.doesNotMatch(levelRule.detailHover.items[4].value, /结构证据：五段式成立/);
  assert.doesNotMatch(executionRule.detailHover.items[4].value, /结构证据：五段式成立/);
  assert.match(levelRule.detailHover.items[4].value, /父级未放行|级别权限|父子级别/);
  assert.match(executionRule.detailHover.items[4].value, /执行层先控制仓位|触发|失效/);
});

test('trading combination exposes parent daily and child 30-minute topology previews', () => {
  const result = createResult();
  result.periods.daily.structure = {
    ...result.periods.daily.structure,
    structure_type: '日线主升结构',
    description: '日线主升段已形成，当前等待上沿确认',
    structure_details: {
      ...result.periods.daily.structure?.structure_details,
      render_payload: createTopologyRenderPayload(),
      explainability: createTopologyExplainability({
        current_segment: {
          from_point_id: 'd4',
          to_point_id: 'd5',
          label: '日线主升阶段',
        },
        next_segment_preview: {
          from_point_id: 'd5',
          to_point_id: 'd6',
          label: '日线放量突破确认',
          status: 'completion',
        },
      }),
    },
  };
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({ level: 'hour30' }),
    structure: {
      structure_type: '30分钟平台整理',
      description: '30分钟处于平台整理尾段，等待方向确认',
      structure_details: {
        render_payload: createTopologyRenderPayload(),
        explainability: createTopologyExplainability({
          structure_family: 'C',
          current_segment: {
            from_point_id: 'm4',
            to_point_id: 'm5',
            label: '30分钟平台整理阶段',
          },
          next_segment_preview: {
            from_point_id: 'm5',
            to_point_id: 'm6',
            label: '30分钟突破平台上沿确认',
            status: 'completion',
          },
        }),
      },
    },
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.parentTopologyPreview?.mode, 'annotated');
  assert.deepEqual(shortline.parentTopologyPreview?.summaryRows, [
    { label: '当前结构', value: '日线主升结构' },
    { label: '当前阶段', value: '日线主升阶段' },
    { label: '下一确认', value: '日线放量突破确认' },
  ]);
  assert.equal(shortline.childTopologyPreview?.mode, 'annotated');
  assert.deepEqual(shortline.childTopologyPreview?.summaryRows, [
    { label: '当前结构', value: '30分钟平台整理' },
    { label: '当前阶段', value: '30分钟平台整理阶段' },
    { label: '下一确认', value: '30分钟突破平台上沿确认' },
  ]);
});

test('trading combination topology preview falls back to raw lines when explainability is missing', () => {
  const result = createResult();
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({ level: 'hour30' }),
    structure: {
      structure_type: '30分钟箱体震荡',
      description: '原始描述：箱体仍在震荡，先等边界',
      structure_details: {
        render_payload: createTopologyRenderPayload(),
        explainability: null,
      },
    },
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.childTopologyPreview?.mode, 'raw_lines');
  assert.deepEqual(shortline.childTopologyPreview?.summaryRows, [
    { label: '当前结构', value: '30分钟箱体震荡' },
    { label: '原始描述', value: '原始描述：箱体仍在震荡，先等边界' },
    { label: '数据状态', value: '已生成 render_payload，缺少 explainability' },
  ]);
});

test('trading combination topology preview falls back to unavailable when render payload is missing', () => {
  const result = createResult();
  result.periods.daily.structure = {
    ...result.periods.daily.structure,
    structure_type: '日线观察结构',
    description: '日线结构识别完成，但没有拓扑渲染数据',
    structure_details: {
      ...result.periods.daily.structure?.structure_details,
      render_payload: null,
      explainability: null,
    },
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.parentTopologyPreview?.mode, 'unavailable');
  assert.deepEqual(shortline.parentTopologyPreview?.summaryRows, [
    { label: '当前结构', value: '日线观察结构' },
    { label: '原始描述', value: '日线结构识别完成，但没有拓扑渲染数据' },
    { label: '数据状态', value: '缺少 render_payload' },
  ]);
});
