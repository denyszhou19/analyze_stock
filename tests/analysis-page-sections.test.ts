import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';
import type {
  AnalysisPageRuleChainItem,
  AnalysisPageViewModel,
} from '../src/lib/trinity-analysis-page-view-model.ts';
import type {
  AnalysisResultData,
  PeriodAnalysisData,
  TrinityDecision,
} from '../src/lib/stock-structure-types.ts';
import type { DataIntegritySnapshot } from '../src/lib/stock-data-integrity.ts';

type TradingCycleBusModule = typeof import('../src/components/stock/TradingCycleBus.tsx');
type TrinityRuleChainModule = typeof import('../src/components/stock/TrinityRuleChain.tsx');
type AnalysisSummaryPanelModule = typeof import('../src/components/stock/AnalysisSummaryPanel.tsx');
type AnalysisPeriodDetailsModule = typeof import('../src/components/stock/AnalysisPeriodDetails.tsx');
type AnalysisPageViewModelModule = typeof import('../src/lib/trinity-analysis-page-view-model.ts');

const periodDetailsSource = await fs.readFile('src/components/stock/AnalysisPeriodDetails.tsx', 'utf8');
const { buildAnalysisPageViewModel } = await import(
  new URL('../src/lib/trinity-analysis-page-view-model.ts', import.meta.url).href
) as AnalysisPageViewModelModule;

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
    judgment_criteria: [],
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

function buildViewModel(result: AnalysisResultData): AnalysisPageViewModel {
  return buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
}

function createExplainableField(label: string, value: string) {
  return {
    label,
    value,
    hoverTitle: `${label}说明`,
    hoverItems: [
      { label: '这句话是什么意思', value: `${label}的补充说明` },
      { label: '为什么这么判断', value: value },
    ],
  };
}

function createSignalTag(label: string, tone: 'bullish' | 'bearish' | 'warning' | 'neutral') {
  const [category = '结构', result = label] = label.split('｜');
  return {
    key: 'structure' as const,
    category: category as AnalysisPageRuleChainItem['signalTags'][number]['category'],
    result,
    label,
    tone,
    hover: {
      title: `${label}说明`,
      items: [
        { label: '这句话是什么意思', value: `${label}的补充说明` },
        { label: '为什么这么判断', value: `${label}对应的判定依据` },
      ],
    },
  };
}

function createTopologyPreview(
  levelLabel: string,
  mode: 'annotated' | 'raw_lines' | 'unavailable',
  summaryRows: Array<{ label: string; value: string }>
) {
  return {
    level: 'daily' as const,
    levelLabel,
    mode,
    summaryRows,
  };
}

function createTopologyRenderPayload() {
  return {
    version: 1,
    viewport: {
      width: 320,
      height: 160,
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
      draw_width: 300,
      draw_height: 120,
      date_label_y: 148,
      label_box: {
        width: 40,
        height: 16,
        radius: 4,
      },
    },
    price_range: {
      min: 10,
      max: 15,
      range: 5,
    },
    points: [
      {
        point_id: 'a1',
        sequence: 0,
        type: 'bottom',
        role: 'anchor',
        price: 10.2,
        price_label: '10.2',
        date: '2026-03-01',
        date_label: '03-01',
        x: 40,
        y: 120,
        label_x: 40,
        label_y: 132,
        label_side: 'bottom',
        label_box_width: 40,
        label_box_height: 16,
        marker_radius: 3,
        marker_fill: '#fff',
        marker_stroke: '#333',
        marker_stroke_width: 1,
        show_date_label: true,
        date_label_y: 148,
        is_current: false,
      },
      {
        point_id: 'a2',
        sequence: 1,
        type: 'top',
        role: 'anchor',
        price: 14.6,
        price_label: '14.6',
        date: '2026-03-05',
        date_label: '03-05',
        x: 120,
        y: 60,
        label_x: 120,
        label_y: 48,
        label_side: 'top',
        label_box_width: 40,
        label_box_height: 16,
        marker_radius: 3,
        marker_fill: '#fff',
        marker_stroke: '#333',
        marker_stroke_width: 1,
        show_date_label: true,
        date_label_y: 148,
        is_current: false,
      },
    ],
    segments: [
      {
        segment_id: 'a1-a2',
        sequence: 0,
        from_point: 0,
        to_point: 1,
        x1: 40,
        y1: 120,
        x2: 120,
        y2: 60,
        direction: 'up',
        length: 1,
        is_current: false,
        stroke: '#64748b',
        stroke_width: 2,
        stroke_dasharray: null,
      },
    ],
    point_count: 2,
    segment_count: 1,
  };
}

