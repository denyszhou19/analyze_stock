# 三位一体综合判断页前端展示重组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改页面大区块位置、不依赖新增后端合同的前提下，完成分析页第一阶段展示重组：让 AI 分析区、交易周期总线、三位一体规则链、周期详情都先按“综合判断 -> 三位一体拆解 -> 执行预案”表达，并恢复所有已命中标签的主视可见性。

**Architecture:** 本计划只覆盖 `2026-04-21-trinity-analysis-page-judgment-display-design.md` 的第一阶段前端展示重组，不实现第 8.3 节定义的后端新增字段。实现方式是：先新增一个轻量的展示推导 helper，统一推导 `严格等待 / 候选可试 / 确认执行`、父子关系短句与执行预案；再扩展统一标签层和页面 view model；最后逐块更新 UI 组件与契约测试，保持页面骨架不变。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, node:test, pnpm

---

## 范围说明

本计划只实现前端第一阶段：

- 标签全展示、按顺序混排
- 恢复背离与完整突破/跌破家族到主视区
- 页面 4 个核心区块改成新的表达顺序
- AI 分析区保留原位置，但升级表达能力

本计划**不**包含：

- `scripts/stock_analyzer.py` 改动
- `TrinityDecision` / `PeriodAnalysisData` 后端新增字段
- 零轴金叉/死叉、候选结构、指标共振的后端显式合同补齐

后端合同补齐需在本计划完成并稳定后，另起第二份计划。

## 文件边界

### 新建文件

- `src/lib/trinity-judgment-display.ts`
  - 统一推导前端第一阶段可稳定得出的展示结论：当前综合判断、父子关系短句、执行预案短句、单周期摘要短句。
- `tests/trinity-judgment-display.test.ts`
  - 覆盖展示 helper 的判断分档、父子关系中文短句、执行摘要文案。

### 修改文件

- `src/lib/trinity-signal-tags.ts`
  - 扩展标签类型，补入级别/执行标签；增加统一排序与去重函数；保留 period 优先覆盖 decision 的突破风险逻辑。
- `src/lib/trinity-analysis-page-view-model.ts`
  - 引入新的展示 helper；去掉总线与规则链上的标签截断；为 AI 区、总线、规则链补充新的展示字段。
- `src/components/stock/SignalTagList.tsx`
  - 允许标签多行换行，继续使用 tooltip，但不负责补全被裁掉的标签。
- `src/components/stock/AnalysisSummaryPanel.tsx`
  - 保留区块位置，改为显示“当前综合判断 / 父子关系 / 时空怎么看 / 结构怎么看 / 现在怎么做”。
- `src/components/stock/TradingCycleBus.tsx`
  - 保留三张组合卡骨架，改为展示综合判断、父子关系、一句三位一体摘要、一句动作建议和全部标签。
- `src/components/stock/TrinityRuleChain.tsx`
  - 每张规则卡先显示 `限制 / 放行 / 观察`，再给一句解释和一句交易含义，保留 tooltip 解释层。
- `src/components/stock/AnalysisPeriodDetails.tsx`
  - 顶部结论头新增当前综合判断、父子关系、全部标签、时空摘要、结构摘要、执行摘要；去掉摘要标签截断。

### 修改测试

- `tests/trinity-signal-tags.test.ts`
- `tests/trinity-analysis-page-view-model.test.ts`
- `tests/analysis-summary-panel.test.ts`
- `tests/analysis-page-sections.test.ts`

### 验证命令

- `node --test tests/trinity-judgment-display.test.ts`
- `node --test tests/trinity-signal-tags.test.ts`
- `node --test tests/trinity-analysis-page-view-model.test.ts`
- `node --test tests/analysis-summary-panel.test.ts`
- `node --test tests/analysis-page-sections.test.ts`
- `node --test tests/analysis-page-layout-contract.test.ts`
- `pnpm ts-check`

---

### Task 1: 新增统一展示推导 helper

**Files:**
- Create: `src/lib/trinity-judgment-display.ts`
- Test: `tests/trinity-judgment-display.test.ts`

- [ ] **Step 1: 先写 helper 契约测试，锁定三档综合判断与父子关系短句**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrinityDecision } from '../src/lib/stock-structure-types.ts';

