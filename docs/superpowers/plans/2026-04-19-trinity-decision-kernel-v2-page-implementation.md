# 三位一体分析页 IA 落地 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已确认的 IA 规格重构 `src/app/stock/[code]/analysis/page.tsx`，先展示确定性信息，再由用户手动触发 AI 综合判断，并把级别决策总线、关键规则链、周期详情和旧版拓扑结构图按新层级落位。

**Architecture:** 保留现有 `prepare-analysis` 与 `ai-analysis` 接口，不改数据获取流程；新增一个页面视图模型层，把后端确定性结果、AI 摘要状态、级别嵌套和数据范围统一映射为页面需要的展示模型。页面组件拆成“状态条 / 综合判断区 / 级别决策总线 / 规则链 / 周期详情”五块，`page.tsx` 只负责请求、状态编排和布局拼装。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Tailwind CSS v4、shadcn/ui、`node:test`、`pnpm`

---

## 文件落点

### 新建文件

- `src/lib/trinity-analysis-page-view-model.ts`
  - 负责把 `AnalysisResultData`、`DataIntegritySnapshot`、AI 状态统一转换成页面视图模型。
- `src/components/stock/AnalysisStatusBar.tsx`
  - 负责顶部状态条：数据同步、AI 状态、本次判定使用的数据范围。
- `src/components/stock/AnalysisSummaryPanel.tsx`
  - 负责综合判断区：默认态 / 加载态 / 失败态 / AI 结果态。
- `src/components/stock/LevelDecisionBus.tsx`
  - 负责三维度级别决策总线。
- `src/components/stock/TrinityRuleChain.tsx`
  - 负责六段规则链。
- `src/components/stock/AnalysisPeriodDetails.tsx`
  - 负责周期详情、结构证据、旧版拓扑结构图和复盘排错入口。
- `tests/trinity-analysis-page-view-model.test.ts`
  - 负责视图模型纯函数测试。
- `tests/helpers/tsx-test-loader.ts`
  - 负责在 `node:test` 中导入 TSX 组件并注入基础 UI stub。
- `tests/analysis-summary-panel.test.ts`
  - 负责综合判断区组件的渲染测试。
- `tests/analysis-page-sections.test.ts`
  - 负责级别决策总线、规则链、周期详情组件的渲染测试。
- `tests/analysis-page-layout-contract.test.ts`
  - 负责分析页主布局源代码契约测试，防止旧版重复区块回流。

### 修改文件

- `src/lib/stock-structure-types.ts`
  - 为 `structure_details.valid_range`、`structure_details.pipeline_debug` 补足类型，避免页面层大量 `unknown`。
- `src/app/stock/[code]/analysis/page.tsx`
  - 按新 IA 重新组织页面布局，移除旧的“核心结论 / 多维度跨级别操作建议 / AI 整段报告置顶”结构。

### 保持不动但继续复用

- `src/components/stock/DataIntegrityAlert.tsx`
  - 继续用于数据异常高优先级提示。
- `src/components/stock/DataSyncTime.tsx`
  - 继续提供同步时间能力，但由新状态条接管页面主展示。
- `src/components/stock/StructureExplainabilityPanel.tsx`
  - 继续用于结构证据区，不再抢主视觉。
- `src/lib/ai-report-contract.ts`
  - 继续解析 AI 返回的 `JSON + Markdown` 契约。

## 实施约束

- 页面用户可见文案必须使用中文，不展示英文硬门控枚举。
- 页面进入后不自动触发 AI；只有用户点击“生成 AI 综合判断”按钮才请求 AI。
- 顶部状态条必须展示“本次判定使用的数据范围”，且按级别分别显示，不能再出现“当前分析窗口 / 近 240 根 K 线”这种统一占位文案。
- 旧版拓扑结构图必须迁移到“周期详情 → 结构证据”，默认只展开日线。
- 级别决策总线固定在综合判断区下方，不能塞回规则链某一格。

## Task 1: 建立页面视图模型与数据范围映射

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Create: `src/lib/trinity-analysis-page-view-model.ts`
- Test: `tests/trinity-analysis-page-view-model.test.ts`

- [ ] **Step 1: 写失败测试，锁定状态条 / 综合判断区 / 总线 / 规则链的最小映射**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { DataIntegritySnapshot } from '../src/lib/stock-data-integrity';
import type { AnalysisResultData } from '../src/lib/stock-structure-types';

const {
  buildAnalysisPageViewModel,
} = await import(new URL('../src/lib/trinity-analysis-page-view-model.ts', import.meta.url).href);