function createTopologyExplainability() {
  return {
    structure_family: 'A' as const,
    standard_qualification: 'standard' as const,
    structure_start_point_id: 'a1',
    current_point_id: 'a2',
    live_point_id: null,
    current_segment: {
      from_point_id: 'a1',
      to_point_id: 'a2',
      label: 'a1→a2',
    },
    next_segment_preview: {
      from_point_id: 'a2',
      to_point_id: 'a3',
      label: 'a2→a3',
      status: 'projected' as const,
    },
    point_labels: [
      { point_id: 'a1', label: 'A1', role: 'start' as const },
      { point_id: 'a2', label: 'A2', role: 'last_confirmed' as const },
    ],
    segment_labels: [
      {
        segment_id: 'a1-a2',
        from_point_id: 'a1',
        to_point_id: 'a2',
        label: 'a1→a2',
        role: 'current' as const,
      },
    ],
    display_reason: '结构继续推进',
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTooltipBlock(html: string, title: string, nextTitles: string[]) {
  const start = html.indexOf(title);
  assert.notEqual(start, -1, `missing tooltip title: ${title}`);

  let end = html.length;
  for (const nextTitle of nextTitles) {
    const nextIndex = html.indexOf(nextTitle, start + title.length);
    if (nextIndex !== -1 && nextIndex < end) {
      end = nextIndex;
    }
  }

  return html.slice(start, end);
}

function createRuleItem(
  overrides: Partial<{
    title: string;
    status: 'passed' | 'failed' | 'warning' | 'info';
    displayStatusLabel: string;
    displayStatusIcon: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    directionLabel: string;
    detail: string;
    reason: string;
    summary: string;
    recommendation: string;
    signalTags: AnalysisPageRuleChainItem['signalTags'];
    detailHover: AnalysisPageRuleChainItem['detailHover'];
    statusExplanation: {
      tradeMeaning: string;
      ruleState: '已满足' | '待确认' | '有约束' | '不成立';
      directionLabel: '偏多' | '偏空' | '中性';
      reason: string;
    };
  }> = {}
) {
  return {
    title: '结构资格',
    status: 'passed' as const,
    displayStatusLabel: '可执行',
    displayStatusIcon: '✓',
    direction: 'bullish' as const,
    directionLabel: '偏多',
    detail: '周线方向允许向下钻取。',
    reason: '父级方向一致',
    summary: '结构结论摘要',
    recommendation: '继续按规则跟踪',
    signalTags: [],
    detailHover: {
      title: `${overrides.title ?? '结构资格'}说明`,
      items: [
        { label: '这句话是什么意思', value: '补充说明' },
        { label: '为什么这么判断', value: overrides.detail ?? '周线方向允许向下钻取。' },
        { label: '当前限制', value: overrides.reason ?? '父级方向一致' },
        { label: '下一步条件', value: '等待下一步信号' },
        { label: '判定依据', value: '当前类别专属依据' },
      ],
    },
    statusExplanation: {
      tradeMeaning: '这条规则已满足，可纳入当前执行判断',
      ruleState: '已满足' as const,
      directionLabel: '偏多' as const,
      reason: '父级方向一致',
    },
    ...overrides,
  };
}

test('TradingCycleBus renders three trading combinations with direction and trigger level', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'midline',
          label: '中线主策略组合｜周线 → 日线',
          levels: ['weekly', 'daily'],
          direction: 'bullish',
          directionLabel: '偏多',
          actionLabel: '观察中',
          judgmentLabel: '严格等待',
          relationLabel: '父级支持，子级顺父级',
          relationHint: '周线看背景，日线看执行',
          summary: '周线偏多，日线等待确认',
          recommendation: '先等日线确认',
          signalTags: [
            createSignalTag('结构｜C单平台式', 'neutral'),
            createSignalTag('执行｜等待触发', 'warning'),
          ],
          actionStateTags: [],
          judgmentBasisTags: [],
          parentConstraintTags: [],
          parentSignalTags: [],
          parentConstraint: createExplainableField('父级约束', '周线：大方向偏多'),
          triggerLevel: createExplainableField('触发级别', '日线：等待确认'),
          triggerLevelLabel: '日线',
          suitableAction: createExplainableField('适合动作', '等待日线确认'),
          majorRisk: createExplainableField('主要风险', '日线仍未突破平台上沿'),
          explanation: '周线定约束，日线给触发；已有方向或预案，但还差确认，不急着动作',
        },
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          judgmentLabel: '候选可试',
          relationLabel: '父级强冲突，子级逆父级',
          relationHint: '日线看背景，30分钟看执行',
          summary: '日线还没完全放行，30分钟先看确认',
          recommendation: '先等30分钟放量突破平台上沿',
          signalTags: [
            createSignalTag('时空｜中偏弱', 'warning'),
            createSignalTag('级别｜子级逆势', 'warning'),
          ],
          actionStateTags: [],
          judgmentBasisTags: [],
          parentConstraintTags: [],
          parentSignalTags: [],
          parentConstraint: {
            label: '父级约束',
            value: '日线：仍未完全放行',
            hoverTitle: '父级约束说明',
            hoverItems: [
              { label: '这句话是什么意思', value: '上一级还没有完全放开当前执行权限。' },
              { label: '为什么这么判断', value: '日线结构和触发条件都还需要进一步确认。' },
            ],
          },
          triggerLevel: createExplainableField('触发级别', '30分钟：放量突破平台上沿'),
          triggerLevelLabel: '30分钟',
          suitableAction: createExplainableField('适合动作', '等待30分钟确认后再决定是否轻仓试探'),
          majorRisk: createExplainableField('主要风险', '30分钟冲高但量能不足会再次回到等待'),
          explanation: '日线定约束，30分钟给触发；存在约束，不能直接放大动作',
        },
        {
          key: 'intraday_t',
          label: '超短线 / T 组合｜60分钟 → 15分钟',
          levels: ['hour60', 'hour15'],
          direction: 'bearish',
          directionLabel: '偏空',
          actionLabel: '暂不做',
          judgmentLabel: '严格等待',
          relationLabel: '父级未明，子级先看确认',
          relationHint: '60分钟看背景，15分钟看执行',
          summary: '60分钟偏弱，15分钟不单独放行',
          recommendation: '先继续等待',
          signalTags: [createSignalTag('执行｜空仓等待', 'bearish')],
          actionStateTags: [],
          judgmentBasisTags: [],
          parentConstraintTags: [],
          parentSignalTags: [],
          parentConstraint: createExplainableField('父级约束', '60分钟：偏弱'),
          triggerLevel: createExplainableField('触发级别', '15分钟：等待确认'),
          triggerLevelLabel: '15分钟',
          suitableAction: createExplainableField('适合动作', '只观察'),
          majorRisk: createExplainableField('主要风险', '15分钟反弹不能推翻上级'),
          explanation: '60分钟定约束，15分钟给触发；当前不支持按这条规则交易',
        },
      ],
    })
  );

  assert.match(html, /交易周期总线/);
  assert.match(html, /中线主策略组合｜周线 → 日线/);
  assert.match(html, /短线执行组合｜日线 → 30分钟/);
  assert.match(html, /超短线 \/ T 组合｜60分钟 → 15分钟/);
  assert.match(html, /触发级别/);
  assert.match(html, /严格等待/);
  assert.match(html, /候选可试/);
  assert.match(html, /父级支持，子级顺父级/);
  assert.match(html, /父级强冲突，子级逆父级/);
  assert.match(html, /适合动作/);
  assert.match(html, /主要风险/);
  assert.match(html, /周线：大方向偏多/);
  assert.match(html, /日线还没完全放行，30分钟先看确认/);
  assert.match(html, /先等30分钟放量突破平台上沿/);
  assert.match(html, /时空｜中偏弱/);
  assert.match(html, /结构｜C单平台式/);
  assert.match(html, /级别｜子级逆势/);
  assert.match(html, /执行｜空仓等待/);
  assert.match(html, /父级约束说明/);
  assert.match(html, /这句话是什么意思/);
  assert.doesNotMatch(html, /日线定约束，30分钟给触发/);
  assert.doesNotMatch(html, /维度一/);
  assert.doesNotMatch(html, /状态：观察中/);
});

test('TradingCycleBus groups signal tags into three layered sections', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          judgmentLabel: '候选可试',
          relationLabel: '父级强冲突，子级逆父级',
          relationHint: '日线看背景，30分钟看执行',
          summary: '日线还没完全放行，30分钟先看确认',
          recommendation: '先等30分钟放量突破平台上沿',
          signalTags: [
            createSignalTag('时空｜中偏弱', 'warning'),
            createSignalTag('背离｜顶背离压制', 'bearish'),
            createSignalTag('量能｜突破量弱', 'warning'),
            createSignalTag('均线｜MA55压制', 'bearish'),
            createSignalTag('结构｜复杂结构候选', 'neutral'),
            createSignalTag('级别｜子级逆势', 'warning'),
            createSignalTag('执行｜等待触发', 'neutral'),
            createSignalTag('突破/跌破｜有效跌破', 'bearish'),
          ],
          actionStateTags: [
            createSignalTag('级别｜30分钟边界试探', 'warning'),
            createSignalTag('执行｜30分钟等待边界确认', 'neutral'),
          ],
          judgmentBasisTags: [
            createSignalTag('时空｜中偏强', 'bullish'),
            createSignalTag('结构｜复杂结构候选', 'neutral'),
            createSignalTag('均线｜MA55压制', 'bearish'),
            createSignalTag('量能｜突破量弱', 'warning'),
            createSignalTag('突破/跌破｜有效跌破', 'bearish'),
            createSignalTag('背离｜顶背离压制', 'bearish'),
          ],
          parentSignalTags: [
            createSignalTag('时空｜中偏弱', 'warning'),
            createSignalTag('结构｜C候选', 'neutral'),
            createSignalTag('均线｜MA55支撑', 'bullish'),
            createSignalTag('量能｜突破量弱', 'warning'),
            createSignalTag('级别｜父级不明', 'neutral'),
            createSignalTag('执行｜等待触发', 'neutral'),
          ],
          parentConstraintTags: [
            createSignalTag('时空｜中偏弱', 'warning'),
            createSignalTag('结构｜C候选', 'neutral'),
            createSignalTag('均线｜MA55支撑', 'bullish'),
            createSignalTag('量能｜突破量弱', 'warning'),
          ],
          parentConstraint: createExplainableField('父级约束', '日线：仍未完全放行'),
          triggerLevel: createExplainableField('触发级别', '30分钟：放量突破平台上沿'),
          triggerLevelLabel: '30分钟',
          suitableAction: createExplainableField('适合动作', '等待30分钟确认后再决定是否轻仓试探'),
          majorRisk: createExplainableField('主要风险', '30分钟冲高但量能不足会再次回到等待'),
          explanation: '日线定约束，30分钟给触发；存在约束，不能直接放大动作',
        },
      ],
    })
  );

  assert.match(html, /当前动作状态/);
  assert.match(html, /子级综合判断依据/);
  assert.doesNotMatch(html, /父子级明细/);
  assert.doesNotMatch(html, /父级判断/);
  assert.doesNotMatch(html, /子级判断/);
  assert.match(html, /子级综合判断依据说明/);
  assert.match(html, /默认取子级主执行层标签/);
  assert.match(html, /data-signal-layer="action-state"/);
  assert.match(html, /data-signal-layer="judgment-basis"/);
  assert.doesNotMatch(html, /data-signal-layer="parent-child-detail"/);
  assert.match(html, /data-signal-layer="parent-constraint"/);
  assert.match(html, /级别｜30分钟边界试探/);
  assert.match(html, /执行｜30分钟等待边界确认/);
  assert.doesNotMatch(html, /级别｜父级不明/);
  assert.doesNotMatch(html, /次级别结构继续共振/);
  assert.doesNotMatch(html, /boundary_probe/);
  assert.doesNotMatch(html, /extended/);
  assert.match(html, /当前动作状态[\s\S]*级别｜30分钟边界试探[\s\S]*执行｜30分钟等待边界确认/);
  assert.match(
    html,
    /子级综合判断依据[\s\S]*时空｜中偏强[\s\S]*结构｜复杂结构候选[\s\S]*均线｜MA55压制/
  );
  assert.match(html, /父级约束[\s\S]*日线：仍未完全放行[\s\S]*时空｜中偏弱[\s\S]*结构｜C候选[\s\S]*均线｜MA55支撑/);
  const parentConstraintHtml = html.slice(html.indexOf('data-signal-layer="parent-constraint"'));
  assert.doesNotMatch(parentConstraintHtml, /级别｜/);
  assert.doesNotMatch(parentConstraintHtml, /执行｜/);
  assert.match(html, /子级综合判断依据[\s\S]*背离｜顶背离压制[\s\S]*父级约束/);
});