const {
  resolveJudgmentLabel,
  resolveRelationLabel,
  buildExecutionPreview,
} = await import(new URL('../src/lib/trinity-judgment-display.ts', import.meta.url).href);

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
      wait_reason: '等待 30 分钟确认触发',
    },
    structure: {
      family: 'standard',
      type: 'C单平台式',
      qualification: 'standard',
      direction: 'up',
      boundaries: {},
      node_map: {},
      can_trade_by_structure_nodes: false,
      can_trade_by_boundaries: true,
      explainability: { status: 'passed', reason: '平台成立', evidence: ['边界清晰'] },
    } as TrinityDecision['structure'],
    spacetime: {
      status: '中偏强',
      direction_bias: 'bullish',
      expected_structures: { up: ['C单平台式'], down: ['D三段式'] },
      structure_match: true,
      mismatch_reason: null,
      divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: '无背离破坏' },
    },
    moving_average: {
      ma55_role: 'support',
      ma233_role: 'support',
      price_position: { above_ma55: true, above_ma233: true },
      breakthrough_state: 'breakout_pending',
      ma_gate: { allow_long: true, allow_short: false, reason: '等待突破确认' },
    },
    volume_confirmation: {
      volume_state: 'normal',
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
      child_signal: 'long',
      resonance: 'child_countertrend',
      permission: {
        allow_position_increase: false,
        allow_t_trade: true,
        allow_only_light_probe: true,
        reason: '父级未完全放行',
      },
    },
    trade_qualification: {
      trade_mode: 'wait_confirmation',
      position_permission: 'light_probe',
      confidence: 'medium',
      reason: ['等待确认'],
    },
    execution: {
      entry_style: 'pullback',
      triggers: ['30分钟重新站上平台上沿'],
      invalidation: ['30分钟跌回平台下沿'],
      confirmation: ['30分钟放量确认突破有效'],
      position_sizing: { max_ratio: 0.2, reason: '先轻仓试探' },
      risk_flags: ['确认失败重新等待'],
    },
    judgment_criteria: [],
    ai_summary_facts: [],
  };

  return { ...base, ...overrides };
}

test('resolveJudgmentLabel returns 候选可试 for light probe setups', () => {
  assert.equal(resolveJudgmentLabel(createDecision()), '候选可试');
});

test('resolveJudgmentLabel returns 确认执行 for tradable full-signal setups', () => {
  const decision = createDecision({
    conclusion: { action: 'buy', action_label: '买入', bias: 'bullish', confidence: 'high', can_trade: true },
    trade_qualification: {
      trade_mode: 'standard_node_trade',
      position_permission: 'full_signal',
      confidence: 'high',
      reason: ['信号完整'],
    },
  });
  assert.equal(resolveJudgmentLabel(decision), '确认执行');
});

test('resolveRelationLabel returns agreed Chinese phrasing', () => {
  assert.equal(resolveRelationLabel(createDecision().level_nesting), '父级强冲突，子级逆父级');
  assert.equal(
    resolveRelationLabel({
      ...createDecision().level_nesting!,
      resonance: 'aligned',
      permission: { allow_position_increase: true, allow_t_trade: true, allow_only_light_probe: false, reason: '父子顺势共振' },
    }),
    '父级支持，子级顺父级'
  );
});

test('buildExecutionPreview exposes probe confirm and invalidation copy', () => {
  assert.deepEqual(buildExecutionPreview(createDecision()), {
    probeEntry: '30分钟重新站上平台上沿',
    confirmEntry: '30分钟放量确认突破有效',
    invalidation: '30分钟跌回平台下沿',
  });
});
```

- [ ] **Step 2: 运行新测试，先确认它失败**

Run: `node --test tests/trinity-judgment-display.test.ts`

Expected: FAIL，报错 `Cannot find module '../src/lib/trinity-judgment-display.ts'` 或导出函数不存在。

- [ ] **Step 3: 写最小 helper 实现，统一推导综合判断、父子关系与执行预览**

```ts
import type { TrinityDecision } from '@/lib/stock-structure-types';

export type JudgmentLabel = '严格等待' | '候选可试' | '确认执行';

export function resolveJudgmentLabel(decision?: TrinityDecision | null): JudgmentLabel {
  if (!decision) {
    return '严格等待';
  }

  if (
    decision.conclusion.can_trade &&
    (decision.trade_qualification.position_permission === 'full_signal' ||
      decision.trade_qualification.position_permission === 'half_position')
  ) {
    return '确认执行';
  }

  if (
    decision.trade_qualification.position_permission === 'light_probe' ||
    decision.trade_qualification.position_permission === 't_trade_only' ||
    decision.moving_average.breakthrough_state === 'breakout_pending' ||
    decision.moving_average.breakthrough_state === 'breakdown_pending'
  ) {
    return '候选可试';
  }

  return '严格等待';
}

export function resolveRelationLabel(
  levelNesting?: TrinityDecision['level_nesting'] | null
): string {
  if (!levelNesting) {
    return '父级未明，子级先看确认';
  }

  if (levelNesting.resonance === 'aligned') {
    return '父级支持，子级顺父级';
  }

  if (levelNesting.resonance === 'child_countertrend' || levelNesting.resonance === 'conflict') {
    return '父级强冲突，子级逆父级';
  }

  return '父级未明，子级先看确认';
}