const sampleIntegrity: DataIntegritySnapshot = {
  code: '300274',
  baostockLatestDate: '2026-04-17',
  currentTime: '2026-04-19 10:00:00',
  isWeekend: true,
  summary: {
    overallStatus: 'ok',
    overallText: '五个级别数据已齐备',
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
  levels: [
    { key: 'w', name: '周线', icon: 'calendar', description: '周线', status: 'ok', statusText: '已同步', lastDate: '2026-04-17', recordCount: 120, expectedRecords: 120, expectedDescription: '近 120 根', completeness: 1, minRecords: 120, needsSync: false, issues: [] },
    { key: 'd', name: '日线', icon: 'sun', description: '日线', status: 'ok', statusText: '已同步', lastDate: '2026-04-17', recordCount: 240, expectedRecords: 240, expectedDescription: '近 240 根', completeness: 1, minRecords: 240, needsSync: false, issues: [] },
    { key: '60', name: '60分钟', icon: 'clock-3', description: '60分钟', status: 'ok', statusText: '已同步', lastDate: '2026-04-17 15:00:00', recordCount: 320, expectedRecords: 320, expectedDescription: '近 320 根', completeness: 1, minRecords: 320, needsSync: false, issues: [] },
    { key: '30', name: '30分钟', icon: 'clock-2', description: '30分钟', status: 'ok', statusText: '已同步', lastDate: '2026-04-17 15:00:00', recordCount: 320, expectedRecords: 320, expectedDescription: '近 320 根', completeness: 1, minRecords: 320, needsSync: false, issues: [] },
    { key: '15', name: '15分钟', icon: 'clock-1', description: '15分钟', status: 'ok', statusText: '已同步', lastDate: '2026-04-17 15:00:00', recordCount: 320, expectedRecords: 320, expectedDescription: '近 320 根', completeness: 1, minRecords: 320, needsSync: false, issues: [] },
  ],
};

const sampleResult: AnalysisResultData = {
  stock_code: '300274',
  stock_name: '阳光电源',
  analysis_time: '2026-04-19 10:00:00',
  periods: {
    daily: {
      analysis_date: '2026-04-17',
      latest_price: 188.3,
      price_change_pct: 1.25,
      volume: 123456789,
      macd: { status: '中偏强', description: '等待确认' },
      structure: {
        structure_type: '延伸C',
        structure_stage: '平台震荡',
        trend_direction: '震荡',
        inflection_points: 8,
        segment_count: 7,
        description: '延伸 C 平台待突破',
        structure_details: {
          valid_range: {
            start_date: '2025-05-12',
            end_date: '2026-04-17',
            start_price: 126.2,
            end_price: 188.3,
            origin_type: 'low',
            break_type: 'MA55',
          },
          pipeline_debug: {
            analysis_kline_count: 240,
            processed_kline_count: 240,
            render_window_size: 120,
            valid_range_applied: true,
          },
        },
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
          wait_reason: '等待放量突破平台上沿',
        },
        structure: {
          family: 'extended',
          type: '延伸C',
          qualification: 'extended',
          direction: 'neutral',
          background_origin: { price: 126.2, date: '2025-05-12 00:00:00', semantic: 'background_origin' },
          focus_origin: { price: 209.88, date: '2025-11-14 00:00:00', semantic: 'focus_origin' },
          execution_origin: { point_id: 'c4', price: 176.2, date: '2026-03-18 00:00:00', semantic: 'execution_origin' },
          boundaries: { upper: 190.4, lower: 176.2, breakout_trigger: 190.4, stop_loss: 176.2 },
          node_map: { last_confirmed: 'c6' },
          can_trade_by_structure_nodes: false,
          can_trade_by_boundaries: true,
          explainability: { status: 'downgraded', reason: '延伸 C 仅允许边界交易', evidence: ['平台点数超限'] },
        },
        spacetime: {
          status: '中偏强',
          direction_bias: 'bullish',
          expected_structures: { up: ['A五段式', 'B双平台式'], down: ['D三段式'] },
          structure_match: true,
          divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: '无背离优势' },
        },
        moving_average: {
          ma55_role: 'support',
          ma233_role: 'support',
          price_position: { above_ma55: true, above_ma233: true, deviation_ma55_pct: 2.1, deviation_ma233_pct: 8.4 },
          breakthrough_state: 'breakout_pending',
          ma_gate: { allow_long: true, allow_short: false, reason: '55线仍为支撑，但未确认突破' },
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
            confidence_adjustment: 'downgrade',
            reason: '量能尚未放大',
          },
        },
        level_nesting: {
          parent_level: 'weekly',
          child_level: 'daily',
          parent_bias: 'bullish',
          child_signal: 'wait',
          resonance: 'conflict',
          permission: {
            allow_position_increase: false,
            allow_t_trade: false,
            allow_only_light_probe: true,
            reason: '周线偏多但日线仍在等待确认',
          },
        },
        trade_qualification: {
          trade_mode: 'wait_confirmation',
          position_permission: 'no_position',
          confidence: 'medium',
          reason: ['等待突破确认', '量能尚未放大'],
        },
        execution: {
          entry_style: 'breakout',
          triggers: ['放量突破 190.40', '回踩 190.40 不破'],
          invalidation: ['跌回 176.20 下方'],
          confirmation: ['量能放大', '55线继续支撑'],
          position_sizing: { max_ratio: 0.25, reason: '确认前不允许扩仓' },
          risk_flags: ['未脱离延伸 C'],
        },
        judgment_criteria: [],
        ai_summary_facts: ['延伸 C 仅允许边界交易'],
      },
    },
  },
  level_nesting: {
    dimension1: { weekly_status: '中偏强', weekly_structure: '上升中继', daily_status: '中偏强', daily_structure: '延伸C', daily_ma55_position: '上方', hour60_status: '中偏弱', analysis: '周线偏多但日线未确认结束' },
    dimension2: { daily_status: '中偏强', daily_structure: '延伸C', hour30_status: '中偏强', hour15_structure: '局部上拐', analysis: '30分钟只能辅助确认' },
    dimension3: { hour60_status: '中偏弱', hour60_ma55_position: '下方', hour15_structure: '反抽', analysis: '15分钟仅用于优化执行' },
    summary: '分析自上而下，交易自下而上',
  },
  multi_dimension_operation: {
    dimension1: null,
    dimension2: null,
    dimension3: null,
  },
};

test('buildAnalysisPageViewModel returns per-level data ranges and AI idle summary state', () => {
  const vm = buildAnalysisPageViewModel({
    result: sampleResult,
    integrity: sampleIntegrity,
    aiState: { status: 'idle', summary: null, markdown: null, error: null },
  });

  assert.equal(vm.statusBar.aiStatus.label, '未生成');
  assert.equal(vm.statusBar.dataRanges[0].label, '日线');
  assert.equal(vm.statusBar.dataRanges[0].countLabel, '近 240 根');
  assert.match(vm.statusBar.dataRanges[0].coverageLabel ?? '', /2025-05-12/);
  assert.equal(vm.summary.mode, 'idle');
  assert.equal(vm.summary.primaryActionLabel, '等待');
  assert.equal(vm.summary.hardGates[0].label, '后端最终动作');
  assert.equal(vm.bus.dimensions.length, 3);
  assert.equal(vm.ruleChain.items.length, 6);
});