test('TradingCycleBus and hover consumers render topology preview summaries from mapped sources', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          parentTopologyPreview: {
            ...createTopologyPreview('日线', 'annotated', [
              { label: '当前结构', value: '日线主升结构' },
              { label: '当前阶段', value: '日线主升阶段' },
              { label: '下一确认', value: '日线放量突破确认' },
            ]),
            renderPayload: createTopologyRenderPayload(),
            explainability: createTopologyExplainability(),
          },
          childTopologyPreview: {
            ...createTopologyPreview('30分钟', 'annotated', [
              { label: '当前结构', value: '30分钟平台整理' },
              { label: '当前阶段', value: '30分钟平台整理阶段' },
              { label: '下一确认', value: '30分钟突破平台上沿确认' },
            ]),
            renderPayload: createTopologyRenderPayload(),
            explainability: createTopologyExplainability(),
          },
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          judgmentLabel: '候选可试',
          relationLabel: '父级强冲突，子级逆父级',
          relationHint: '日线看背景，30分钟看执行',
          summary: '日线还没完全放行，30分钟先看确认',
          recommendation: '先等30分钟放量突破平台上沿',
          signalTags: [],
          actionStateTags: [
            {
              ...createSignalTag('执行｜30分钟等待边界确认', 'neutral'),
              topologyPreviewSource: 'child' as const,
            },
          ],
          judgmentBasisTags: [
            {
              ...createSignalTag('结构｜30分钟平台整理', 'neutral'),
              topologyPreviewSource: 'child' as const,
            },
          ],
          parentConstraintTags: [
            {
              ...createSignalTag('结构｜日线主升结构', 'bullish'),
              topologyPreviewSource: 'parent' as const,
            },
          ],
          parentSignalTags: [],
          parentConstraint: {
            ...createExplainableField('父级约束', '日线：仍未完全放行'),
            topologyPreviewSource: 'parent' as const,
          },
          triggerLevel: {
            ...createExplainableField('触发级别', '30分钟：放量突破平台上沿'),
            topologyPreviewSource: 'child' as const,
          },
          triggerLevelLabel: '30分钟',
          suitableAction: {
            ...createExplainableField('适合动作', '等待30分钟确认后再决定是否轻仓试探'),
            topologyPreviewSource: 'child' as const,
          },
          majorRisk: {
            ...createExplainableField('主要风险', '30分钟冲高但量能不足会再次回到等待'),
            topologyPreviewSource: 'child' as const,
          },
          explanation: '日线定约束，30分钟给触发；存在约束，不能直接放大动作',
        },
      ],
    })
  );

  const parentConstraintBlock = getTooltipBlock(html, '父级约束说明', [
    '结构｜日线主升结构说明',
  ]);
  const parentConstraintTagBlock = getTooltipBlock(html, '结构｜日线主升结构说明', [
    '触发级别说明',
  ]);
  const childStructureTagBlock = getTooltipBlock(html, '结构｜30分钟平台整理说明', [
    '父级约束说明',
  ]);
  const triggerLevelBlock = getTooltipBlock(html, '触发级别说明', ['适合动作说明']);
  const suitableActionBlock = getTooltipBlock(html, '适合动作说明', ['主要风险说明']);
  const majorRiskBlock = getTooltipBlock(html, '主要风险说明', []);

  assert.doesNotMatch(parentConstraintBlock, /结构参考|structure-topology-svg/);
  assert.match(parentConstraintTagBlock, /父级结构参考[\s\S]*当前结构[\s\S]*日线主升结构[\s\S]*当前阶段[\s\S]*日线主升阶段[\s\S]*下一确认[\s\S]*日线放量突破确认/);
  assert.match(childStructureTagBlock, /子级结构参考[\s\S]*当前结构[\s\S]*30分钟平台整理[\s\S]*当前阶段[\s\S]*30分钟平台整理阶段[\s\S]*下一确认[\s\S]*30分钟突破平台上沿确认/);
  assert.match(html, /结构｜日线主升结构<\/span><\/button><div side="left"/);
  assert.match(html, /结构｜30分钟平台整理<\/span><\/button><div side="right"/);
  assert.match(parentConstraintTagBlock, /data-slot="trading-cycle-topology-preview-card"/);
  assert.match(parentConstraintTagBlock, /data-slot="trading-cycle-topology-preview-graph"/);
  assert.match(parentConstraintTagBlock, /class="h-44 w-full"/);
  assert.doesNotMatch(parentConstraintTagBlock, /bg-slate-950\/95/);
  assert.doesNotMatch(parentConstraintTagBlock, /先看父级框架/);
  assert.doesNotMatch(childStructureTagBlock, /先看子级结构/);
  assert.match(childStructureTagBlock, /data-slot="structure-topology-svg"[\s\S]*data-has-explainability="true"/);
  assert.match(childStructureTagBlock, /data-slot="trading-cycle-topology-summary"/);
  assert.doesNotMatch(triggerLevelBlock, /结构参考|structure-topology-svg/);
  assert.doesNotMatch(suitableActionBlock, /结构参考|structure-topology-svg/);
  assert.doesNotMatch(majorRiskBlock, /结构参考|structure-topology-svg/);
  const judgmentBasisInfoBlock = getTooltipBlock(html, '子级综合判断依据说明', ['结构｜30分钟平台整理说明']);
  assert.match(judgmentBasisInfoBlock, /data-disable-text-balance="false"/);
});

test('TooltipContent exposes an explicit disableTextBalance API instead of inferring from class names', async () => {
  const tooltipSource = await fs.readFile('src/components/ui/tooltip.tsx', 'utf8');

  assert.match(tooltipSource, /disableTextBalance\s*=\s*false/);
  assert.match(tooltipSource, /!disableTextBalance && "text-balance"/);
  assert.doesNotMatch(tooltipSource, /className\.includes\("\\[text-wrap:wrap\\]"\)/);
  assert.doesNotMatch(tooltipSource, /className\.includes\('\[text-wrap:wrap\]'\)/);
});

test('TradingCycleBus keeps raw-lines topology preview gated behind structure tags', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          parentTopologyPreview: {
            ...createTopologyPreview('日线', 'annotated', [
              { label: '当前结构', value: '日线主升结构' },
              { label: '当前阶段', value: '日线主升阶段' },
              { label: '下一确认', value: '日线放量突破确认' },
            ]),
            renderPayload: createTopologyRenderPayload(),
            explainability: createTopologyExplainability(),
          },
          childTopologyPreview: {
            ...createTopologyPreview('30分钟', 'raw_lines', [
              { label: '当前结构', value: '30分钟箱体震荡' },
              { label: '原始描述', value: '原始描述：箱体仍在震荡，先等边界' },
              { label: '数据状态', value: '已生成结构图，缺少结构说明' },
            ]),
            renderPayload: createTopologyRenderPayload(),
            explainability: null,
          },
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          judgmentLabel: '候选可试',
          relationLabel: '父级强冲突，子级逆父级',
          relationHint: '日线看背景，30分钟看执行',
          summary: '日线还没完全放行，30分钟先看确认',
          recommendation: '先等30分钟放量突破平台上沿',
          signalTags: [],
          actionStateTags: [
            {
              ...createSignalTag('执行｜30分钟等待边界确认', 'neutral'),
              topologyPreviewSource: 'child' as const,
            },
          ],
          judgmentBasisTags: [],
          parentConstraintTags: [],
          parentSignalTags: [],
          parentConstraint: {
            ...createExplainableField('父级约束', '日线：仍未完全放行'),
            topologyPreviewSource: 'parent' as const,
          },
          triggerLevel: {
            ...createExplainableField('触发级别', '30分钟：放量突破平台上沿'),
            topologyPreviewSource: 'child' as const,
          },
          triggerLevelLabel: '30分钟',
          suitableAction: {
            ...createExplainableField('适合动作', '等待30分钟确认后再决定是否轻仓试探'),
            topologyPreviewSource: 'child' as const,
          },
          majorRisk: {
            ...createExplainableField('主要风险', '30分钟冲高但量能不足会再次回到等待'),
            topologyPreviewSource: 'child' as const,
          },
          explanation: '日线定约束，30分钟给触发；存在约束，不能直接放大动作',
        },
      ],
    })
  );

  const actionStateBlock = getTooltipBlock(html, '执行｜30分钟等待边界确认说明', [
    '父级约束说明',
  ]);
  const triggerLevelBlock = getTooltipBlock(html, '触发级别说明', ['适合动作说明']);
  const suitableActionBlock = getTooltipBlock(html, '适合动作说明', ['主要风险说明']);
  const majorRiskBlock = getTooltipBlock(html, '主要风险说明', []);

  assert.doesNotMatch(actionStateBlock, /结构参考|structure-topology-svg/);
  assert.doesNotMatch(triggerLevelBlock, /结构参考|structure-topology-svg/);
  assert.doesNotMatch(suitableActionBlock, /结构参考|structure-topology-svg/);
  assert.doesNotMatch(majorRiskBlock, /结构参考|structure-topology-svg/);
});