export function buildExecutionPreview(decision?: TrinityDecision | null) {
  return {
    probeEntry: decision?.execution.triggers?.[0] ?? '继续等待触发',
    confirmEntry: decision?.execution.confirmation?.[0] ?? '等待进一步确认',
    invalidation: decision?.execution.invalidation?.[0] ?? '若条件失效则取消',
  };
}
```

- [ ] **Step 4: 再跑一次 helper 测试，确认全部通过**

Run: `node --test tests/trinity-judgment-display.test.ts`

Expected: PASS，4 条测试全部通过。

- [ ] **Step 5: 提交 helper 基线**

```bash
git add src/lib/trinity-judgment-display.ts tests/trinity-judgment-display.test.ts
git commit -m "实现：补充综合判断展示推导 helper"
```

---

### Task 2: 扩展统一标签层并去掉标签截断依赖

**Files:**
- Modify: `src/lib/trinity-signal-tags.ts`
- Test: `tests/trinity-signal-tags.test.ts`

- [ ] **Step 1: 先写失败测试，锁定级别/执行标签和稳定排序**

```ts
test('buildDecisionSignalTags includes level and execution tags in mixed ordered output', () => {
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
});

test('buildDecisionSignalTags still supports explicit max but keeps order stable', () => {
  const tags = signalTags.buildDecisionSignalTags(createDecision(), { max: 4 });
  assert.deepEqual(tags.map((tag) => tag.label), [
    '时空｜中偏强',
    '突破/跌破｜突破候选',
    '量能｜突破量弱',
    '均线｜MA55支撑',
  ]);
});
```

- [ ] **Step 2: 运行标签测试，确认新断言先失败**

Run: `node --test tests/trinity-signal-tags.test.ts`

Expected: FAIL，现有输出不包含 `级别｜子级逆势` 和 `执行｜回踩执行`。

- [ ] **Step 3: 扩展标签层，增加级别/执行标签与统一排序工具**

```ts
export interface TrinitySignalTag {
  key:
    | 'spacetime'
    | 'breakthrough'
    | 'volume'
    | 'moving_average'
    | 'structure'
    | 'divergence'
    | 'level_nesting'
    | 'execution';
  category: '时空' | '突破/跌破' | '量能' | '均线' | '结构' | '背离' | '级别' | '执行';
  result: string;
  label: string;
  tone: SignalTagTone;
  hover: SignalTagHover;
}

const TAG_ORDER: TrinitySignalTag['key'][] = [
  'spacetime',
  'divergence',
  'breakthrough',
  'volume',
  'moving_average',
  'structure',
  'level_nesting',
  'execution',
];

function levelNestingLabel(decision?: TrinityDecision | null): string {
  switch (decision?.level_nesting?.resonance) {
    case 'aligned':
      return '共振一致';
    case 'child_countertrend':
      return '子级逆势';
    case 'conflict':
      return '级别冲突';
    case 'parent_unclear':
      return '父级不明';
    default:
      return '';
  }
}

function executionLabel(decision?: TrinityDecision | null): string {
  switch (decision?.execution.entry_style) {
    case 'pullback':
      return '回踩执行';
    case 'breakout':
      return '突破执行';
    case 't_trade':
      return 'T交易';
    case 'node':
      return '节点执行';
    default:
      return decision?.conclusion.can_trade ? '执行跟踪' : '等待触发';
  }
}

function sortSignalTags(tags: TrinitySignalTag[]): TrinitySignalTag[] {
  return [...tags].sort((a, b) => TAG_ORDER.indexOf(a.key) - TAG_ORDER.indexOf(b.key));
}

export function buildDecisionSignalTags(
  decision?: TrinityDecision | null,
  options?: BuildSignalTagOptions
): TrinitySignalTag[] {
  if (!decision) {
    return [];
  }

  const tags = sortSignalTags([
    buildTag('spacetime', '时空', decision.spacetime.status, decision.spacetime.direction_bias, [
      { label: '结构匹配', value: decision.spacetime.structure_match ? '时空与结构匹配' : decision.spacetime.mismatch_reason },
      { label: '背离策略', value: decision.spacetime.divergence_policy.reason },
    ]),
    buildTag('breakthrough', '突破/跌破', breakthroughDecisionLabel(decision.moving_average.breakthrough_state), breakthroughDecisionTone(decision.moving_average.breakthrough_state), [
      { label: '说明', value: decision.moving_average.ma_gate.reason },
    ]),
    buildTag('volume', '量能', breakoutVolumeLabel(decision.volume_confirmation.breakout_volume), breakoutVolumeTone(decision.volume_confirmation.breakout_volume), [
      { label: '说明', value: decision.volume_confirmation.volume_gate.reason },
    ]),
    buildTag('moving_average', '均线', maRoleLabel(decision.moving_average.ma55_role), maRoleTone(decision.moving_average.ma55_role), [
      { label: '说明', value: decision.moving_average.ma_gate.reason },
    ]),
    buildTag('structure', '结构', structureLabel(decision.structure.type), 'neutral', [
      { label: '说明', value: decision.structure.explainability.reason },
    ]),
    buildTag('level_nesting', '级别', levelNestingLabel(decision), 'neutral', [
      { label: '说明', value: decision.level_nesting?.permission.reason },
    ]),
    buildTag('execution', '执行', executionLabel(decision), 'neutral', [
      { label: '先手点', value: decision.execution.triggers?.[0] },
      { label: '确认点', value: decision.execution.confirmation?.[0] },
      { label: '失效点', value: decision.execution.invalidation?.[0] },
    ]),
  ].filter((tag): tag is TrinitySignalTag => Boolean(tag)));

  return applyMax(tags, options);
}
```

- [ ] **Step 4: 跑标签测试，确认现有与新增断言都通过**

Run: `node --test tests/trinity-signal-tags.test.ts`

Expected: PASS，现有周期标签测试仍过，新标签排序测试通过。

- [ ] **Step 5: 提交标签层改动**

```bash
git add src/lib/trinity-signal-tags.ts tests/trinity-signal-tags.test.ts
git commit -m "实现：扩展三位一体统一信号标签层"
```

---

### Task 3: 重组分析页 view model，去掉总线与规则链的标签截断

**Files:**
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Test: `tests/trinity-analysis-page-view-model.test.ts`

- [ ] **Step 1: 先写 view model 失败测试，锁定新字段和不截断标签**

```ts
test('buildAnalysisPageViewModel exposes judgment relation and full mixed tags for trading combinations', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');
  assert.ok(shortline);
  assert.equal(shortline.judgmentLabel, '候选可试');
  assert.equal(shortline.relationLabel, '父级强冲突，子级逆父级');
  assert.deepEqual(shortline.signalTags.map((tag) => tag.label), [
    '时空｜中偏强',
    '突破/跌破｜有效突破',
    '量能｜突破量弱',
    '均线｜MA55支撑',
    '结构｜A五段式',
    '级别｜子级逆势',
    '执行｜回抽确认执行',
  ]);
});