test('buildAnalysisPageViewModel upgrades summary panel after AI summary arrives', () => {
  const vm = buildAnalysisPageViewModel({
    result: sampleResult,
    integrity: sampleIntegrity,
    aiState: {
      status: 'ready',
      summary: {
        headline: '等待放量突破后轻仓试探',
        action: 'wait',
        bias: 'neutral',
        primary_reason: '日线延伸 C 尚未结束，只能先等突破确认。',
        triggers: ['放量突破平台上沿', '回踩上沿不破'],
        risks: ['量能继续偏弱', '跌回平台下沿'],
        guardrail: '后端仍是等待，AI 不能升级成标准买入。',
      },
      markdown: '## AI 正文\n\n等待确认。',
      error: null,
    },
  });

  assert.equal(vm.summary.mode, 'ready');
  assert.equal(vm.summary.headline, '等待放量突破后轻仓试探');
  assert.deepEqual(vm.summary.triggerLabels, ['放量突破平台上沿', '回踩上沿不破']);
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/trinity-analysis-page-view-model.test.ts`

Expected: FAIL，报错类似 `ERR_MODULE_NOT_FOUND` 或 `buildAnalysisPageViewModel is not a function`

- [ ] **Step 3: 为结构明细补足类型，并实现页面视图模型**

```ts
// src/lib/stock-structure-types.ts
export interface StructureValidRange {
  start_date?: string | null;
  end_date?: string | null;
  start_price?: number | null;
  end_price?: number | null;
  origin_type?: string | null;
  break_type?: string | null;
}

export interface StructurePipelineDebug {
  analysis_kline_count?: number | null;
  processed_kline_count?: number | null;
  valid_range_applied?: boolean | null;
  render_window_size?: number | null;
}

export interface PeriodStructureDetailsData {
  prediction?: StructurePrediction | null;
  top_fractals?: Array<Partial<StructureFractalPoint>> | null;
  bottom_fractals?: Array<Partial<StructureFractalPoint>> | null;
  strokes?: Array<Partial<StructureStroke>> | null;
  render_payload?: Record<string, unknown> | null;
  explainability?: StructureExplainabilityData | null;
  focus_origin_analysis?: StructureFocusOriginAnalysis | null;
  raw_classification?: StructureRawClassification | null;
  focus_classification?: StructureFocusClassification | null;
  valid_range?: StructureValidRange | null;
  pipeline_debug?: StructurePipelineDebug | null;
  [key: string]: unknown;
}
```

```ts
// src/lib/trinity-analysis-page-view-model.ts
import type {
  AiSummaryCard,
  AnalysisResultData,
  TrinityDecision,
} from '@/lib/stock-structure-types';
import type { DataIntegritySnapshot } from '@/lib/stock-data-integrity';

const PERIOD_LABELS: Record<string, string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

const PRIMARY_DECISION_LEVEL_ORDER = ['daily', 'weekly', 'hour60', 'hour30', 'hour15'] as const;
const DISPLAY_LEVEL_ORDER = ['weekly', 'daily', 'hour60', 'hour30', 'hour15'] as const;

const TRADE_MODE_LABELS: Record<TrinityDecision['trade_qualification']['trade_mode'], string> = {
  standard_node_trade: '标准节点交易',
  conditional_boundary_trade: '条件边界交易',
  wait_confirmation: '等待确认',
  risk_control: '风险控制',
  no_trade: '不交易',
};

const POSITION_PERMISSION_LABELS: Record<TrinityDecision['trade_qualification']['position_permission'], string> = {
  full_signal: '完整信号',
  half_position: '半仓以内',
  light_probe: '轻仓试探',
  t_trade_only: '仅做 T',
  reduce_only: '仅减仓',
  no_position: '空仓等待',
};

const MA55_ROLE_LABELS: Record<TrinityDecision['moving_average']['ma55_role'], string> = {
  support: '55线支撑',
  resistance: '55线压制',
  neutral: '55线中性',
};

const BREAKTHROUGH_STATE_LABELS: Record<TrinityDecision['moving_average']['breakthrough_state'], string> = {
  none: '无突破',
  breakout_pending: '突破待确认',
  valid_breakout: '有效突破',
  pullback_confirmed: '回踩确认',
  false_breakout: '假突破',
  breakdown_pending: '跌破待确认',
  valid_breakdown: '有效跌破',
  pullback_breakdown_confirmed: '跌破回抽确认',
  false_breakdown: '假跌破',
};

const VOLUME_STATE_LABELS: Record<TrinityDecision['volume_confirmation']['volume_state'], string> = {
  shrinking: '缩量',
  normal: '量能正常',
  expanding: '放量',
  climax: '放量过热',
  unknown: '量能未知',
};

const BREAKOUT_VOLUME_LABELS: Record<TrinityDecision['volume_confirmation']['breakout_volume'], string> = {
  confirmed: '突破量能确认',
  weak: '突破量能偏弱',
  climax_risk: '突破量能过热风险',
  not_applicable: '无突破量能要求',
};

const PULLBACK_VOLUME_LABELS: Record<TrinityDecision['volume_confirmation']['pullback_volume'], string> = {
  healthy_shrink: '回踩健康缩量',
  danger_expand: '回踩放量风险',
  normal: '回踩量能正常',
  not_applicable: '无回踩量能要求',
};

const ENTRY_STYLE_LABELS: Record<TrinityDecision['execution']['entry_style'], string> = {
  node: '节点型',
  boundary: '边界型',
  pullback: '回踩型',
  breakout: '突破型',
  t_trade: '做 T',
  none: '无执行',
};

type LegacyLevelNesting = {
  dimension1?: {
    weekly_status?: string;
    daily_structure?: string;
    analysis?: string;
  } | null;
  dimension2?: {
    daily_status?: string;
    hour15_structure?: string;
    analysis?: string;
  } | null;
  dimension3?: {
    hour60_status?: string;
    hour15_structure?: string;
    analysis?: string;
  } | null;
} | null;

export interface AnalysisPageAiState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  summary: AiSummaryCard | null;
  markdown: string | null;
  error: string | null;
}

export interface AnalysisPageViewModel {
  statusBar: {
    aiStatus: { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' };
    syncStatus: { label: string; description: string | null };
    dataRanges: Array<{ key: string; label: string; countLabel: string; coverageLabel: string | null; missing: boolean }>;
  };
  summary: {
    mode: 'idle' | 'loading' | 'ready' | 'error';
    headline: string | null;
    primaryActionLabel: string;
    primaryReason: string | null;
    triggerLabels: string[];
    riskLabels: string[];
    guardrail: string | null;
    hardGates: Array<{ label: string; value: string }>;
  };
  bus: {
    dimensions: Array<{ key: string; title: string; majorSignal: string; minorSignal: string; conclusion: string; tradingMeaning: string }>;
  };
  ruleChain: {
    items: Array<{ key: string; title: string; badge: string; reason: string; evidence: string[] }>;
  };
}

function pickPrimaryDecision(result: AnalysisResultData): TrinityDecision | null {
  for (const level of PRIMARY_DECISION_LEVEL_ORDER) {
    const decision = result.periods[level]?.trinity_decision;
    if (decision) {
      return decision;
    }
  }
  return null;
}

function buildDataRanges(result: AnalysisResultData) {
  return DISPLAY_LEVEL_ORDER
    .map((level) => {
      const period = result.periods[level];
      if (!period) {
        return null;
      }
      const details = period?.structure?.structure_details;
      const count = details?.pipeline_debug?.analysis_kline_count ?? null;
      const start = details?.valid_range?.start_date?.slice(0, 10) ?? null;
      const end = details?.valid_range?.end_date?.slice(0, 10) ?? null;
      return {
        key: level,
        label: PERIOD_LABELS[level],
        countLabel: count ? `近 ${count} 根` : '未提供',
        coverageLabel: start && end ? `${start} 至 ${end}` : null,
        missing: count === null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export function buildAnalysisPageViewModel({
  result,
  integrity,
  aiState,
}: {
  result: AnalysisResultData;
  integrity: DataIntegritySnapshot | null;
  aiState: AnalysisPageAiState;
}): AnalysisPageViewModel {
  const decision = pickPrimaryDecision(result);
  if (!decision) {
    throw new Error('缺少可用的三位一体判定');
  }
  const levelNesting = result.level_nesting as LegacyLevelNesting;

  return {
    statusBar: {
      aiStatus: aiState.status === 'ready'
        ? { label: '已生成', tone: 'success' }
        : aiState.status === 'loading'
          ? { label: '生成中', tone: 'warning' }
          : aiState.status === 'error'
            ? { label: '生成失败', tone: 'danger' }
            : { label: '未生成', tone: 'neutral' },
      syncStatus: {
        label: integrity?.summary.overallText ?? '同步状态未提供',
        description: integrity?.summary.analyzeWarning ?? null,
      },
      dataRanges: buildDataRanges(result),
    },
    summary: {
      mode: aiState.status,
      headline: aiState.summary?.headline ?? null,
      primaryActionLabel: decision.conclusion.action_label,
      primaryReason: aiState.summary?.primary_reason ?? decision.conclusion.wait_reason ?? null,
      triggerLabels: aiState.summary?.triggers ?? decision.execution.triggers,
      riskLabels: aiState.summary?.risks ?? decision.execution.risk_flags,
      guardrail: aiState.summary?.guardrail ?? 'AI 只能在后端硬门控范围内生成策略摘要。',
      hardGates: [
        { label: '后端最终动作', value: decision.conclusion.action_label },
        { label: '交易模式', value: TRADE_MODE_LABELS[decision.trade_qualification.trade_mode] },
        { label: '仓位权限', value: POSITION_PERMISSION_LABELS[decision.trade_qualification.position_permission] },
        { label: '结构资格', value: decision.structure.type },
        { label: '聚焦结构', value: decision.structure.type },
        { label: '执行级别', value: PERIOD_LABELS[decision.level] },
        { label: '量能状态', value: decision.volume_confirmation.volume_gate.reason },
        { label: '结论约束', value: decision.trade_qualification.reason.join('；') },
      ],
    },
    bus: {
      dimensions: [
        {
          key: 'dimension1',
          title: '维度一｜周线 → 日线',
          majorSignal: levelNesting?.dimension1?.weekly_status ?? '未提供',
          minorSignal: levelNesting?.dimension1?.daily_structure ?? '未提供',
          conclusion: levelNesting?.dimension1?.analysis ?? '未提供',
          tradingMeaning: '先判断能不能顺大级别做，决定是否允许放大仓位',
        },
        {
          key: 'dimension2',
          title: '维度二｜日线 → 30分钟',
          majorSignal: levelNesting?.dimension2?.daily_status ?? '未提供',
          minorSignal: levelNesting?.dimension2?.hour15_structure ?? '未提供',
          conclusion: levelNesting?.dimension2?.analysis ?? '未提供',
          tradingMeaning: '日线定策略，30分钟只负责触发与回踩确认',
        },
        {
          key: 'dimension3',
          title: '维度三｜60分钟 → 15分钟',
          majorSignal: levelNesting?.dimension3?.hour60_status ?? '未提供',
          minorSignal: levelNesting?.dimension3?.hour15_structure ?? '未提供',
          conclusion: levelNesting?.dimension3?.analysis ?? '未提供',
          tradingMeaning: '15分钟只优化执行点，不改变上级结论',
        },
      ],
    },
    ruleChain: {
      items: [
        { key: 'structure', title: '结构资格', badge: decision.structure.type, reason: decision.structure.explainability.reason, evidence: decision.structure.explainability.evidence.slice(0, 2) },
        { key: 'spacetime', title: 'MACD 时空', badge: decision.spacetime.status, reason: decision.spacetime.mismatch_reason ?? '结构与时空匹配', evidence: [decision.spacetime.divergence_policy.reason] },
        { key: 'ma', title: '55 / 233 线关系', badge: MA55_ROLE_LABELS[decision.moving_average.ma55_role], reason: decision.moving_average.ma_gate.reason, evidence: [BREAKTHROUGH_STATE_LABELS[decision.moving_average.breakthrough_state]] },
        { key: 'volume', title: '量能确认', badge: VOLUME_STATE_LABELS[decision.volume_confirmation.volume_state], reason: decision.volume_confirmation.volume_gate.reason, evidence: [BREAKOUT_VOLUME_LABELS[decision.volume_confirmation.breakout_volume], PULLBACK_VOLUME_LABELS[decision.volume_confirmation.pullback_volume]] },
        { key: 'level', title: '级别权限', badge: decision.level_nesting?.permission.allow_only_light_probe ? '轻仓 / 等待' : '允许放大', reason: decision.level_nesting?.permission.reason ?? '未提供', evidence: [decision.level_nesting?.resonance ?? '未提供'] },
        { key: 'execution', title: '执行计划', badge: ENTRY_STYLE_LABELS[decision.execution.entry_style], reason: decision.execution.position_sizing.reason, evidence: [...decision.execution.triggers.slice(0, 1), ...decision.execution.invalidation.slice(0, 1)] },
      ],
    },
  };
}
```

- [ ] **Step 4: 运行测试，确认视图模型通过**

Run: `node --test tests/trinity-analysis-page-view-model.test.ts`

Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add \
  src/lib/stock-structure-types.ts \
  src/lib/trinity-analysis-page-view-model.ts \
  tests/trinity-analysis-page-view-model.test.ts
git commit -m "实现：新增分析页视图模型与数据范围映射"
```

## Task 2: 实现顶部状态条与综合判断区组件

**Files:**
- Create: `src/components/stock/AnalysisStatusBar.tsx`
- Create: `src/components/stock/AnalysisSummaryPanel.tsx`
- Create: `tests/helpers/tsx-test-loader.ts`
- Test: `tests/analysis-summary-panel.test.ts`

- [ ] **Step 1: 写失败测试，锁定默认态与 AI 结果态文案**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { importTsxComponent } from './helpers/tsx-test-loader';

test('AnalysisSummaryPanel renders manual trigger state before AI request', async () => {
  const { AnalysisSummaryPanel } = await importTsxComponent('src/components/stock/AnalysisSummaryPanel.tsx');

  const html = renderToStaticMarkup(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        mode: 'idle',
        headline: null,
        primaryActionLabel: '等待',
        primaryReason: '等待放量突破平台上沿',
        triggerLabels: ['放量突破 190.40'],
        riskLabels: ['跌回 176.20 下方'],
        guardrail: 'AI 只能在后端硬门控范围内生成策略摘要。',
        hardGates: [
          { label: '后端最终动作', value: '等待' },
          { label: '仓位权限', value: '空仓等待' },
        ],
      },
      onGenerate: () => undefined,
      canGenerate: true,
    })
  );

  assert.match(html, /AI 综合判断尚未生成/);
  assert.match(html, /生成 AI 综合判断/);
  assert.match(html, /后端最终动作/);
  assert.match(html, /等待/);
});

test('AnalysisSummaryPanel renders AI headline and Chinese hard gates after success', async () => {
  const { AnalysisSummaryPanel } = await importTsxComponent('src/components/stock/AnalysisSummaryPanel.tsx');

  const html = renderToStaticMarkup(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        mode: 'ready',
        headline: '等待放量突破后轻仓试探',
        primaryActionLabel: '等待',
        primaryReason: '日线延伸 C 尚未结束。',
        triggerLabels: ['放量突破平台上沿'],
        riskLabels: ['跌回平台下沿'],
        guardrail: 'AI 不能升级为标准买入。',
        hardGates: [
          { label: '后端最终动作', value: '等待' },
          { label: '交易模式', value: '等待确认' },
          { label: '仓位权限', value: '空仓等待' },
        ],
      },
      onGenerate: () => undefined,
      canGenerate: true,
    })
  );

  assert.match(html, /等待放量突破后轻仓试探/);
  assert.match(html, /交易模式/);
  assert.doesNotMatch(html, /wait_confirmation/);
});