test('TradingCycleBus renders topology previews from real analysis view model contracts', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const result = createResult();
  result.periods.daily.structure = {
    ...result.periods.daily.structure,
    structure_type: '日线主升结构',
    description: '日线原始描述',
    structure_details: {
      ...result.periods.daily.structure?.structure_details,
      render_payload: createTopologyRenderPayload(),
      explainability: {
        ...createTopologyExplainability(),
        current_segment: {
          from_point_id: 'a1',
          to_point_id: 'a2',
          label: '日线主升阶段',
        },
        next_segment_preview: {
          from_point_id: 'a2',
          to_point_id: 'a3',
          label: '日线放量突破确认',
          status: 'projected',
        },
      },
    },
  };
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

  const vm = buildViewModel(result);
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline?.parentTopologyPreview?.renderPayload);
  assert.ok(shortline?.parentTopologyPreview?.explainability);
  assert.ok(shortline?.childTopologyPreview?.renderPayload);
  assert.equal(shortline?.childTopologyPreview?.explainability, null);
  assert.ok(shortline?.parentConstraintTags.length);

  const parentConstraintTagTitle = shortline
    ? `${shortline.parentConstraintTags[0].label}${shortline.parentConstraintTags[0].hover.title.includes('说明') ? '' : '说明'}`
    : '';
  const parentConstraintTagHeading = shortline?.parentConstraintTags[0].hover.title ?? '';

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: shortline ? [shortline] : [],
    })
  );

  const parentConstraintBlock = getTooltipBlock(html, '父级约束说明', [
    parentConstraintTagHeading || parentConstraintTagTitle,
  ]);
  const parentConstraintTagBlock = getTooltipBlock(
    html,
    parentConstraintTagHeading || parentConstraintTagTitle,
    ['触发级别说明']
  );
  const triggerLevelBlock = getTooltipBlock(html, '触发级别说明', ['适合动作说明']);
  const suitableActionBlock = getTooltipBlock(html, '适合动作说明', ['主要风险说明']);
  const majorRiskBlock = getTooltipBlock(html, '主要风险说明', []);

  assert.doesNotMatch(parentConstraintBlock, /结构参考|structure-topology-svg/);
  assert.match(
    parentConstraintTagBlock,
    new RegExp(
      `父级结构参考[\\s\\S]*当前结构[\\s\\S]*日线主升结构[\\s\\S]*当前阶段[\\s\\S]*日线主升阶段[\\s\\S]*下一确认[\\s\\S]*日线放量突破确认`
    )
  );
  assert.match(parentConstraintTagBlock, /data-slot="structure-topology-svg"[\s\S]*data-has-explainability="true"/);
  assert.doesNotMatch(triggerLevelBlock, /结构参考|structure-topology-svg/);
  assert.doesNotMatch(suitableActionBlock, /结构参考|structure-topology-svg/);
  assert.doesNotMatch(majorRiskBlock, /结构参考|structure-topology-svg/);
});

test('TradingCycleBus renders Chinese node semantic contract copy without internal field names', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          judgmentLabel: '候选可试',
          relationLabel: '父级支持，子级顺父级',
          relationHint: '日线看背景，30分钟看执行',
          summary: '日线给背景，30分钟看B类节点确认',
          recommendation: '先等待30分钟B类b3回踩确认',
          signalTags: [
            createSignalTag('级别｜日线支持30分钟', 'neutral'),
            createSignalTag('执行｜30分钟等待边界确认', 'neutral'),
          ],
          actionStateTags: [
            {
              key: 'level_nesting',
              category: '级别',
              result: '日线支持30分钟',
              label: '级别｜日线支持30分钟',
              tone: 'neutral',
              hover: {
                title: '级别｜日线支持30分钟说明',
                items: [
                  { label: '父级别', value: '日线' },
                  { label: '子级别', value: '30分钟' },
                  { label: '节点语义', value: 'B类b3回踩确认' },
                  { label: '说明', value: '日线强支持30分钟B类b3回踩确认，但仍需按节点确认节奏执行' },
                ],
              },
            },
            {
              key: 'execution',
              category: '执行',
              result: '30分钟等待边界确认',
              label: '执行｜30分钟等待边界确认',
              tone: 'neutral',
              hover: {
                title: '执行｜30分钟等待边界确认说明',
                items: [
                  { label: '执行级别', value: '30分钟' },
                  { label: '当前动作', value: '继续等待' },
                  { label: '等待条件', value: '等待30分钟B类b3回踩确认' },
                ],
              },
            },
          ],
          judgmentBasisTags: [],
          parentConstraintTags: [],
          parentSignalTags: [],
          parentConstraint: createExplainableField('父级约束', '日线：趋势偏多'),
          triggerLevel: {
            label: '触发级别',
            value: '30分钟：B类b3回踩确认',
            hoverTitle: '触发级别说明',
            hoverItems: [
              { label: '这句话是什么意思', value: '30分钟负责给出更具体的执行触发。' },
              { label: '为什么这么判断', value: '30分钟当前处于B类b3回踩确认阶段，等待回踩后重新转强' },
              { label: '当前限制', value: '日线：趋势偏多' },
              { label: '下一步条件', value: '30分钟回踩平台上沿不破' },
            ],
          },
          triggerLevelLabel: '30分钟',
          suitableAction: createExplainableField('适合动作', '等待30分钟确认后再考虑介入'),
          majorRisk: createExplainableField('主要风险', '30分钟回踩跌回平台下沿失效'),
          explanation: '日线定约束，30分钟给触发；当前按B类节点语义执行',
        },
      ],
    })
  );

  assert.match(html, /B类b3回踩确认/);
  assert.match(html, /30分钟当前处于B类b3回踩确认阶段/);
  assert.match(html, /30分钟回踩跌回平台下沿失效/);
  assert.doesNotMatch(html, /actionable_node/);
  assert.doesNotMatch(html, /node_semantic/);
  assert.doesNotMatch(html, /暂无补充说明/);
});