test('buildAnalysisPageViewModel enriches AI summary with triad display lines', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  assert.equal(vm.summary.judgmentLabel, '候选可试');
  assert.match(vm.summary.relationLabel, /父级/);
  assert.match(vm.summary.spacetimeSummary, /时空/);
  assert.match(vm.summary.structureSummary, /结构/);
  assert.match(vm.summary.executionSummary, /先手点|确认点/);
});

test('buildAnalysisPageViewModel keeps level and execution tags visible in rule chain', () => {
  const vm = buildAnalysisPageViewModel({
    result: createResult(),
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const levelRule = vm.ruleChain.items.find((item) => item.title === '级别权限');
  const executionRule = vm.ruleChain.items.find((item) => item.title === '执行计划');

  assert.ok(levelRule);
  assert.ok(executionRule);
  assert.ok(levelRule.signalTags.some((tag) => tag.label === '级别｜子级逆势'));
  assert.ok(executionRule.signalTags.some((tag) => tag.label === '执行｜回抽确认执行'));
});
```

- [ ] **Step 2: 运行 view model 测试，确认新断言失败**

Run: `node --test tests/trinity-analysis-page-view-model.test.ts`

Expected: FAIL，原因是 `judgmentLabel` / `relationLabel` / `spacetimeSummary` 等字段不存在，且总线标签仍被 `.slice(0, 3)` 截断。

- [ ] **Step 3: 引入展示 helper，扩展 view model 字段并去掉组合标签截断**

```ts
import {
  buildExecutionPreview,
  resolveJudgmentLabel,
  resolveRelationLabel,
} from '@/lib/trinity-judgment-display';

export interface AnalysisPageSummaryViewModel {
  mode: AnalysisPageAiState['status'];
  errorMessage?: string | null;
  headline: string;
  primaryActionLabel: string;
  primaryReason: string;
  triggerLabels: string[];
  riskLabels: string[];
  guardrail: string;
  hardGateTitle: string;
  hardGateSourceLabel: string;
  hardGates: AnalysisPageSummaryGate[];
  judgmentLabel: string;
  relationLabel: string;
  spacetimeSummary: string;
  structureSummary: string;
  executionSummary: string;
  signalTags: AnalysisPageSignalTagViewModel[];
}

export interface AnalysisPageTradingCombinationViewModel {
  key: TradingCombinationKey;
  label: string;
  levels: [TrinityLevel, TrinityLevel];
  direction: DirectionTone;
  directionLabel: string;
  actionLabel: string;
  judgmentLabel: string;
  relationLabel: string;
  summary: string;
  recommendation: string;
  signalTags: AnalysisPageSignalTagViewModel[];
  parentConstraint: AnalysisPageExplainableField;
  triggerLevel: AnalysisPageExplainableField;
  suitableAction: AnalysisPageExplainableField;
  majorRisk: AnalysisPageExplainableField;
  explanation: string;
}

function buildCombinationSignalTags(
  major: TrinityDecision | null,
  minor: TrinityDecision | null
): AnalysisPageSignalTagViewModel[] {
  const majorTags = buildDecisionSignalTags(major);
  const minorTags = buildDecisionSignalTags(minor).filter(
    (tag) => !majorTags.some((majorTag) => majorTag.key === tag.key && majorTag.label === tag.label)
  );
  return [...majorTags, ...minorTags];
}

function buildTradingCombination(/* ... */): BuiltTradingCombination {
  const relationLabel = resolveRelationLabel(minor?.level_nesting ?? major?.level_nesting);
  return {
    /* existing fields */
    judgmentLabel: resolveJudgmentLabel(minor ?? major),
    relationLabel,
    summary: buildCombinationSummary(majorLevel, minorLevel, major, minor),
    recommendation: buildCombinationRecommendation(majorLevel, major, minor),
    signalTags: buildCombinationSignalTags(major, minor),
    /* ... */
  };
}

function buildSummary(/* ... */): AnalysisPageSummaryViewModel {
  const preview = buildExecutionPreview(primaryDecision);
  return {
    /* existing fields */
    judgmentLabel: resolveJudgmentLabel(primaryDecision),
    relationLabel: resolveRelationLabel(primaryDecision.level_nesting),
    spacetimeSummary: `时空：${primaryDecision.spacetime.status}，${primaryDecision.spacetime.divergence_policy.reason}`,
    structureSummary: `结构：正式${primaryDecision.structure.type}，等待更明确确认`,
    executionSummary: `现在怎么做：先看${preview.probeEntry}，确认看${preview.confirmEntry}，失效看${preview.invalidation}`,
    signalTags: buildDecisionSignalTags(primaryDecision),
  };
}
```

- [ ] **Step 4: 重新跑 view model 测试，确认新字段和完整标签通过**

Run: `node --test tests/trinity-analysis-page-view-model.test.ts`

Expected: PASS，新增断言通过，已有 hover 断言与规则卡断言保持通过。

- [ ] **Step 5: 提交 view model 重组**

```bash
git add src/lib/trinity-analysis-page-view-model.ts tests/trinity-analysis-page-view-model.test.ts
git commit -m "实现：重组三位一体分析页展示 view model"
```

---

### Task 4: 更新 AI 区、总线、规则链与标签列表组件

**Files:**
- Modify: `src/components/stock/SignalTagList.tsx`
- Modify: `src/components/stock/AnalysisSummaryPanel.tsx`
- Modify: `src/components/stock/TradingCycleBus.tsx`
- Modify: `src/components/stock/TrinityRuleChain.tsx`
- Test: `tests/analysis-summary-panel.test.ts`
- Test: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 先写组件失败测试，锁定新的主信息结构**

```ts
test('AnalysisSummaryPanel renders judgment relation triad lines and mixed tags', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule('src/components/stock/AnalysisSummaryPanel.tsx');

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        judgmentLabel: '候选可试',
        relationLabel: '父级支持，子级顺父级',
        spacetimeSummary: '时空怎么看：日线中偏强，等待零轴附近二次确认',
        structureSummary: '结构怎么看：正式 C 单平台，当前更像 D 候选',
        executionSummary: '现在怎么做：先轻仓试，突破确认后再加',
        signalTags: [
          {
            key: 'spacetime',
            category: '时空',
            result: '中偏强',
            label: '时空｜中偏强',
            tone: 'bullish',
            hover: { title: '时空｜中偏强', items: [{ label: '结论', value: '中偏强' }] },
          },
          {
            key: 'breakthrough',
            category: '突破/跌破',
            result: '突破候选',
            label: '突破/跌破｜突破候选',
            tone: 'warning',
            hover: { title: '突破/跌破｜突破候选', items: [{ label: '结论', value: '突破候选' }] },
          },
          {
            key: 'divergence',
            category: '背离',
            result: '顶背离',
            label: '背离｜顶背离',
            tone: 'bearish',
            hover: { title: '背离｜顶背离', items: [{ label: '结论', value: '顶背离' }] },
          },
        ],
      },
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /候选可试/);
  assert.match(html, /父级支持，子级顺父级/);
  assert.match(html, /时空怎么看/);
  assert.match(html, /结构怎么看/);
  assert.match(html, /现在怎么做/);
  assert.match(html, /背离｜顶背离/);
});