test('AnalysisStatusBar renders per-level data ranges instead of a single analysis window label', async () => {
  const { AnalysisStatusBar } = await importTsxComponent('src/components/stock/AnalysisStatusBar.tsx');

  const html = renderToStaticMarkup(
    React.createElement(AnalysisStatusBar, {
      syncStatus: { label: '五个级别数据已齐备', description: null },
      aiStatus: { label: '未生成', tone: 'neutral' },
      dataRanges: [
        { key: 'daily', label: '日线', countLabel: '近 240 根', coverageLabel: '2025-05-12 至 2026-04-17', missing: false },
        { key: 'hour30', label: '30分钟', countLabel: '近 320 根', coverageLabel: '近 20 个交易日', missing: false },
      ],
    })
  );

  assert.match(html, /本次判定使用的数据范围/);
  assert.match(html, /日线/);
  assert.match(html, /近 240 根/);
  assert.doesNotMatch(html, /当前分析窗口/);
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/analysis-summary-panel.test.ts`

Expected: FAIL，报错类似 `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 先写 TSX 测试加载 helper，减少组件测试重复样板**

```ts
// tests/helpers/tsx-test-loader.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const require = createRequire(import.meta.url);

function asDataModule(code: string): string {
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

export async function importTsxComponent(relativePath: string) {
  const filePath = path.resolve(process.cwd(), relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      baseUrl: process.cwd(),
      paths: {
        '@/*': ['src/*'],
      },
    },
    fileName: filePath,
  });

  const reactUrl = pathToFileURL(require.resolve('react')).href;
  const jsxRuntimeUrl = asDataModule(`
    import React from '${reactUrl}';
    export const Fragment = React.Fragment;
    export function jsx(type, props, key) {
      return React.createElement(type, { ...props, key });
    }
    export function jsxs(type, props, key) {
      return React.createElement(type, { ...props, key });
    }
  `);
  const uiStubUrl = asDataModule(`
    import React from '${reactUrl}';
    function slot(tag, name) {
      return function Component({ children, className, ...props }) {
        return React.createElement(tag, { ...props, className, 'data-slot': name }, children);
      };
    }
    export const Card = slot('section', 'card');
    export const CardHeader = slot('header', 'card-header');
    export const CardTitle = slot('h3', 'card-title');
    export const CardContent = slot('div', 'card-content');
    export const Badge = slot('span', 'badge');
    export const Button = slot('button', 'button');
    export const Separator = slot('hr', 'separator');
    export const Accordion = slot('div', 'accordion');
    export const AccordionItem = slot('div', 'accordion-item');
    export const AccordionTrigger = slot('button', 'accordion-trigger');
    export const AccordionContent = slot('div', 'accordion-content');
  `);
  const utilsUrl = asDataModule(`
    export function cn(...values) {
      return values.filter(Boolean).join(' ');
    }
  `);

  const rewritten = transpiled.outputText
    .replaceAll('"react/jsx-runtime"', `'${jsxRuntimeUrl}'`)
    .replaceAll("'react/jsx-runtime'", `'${jsxRuntimeUrl}'`)
    .replaceAll("'@/components/ui/card'", `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/badge'", `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/button'", `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/separator'", `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/accordion'", `'${uiStubUrl}'`)
    .replaceAll("'@/lib/utils'", `'${utilsUrl}'`);

  return import(asDataModule(rewritten));
}
```

- [ ] **Step 4: 实现状态条与综合判断区组件**

```tsx
// src/components/stock/AnalysisStatusBar.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  syncStatus: { label: string; description: string | null };
  aiStatus: { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' };
  dataRanges: Array<{ key: string; label: string; countLabel: string; coverageLabel: string | null; missing: boolean }>;
}

const AI_TONE_CLASS: Record<StatusBarProps['aiStatus']['tone'], string> = {
  neutral: 'bg-muted text-foreground',
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-destructive/10 text-destructive',
};

export function AnalysisStatusBar({ syncStatus, aiStatus, dataRanges }: StatusBarProps) {
  return (
    <Card className="border-border/60 bg-muted/20 shadow-none">
      <CardContent className="grid gap-3 px-4 py-3 lg:grid-cols-[1.2fr_0.8fr_2fr]">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">数据同步状态</div>
          <div className="text-sm font-medium">{syncStatus.label}</div>
          {syncStatus.description ? <div className="text-xs text-muted-foreground">{syncStatus.description}</div> : null}
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">AI 综合判断</div>
          <Badge className={cn('w-fit', AI_TONE_CLASS[aiStatus.tone])}>{aiStatus.label}</Badge>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground">本次判定使用的数据范围</div>
          <div className="flex flex-wrap gap-2">
            {dataRanges.map((item) => (
              <div key={item.key} className="rounded-md border bg-background px-2 py-1 text-xs">
                <div className="font-medium">{item.label}：{item.countLabel}</div>
                {item.coverageLabel ? <div className="text-muted-foreground">{item.coverageLabel}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/components/stock/AnalysisSummaryPanel.tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SummaryPanelProps {
  viewModel: {
    mode: 'idle' | 'loading' | 'ready' | 'error';
    headline: string | null;
    primaryActionLabel: string;
    primaryReason: string | null;
    triggerLabels: string[];
    riskLabels: string[];
    guardrail: string | null;
    hardGates: Array<{ label: string; value: string }>;
  };
  onGenerate: () => void;
  canGenerate: boolean;
}

export function AnalysisSummaryPanel({ viewModel, onGenerate, canGenerate }: SummaryPanelProps) {
  const isReady = viewModel.mode === 'ready';
  const isLoading = viewModel.mode === 'loading';
  const isError = viewModel.mode === 'error';

  return (
    <Card className="border-border/70 bg-background shadow-sm">
      <CardHeader className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <CardTitle className="text-xl font-semibold">
            {isReady ? viewModel.headline : 'AI 综合判断尚未生成'}
          </CardTitle>
          {!isReady ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>页面已先展示后端确定性结论，点击后由 AI 在硬门控范围内生成策略摘要。</p>
              {isError ? <p className="text-destructive">AI 综合判断生成失败，当前展示后端确定性结论。</p> : null}
              <Button onClick={onGenerate} disabled={!canGenerate || isLoading}>
                {isLoading ? 'AI 正在综合三位一体结果，请稍候。' : '生成 AI 综合判断'}
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-semibold text-muted-foreground">当前动作</div>
              <div className="mt-1 text-base font-semibold">{viewModel.primaryActionLabel}</div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-semibold text-muted-foreground">主要原因</div>
              <div className="mt-1 text-sm">{viewModel.primaryReason ?? '未提供'}</div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="text-xs font-semibold text-emerald-700">触发条件</div>
              <ul className="mt-1 space-y-1 text-sm">
                {viewModel.triggerLabels.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
              <div className="text-xs font-semibold text-rose-700">风险条件</div>
              <ul className="mt-1 space-y-1 text-sm">
                {viewModel.riskLabels.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          </div>
          {viewModel.guardrail ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
              {viewModel.guardrail}
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
          <div className="text-xs font-semibold text-muted-foreground">后端硬门控</div>
          {viewModel.hardGates.map((gate) => (
            <div key={gate.label} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
              <span className="text-sm text-muted-foreground">{gate.label}</span>
              <Badge variant="secondary">{gate.value}</Badge>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
```

- [ ] **Step 5: 运行测试，确认组件通过**

Run: `node --test tests/analysis-summary-panel.test.ts`

Expected: PASS

- [ ] **Step 6: 提交本任务**

```bash
git add \
  src/components/stock/AnalysisStatusBar.tsx \
  src/components/stock/AnalysisSummaryPanel.tsx \
  tests/helpers/tsx-test-loader.ts \
  tests/analysis-summary-panel.test.ts
git commit -m "实现：新增分析页状态条与综合判断区组件"
```

## Task 3: 实现级别决策总线、关键规则链与周期详情组件

**Files:**
- Create: `src/components/stock/LevelDecisionBus.tsx`
- Create: `src/components/stock/TrinityRuleChain.tsx`
- Create: `src/components/stock/AnalysisPeriodDetails.tsx`
- Test: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 写失败测试，锁定三维度总线、六段规则链和日线默认展开**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { importTsxComponent } from './helpers/tsx-test-loader';

test('LevelDecisionBus renders three fixed dimensions under summary panel', async () => {
  const { LevelDecisionBus } = await importTsxComponent('src/components/stock/LevelDecisionBus.tsx');

  const html = renderToStaticMarkup(
    React.createElement(LevelDecisionBus, {
      dimensions: [
        { key: 'dimension1', title: '维度一｜周线 → 日线', majorSignal: '周线偏多', minorSignal: '日线延伸C', conclusion: '大方向未破坏，但日线未给标准节点', tradingMeaning: '先等待，不先抢大仓' },
        { key: 'dimension2', title: '维度二｜日线 → 30分钟', majorSignal: '日线等待确认', minorSignal: '30分钟先行触发', conclusion: '30分钟信号不能升级成日线主升结论', tradingMeaning: '只允许轻仓试探' },
        { key: 'dimension3', title: '维度三｜60分钟 → 15分钟', majorSignal: '60分钟偏弱', minorSignal: '15分钟反抽', conclusion: '只负责执行优化', tradingMeaning: '不能改变上级方向' },
      ],
    })
  );

  assert.match(html, /维度一｜周线 → 日线/);
  assert.match(html, /维度二｜日线 → 30分钟/);
  assert.match(html, /维度三｜60分钟 → 15分钟/);
});

test('TrinityRuleChain renders six rule cards with short badges and evidence', async () => {
  const { TrinityRuleChain } = await importTsxComponent('src/components/stock/TrinityRuleChain.tsx');

  const html = renderToStaticMarkup(
    React.createElement(TrinityRuleChain, {
      items: [
        { key: 'structure', title: '结构资格', badge: '延伸 C', reason: '平台点数超限后仅允许边界交易', evidence: ['上沿 190.40', '下沿 176.20'] },
        { key: 'spacetime', title: 'MACD 时空', badge: '中偏强', reason: '仍是偏强等待区', evidence: ['无背离优势'] },
        { key: 'ma', title: '55 / 233 线关系', badge: '55线支撑', reason: '55线尚未失守', evidence: ['突破待确认'] },
        { key: 'volume', title: '量能确认', badge: '量能偏弱', reason: '放量突破尚未成立', evidence: ['突破量能偏弱'] },
        { key: 'level', title: '级别权限', badge: '轻仓 / 等待', reason: '父子级别仍冲突', evidence: ['conflict'] },
        { key: 'execution', title: '执行计划', badge: '突破型', reason: '确认前不允许扩仓', evidence: ['放量突破 190.40'] },
      ],
    })
  );

  assert.match(html, /结构资格/);
  assert.match(html, /级别权限/);
  assert.match(html, /放量突破 190.40/);
});

test('AnalysisPeriodDetails keeps daily section expanded and topology moved into structure evidence area', async () => {
  const { AnalysisPeriodDetails } = await importTsxComponent('src/components/stock/AnalysisPeriodDetails.tsx');

  const html = renderToStaticMarkup(
    React.createElement(AnalysisPeriodDetails, {
      sections: [
        { key: 'daily', label: '日线', defaultOpen: true, summary: '日线延伸 C', rangeLabel: '近 240 根', topologyTitle: '日线拓扑结构图', content: React.createElement('div', null, 'daily-body') },
        { key: 'hour30', label: '30分钟', defaultOpen: false, summary: '30分钟辅助确认', rangeLabel: '近 320 根', topologyTitle: '30分钟拓扑结构图', content: React.createElement('div', null, 'hour30-body') },
      ],
    })
  );

  assert.match(html, /日线拓扑结构图/);
  assert.match(html, /结构证据/);
  assert.match(html, /data-default-open=\"true\"/);
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/analysis-page-sections.test.ts`

Expected: FAIL，报错类似 `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: 实现级别决策总线、规则链和周期详情组件**

```tsx
// src/components/stock/LevelDecisionBus.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LevelDecisionBusProps {
  dimensions: Array<{ key: string; title: string; majorSignal: string; minorSignal: string; conclusion: string; tradingMeaning: string }>;
}

export function LevelDecisionBus({ dimensions }: LevelDecisionBusProps) {
  return (
    <Card className="border-emerald-200/80 bg-emerald-50/40">
      <CardHeader>
        <CardTitle className="text-lg">级别决策总线</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        {dimensions.map((item) => (
          <section key={item.key} className="rounded-xl border bg-background p-4">
            <div className="text-sm font-semibold">{item.title}</div>
            <div className="mt-3 space-y-2 text-sm">
              <div><span className="text-muted-foreground">大级别：</span>{item.majorSignal}</div>
              <div><span className="text-muted-foreground">小级别：</span>{item.minorSignal}</div>
              <div><span className="text-muted-foreground">维度结论：</span>{item.conclusion}</div>
              <div className="rounded-md bg-muted/20 p-2 text-muted-foreground">{item.tradingMeaning}</div>
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/components/stock/TrinityRuleChain.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RuleChainProps {
  items: Array<{ key: string; title: string; badge: string; reason: string; evidence: string[] }>;
}

export function TrinityRuleChain({ items }: RuleChainProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">关键规则链</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 xl:grid-cols-6">
        {items.map((item) => (
          <section key={item.key} className="rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{item.title}</div>
              <Badge variant="secondary">{item.badge}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{item.reason}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {item.evidence.map((entry) => <li key={entry}>- {entry}</li>)}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/components/stock/AnalysisPeriodDetails.tsx
import type { ReactNode } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalysisPeriodDetailsProps {
  sections: Array<{
    key: string;
    label: string;
    defaultOpen: boolean;
    summary: string;
    rangeLabel: string;
    topologyTitle: string;
    content: ReactNode;
  }>;
}

export function AnalysisPeriodDetails({ sections }: AnalysisPeriodDetailsProps) {
  const defaultValue = sections.filter((item) => item.defaultOpen).map((item) => item.key);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">周期详情 / 结构证据 / 复盘排错</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={defaultValue}>
          {sections.map((section) => (
            <AccordionItem key={section.key} value={section.key} data-default-open={section.defaultOpen}>
              <AccordionTrigger>
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium">{section.label}</span>
                  <span className="text-xs text-muted-foreground">{section.summary} · {section.rangeLabel}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <section className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-sm font-semibold">结构证据</div>
                  <div className="mt-2 rounded-lg border bg-background p-3">
                    <div className="text-sm font-medium">{section.topologyTitle}</div>
                  </div>
                </section>
                <section className="rounded-xl border bg-background p-4">
                  {section.content}
                </section>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: 运行测试，确认组件通过**

Run: `node --test tests/analysis-page-sections.test.ts`

Expected: PASS

- [ ] **Step 5: 提交本任务**

```bash
git add \
  src/components/stock/LevelDecisionBus.tsx \
  src/components/stock/TrinityRuleChain.tsx \
  src/components/stock/AnalysisPeriodDetails.tsx \
  tests/analysis-page-sections.test.ts
git commit -m "实现：新增级别总线规则链与周期详情组件"
```

## Task 4: 重构分析页布局并接入手动 AI 摘要

**Files:**
- Modify: `src/app/stock/[code]/analysis/page.tsx`
- Modify: `src/lib/ai-report-contract.ts`（仅在需要补充错误消息时修改）
- Test: `tests/analysis-page-layout-contract.test.ts`

- [ ] **Step 1: 写失败测试，锁定新布局组件接入并阻止旧区块回流**

```ts
import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const pageSource = await fs.readFile('src/app/stock/[code]/analysis/page.tsx', 'utf8');

test('analysis page composes the confirmed IA sections', () => {
  assert.match(pageSource, /AnalysisStatusBar/);
  assert.match(pageSource, /AnalysisSummaryPanel/);
  assert.match(pageSource, /LevelDecisionBus/);
  assert.match(pageSource, /TrinityRuleChain/);
  assert.match(pageSource, /AnalysisPeriodDetails/);
  assert.match(pageSource, /parseAiReportContract/);
});

test('analysis page no longer keeps old first-screen duplicate sections', () => {
  assert.doesNotMatch(pageSource, /AI 智能分析报告/);
  assert.doesNotMatch(pageSource, /多维度跨级别操作建议/);
  assert.doesNotMatch(pageSource, /当前分析窗口/);
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `node --test tests/analysis-page-layout-contract.test.ts`

Expected: FAIL，因为页面还没有引入新布局组件，且仍包含旧版重复区块标题。

- [ ] **Step 3: 在页面中接入新组件和手动 AI 状态**

```tsx
// src/app/stock/[code]/analysis/page.tsx
import { AnalysisPeriodDetails } from '@/components/stock/AnalysisPeriodDetails';
import { AnalysisStatusBar } from '@/components/stock/AnalysisStatusBar';
import { AnalysisSummaryPanel } from '@/components/stock/AnalysisSummaryPanel';
import { LevelDecisionBus } from '@/components/stock/LevelDecisionBus';
import { TrinityRuleChain } from '@/components/stock/TrinityRuleChain';
import { parseAiReportContract } from '@/lib/ai-report-contract';
import { buildAnalysisPageViewModel } from '@/lib/trinity-analysis-page-view-model';
```

```tsx
const [aiSummary, setAiSummary] = useState<AiSummaryCard | null>(null);
const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);

const pageViewModel = useMemo(() => {
  if (!result) return null;
  return buildAnalysisPageViewModel({
    result,
    integrity: integritySnapshot,
    aiState: {
      status: isAiLoading ? 'loading' : aiError ? 'error' : aiSummary ? 'ready' : 'idle',
      summary: aiSummary,
      markdown: aiMarkdown,
      error: aiError,
    },
  });
}, [result, integritySnapshot, isAiLoading, aiError, aiSummary, aiMarkdown]);
```

```tsx
const loadAiAnalysis = async () => {
  if (!result) return;

  setIsAiLoading(true);
  setAiError(null);

  try {
    const response = await fetch('/api/stock/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, analysisData: result }),
    });

    const data = await response.json();
    if (!data.success) {
      setAiSummary(null);
      setAiMarkdown(null);
      setAiError(data.error || 'AI 分析失败');
      return;
    }

    const parsed = parseAiReportContract(data.data.report);
    setAiSummary(parsed.summary);
    setAiMarkdown(parsed.markdown);
    setShowAiReport(true);
  } catch (error) {
    setAiSummary(null);
    setAiMarkdown(null);
    setAiError(error instanceof Error ? error.message : 'AI 分析失败');
  } finally {
    setIsAiLoading(false);
  }
};
```

```tsx
{result && !isLoading && dataIntegrityStatus.canAnalyze && pageViewModel && (
  <div ref={contentRef} className="space-y-4 rounded-lg bg-white p-4">
    <AnalysisStatusBar
      syncStatus={pageViewModel.statusBar.syncStatus}
      aiStatus={pageViewModel.statusBar.aiStatus}
      dataRanges={pageViewModel.statusBar.dataRanges}
    />

    <AnalysisSummaryPanel
      viewModel={pageViewModel.summary}
      onGenerate={loadAiAnalysis}
      canGenerate={!isLoading && !isAiLoading && !!result}
    />

    <LevelDecisionBus dimensions={pageViewModel.bus.dimensions} />

    <TrinityRuleChain items={pageViewModel.ruleChain.items} />

    {aiMarkdown && showAiReport ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 正文</CardTitle>
        </CardHeader>
        <CardContent>
          <Markdown content={aiMarkdown} className="rounded-lg border bg-background/50 p-4" />
        </CardContent>
      </Card>
    ) : null}

    <AnalysisPeriodDetails sections={periodSections} />
  </div>
)}
```

- [ ] **Step 4: 删除旧版重复区块，避免页面信息重复**

```tsx
// 删除以下旧区块的整段 JSX
// 1. 顶部头部右侧的“AI 智能分析”按钮
// 2. 旧版 “AI 智能分析报告” 置顶大卡
// 3. 旧版 “核心结论” 卡片
// 4. 旧版 “多维度跨级别操作建议” 卡片
// 5. 周期卡片中对 TrinityDecisionPanel 的直接渲染
//
// 保留 DataIntegrityAlert、DataSyncTime、StructureExplainabilityPanel，并把它们纳入新层级。
```

- [ ] **Step 5: 运行定向测试与类型检查**

Run:

```bash
node --test \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-summary-panel.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/analysis-page-layout-contract.test.ts \
  tests/ai-report-contract.test.ts
pnpm ts-check
```

Expected:

- `node --test` 全部 PASS
- `pnpm ts-check` 输出 0 error

- [ ] **Step 6: 提交本任务**

```bash
git add \
  src/app/stock/[code]/analysis/page.tsx \
  src/lib/ai-report-contract.ts \
  tests/analysis-page-layout-contract.test.ts \
  tests/analysis-summary-panel.test.ts \
  tests/analysis-page-sections.test.ts
git commit -m "实现：按新IA重构三位一体分析页主布局"
```

## Task 5: 最终验证、手动回归与交付检查

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-trinity-decision-kernel-v2-page-implementation.md`（仅勾选复核，不改需求）

- [ ] **Step 1: 运行完整定向验证**

Run:

```bash
node --test \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-summary-panel.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/analysis-page-layout-contract.test.ts \
  tests/ai-report-contract.test.ts \
  tests/structure-explainability-panel.test.ts \
  tests/prepare-analysis-response.test.ts
pnpm ts-check
```

Expected:

- 所有 `node --test` 用例 PASS
- `pnpm ts-check` PASS

- [ ] **Step 2: 启动本地开发服务器做人工回归**

Run:

```bash
PORT=5001 pnpm dev
```

Manual checks:

- 打开 `http://localhost:5001/stock/300274/analysis`
- 首屏先看到顶部状态条，不再看到“当前分析窗口 / 近 240 根 K 线”统一文案
- 综合判断区默认显示 “AI 综合判断尚未生成” 和 “生成 AI 综合判断” 按钮
- 点击按钮后才请求 AI，并在成功后显示“一句话策略结论 + 主因 + 触发条件 + 风险条件”
- 级别决策总线固定在综合判断区下方
- 旧版拓扑结构图出现在“周期详情 → 结构证据”，默认只展开日线
- 周期详情中不再重复堆叠旧版“核心结论 / 多维度跨级别操作建议”

- [ ] **Step 3: 检查是否仍有旧入口或重复文案残留**

Run:

```bash
rg -n "当前分析窗口|核心结论|多维度跨级别操作建议|AI 智能分析报告" src/app/stock/[code]/analysis/page.tsx src/components/stock
```

Expected:

- `当前分析窗口` 不再出现
- `核心结论` 和 `多维度跨级别操作建议` 不再作为旧卡片标题出现在分析页主路径
- `AI 智能分析报告` 如果保留，只允许作为 AI 正文展开区的辅助标题，而不是首屏主卡标题

- [ ] **Step 4: 提交最终实现**

```bash
git add \
  src/app/stock/[code]/analysis/page.tsx \
  src/components/stock \
  src/lib \
  tests
git commit -m "实现：完成三位一体分析页信息架构重构"
```

## 自审检查

### 规格覆盖

- 顶部状态条与“本次判定使用的数据范围（按级别分别展示）”：Task 1、Task 2、Task 4
- AI 手动触发、默认态 / 加载态 / 失败态 / 成功态：Task 1、Task 2、Task 4
- 后端硬门控全中文：Task 1、Task 2、Task 4
- 级别决策总线固定在综合判断区下方：Task 1、Task 3、Task 4
- 关键规则链六段化：Task 1、Task 3、Task 4
- 旧版拓扑结构图迁移到周期详情 / 结构证据：Task 3、Task 4
- 删除旧版重复区块：Task 4、Task 5

### 占位检查

- 本计划每个步骤都有明确文件、命令、预期结果和提交范围。
- 每个任务都给出具体文件路径、测试文件、运行命令和提交命令。

### 一致性检查

- 主执行级别选择固定由 `buildAnalysisPageViewModel()` 统一挑选，避免页面多处分散判断。
- AI 摘要始终通过 `parseAiReportContract()` 解析，避免页面自己再拆 JSON。
- 顶部状态条的数据范围固定来自 `structure_details.valid_range` / `pipeline_debug`，不再混用总记录数。