test('TradingCycleBus renders Chinese boundary semantic contract copy without internal field names', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          judgmentLabel: '候选可试',
          relationLabel: '父级支持，子级边界试探',
          relationHint: '日线看背景，30分钟看执行',
          summary: '日线给背景，30分钟等箱体边界触发',
          recommendation: '先等待30分钟突破箱体上沿11.20或跌破箱体下沿10.40',
          signalTags: [
            createSignalTag('级别｜日线支持30分钟', 'neutral'),
            createSignalTag('执行｜30分钟等待边界确认', 'neutral'),
          ],
          actionStateTags: [
            {
              key: 'level_nesting',
              category: '级别',
              result: '30分钟边界试探',
              label: '级别｜30分钟边界试探',
              tone: 'warning',
              hover: {
                title: '级别｜30分钟边界试探说明',
                items: [
                  { label: '父级别', value: '日线' },
                  { label: '子级别', value: '30分钟' },
                  { label: '边界语义', value: '箱体边界等待突破' },
                  { label: '边界原因', value: '30分钟当前处于箱体震荡，必须等真实边界价位被触发后再行动' },
                  { label: '边界价位', value: '上沿 11.20 / 下沿 10.40 / 中轴 10.80' },
                  { label: '说明', value: '日线偏多，但30分钟箱体只允许按边界轻仓试探' },
                ],
              },
            },
            {
              key: 'execution',
              category: '执行',
              result: '30分钟等待边界确认',
              label: '执行｜30分钟等待边界确认',
              tone: 'neutral',
              hover: {
                title: '执行｜30分钟等待边界确认说明',
                items: [
                  { label: '执行级别', value: '30分钟' },
                  { label: '当前动作', value: '继续等待' },
                  { label: '等待条件', value: '等待30分钟突破箱体上沿11.20或跌破箱体下沿10.40' },
                ],
              },
            },
          ],
          judgmentBasisTags: [],
          parentConstraintTags: [],
          parentSignalTags: [],
          parentConstraint: createExplainableField('父级约束', '日线：趋势偏多'),
          triggerLevel: {
            label: '触发级别',
            value: '30分钟：突破箱体上沿11.20或跌破箱体下沿10.40',
            hoverTitle: '触发级别说明',
            hoverItems: [
              { label: '这句话是什么意思', value: '30分钟负责给出更具体的执行触发。' },
              { label: '为什么这么判断', value: '30分钟当前处于箱体震荡，必须等真实边界价位被触发后再行动' },
              { label: '当前限制', value: '日线：趋势偏多' },
              { label: '下一步条件', value: '30分钟突破11.20后回踩不破再确认' },
            ],
          },
          triggerLevelLabel: '30分钟',
          suitableAction: createExplainableField('适合动作', '等待30分钟确认后再考虑介入'),
          majorRisk: createExplainableField('主要风险', '30分钟重新回到10.40-11.20区间内，按假突破/假跌破处理'),
          explanation: '日线定约束，30分钟给触发；当前按边界语义执行',
        },
      ],
    })
  );

  assert.match(html, /箱体边界等待突破/);
  assert.match(html, /30分钟当前处于箱体震荡，必须等真实边界价位被触发后再行动/);
  assert.match(html, /上沿 11.20 \/ 下沿 10.40 \/ 中轴 10.80/);
  assert.match(html, /30分钟重新回到10.40-11.20区间内，按假突破\/假跌破处理/);
  assert.doesNotMatch(html, /boundary_semantic/);
  assert.doesNotMatch(html, /暂无补充说明/);
});

test('TradingCycleBus renders view-model generated modifier-layer tags without leaking internal enums', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

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
  const vm = buildViewModel(result);

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: vm.tradingCombinations,
    })
  );

  assert.match(html, /先等待30分钟突破平台上沿11.20/);
  assert.match(html, /背离｜顶背离压制/);
  assert.match(html, /30分钟突破量弱，等待二次放量确认/);
  assert.match(html, /30分钟站上30分钟MA55后回踩不破再确认/);
  assert.match(html, /30分钟跌破30分钟MA55且反抽不过失效/);
  assert.match(html, /背离｜顶背离压制/);
  assert.match(html, /量能｜突破量弱/);
  assert.match(html, /均线｜MA55压制/);
  assert.doesNotMatch(html, /supports_breakout/);
  assert.doesNotMatch(html, /hard_block/);
  assert.doesNotMatch(html, /suppressive/);
});

test('TrinityRuleChain renders six rule items and keeps failed status plus reason visible', async () => {
  const { TrinityRuleChain } = await importTsxModule<TrinityRuleChainModule>(
    'src/components/stock/TrinityRuleChain.tsx'
  );

  const html = renderQuietly(
    React.createElement(TrinityRuleChain, {
      sourceLabel:
        '本规则链默认按日线主判定展示；若日线缺失，则依次降级为周线、60分钟、30分钟、15分钟。',
      items: [
        createRuleItem({
          summary: '延伸结构可观察，但不能按标准节点操作',
          recommendation: '先按边界看，不按标准节点下手',
          signalTags: [createSignalTag('结构｜延伸C', 'neutral')],
          detailHover: {
            title: '结构资格说明',
            items: [
              { label: '这句话是什么意思', value: '当前结构还能观察，但已不适合按标准节点机械执行。' },
              { label: '为什么这么判断', value: '结构已经进入延伸阶段，标准编号解释力下降。' },
              { label: '当前限制', value: '不能把当前段落直接当作标准 C 节点操作。' },
              { label: '下一步条件', value: '继续观察平台边界与确认节奏。' },
              { label: '判定依据', value: '延伸结构更依赖边界与执行段确认。' },
            ],
          },
          detail: '周线方向允许向下钻取。',
          reason: '父级方向一致',
        }),
        createRuleItem({
          title: 'MACD 时空',
          status: 'info',
          displayStatusLabel: '观察中',
          displayStatusIcon: '○',
          direction: 'neutral',
          directionLabel: '中性',
          detail: '日线级别处于等待确认状态。',
          reason: '等待时空确认',
          summary: '时空仍待确认',
          recommendation: '先等时空确认',
          statusExplanation: {
            tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
            ruleState: '待确认',
            directionLabel: '中性',
            reason: '等待时空确认',
          },
        }),
        createRuleItem({
          title: '55 / 233 线关系',
          status: 'warning',
          displayStatusLabel: '谨慎看',
          displayStatusIcon: '!',
          direction: 'bearish',
          directionLabel: '偏空',
          detail: '30分钟触发尚需量能确认。',
          reason: '量能未同步放大',
          summary: '均线仍有限制',
          recommendation: '先等均线确认',
          statusExplanation: {
            tradeMeaning: '存在约束，不能直接放大动作',
            ruleState: '有约束',
            directionLabel: '偏空',
            reason: '量能未同步放大',
          },
        }),
        createRuleItem({
          title: '量能确认',
          status: 'info',
          displayStatusLabel: '观察中',
          displayStatusIcon: '○',
          direction: 'neutral',
          directionLabel: '中性',
          detail: '60分钟节奏进入观察区。',
          reason: '等待下一段确认',
          summary: '量能还没补齐',
          recommendation: '先看量能变化',
          statusExplanation: {
            tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
            ruleState: '待确认',
            directionLabel: '中性',
            reason: '等待下一段确认',
          },
        }),
        createRuleItem({
          title: '级别权限',
          status: 'failed',
          displayStatusLabel: '暂不做',
          displayStatusIcon: '×',
          direction: 'bearish',
          directionLabel: '偏空',
          detail: '15分钟入场点尚未成立。',
          reason: '入场触发条件缺失',
          summary: '当前级别权限不放行',
          recommendation: '先等父子级别重新对齐',
          statusExplanation: {
            tradeMeaning: '当前不支持按这条规则交易',
            ruleState: '不成立',
            directionLabel: '偏空',
            reason: '入场触发条件缺失',
          },
        }),
        createRuleItem({
          title: '执行计划',
          status: 'passed',
          displayStatusLabel: '可执行',
          displayStatusIcon: '✓',
          direction: 'bullish',
          directionLabel: '偏多',
          detail: '风险回撤边界已定义。',
          reason: '止损与失效位明确',
          summary: '执行边界已定义',
          recommendation: '按计划执行',
          statusExplanation: {
            tradeMeaning: '这条规则已满足，可纳入当前执行判断',
            ruleState: '已满足',
            directionLabel: '偏多',
            reason: '止损与失效位明确',
          },
        }),
      ],
    })
  );

  assert.match(html, /结构资格/);
  assert.match(html, /MACD 时空/);
  assert.match(html, /55 \/ 233 线关系/);
  assert.match(html, /量能确认/);
  assert.match(html, /级别权限/);
  assert.match(html, /执行计划/);
  assert.match(html, /本规则链默认按日线主判定展示/);
  assert.match(html, /可执行/);
  assert.match(html, /观察中/);
  assert.match(html, /谨慎看/);
  assert.match(html, /暂不做/);
  assert.match(html, /当前状态：可执行/);
  assert.match(html, /当前状态：观察中/);
  assert.match(html, /当前状态：暂不做/);
  assert.match(html, /交易含义/);
  assert.match(html, /规则状态/);
  assert.match(html, /当前方向/);
  assert.match(html, /延伸结构可观察，但不能按标准节点操作/);
  assert.match(html, /先按边界看，不按标准节点下手/);
  assert.match(html, /结构｜延伸C/);
  assert.match(html, /结构资格说明/);
  assert.match(html, /当前限制/);
  assert.doesNotMatch(html, /周线方向允许向下钻取/);
  assert.match(html, /等待触发：已有预案，但触发条件尚未满足/);
  assert.doesNotMatch(html, />通过</);
  assert.doesNotMatch(html, />警示</);
  assert.doesNotMatch(html, />提示</);
  assert.doesNotMatch(html, />失败</);
});