test('TradingCycleBus renders judgment relation and all mixed tags without truncation', async () => {
  const { TradingCycleBus } = await importTsxModule('src/components/stock/TradingCycleBus.tsx');
  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'bullish',
          directionLabel: '偏多',
          actionLabel: '候选可试',
          judgmentLabel: '候选可试',
          relationLabel: '父级强冲突，子级逆父级',
          summary: '日线还没完全放行，30分钟先看确认',
          recommendation: '先轻仓试，确认后再加',
          signalTags: [
            { key: 'spacetime', category: '时空', result: '中偏强', label: '时空｜中偏强', tone: 'bullish', hover: { title: '时空｜中偏强', items: [{ label: '结论', value: '中偏强' }] } },
            { key: 'breakthrough', category: '突破/跌破', result: '有效突破', label: '突破/跌破｜有效突破', tone: 'bullish', hover: { title: '突破/跌破｜有效突破', items: [{ label: '结论', value: '有效突破' }] } },
            { key: 'volume', category: '量能', result: '突破量弱', label: '量能｜突破量弱', tone: 'warning', hover: { title: '量能｜突破量弱', items: [{ label: '结论', value: '突破量弱' }] } },
            { key: 'moving_average', category: '均线', result: 'MA55支撑', label: '均线｜MA55支撑', tone: 'bullish', hover: { title: '均线｜MA55支撑', items: [{ label: '结论', value: 'MA55支撑' }] } },
            { key: 'structure', category: '结构', result: 'A五段式', label: '结构｜A五段式', tone: 'neutral', hover: { title: '结构｜A五段式', items: [{ label: '结论', value: 'A五段式' }] } },
            { key: 'level_nesting', category: '级别', result: '子级逆势', label: '级别｜子级逆势', tone: 'warning', hover: { title: '级别｜子级逆势', items: [{ label: '结论', value: '子级逆势' }] } },
            { key: 'execution', category: '执行', result: '回抽确认执行', label: '执行｜回抽确认执行', tone: 'neutral', hover: { title: '执行｜回抽确认执行', items: [{ label: '结论', value: '回抽确认执行' }] } },
          ],
          parentConstraint: {
            label: '父级约束',
            value: '日线等待结构边界确认',
            hoverTitle: '父级约束说明',
            hoverItems: [{ label: '这句话是什么意思', value: '父级还没完全放行' }],
          },
          triggerLevel: {
            label: '触发级别',
            value: '30分钟：等回抽突破确认',
            hoverTitle: '触发级别说明',
            hoverItems: [{ label: '现在盯什么', value: '等 30 分钟确认' }],
          },
          suitableAction: {
            label: '适合动作',
            value: '轻仓试，确认后加',
            hoverTitle: '适合动作说明',
            hoverItems: [{ label: '满足后怎么做', value: '确认后再加仓' }],
          },
          majorRisk: {
            label: '主要风险',
            value: '30分钟跌回平台下沿',
            hoverTitle: '主要风险说明',
            hoverItems: [{ label: '什么情况取消', value: '跌回平台下沿则取消' }],
          },
          explanation: '先看子级确认，不直接放大动作',
        },
      ] as any,
    })
  );

  assert.match(html, /候选可试/);
  assert.match(html, /父级强冲突，子级逆父级/);
  assert.match(html, /执行｜回抽确认执行/);
});
```

- [ ] **Step 2: 跑组件测试，确认新 UI 断言先失败**

Run: `node --test tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts`

Expected: FAIL，当前 `AnalysisSummaryPanel` 不存在三条摘要，`TradingCycleBus` 仍只显示旧的状态 badge 和被裁掉的标签。

- [ ] **Step 3: 改组件实现，保留骨架但升级主内容**

```tsx
// src/components/stock/SignalTagList.tsx
export function SignalTagList({ tags }: SignalTagListProps) {
  if (!tags.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const toneMeta = getSignalTagToneMeta(tag.tone);
        return (
          <Tooltip key={`${tag.key}-${tag.label}`}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn('cursor-help whitespace-normal break-words text-left leading-5', toneMeta.badgeClassName)}
              >
                {tag.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-sm leading-6">
              <div className="space-y-1">
                <div className="font-medium">{tag.hover.title}</div>
                {tag.hover.items.map((item) => (
                  <p key={`${tag.key}-${item.label}`}>
                    {item.label}：{item.value}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
```

```tsx
// src/components/stock/AnalysisSummaryPanel.tsx
<section className="rounded-xl border bg-background/70 p-4">
  <div className="text-xs text-muted-foreground">{isReady ? 'AI 结论' : '后端当前结论'}</div>
  <div className="mt-2 flex flex-wrap gap-2">
    <Badge variant="outline">{viewModel.judgmentLabel}</Badge>
    <Badge variant="outline">{viewModel.relationLabel}</Badge>
  </div>
  <h2 className="mt-3 text-xl font-semibold leading-snug">{viewModel.headline}</h2>
  <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
    <p>{viewModel.spacetimeSummary}</p>
    <p>{viewModel.structureSummary}</p>
    <p>{viewModel.executionSummary}</p>
  </div>
  <div className="mt-4">
    <SignalTagList tags={viewModel.signalTags} />
  </div>
</section>
```

```tsx
// src/components/stock/TradingCycleBus.tsx
<CardContent className="space-y-3 px-4 text-sm">
  <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className={directionMeta.badgeClassName}>
        {combination.judgmentLabel}
      </Badge>
      <Badge variant="outline">{combination.relationLabel}</Badge>
    </div>
    <p className="leading-6 text-foreground">{combination.summary}</p>
    <p className="leading-6 text-muted-foreground">{combination.recommendation}</p>
  </div>

  <SignalTagList tags={combination.signalTags} />

  <div className="grid gap-2 text-xs text-muted-foreground">
    <ExplainableFact fact={combination.parentConstraint} />
    <ExplainableFact fact={combination.triggerLevel} />
    <ExplainableFact fact={combination.suitableAction} />
    <ExplainableFact fact={combination.majorRisk} />
  </div>
</CardContent>
```

```tsx
// src/components/stock/TrinityRuleChain.tsx
<CardContent className="space-y-2 px-4 text-sm leading-6 text-muted-foreground">
  <p className="text-foreground">当前状态：{item.displayStatusLabel}</p>
  <p className="text-foreground">{item.summary}</p>
  <p>{item.recommendation}</p>
  <SignalTagList tags={item.signalTags} />
  <p className="text-xs text-foreground/75">判定依据：{item.statusExplanation.reason}</p>
</CardContent>
```

- [ ] **Step 4: 重跑组件测试，确认新的主信息结构通过**

Run: `node --test tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts`

Expected: PASS，AI 区出现新的三条摘要，总线卡出现综合判断/父子关系与完整标签，规则链测试仍通过。

- [ ] **Step 5: 提交组件层改动**

```bash
git add src/components/stock/SignalTagList.tsx src/components/stock/AnalysisSummaryPanel.tsx src/components/stock/TradingCycleBus.tsx src/components/stock/TrinityRuleChain.tsx tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts
git commit -m "实现：升级分析页核心区块展示文案"
```

---

### Task 5: 重做周期详情顶部结论头并恢复完整标签

**Files:**
- Modify: `src/components/stock/AnalysisPeriodDetails.tsx`
- Test: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 先补周期详情失败测试，锁定顶部结论头与完整标签输出**

```ts
test('AnalysisPeriodDetails renders judgment header with relation summaries and mixed tags', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule('src/components/stock/AnalysisPeriodDetails.tsx');

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'daily',
      sections: [
        {
          key: 'daily',
          label: '日线',
          defaultOpen: true,
          summary: '日线等待 30 分钟触发',
          period: {
            period: 'daily',
            macd: {
              status: '中偏弱',
              description: '等待零轴附近二次确认',
              divergence_note: '注意顶背离',
            },
            breakthrough: {
              pattern_type: '假突破',
              direction: 'up',
              is_valid: false,
              key_signals: ['冲高后回落'],
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
                wait_reason: '等待 30 分钟触发',
              },
              structure: {
                family: 'standard',
                type: 'C单平台式',
                qualification: 'standard',
                direction: 'up',
                boundaries: {},
                node_map: {},
                can_trade_by_structure_nodes: false,
                can_trade_by_boundaries: true,
                explainability: { status: 'passed', reason: '日线平台成立', evidence: ['边界仍待确认'] },
              },
              spacetime: {
                status: '中偏弱',
                direction_bias: 'neutral',
                expected_structures: { up: ['C单平台式'], down: ['D三段式'] },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: true,
                  bottom_divergence_valid: false,
                  reason: '注意顶背离',
                },
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: { above_ma55: true, above_ma233: false },
                breakthrough_state: 'breakout_pending',
                ma_gate: { allow_long: false, allow_short: false, reason: '等待突破确认' },
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
              level_nesting: {
                parent_level: 'weekly',
                child_level: 'daily',
                parent_bias: 'bullish',
                child_signal: 'wait',
                resonance: 'child_countertrend',
                permission: {
                  allow_position_increase: false,
                  allow_t_trade: true,
                  allow_only_light_probe: true,
                  reason: '周线未完全放行',
                },
              },
              trade_qualification: {
                trade_mode: 'wait_confirmation',
                position_permission: 'light_probe',
                confidence: 'medium',
                reason: ['等待确认'],
              },
              execution: {
                entry_style: 'pullback',
                triggers: ['30分钟重新站上平台上沿'],
                invalidation: ['30分钟跌回平台下沿'],
                confirmation: ['30分钟放量确认突破有效'],
                position_sizing: { max_ratio: 0.2, reason: '先轻仓试探' },
                risk_flags: ['确认失败重新等待'],
              },
              judgment_criteria: [],
              ai_summary_facts: [],
            } as any,
            structure: {
              structure_type: 'C单平台式',
              description: '日线平台边界仍待确认',
            },
          } as any,
        },
      ],
    })
  );

  assert.match(html, /当前综合判断/);
  assert.match(html, /父级强冲突，子级逆父级/);
  assert.match(html, /背离｜顶背离/);
  assert.match(html, /突破\/跌破｜假突破风险/);
  assert.match(html, /时空摘要/);
  assert.match(html, /结构摘要/);
  assert.match(html, /执行摘要/);
  assert.match(html, /先手点/);
  assert.match(html, /确认点/);
  assert.match(html, /失效点/);
});
```

- [ ] **Step 2: 运行周期详情测试，确认新断言失败**

Run: `node --test tests/analysis-page-sections.test.ts`

Expected: FAIL，当前 `AnalysisPeriodDetails` 顶部仍只显示 `该级别简明决策` 和最多 4 个摘要标签。

- [ ] **Step 3: 改造周期详情顶部，去掉摘要标签截断并补三条摘要**

```tsx
function buildPeriodDisplaySignalTags(section: AnalysisPeriodSection) {
  const decisionTags = new Map(
    buildDecisionSignalTags(section.period?.trinity_decision).map((tag) => [tag.key, tag] as const)
  );
  const periodTags = new Map(
    buildPeriodSignalTags(section.period).map((tag) => [tag.key, tag] as const)
  );

  const ordered = [
    periodTags.get('spacetime') ?? decisionTags.get('spacetime'),
    periodTags.get('divergence'),
    resolvePreferredBreakthroughTag(periodTags.get('breakthrough'), decisionTags.get('breakthrough')),
    decisionTags.get('volume'),
    decisionTags.get('moving_average'),
    decisionTags.get('structure') ?? buildStructureSummaryTag(section),
    decisionTags.get('level_nesting'),
    decisionTags.get('execution'),
  ].filter((tag): tag is SignalTag => Boolean(tag));

  return ordered.map((tag) => enrichStructureSignalTag(section, tag));
}

function resolvePeriodExecutionSummary(section: AnalysisPeriodSection) {
  const decision = section.period?.trinity_decision;
  const preview = buildExecutionPreview(decision);
  return `先手点：${preview.probeEntry}；确认点：${preview.confirmEntry}；失效点：${preview.invalidation}`;
}
```

```tsx
<div className="space-y-3 rounded-xl border bg-background/70 p-4">
  <div className="flex flex-wrap gap-2">
    <Badge variant="outline">{resolveJudgmentLabel(section.period?.trinity_decision)}</Badge>
    <Badge variant="outline">{resolveRelationLabel(section.period?.trinity_decision?.level_nesting)}</Badge>
  </div>

  <SignalTagList tags={buildPeriodDisplaySignalTags(section)} />

  <div className="grid gap-3 lg:grid-cols-3">
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">时空摘要</div>
      <p className="text-sm leading-6">{resolveSpacetimeStatus(section)}</p>
    </div>
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">结构摘要</div>
      <p className="text-sm leading-6">{resolveStructureEvidence(section)}</p>
    </div>
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">执行摘要</div>
      <p className="text-sm leading-6">{resolvePeriodExecutionSummary(section)}</p>
    </div>
  </div>
</div>
```

- [ ] **Step 4: 重新跑周期详情测试，确认顶部结论头通过**

Run: `node --test tests/analysis-page-sections.test.ts`

Expected: PASS，周期详情顶部出现综合判断、父子关系、完整标签与三条摘要，旧的结构证据区仍保留。

- [ ] **Step 5: 提交周期详情改动**

```bash
git add src/components/stock/AnalysisPeriodDetails.tsx tests/analysis-page-sections.test.ts
git commit -m "实现：重构周期详情结论头与标签展示"
```

---

### Task 6: 做一轮前端回归验证并收尾

**Files:**
- Verify only: `tests/trinity-judgment-display.test.ts`
- Verify only: `tests/trinity-signal-tags.test.ts`
- Verify only: `tests/trinity-analysis-page-view-model.test.ts`
- Verify only: `tests/analysis-summary-panel.test.ts`
- Verify only: `tests/analysis-page-sections.test.ts`
- Verify only: `tests/analysis-page-layout-contract.test.ts`

- [ ] **Step 1: 先跑全部前端契约测试**

Run:

```bash
node --test \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-signal-tags.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-summary-panel.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/analysis-page-layout-contract.test.ts
```

Expected: PASS，所有 node:test 测试通过。

- [ ] **Step 2: 再跑 TypeScript 类型检查**

Run: `pnpm ts-check`

Expected: PASS，`Found 0 errors` 或无错误退出。

- [ ] **Step 3: 最后做一次自查并提交**

自查清单：

- `SignalTagList` 不再使用 `whitespace-nowrap`
- 总线和周期详情都没有 `slice(0, N)` 裁剪标签
- `AnalysisSummaryPanel` 主内容里直接出现综合判断、父子关系、时空/结构/执行三条摘要
- 规则链卡面已经出现 `当前状态` 和该卡完整标签
- 周期详情顶部已显示背离、突破风险、时空、结构、级别、执行等混排标签

```bash
git add src/lib/trinity-judgment-display.ts src/lib/trinity-signal-tags.ts src/lib/trinity-analysis-page-view-model.ts src/components/stock/SignalTagList.tsx src/components/stock/AnalysisSummaryPanel.tsx src/components/stock/TradingCycleBus.tsx src/components/stock/TrinityRuleChain.tsx src/components/stock/AnalysisPeriodDetails.tsx tests/trinity-judgment-display.test.ts tests/trinity-signal-tags.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts
git commit -m "实现：重组三位一体综合判断页前端展示"
```

---

## 后续计划（不在本计划内）

本计划完成后，应立即新起第二份计划，专门处理 spec 第 8.3 节定义的后端合同补齐，包括：

- 候选结构字段
- 等待类型字段
- 零轴强事件字段
- 指标共振字段
- 综合判断字段
- 执行预案展示字段

这一步不应并入本计划执行，避免把“前端展示重组”和“后端判断合同升级”混成一个大任务。