test('AnalysisPeriodDetails keeps a pure data contract and renders structure explanation internally', () => {
  assert.match(periodDetailsSource, /export interface AnalysisPeriodSection/);
  assert.doesNotMatch(periodDetailsSource, /structureExplainabilitySlot/);
  assert.match(periodDetailsSource, /StructureExplainabilityPanel/);
  assert.match(periodDetailsSource, /buildExecutionSummary/);
  assert.match(periodDetailsSource, /结构说明/);
  assert.match(periodDetailsSource, /defaultLevelKey/);
  assert.match(periodDetailsSource, /TabsList/);
  assert.match(periodDetailsSource, /TabsTrigger/);
  assert.match(periodDetailsSource, /TabsContent/);
  assert.doesNotMatch(periodDetailsSource, /AccordionTrigger/);
  assert.match(periodDetailsSource, /section\.period/);
});

test('AnalysisPeriodDetails normalizes internal field labels before rendering structure evidence', () => {
  assert.match(periodDetailsSource, /normalizeStructureDisplayText/);
  assert.match(
    periodDetailsSource,
    /const evidence = \[[\s\S]*?prediction\?\.prediction_alert[\s\S]*?\]\s*\.filter\(Boolean\)\s*\.join\('｜'\);[\s\S]*?return normalizeStructureDisplayText\(evidence\)/
  );
});

test('AnalysisSummaryPanel renders global strategy scope and hard gate explanations', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        mode: 'idle',
        headline: '等待放量突破后轻仓试探',
        primaryActionLabel: '等待',
        judgmentLabel: '候选可试',
        relationLabel: '父级强冲突，子级逆父级',
        primaryReason: '日线仍需确认，只能等待30分钟触发',
        triggerLabels: ['30分钟放量突破平台上沿'],
        riskLabels: ['跌回日线平台下沿'],
        guardrail: '仓位不超过 20%',
        spacetimeSummary: '时空：中偏强，等待时空确认',
        structureSummary: '结构：A五段式，A原型成立',
        executionSummary: '现在怎么做：先看30分钟放量突破平台上沿，确认看回踩不破平台上沿，失效看跌回日线平台下沿',
        signalTags: [
          createSignalTag('级别｜子级逆势', 'warning'),
          createSignalTag('执行｜回踩执行', 'neutral'),
        ],
        hardGateTitle: '主策略硬门控',
        hardGateSourceLabel: '当前硬门控来自主判定级别：日线',
        hardGates: [
          {
            label: '仓位权限',
            value: '轻仓试探',
            description: {
              title: '仓位权限',
              meaning: '后端允许的最大仓位动作范围。',
              tradeImpact: '当前值为「轻仓试探」，AI 和页面结论不能突破这个限制。',
              source: 'trinity_decision.trade_qualification.position_permission',
            },
          },
        ],
      },
      globalStrategy: {
        scopeLabel: '综合范围：中线主策略组合、短线执行组合、超短线 / T 组合',
        primaryCombination: 'shortline',
        primaryCombinationLabel: '短线执行组合｜日线 → 30分钟',
        primaryConstraintLevel: 'daily',
        primaryConstraintLevelLabel: '日线',
        triggerLevel: 'hour30',
        triggerLevelLabel: '30分钟',
        direction: 'bullish',
        directionLabel: '偏多',
        actionLabel: '观察中',
        headline: '等待放量突破后轻仓试探',
        primaryReason: '日线仍需确认，只能等待30分钟触发',
        triggerLabels: ['30分钟放量突破平台上沿'],
        riskLabels: ['跌回日线平台下沿'],
        guardrail: '仓位不超过 20%',
      },
      onGenerate: () => undefined,
      canGenerate: true,
    })
  );

  assert.match(html, /页面级综合结论/);
  assert.match(html, /综合范围：中线主策略组合、短线执行组合、超短线 \/ T 组合/);
  assert.match(html, /当前优先组合/);
  assert.match(html, /短线执行组合｜日线 → 30分钟/);
  assert.match(html, /主约束级别/);
  assert.match(html, /触发级别/);
  assert.match(html, /候选可试/);
  assert.match(html, /父级强冲突，子级逆父级/);
  assert.match(html, /时空：中偏强，等待时空确认/);
  assert.match(html, /结构：A五段式，A原型成立/);
  assert.match(html, /现在怎么做：先看30分钟放量突破平台上沿，确认看回踩不破平台上沿，失效看跌回日线平台下沿/);
  assert.match(html, /级别｜子级逆势/);
  assert.match(html, /执行｜回踩执行/);
  assert.match(html, /主策略硬门控/);
  assert.match(html, /仓位权限/);
  assert.match(html, /后端允许的最大仓位动作范围/);
  assert.doesNotMatch(html, /后端硬门控/);
});

test('AnalysisSummaryPanel keeps signal tags and hard gates visible when phase3 summary blocks render', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        mode: 'ready',
        headline: 'AI 判断：当前先等30分钟回抽确认',
        primaryActionLabel: '等待',
        judgmentLabel: '候选可试',
        relationLabel: '父级强冲突，子级逆父级',
        primaryReason: '父级支持，但30分钟回抽段未完成止跌确认',
        triggerLabels: ['30分钟止跌后重新转强'],
        riskLabels: ['跌回日线确认低点下方'],
        guardrail: '后端当前仍未放开等待约束',
        spacetimeSummary: '时空：日线中偏强，30分钟顺父级，零轴强信号偏支持',
        structureSummary: '结构：正式结构未完全确认，当前更偏 D 候选',
        executionSummary: '现在怎么做：先看30分钟止跌，确认后再加',
        judgmentWarning: '判断疑点：30分钟信号已明显转强，但后端当前结论仍偏保守',
        candidateStructureSummary: {
          label: 'D候选',
          currentLeg: '30分钟回抽段',
          upgradeCondition: '30分钟回抽止跌并放量重新转强',
          invalidation: '跌回日线确认低点下方',
        },
        waitStateSummary: {
          label: '等待回抽确认',
          currentBlock: '30分钟回抽段尚未完成止跌确认',
          nextAction: '观察30分钟止跌并重新转强',
        },
        signalTags: [
          createSignalTag('级别｜子级逆势', 'warning'),
          createSignalTag('执行｜回踩执行', 'neutral'),
        ],
        hardGateTitle: '主策略硬门控',
        hardGateSourceLabel: '当前硬门控来自主判定级别：日线',
        hardGates: [
          {
            label: '仓位权限',
            value: '轻仓试探',
            description: {
              title: '仓位权限',
              meaning: '后端允许的最大仓位动作范围。',
              tradeImpact: '当前值为「轻仓试探」，AI 和页面结论不能突破这个限制。',
              source: 'trinity_decision.trade_qualification.position_permission',
            },
          },
        ],
      },
      globalStrategy: {
        scopeLabel: '综合范围：中线主策略组合、短线执行组合、超短线 / T 组合',
        primaryCombination: 'shortline',
        primaryCombinationLabel: '短线执行组合｜日线 → 30分钟',
        primaryConstraintLevel: 'daily',
        primaryConstraintLevelLabel: '日线',
        triggerLevel: 'hour30',
        triggerLevelLabel: '30分钟',
        direction: 'bullish',
        directionLabel: '偏多',
        actionLabel: '观察中',
        headline: 'AI 判断：当前先等30分钟回抽确认',
        primaryReason: '父级支持，但30分钟回抽段未完成止跌确认',
        triggerLabels: ['30分钟止跌后重新转强'],
        riskLabels: ['跌回日线确认低点下方'],
        guardrail: '后端当前仍未放开等待约束',
      },
      onGenerate: () => undefined,
      canGenerate: true,
    })
  );

  assert.match(html, /判断疑点/);
  assert.match(html, /候选结构/);
  assert.match(html, /D候选｜30分钟回抽段/);
  assert.match(html, /等待状态/);
  assert.match(html, /等待回抽确认｜30分钟回抽段尚未完成止跌确认/);
  assert.match(html, /级别｜子级逆势/);
  assert.match(html, /执行｜回踩执行/);
  assert.match(html, /页面级综合结论/);
  assert.match(html, /主策略硬门控/);
  assert.match(html, /仓位权限/);
});

test('AnalysisPeriodDetails renders level tabs with decision card, rule summary and evidence', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'daily',
      sections: [
        {
          key: 'daily',
          label: '日线',
          defaultOpen: true,
          rangeLabel: '近 240 根',
          summary: '日线等待确认',
          topologyTitle: '日线结构证据',
            period: {
              period: 'daily',
              macd: {
                status: '中偏弱',
                divergence_note: '注意顶背离',
              },
              breakthrough: {
                pattern_type: '普通突破',
                pattern_name: '普通突破',
                direction: 'up',
                is_valid: false,
              },
              moving_averages: {
                ma_status: '站上MA55',
              },
              trinity_decision: {
                version: 'v2',
                level: 'daily',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '等待30分钟触发',
              },
              spacetime: {
                status: '中偏弱',
                direction_bias: 'neutral',
                expected_structures: {
                  up: ['C单平台式'],
                  down: ['D三段式'],
                },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: false,
                  bottom_divergence_valid: false,
                  reason: '注意顶背离',
                },
              },
              structure: {
                family: 'standard',
                type: 'C单平台式',
                qualification: 'standard',
                direction: 'neutral',
                boundaries: {},
                node_map: {},
                can_trade_by_structure_nodes: false,
                can_trade_by_boundaries: true,
                explainability: { status: 'passed', reason: 'C平台成立', evidence: [] },
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: {
                  above_ma55: true,
                  above_ma233: false,
                },
                breakthrough_state: 'breakout_pending',
                ma_gate: {
                  allow_long: false,
                  allow_short: false,
                  reason: '站上MA55',
                },
              },
              volume_confirmation: {
                volume_state: 'expanding',
                breakout_volume: 'weak',
                breakdown_volume: 'not_applicable',
                pullback_volume: 'normal',
                volume_gate: {
                  supports_breakout: false,
                  supports_breakdown: false,
                  supports_pullback_confirmation: false,
                  confidence_adjustment: 'neutral',
                  reason: '突破量弱',
                },
              },
              execution: {
                entry_style: 'pullback',
                triggers: ['30分钟放量突破'],
                confirmation: ['30分钟回踩不破平台上沿'],
                invalidation: ['跌回平台下沿'],
                risk_flags: ['跌回平台下沿'],
                position_sizing: { reason: '不超过轻仓' },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
                confidence: 'medium',
                reason: ['等待确认'],
              },
              level_nesting: {
                parent_level: 'weekly',
                child_level: 'daily',
                parent_bias: 'bullish',
                child_signal: 'wait',
                resonance: 'aligned',
                permission: {
                  allow_position_increase: false,
                  allow_t_trade: false,
                  allow_only_light_probe: true,
                  reason: '周线偏多，日线等待触发',
                },
              },
              judgment_criteria: [],
              ai_summary_facts: [],
            },
            structure: {
              structure_type: 'C单平台式',
              inflection_points: 6,
              description: 'C单平台式，等待突破',
              interpretation: {
                spacetime_gate: {
                  parent_status: '周线偏多',
                  resonance_enabled: true,
                  wait_reason: '日线等待30分钟放量突破',
                  required_confirmation: '30分钟放量突破',
                },
              },
              structure_details: {
                prediction: {
                  current_stage: 'c5拐点',
                  next_stage: 'c6确认',
                  prediction_alert: '等待平台边界确认',
                  key_price_levels: [],
                  confidence: 'medium',
                  action_hint: '等待平台边界确认',
                },
              },
            },
          } as PeriodAnalysisData,
        },
      ],
    })
  );

  assert.match(html, /周期详情/);
  assert.match(html, /日线/);
  assert.match(html, /当前综合判断/);
  assert.match(html, /父子关系/);
  assert.match(html, /时空摘要/);
  assert.match(html, /结构摘要/);
  assert.match(html, /执行摘要/);
  assert.match(html, /先手点/);
  assert.match(html, /确认点/);
  assert.match(html, /失效点/);
  assert.match(html, /日线等待确认/);
  assert.match(html, /时空｜中偏弱/);
  assert.match(html, /背离｜顶背离/);
  assert.match(html, /结构｜C单平台式/);
  assert.match(html, /突破\/跌破｜突破候选/);
  assert.doesNotMatch(html, /突破\/跌破｜普通突破/);
  assert.match(html, /量能｜突破量弱/);
  assert.match(html, /均线｜MA55支撑/);
  assert.match(html, /级别｜父子级支持/);
  assert.match(html, /执行｜回踩执行/);
  assert.match(html, /信号含义/);
  assert.match(html, /交易含义/);
  assert.match(html, /规则摘要/);
  assert.match(html, /证据区/);
  assert.match(html, /来源：日线三位一体判定/);
  assert.match(html, /触发条件/);
  assert.match(html, /风险条件/);
  assert.match(html, /注意顶背离/);
  assert.match(html, /普通突破/);
  assert.match(html, /站上MA55/);
  assert.match(html, /风控约束/);
  assert.match(html, /结构类型/);
  assert.match(html, /标准C类结构/);
  assert.match(html, /共振对象：周线 → 日线/);
  assert.match(html, /上一级：周线/);
  assert.match(html, /当前级别：日线/);
  assert.doesNotMatch(html, /当前级别简明决策/);
  assert.doesNotMatch(html, /周期摘要/);
});

test('AnalysisPeriodDetails prefers period breakthrough risk over broader decision candidate tags', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'hour30',
      sections: [
        {
          key: 'hour30',
          label: '30分钟',
          defaultOpen: true,
          summary: '30分钟等待确认',
          period: {
            period: 'hour30',
            macd: {
              status: '中偏弱',
            },
            breakthrough: {
              pattern_type: '假突破',
              pattern_name: '假突破',
              direction: 'up',
              is_valid: false,
            },
            trinity_decision: {
              version: 'v2',
              level: 'hour30',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '等待15分钟进一步确认',
              },
              spacetime: {
                status: '中偏弱',
                direction_bias: 'neutral',
                expected_structures: {
                  up: ['C单平台式'],
                  down: ['D三段式'],
                },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: false,
                  bottom_divergence_valid: false,
                  reason: '注意顶背离',
                },
              },
              structure: {
                family: 'standard',
                type: 'C单平台式',
                qualification: 'standard',
                direction: 'neutral',
                boundaries: {},
                node_map: {},
                can_trade_by_structure_nodes: false,
                can_trade_by_boundaries: true,
                explainability: { status: 'passed', reason: 'C平台成立', evidence: [] },
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: {
                  above_ma55: true,
                  above_ma233: false,
                },
                breakthrough_state: 'breakout_pending',
                ma_gate: {
                  allow_long: false,
                  allow_short: false,
                  reason: '等待突破确认',
                },
              },
              volume_confirmation: {
                volume_state: 'normal',
                breakout_volume: 'weak',
                breakdown_volume: 'not_applicable',
                pullback_volume: 'normal',
                volume_gate: {
                  supports_breakout: false,
                  supports_breakdown: false,
                  supports_pullback_confirmation: false,
                  confidence_adjustment: 'neutral',
                  reason: '突破量弱',
                },
              },
              execution: {
                entry_style: 'pullback',
                triggers: ['15分钟进一步确认'],
                confirmation: ['15分钟回踩不破平台上沿'],
                invalidation: ['再次跌回平台下沿'],
                risk_flags: ['再次跌回平台下沿'],
                position_sizing: { reason: '先保持轻仓观察' },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
                confidence: 'medium',
                reason: ['等待确认'],
              },
              judgment_criteria: [],
              ai_summary_facts: [],
            },
            structure: {
              structure_type: 'C单平台式',
              inflection_points: 6,
              description: '30分钟假突破风险正在增加',
            },
          } as PeriodAnalysisData,
        },
      ],
    })
  );

  assert.match(html, /突破\/跌破｜假突破风险/);
  assert.doesNotMatch(html, /突破\/跌破｜突破候选/);
});

test('AnalysisPeriodDetails prefers phase2 wait and execution fields with legacy fallback preserved', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'daily',
      sections: [
        {
          key: 'daily',
          label: '日线',
          period: {
            period: 'daily',
            trinity_decision: {
              version: 'v2',
              level: 'daily',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '旧等待理由',
              },
              spacetime: {
                status: '中偏强',
                direction_bias: 'neutral',
                expected_structures: {
                  up: ['A五段式'],
                  down: ['D三段式'],
                },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: false,
                  bottom_divergence_valid: false,
                  reason: '旧时空说明',
                },
              },
              structure: {
                family: 'standard',
                type: 'A五段式',
                qualification: 'standard',
                direction: 'up',
                boundaries: {},
                node_map: {},
                can_trade_by_structure_nodes: false,
                can_trade_by_boundaries: true,
                explainability: { status: 'passed', reason: 'A原型成立', evidence: [] },
              },
              candidate_structure: {
                candidate_type: 'A延续',
                candidate_label: 'A延续候选',
                current_leg: 'a3进行中',
                direction: 'up',
                reason: 'live 段仍按上涨原型处理',
                upgrade_condition: '确认 a4 后继续突破前高',
                invalidation: '跌破 a3 起涨低点',
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: {
                  above_ma55: true,
                  above_ma233: false,
                },
                breakthrough_state: 'breakout_pending',
                ma_gate: {
                  allow_long: false,
                  allow_short: false,
                  reason: '等待突破确认',
                },
              },
              volume_confirmation: {
                volume_state: 'normal',
                breakout_volume: 'weak',
                breakdown_volume: 'not_applicable',
                pullback_volume: 'normal',
                volume_gate: {
                  supports_breakout: false,
                  supports_breakdown: false,
                  supports_pullback_confirmation: false,
                  confidence_adjustment: 'neutral',
                  reason: '突破量弱',
                },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
                confidence: 'medium',
                reason: ['旧资格说明'],
              },
              execution: {
                entry_style: 'pullback',
                triggers: ['旧先手点'],
                confirmation: ['旧确认点'],
                invalidation: ['旧失效点'],
                risk_flags: ['旧风险'],
                position_sizing: { reason: '旧执行摘要' },
              },
              wait_state: {
                wait_type: '等待回抽确认',
                wait_label: '等待回抽确认',
                current_block: '30分钟尚未给出回抽企稳',
                next_confirmation_action: '观察30分钟回抽不破 MA55',
                reason: '当前仍缺少确认回抽',
              },
              execution_plan: {
                probe_entry: '15分钟止跌后轻仓试',
                confirm_entry: '30分钟回抽确认后加仓',
                invalidation: '跌破15分钟确认低点',
                current_position_action: '轻仓试',
              },
              judgment: {
                level: 'candidate_probe',
                label: '候选可试',
                current_best_action: '轻仓试',
                critical_reason: '父级支持但30分钟仍待确认',
                supporting_factors: ['零轴金叉'],
                limiting_factors: ['等待回抽确认'],
              },
              judgment_criteria: [],
              ai_summary_facts: [],
            },
            structure: {
              structure_type: 'A五段式',
              description: '旧结构摘要',
            },
          } as PeriodAnalysisData,
        },
      ],
    })
  );

  assert.match(html, /候选可试/);
  assert.match(html, /A延续候选｜a3进行中/);
  assert.match(html, /结构｜A延续候选/);
  assert.doesNotMatch(html, /结构｜A五段式/);
  assert.match(html, /观察30分钟回抽不破 MA55/);
  assert.match(html, /父级支持但30分钟仍待确认/);
  assert.match(html, /15分钟止跌后轻仓试/);
  assert.match(html, /30分钟回抽确认后加仓/);
  assert.match(html, /跌破15分钟确认低点/);
  assert.doesNotMatch(html, /旧确认点/);
});

test('AnalysisPeriodDetails ignores legacy section summary when candidate structure is present', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'daily',
      sections: [
        {
          key: 'daily',
          label: '日线',
          summary: '旧调用方摘要',
          period: {
            period: 'daily',
            trinity_decision: {
              version: 'v2',
              level: 'daily',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '旧等待理由',
              },
              spacetime: {
                status: '中偏强',
                direction_bias: 'neutral',
                expected_structures: { up: ['A五段式'], down: ['D三段式'] },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: false,
                  bottom_divergence_valid: false,
                  reason: '旧时空说明',
                },
              },
              structure: {
                family: 'standard',
                type: 'A五段式',
                qualification: 'standard',
                direction: 'up',
                boundaries: {},
                node_map: {},
                can_trade_by_structure_nodes: false,
                can_trade_by_boundaries: true,
                explainability: { status: 'passed', reason: 'A原型成立', evidence: [] },
              },
              candidate_structure: {
                candidate_type: 'A延续',
                candidate_label: 'A延续候选',
                current_leg: 'a3进行中',
                direction: 'up',
                reason: 'live 段仍按上涨原型处理',
                upgrade_condition: '确认 a4 后继续突破前高',
                invalidation: '跌破 a3 起涨低点',
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: { above_ma55: true, above_ma233: false },
                breakthrough_state: 'breakout_pending',
                ma_gate: {
                  allow_long: false,
                  allow_short: false,
                  reason: '等待突破确认',
                },
              },
              volume_confirmation: {
                volume_state: 'normal',
                breakout_volume: 'weak',
                breakdown_volume: 'not_applicable',
                pullback_volume: 'normal',
                volume_gate: {
                  supports_breakout: false,
                  supports_breakdown: false,
                  supports_pullback_confirmation: false,
                  confidence_adjustment: 'neutral',
                  reason: '突破量弱',
                },
              },
              execution: {
                entry_style: 'pullback',
                triggers: ['旧先手点'],
                confirmation: ['旧确认点'],
                invalidation: ['旧失效点'],
                risk_flags: ['旧风险'],
                position_sizing: { reason: '旧执行摘要' },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
                confidence: 'medium',
                reason: ['旧资格说明'],
              },
              judgment_criteria: [],
              ai_summary_facts: [],
            },
            structure: {
              structure_type: 'A五段式',
              description: '旧结构摘要',
            },
          } as PeriodAnalysisData,
        },
      ],
    })
  );

  assert.match(html, /A延续候选｜a3进行中/);
  assert.match(html, /结构｜A延续候选/);
  assert.doesNotMatch(html, /旧调用方摘要/);
});

test('AnalysisPeriodDetails falls back to legacy structure and guardrail when phase2 fields are absent', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'daily',
      sections: [
        {
          key: 'daily',
          label: '日线',
          period: {
            period: 'daily',
            trinity_decision: {
              version: 'v2',
              level: 'daily',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '旧等待理由',
              },
              spacetime: {
                status: '中偏强',
                direction_bias: 'neutral',
                expected_structures: { up: ['A五段式'], down: ['D三段式'] },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: false,
                  bottom_divergence_valid: false,
                  reason: '旧时空说明',
                },
              },
              structure: {
                family: 'standard',
                type: 'A五段式',
                qualification: 'standard',
                direction: 'up',
                boundaries: {},
                node_map: {},
                can_trade_by_structure_nodes: false,
                can_trade_by_boundaries: true,
                explainability: { status: 'passed', reason: '旧结构解释', evidence: [] },
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: { above_ma55: true, above_ma233: false },
                breakthrough_state: 'breakout_pending',
                ma_gate: {
                  allow_long: false,
                  allow_short: false,
                  reason: '等待突破确认',
                },
              },
              volume_confirmation: {
                volume_state: 'normal',
                breakout_volume: 'weak',
                breakdown_volume: 'not_applicable',
                pullback_volume: 'normal',
                volume_gate: {
                  supports_breakout: false,
                  supports_breakdown: false,
                  supports_pullback_confirmation: false,
                  confidence_adjustment: 'neutral',
                  reason: '突破量弱',
                },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
                confidence: 'medium',
                reason: ['旧资格说明'],
              },
              execution: {
                entry_style: 'pullback',
                triggers: ['旧先手点'],
                confirmation: ['旧确认点'],
                invalidation: ['旧失效点'],
                risk_flags: ['旧风险'],
                position_sizing: { reason: '旧执行摘要' },
              },
              judgment_criteria: [],
              ai_summary_facts: [],
            },
            structure: {
              structure_type: 'A五段式',
              description: '旧结构摘要',
            },
          } as PeriodAnalysisData,
        },
      ],
    })
  );

  assert.match(html, /旧结构摘要/);
  assert.match(html, /结构｜A五段式/);
  assert.match(html, /旧先手点/);
  assert.match(html, /旧确认点/);
  assert.match(html, /旧失效点/);
  assert.match(html, /旧执行摘要/);
});

test('AnalysisPeriodDetails falls back cleanly when period data is missing', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      sections: [
        {
          key: 'daily',
          label: '日线',
        },
      ],
    })
  );

  assert.match(html, /当前综合判断/);
  assert.match(html, /严格等待/);
  assert.match(html, /父级未明，子级先看确认/);
  assert.match(html, /当前级别暂无周期数据/);
  assert.match(html, /当前周期暂无时空状态/);
  assert.match(html, /当前周期暂无结构证据/);
  assert.match(html, /先手点：/);
  assert.match(html, /继续等待触发/);
  assert.match(html, /确认点：/);
  assert.match(html, /等待进一步确认/);
  assert.match(html, /失效点：/);
  assert.match(html, /若条件失效则取消/);
  assert.doesNotMatch(html, /signal-tags/);
});
