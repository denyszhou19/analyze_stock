# 三位一体分析页全局 UX 升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将分析页从“日线优先展示”升级为“页面级综合结论 + 三条交易组合 + 周期详情子 Tab”的统一用户体验。

**Architecture:** 前端短期基于现有多级别 `trinity_decision` 组装页面级综合 ViewModel、交易周期组合 ViewModel 和周期级详情 ViewModel；后端算法不改。UI 层统一使用“红=偏多、绿=偏空、灰=中性”的方向色和“可执行/观察中/谨慎看/暂不做”的状态词，并为硬门控、状态、结构标签提供 hover 解释。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Tailwind CSS v4、shadcn/ui、Radix Tooltip/Tabs、Node test runner、`pnpm ts-check`。

---

## 文件职责规划

- `src/lib/trinity-display-vocabulary.ts`
  - 新建：统一方向、状态、结构标签、hover 文案和颜色 class。
- `src/lib/trinity-analysis-page-view-model.ts`
  - 修改：输出页面级综合结论、主策略硬门控、交易周期组合、全局规则链、周期详情 Tab 数据。
- `src/components/stock/AnalysisSummaryPanel.tsx`
  - 修改：展示页面级综合结论、作用域提示、主策略硬门控 hover。
- `src/components/stock/TradingCycleBus.tsx`
  - 新建：替代 `LevelDecisionBus`，展示三条交易组合。
- `src/components/stock/TrinityRuleChain.tsx`
  - 修改：状态标签使用交易语言，颜色使用方向语义，新增状态 hover。
- `src/components/stock/AnalysisPeriodDetails.tsx`
  - 修改：从 Accordion 改为 Tabs，展示每级别简明决策卡、规则摘要和证据区。
- `src/app/stock/[code]/analysis/page.tsx`
  - 修改：使用新 ViewModel 字段和 `TradingCycleBus`。
- `src/app/api/stock/ai-analysis/route.ts`
  - 修改：提示词明确 AI 综合范围、优先组合、主约束级别、触发级别。
- `tests/trinity-display-vocabulary.test.ts`
  - 新建：覆盖方向、状态、结构标签映射。
- `tests/trinity-analysis-page-view-model.test.ts`
  - 修改：覆盖页面级综合结论、交易周期组合、主策略硬门控、周期详情 Tab。
- `tests/analysis-page-sections.test.ts`
  - 修改：覆盖 `TradingCycleBus`、`AnalysisSummaryPanel`、`AnalysisPeriodDetails` 的用户可见文案。
- `tests/helpers/tsx-test-loader.ts`
  - 修改：为 `@/components/ui/tabs` 补齐测试 stub；保留已有 tooltip stub。

---

### Task 1: 建立全局展示词典

**Files:**
- Create: `src/lib/trinity-display-vocabulary.ts`
- Create: `tests/trinity-display-vocabulary.test.ts`

- [ ] **Step 1: Write failing tests for display vocabulary**

Create `tests/trinity-display-vocabulary.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

const vocabulary = await import(
  new URL('../src/lib/trinity-display-vocabulary.ts', import.meta.url).href
) as typeof import('../src/lib/trinity-display-vocabulary.ts');

test('maps backend status to trading language labels', () => {
  assert.equal(vocabulary.getActionStatusMeta('passed').label, '可执行');
  assert.equal(vocabulary.getActionStatusMeta('info').label, '观察中');
  assert.equal(vocabulary.getActionStatusMeta('warning').label, '谨慎看');
  assert.equal(vocabulary.getActionStatusMeta('failed').label, '暂不做');
});

test('maps direction tone to Chinese labels and color classes', () => {
  assert.equal(vocabulary.getDirectionMeta('bullish').label, '偏多');
  assert.equal(vocabulary.getDirectionMeta('bearish').label, '偏空');
  assert.equal(vocabulary.getDirectionMeta('neutral').label, '中性');
  assert.match(vocabulary.getDirectionMeta('bullish').cardClassName, /red/);
  assert.match(vocabulary.getDirectionMeta('bearish').cardClassName, /green/);
  assert.match(vocabulary.getDirectionMeta('neutral').cardClassName, /slate|gray/);
});

test('normalizes structure tags globally', () => {
  const standardC = vocabulary.getStructureTagMeta('C单平台式');
  assert.equal(standardC.label, 'C单平台式');
  assert.equal(standardC.family, 'C');
  assert.equal(standardC.className, 'border-blue-200 bg-blue-50 text-blue-700');
  assert.match(standardC.explanation, /标准C类结构/);

  const extendedC = vocabulary.getStructureTagMeta('延伸C类');
  assert.equal(extendedC.label, '延伸C类');
  assert.equal(extendedC.family, 'C');
  assert.equal(extendedC.className, 'border-blue-200 bg-blue-50 text-blue-700');
  assert.match(extendedC.tradeMeaning, /不能直接等同于标准C/);

  assert.equal(vocabulary.getStructureTagMeta('未知结构').label, '未知结构');
});

test('builds status hover explanation with reason and direction', () => {
  const explanation = vocabulary.buildStatusExplanation({
    status: 'warning',
    direction: 'bearish',
    reason: '父级偏空，当前级别反弹未确认',
  });

  assert.equal(explanation.tradeMeaning, '存在约束，不能直接放大动作');
  assert.equal(explanation.ruleState, '有约束');
  assert.equal(explanation.directionLabel, '偏空');
  assert.equal(explanation.reason, '父级偏空，当前级别反弹未确认');
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test tests/trinity-display-vocabulary.test.ts
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

because `src/lib/trinity-display-vocabulary.ts` does not exist yet.

- [ ] **Step 3: Implement display vocabulary**

Create `src/lib/trinity-display-vocabulary.ts`:

```ts
import type { TrinityJudgmentCriterion, TrinityDecision } from '@/lib/stock-structure-types';

export type DirectionTone = 'bullish' | 'bearish' | 'neutral';
export type ActionStatus = 'passed' | 'failed' | 'warning' | 'info';
export type ActionStatusLabel = '可执行' | '观察中' | '谨慎看' | '暂不做';
export type ActionRuleState = '已满足' | '待确认' | '有约束' | '不成立';

export interface DirectionMeta {
  label: '偏多' | '偏空' | '中性';
  cardClassName: string;
  badgeClassName: string;
  textClassName: string;
}

export interface ActionStatusMeta {
  label: ActionStatusLabel;
  icon: '✓' | '○' | '!' | '×';
  ruleState: ActionRuleState;
  tradeMeaning: string;
}

export interface StatusExplanation {
  tradeMeaning: string;
  ruleState: ActionRuleState;
  directionLabel: DirectionMeta['label'];
  reason: string;
}

export interface StructureTagMeta {
  label: string;
  family: string;
  className: string;
  explanation: string;
  tradeMeaning: string;
}

const DIRECTION_META: Record<DirectionTone, DirectionMeta> = {
  bullish: {
    label: '偏多',
    cardClassName: 'border-red-200 bg-red-50/60',
    badgeClassName: 'border-red-200 bg-red-50 text-red-700',
    textClassName: 'text-red-700',
  },
  bearish: {
    label: '偏空',
    cardClassName: 'border-green-200 bg-green-50/60',
    badgeClassName: 'border-green-200 bg-green-50 text-green-700',
    textClassName: 'text-green-700',
  },
  neutral: {
    label: '中性',
    cardClassName: 'border-slate-200 bg-slate-50/80',
    badgeClassName: 'border-slate-200 bg-slate-50 text-slate-700',
    textClassName: 'text-slate-700',
  },
};

const ACTION_STATUS_META: Record<ActionStatus, ActionStatusMeta> = {
  passed: {
    label: '可执行',
    icon: '✓',
    ruleState: '已满足',
    tradeMeaning: '这条规则已满足，可纳入当前执行判断',
  },
  info: {
    label: '观察中',
    icon: '○',
    ruleState: '待确认',
    tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
  },
  warning: {
    label: '谨慎看',
    icon: '!',
    ruleState: '有约束',
    tradeMeaning: '存在约束，不能直接放大动作',
  },
  failed: {
    label: '暂不做',
    icon: '×',
    ruleState: '不成立',
    tradeMeaning: '当前不支持按这条规则交易',
  },
};

const STRUCTURE_TAGS: Record<string, StructureTagMeta> = {
  A五段式: {
    label: 'A五段式',
    family: 'A',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    explanation: '标准A类五段推动结构。',
    tradeMeaning: '优先观察趋势延续节点和回踩确认。',
  },
  B双平台式: {
    label: 'B双平台式',
    family: 'B',
    className: 'border-purple-200 bg-purple-50 text-purple-700',
    explanation: '标准B类双平台震荡结构。',
    tradeMeaning: '优先按平台边界和突破有效性处理。',
  },
  C单平台式: {
    label: 'C单平台式',
    family: 'C',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    explanation: '标准C类结构中的单平台形态。',
    tradeMeaning: '重点观察平台边界、量能确认和下一段方向选择。',
  },
  延伸C类: {
    label: '延伸C类',
    family: 'C',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    explanation: 'C类结构出现延伸或复杂化，仍归入C家族观察。',
    tradeMeaning: '不能直接等同于标准C，需要降低确定性并等待边界确认。',
  },
  D三段式: {
    label: 'D三段式',
    family: 'D',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    explanation: '标准D类三段修正结构。',
    tradeMeaning: '优先关注修正结束、失效位和反向确认。',
  },
  未完成结构: {
    label: '未完成结构',
    family: 'unfinished',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    explanation: '当前结构尚未满足完整原型。',
    tradeMeaning: '以观察和等待确认为主，不放大动作。',
  },
  复杂结构: {
    label: '复杂结构',
    family: 'complex',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
    explanation: '当前结构存在复杂嵌套或非标准变体。',
    tradeMeaning: '降低确定性，以边界、时空和量能联合确认。',
  },
};

export function getDirectionMeta(direction: DirectionTone): DirectionMeta {
  return DIRECTION_META[direction];
}

export function getActionStatusMeta(status: ActionStatus): ActionStatusMeta {
  return ACTION_STATUS_META[status];
}

export function getStructureTagMeta(value?: string | null): StructureTagMeta {
  const label = value?.trim() || '未识别结构';
  return STRUCTURE_TAGS[label] ?? {
    label,
    family: 'unknown',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    explanation: '当前结构类型未纳入统一结构词典。',
    tradeMeaning: '需要结合结构证据、时空状态和级别约束人工复核。',
  };
}

export function directionFromBias(
  bias?: TrinityDecision['conclusion']['bias'] | TrinityDecision['spacetime']['direction_bias'] | null
): DirectionTone {
  if (bias === 'bullish') {
    return 'bullish';
  }
  if (bias === 'bearish') {
    return 'bearish';
  }
  return 'neutral';
}

export function directionFromStructure(direction?: TrinityDecision['structure']['direction'] | null): DirectionTone {
  if (direction === 'up') {
    return 'bullish';
  }
  if (direction === 'down') {
    return 'bearish';
  }
  return 'neutral';
}

export function buildStatusExplanation({
  status,
  direction,
  reason,
}: {
  status: TrinityJudgmentCriterion['status'];
  direction: DirectionTone;
  reason?: string | null;
}): StatusExplanation {
  const statusMeta = getActionStatusMeta(status);
  const directionMeta = getDirectionMeta(direction);

  return {
    tradeMeaning: statusMeta.tradeMeaning,
    ruleState: statusMeta.ruleState,
    directionLabel: directionMeta.label,
    reason: reason?.trim() || '当前规则未提供明确原因',
  };
}
```

- [ ] **Step 4: Run vocabulary tests and verify green**

Run:

```bash
node --test tests/trinity-display-vocabulary.test.ts
```

Expected:

```text
pass 4
fail 0
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/trinity-display-vocabulary.ts tests/trinity-display-vocabulary.test.ts
git commit -m "实现：新增三位一体全局展示词典"
```

---

### Task 2: 扩展页面级综合 ViewModel

**Files:**
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Modify: `tests/trinity-analysis-page-view-model.test.ts`

- [ ] **Step 1: Add failing tests for global strategy and trading combinations**

Append to `tests/trinity-analysis-page-view-model.test.ts`:

```ts
test('global strategy is derived from three trading combinations, not a single daily label', () => {
  const result = createResult();
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
        entry_style: 'pullback_confirm',
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
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts
```

Expected:

```text
Property 'globalStrategy' does not exist
```

- [ ] **Step 3: Extend ViewModel types and imports**

Modify `src/lib/trinity-analysis-page-view-model.ts` imports:

```ts
import {
  buildStatusExplanation,
  directionFromBias,
  getActionStatusMeta,
  getDirectionMeta,
  getStructureTagMeta,
  type DirectionTone,
} from './trinity-display-vocabulary.ts';
```

Replace `AnalysisPageSummaryGate` with:

```ts
export interface AnalysisPageHardGateDescription {
  title: string;
  meaning: string;
  tradeImpact: string;
  source: string;
}

export interface AnalysisPageSummaryGate {
  label: string;
  value: string;
  description: AnalysisPageHardGateDescription;
}
```

Add new interfaces after `AnalysisPageBusDimension`:

```ts
export type TradingCombinationKey = 'midline' | 'shortline' | 'intraday_t';

export interface AnalysisPageGlobalStrategyViewModel {
  scopeLabel: string;
  primaryCombination: TradingCombinationKey;
  primaryCombinationLabel: string;
  primaryConstraintLevel: TrinityLevel;
  primaryConstraintLevelLabel: string;
  triggerLevel: TrinityLevel;
  triggerLevelLabel: string;
  direction: DirectionTone;
  directionLabel: string;
  actionLabel: string;
  headline: string;
  primaryReason: string;
  triggerLabels: string[];
  riskLabels: string[];
  guardrail: string;
}

export interface AnalysisPageTradingCombinationViewModel {
  key: TradingCombinationKey;
  label: string;
  levels: [TrinityLevel, TrinityLevel];
  direction: DirectionTone;
  directionLabel: string;
  actionLabel: string;
  parentConstraint: string;
  triggerLevelLabel: string;
  suitableAction: string;
  majorRisk: string;
  explanation: string;
}
```

Extend `AnalysisPageSummaryViewModel`:

```ts
  hardGateTitle: string;
  hardGateSourceLabel: string;
```

Extend `AnalysisPageViewModel`:

```ts
  globalStrategy: AnalysisPageGlobalStrategyViewModel;
  tradingCombinations: AnalysisPageTradingCombinationViewModel[];
```

- [ ] **Step 4: Add helper functions**

Add before `buildBus()`:

```ts
function gateDescription(label: string, value: string, source: string): AnalysisPageHardGateDescription {
  const meanings: Record<string, string> = {
    后端最终动作: '后端确定性链路给出的当前最大动作。',
    交易模式: '当前策略允许采用的交易模式。',
    仓位权限: '后端允许的最大仓位动作范围。',
    结构资格: '当前结构是否具备交易解释力。',
    聚焦结构: '当前主策略正在跟踪的结构类型。',
    执行级别: '当前硬门控来自哪个主判定级别。',
    量能状态: '突破、跌破或回踩是否获得量能支持。',
    结论约束: '当前策略不能突破的主要限制。',
  };

  return {
    title: label,
    meaning: meanings[label] ?? '当前硬门控字段。',
    tradeImpact: `当前值为「${value}」，AI 和页面结论不能突破这个限制。`,
    source,
  };
}

function primaryLevelSourceLabel(
  decision: TrinityDecision,
  primaryCombination?: AnalysisPageTradingCombinationViewModel
): string {
  const levelIndex = PRIMARY_DECISION_ORDER.indexOf(decision.level);
  const combinationLabel = primaryCombination ? `；当前优先组合：${primaryCombination.label}` : '';
  if (levelIndex <= 0) {
    return `当前硬门控来自主判定级别：${LEVEL_LABELS[decision.level]}${combinationLabel}`;
  }
  const missingLevels = PRIMARY_DECISION_ORDER.slice(0, levelIndex).map((level) => LEVEL_LABELS[level]);
  return `当前硬门控来自主判定级别：${LEVEL_LABELS[decision.level]}${combinationLabel}；因${missingLevels.join('、')}主判定缺失，已自动降级。`;
}

function findLevelDecision(result: AnalysisResultData, level: TrinityLevel): TrinityDecision | null {
  return result.periods[level]?.trinity_decision ?? null;
}

function resolveCombinationStatus(major: TrinityDecision | null, minor: TrinityDecision | null): TrinityJudgmentCriterion['status'] {
  if (!major && !minor) {
    return 'failed';
  }
  if (minor?.conclusion.can_trade && major?.conclusion.bias !== 'bearish') {
    return 'passed';
  }
  if (major?.trade_qualification.position_permission === 'no_position') {
    return 'warning';
  }
  return 'info';
}

function buildCombination({
  key,
  label,
  levels,
  result,
}: {
  key: TradingCombinationKey;
  label: string;
  levels: [TrinityLevel, TrinityLevel];
  result: AnalysisResultData;
}): AnalysisPageTradingCombinationViewModel {
  const [majorLevel, minorLevel] = levels;
  const major = findLevelDecision(result, majorLevel);
  const minor = findLevelDecision(result, minorLevel);
  const status = resolveCombinationStatus(major, minor);
  const statusMeta = getActionStatusMeta(status);
  const direction = directionFromBias(minor?.conclusion.bias ?? major?.conclusion.bias ?? 'neutral');
  const directionLabel = getDirectionMeta(direction).label;
  const majorLabel = LEVEL_LABELS[majorLevel];
  const minorLabel = LEVEL_LABELS[minorLevel];

  return {
    key,
    label,
    levels,
    direction,
    directionLabel,
    actionLabel: statusMeta.label,
    parentConstraint: major ? `${majorLabel}：${major.conclusion.wait_reason ?? major.trade_qualification.reason[0] ?? '暂无额外约束'}` : `${majorLabel}缺失`,
    triggerLevelLabel: minorLabel,
    suitableAction: minor ? formatDecisionActionLabel(minor.conclusion.action, minor.conclusion.action_label) : '等待数据补齐',
    majorRisk: minor?.execution.risk_flags?.[0] ?? major?.execution.risk_flags?.[0] ?? '暂无明确风险',
    explanation: `${majorLabel}定约束，${minorLabel}给触发；${statusMeta.tradeMeaning}`,
  };
}

function buildTradingCombinations(result: AnalysisResultData): AnalysisPageTradingCombinationViewModel[] {
  return [
    buildCombination({ key: 'midline', label: '中线主策略组合｜周线 → 日线', levels: ['weekly', 'daily'], result }),
    buildCombination({ key: 'shortline', label: '短线执行组合｜日线 → 30分钟', levels: ['daily', 'hour30'], result }),
    buildCombination({ key: 'intraday_t', label: '超短线 / T 组合｜60分钟 → 15分钟', levels: ['hour60', 'hour15'], result }),
  ];
}

function pickPrimaryCombination(
  combinations: AnalysisPageTradingCombinationViewModel[]
): AnalysisPageTradingCombinationViewModel {
  const score: Record<string, number> = {
    可执行: 4,
    谨慎看: 3,
    观察中: 2,
    暂不做: 1,
  };
  const tieBreak: Record<TradingCombinationKey, number> = {
    shortline: 3,
    midline: 2,
    intraday_t: 1,
  };

  return [...combinations].sort((left, right) => {
    const scoreDiff = score[right.actionLabel] - score[left.actionLabel];
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return tieBreak[right.key] - tieBreak[left.key];
  })[0];
}
```

- [ ] **Step 5: Update hard gates and global strategy builders**

Update `buildHardGates(decision)` to include descriptions:

```ts
function buildHardGates(decision: TrinityDecision): AnalysisPageSummaryGate[] {
  const actionLabel = formatDecisionActionLabel(
    decision.conclusion.action,
    decision.conclusion.action_label
  );

  const gates = [
    { label: '后端最终动作', value: actionLabel, source: 'trinity_decision.conclusion.action' },
    { label: '交易模式', value: TRADE_MODE_LABELS[decision.trade_qualification.trade_mode], source: 'trinity_decision.trade_qualification.trade_mode' },
    { label: '仓位权限', value: POSITION_PERMISSION_LABELS[decision.trade_qualification.position_permission], source: 'trinity_decision.trade_qualification.position_permission' },
    { label: '结构资格', value: STRUCTURE_QUALIFICATION_LABELS[decision.structure.qualification], source: 'trinity_decision.structure.qualification' },
    { label: '聚焦结构', value: getStructureTagMeta(decision.structure.type).label, source: 'trinity_decision.structure.type' },
    { label: '执行级别', value: LEVEL_LABELS[decision.level], source: 'trinity_decision.level' },
    { label: '量能状态', value: `${VOLUME_STATE_LABELS[decision.volume_confirmation.volume_state]}｜${BREAKOUT_VOLUME_LABELS[decision.volume_confirmation.breakout_volume]}`, source: 'trinity_decision.volume_confirmation' },
    { label: '结论约束', value: decision.conclusion.wait_reason ?? decision.execution.position_sizing.reason, source: 'trinity_decision.conclusion.wait_reason' },
  ];

  return gates.map((gate) => ({
    label: gate.label,
    value: gate.value,
    description: gateDescription(gate.label, gate.value, gate.source),
  }));
}
```

Add `buildGlobalStrategy()`:

```ts
function buildGlobalStrategy(
  decision: TrinityDecision,
  summary: AnalysisPageSummaryViewModel,
  primaryCombination: AnalysisPageTradingCombinationViewModel
): AnalysisPageGlobalStrategyViewModel {
  const direction = primaryCombination.direction;
  return {
    scopeLabel: '综合范围：中线主策略组合、短线执行组合、超短线 / T 组合',
    primaryCombination: primaryCombination.key,
    primaryCombinationLabel: primaryCombination.label,
    primaryConstraintLevel: decision.level,
    primaryConstraintLevelLabel: LEVEL_LABELS[decision.level],
    triggerLevel: primaryCombination.levels[1],
    triggerLevelLabel: primaryCombination.triggerLevelLabel,
    direction,
    directionLabel: getDirectionMeta(direction).label,
    actionLabel: primaryCombination.actionLabel,
    headline: summary.headline,
    primaryReason: summary.primaryReason,
    triggerLabels: summary.triggerLabels,
    riskLabels: summary.riskLabels,
    guardrail: summary.guardrail,
  };
}
```

Update `buildSummary(decision, aiState, primaryCombination)` signature and return:

```ts
    hardGateTitle: '主策略硬门控',
    hardGateSourceLabel: primaryLevelSourceLabel(decision, primaryCombination),
    hardGates: buildHardGates(decision),
```

Update `buildAnalysisPageViewModel()`:

```ts
  const primaryDecision = pickPrimaryDecision(result);
  const tradingCombinations = buildTradingCombinations(result);
  const primaryCombination = pickPrimaryCombination(tradingCombinations);
  const summary = buildSummary(primaryDecision, aiState, primaryCombination);

  return {
    statusBar: buildStatusBar(result, integrity, aiState),
    globalStrategy: buildGlobalStrategy(primaryDecision, summary, primaryCombination),
    summary,
    bus: buildBus(result),
    tradingCombinations,
    ruleChain: buildRuleChain(primaryDecision),
  };
```

- [ ] **Step 6: Run ViewModel tests and verify green**

Run:

```bash
node --test tests/trinity-display-vocabulary.test.ts tests/trinity-analysis-page-view-model.test.ts
```

Expected:

```text
fail 0
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/trinity-analysis-page-view-model.ts tests/trinity-analysis-page-view-model.test.ts
git commit -m "实现：扩展三位一体页面级综合视图模型"
```

---

### Task 3: 升级 AI 综合判断与主策略硬门控 UI

**Files:**
- Modify: `src/components/stock/AnalysisSummaryPanel.tsx`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: Add failing component test for summary scope and hard gate hover**

Add imports/types in `tests/analysis-page-sections.test.ts`:

```ts
type AnalysisSummaryPanelModule = typeof import('../src/components/stock/AnalysisSummaryPanel.tsx');
```

Append test:

```ts
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
        primaryReason: '日线仍需确认，只能等待30分钟触发',
        triggerLabels: ['30分钟放量突破平台上沿'],
        riskLabels: ['跌回日线平台下沿'],
        guardrail: '仓位不超过 20%',
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
  assert.match(html, /主策略硬门控/);
  assert.match(html, /仓位权限/);
  assert.match(html, /后端允许的最大仓位动作范围/);
  assert.doesNotMatch(html, /后端硬门控/);
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
node --test tests/analysis-page-sections.test.ts
```

Expected:

```text
Property 'globalStrategy' is missing
```

- [ ] **Step 3: Update component props and hard gate UI**

Modify `src/components/stock/AnalysisSummaryPanel.tsx` imports:

```ts
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  AnalysisPageGlobalStrategyViewModel,
  AnalysisPageSummaryViewModel,
} from '@/lib/trinity-analysis-page-view-model';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
```

Update props:

```ts
export interface AnalysisSummaryPanelProps {
  viewModel: AnalysisPageSummaryViewModel;
  globalStrategy: AnalysisPageGlobalStrategyViewModel;
  onGenerate: () => void;
  canGenerate: boolean;
}
```

Replace `HardGates` with:

```tsx
function HardGates({
  title,
  sourceLabel,
  hardGates,
}: {
  title: string;
  sourceLabel: string;
  hardGates: AnalysisPageSummaryViewModel['hardGates'];
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs leading-5 text-muted-foreground">{sourceLabel}</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {hardGates.map((gate) => (
          <TooltipProvider key={`${gate.label}-${gate.value}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help rounded-lg border bg-background/70 p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{gate.label}</span>
                    <Info className="h-3.5 w-3.5" />
                  </div>
                  <div className="mt-1 text-sm font-medium">{gate.value}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm text-sm leading-6">
                <div className="space-y-1">
                  <div className="font-medium">{gate.description.title}</div>
                  <p>{gate.description.meaning}</p>
                  <p>{gate.description.tradeImpact}</p>
                  <p className="text-xs text-muted-foreground">数据来源：{gate.description.source}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </section>
  );
}
```

Add scope block inside `AnalysisSummaryPanel` before trigger/risk grid:

```tsx
function ScopeBlock({ globalStrategy }: { globalStrategy: AnalysisPageGlobalStrategyViewModel }) {
  const directionMeta = getDirectionMeta(globalStrategy.direction);
  return (
    <section className={`rounded-xl border p-4 ${directionMeta.cardClassName}`}>
      <div className="text-xs font-medium text-muted-foreground">页面级综合结论</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="outline" className={directionMeta.badgeClassName}>方向：{globalStrategy.directionLabel}</Badge>
        <Badge variant="outline">状态：{globalStrategy.actionLabel}</Badge>
        <Badge variant="outline">当前优先组合：{globalStrategy.primaryCombinationLabel}</Badge>
        <Badge variant="outline">主约束级别：{globalStrategy.primaryConstraintLevelLabel}</Badge>
        <Badge variant="outline">触发级别：{globalStrategy.triggerLevelLabel}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{globalStrategy.scopeLabel}</p>
    </section>
  );
}
```

Use `globalStrategy` prop:

```tsx
export function AnalysisSummaryPanel({
  viewModel,
  globalStrategy,
  onGenerate,
  canGenerate,
}: AnalysisSummaryPanelProps) {
```

Replace card description:

```tsx
<CardDescription>
  先看页面级综合结论，再核对触发条件、风险条件与主策略硬门控。
</CardDescription>
```

Render scope block after top conclusion:

```tsx
<ScopeBlock globalStrategy={globalStrategy} />
```

Render hard gates:

```tsx
<HardGates
  title={viewModel.hardGateTitle}
  sourceLabel={viewModel.hardGateSourceLabel}
  hardGates={viewModel.hardGates}
/>
```

- [ ] **Step 4: Verify tooltip test loader support**

Run:

```bash
rg -n "components/ui/tooltip|TooltipContent|TooltipTrigger" tests/helpers/tsx-test-loader.ts
```

Expected: output includes `TooltipTrigger`, `TooltipContent`, and both `@/components/ui/tooltip` import rewrite lines. No file change is expected in this step.

- [ ] **Step 5: Update page call site**

Modify `src/app/stock/[code]/analysis/page.tsx`:

```tsx
<AnalysisSummaryPanel
  viewModel={pageViewModel.summary}
  globalStrategy={pageViewModel.globalStrategy}
  onGenerate={handleGenerateAiSummary}
  canGenerate={Boolean(result) && !isLoading}
/>
```

- [ ] **Step 6: Run component tests and type check**

Run:

```bash
node --test tests/analysis-page-sections.test.ts tests/trinity-analysis-page-view-model.test.ts
pnpm ts-check
```

Expected:

```text
fail 0
tsc exit 0
```

- [ ] **Step 7: Commit**

```bash
git add src/components/stock/AnalysisSummaryPanel.tsx src/app/stock/'[code]'/analysis/page.tsx tests/analysis-page-sections.test.ts tests/helpers/tsx-test-loader.ts
git commit -m "实现：升级页面级综合结论与主策略硬门控展示"
```

---

### Task 4: 新增交易周期总线组件

**Files:**
- Create: `src/components/stock/TradingCycleBus.tsx`
- Modify: `src/app/stock/[code]/analysis/page.tsx`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: Add failing test for TradingCycleBus**

Add type import in `tests/analysis-page-sections.test.ts`:

```ts
type TradingCycleBusModule = typeof import('../src/components/stock/TradingCycleBus.tsx');
```

Append test:

```ts
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
          parentConstraint: '周线：大方向偏多',
          triggerLevelLabel: '日线',
          suitableAction: '等待日线确认',
          majorRisk: '日线仍未突破平台上沿',
          explanation: '周线定约束，日线给触发；已有方向或预案，但还差确认，不急着动作',
        },
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          parentConstraint: '日线：等待确认',
          triggerLevelLabel: '30分钟',
          suitableAction: '轻仓试探',
          majorRisk: '日线硬门控未放开',
          explanation: '日线定约束，30分钟给触发；存在约束，不能直接放大动作',
        },
        {
          key: 'intraday_t',
          label: '超短线 / T 组合｜60分钟 → 15分钟',
          levels: ['hour60', 'hour15'],
          direction: 'bearish',
          directionLabel: '偏空',
          actionLabel: '暂不做',
          parentConstraint: '60分钟：偏弱',
          triggerLevelLabel: '15分钟',
          suitableAction: '只观察',
          majorRisk: '15分钟反弹不能推翻上级',
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
  assert.match(html, /适合动作/);
  assert.match(html, /主要风险/);
  assert.doesNotMatch(html, /维度一/);
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
node --test tests/analysis-page-sections.test.ts
```

Expected:

```text
Cannot find module 'src/components/stock/TradingCycleBus.tsx'
```

- [ ] **Step 3: Implement TradingCycleBus**

Create `src/components/stock/TradingCycleBus.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
import type { AnalysisPageTradingCombinationViewModel } from '@/lib/trinity-analysis-page-view-model';

interface TradingCycleBusProps {
  combinations: AnalysisPageTradingCombinationViewModel[];
}

export function TradingCycleBus({ combinations }: TradingCycleBusProps) {
  if (!combinations.length) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="交易周期总线">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">交易周期总线</h2>
        <p className="text-sm text-muted-foreground">
          用三条交易组合综合判断当前最适合做中线、短线、超短线 / T，还是继续等待。
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {combinations.map((combination) => {
          const directionMeta = getDirectionMeta(combination.direction);
          return (
            <Card
              key={combination.key}
              className={cn('gap-4 py-4 shadow-none', directionMeta.cardClassName)}
            >
              <CardHeader className="space-y-2 px-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm">{combination.label}</CardTitle>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={directionMeta.badgeClassName}>
                      {combination.directionLabel}
                    </Badge>
                    <Badge variant="outline">{combination.actionLabel}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-4 text-sm">
                <p className="leading-6 text-muted-foreground">{combination.explanation}</p>
                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">父级约束：</span>{combination.parentConstraint}
                  </div>
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">触发级别：</span>{combination.triggerLevelLabel}
                  </div>
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">适合动作：</span>{combination.suitableAction}
                  </div>
                  <div className="rounded-lg border bg-background/70 p-2">
                    <span className="font-medium text-foreground">主要风险：</span>{combination.majorRisk}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace page usage**

Modify `src/app/stock/[code]/analysis/page.tsx` imports:

```ts
import { TradingCycleBus } from '@/components/stock/TradingCycleBus';
```

Remove:

```ts
import { LevelDecisionBus } from '@/components/stock/LevelDecisionBus';
```

Replace JSX:

```tsx
<TradingCycleBus combinations={pageViewModel.tradingCombinations} />
```

- [ ] **Step 5: Replace LevelDecisionBus component test**

In `tests/analysis-page-sections.test.ts`, delete the existing `type LevelDecisionBusModule = typeof import('../src/components/stock/LevelDecisionBus.tsx');` line and replace it with:

```ts
type TradingCycleBusModule = typeof import('../src/components/stock/TradingCycleBus.tsx');
```

Replace the full test named `LevelDecisionBus renders three fixed dimension titles` with the `TradingCycleBus renders three trading combinations with direction and trigger level` test from Step 1. Keep the negative assertion:

```ts
assert.doesNotMatch(html, /维度一/);
```

- [ ] **Step 6: Run tests and type check**

Run:

```bash
node --test tests/analysis-page-sections.test.ts tests/trinity-analysis-page-view-model.test.ts
pnpm ts-check
```

Expected:

```text
fail 0
tsc exit 0
```

- [ ] **Step 7: Commit**

```bash
git add src/components/stock/TradingCycleBus.tsx src/app/stock/'[code]'/analysis/page.tsx tests/analysis-page-sections.test.ts
git commit -m "实现：新增交易周期总线展示"
```

---

### Task 5: 升级规则链状态标签与 hover

**Files:**
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Modify: `src/components/stock/TrinityRuleChain.tsx`
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: Add failing tests for rule chain display labels**

Append to `tests/trinity-analysis-page-view-model.test.ts`:

```ts
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
```

Replace the `items: [` array in the `TrinityRuleChain renders six rule items and keeps failed status plus reason visible` test with:

```ts
items: [
  {
    title: '结构资格',
    status: 'passed',
    displayStatusLabel: '可执行',
    displayStatusIcon: '✓',
    direction: 'bullish',
    directionLabel: '偏多',
    detail: '周线方向允许向下钻取。',
    reason: '父级方向一致',
    statusExplanation: {
      tradeMeaning: '这条规则已满足，可纳入当前执行判断',
      ruleState: '已满足',
      directionLabel: '偏多',
      reason: '父级方向一致',
    },
  },
  {
    title: 'MACD 时空',
    status: 'info',
    displayStatusLabel: '观察中',
    displayStatusIcon: '○',
    direction: 'neutral',
    directionLabel: '中性',
    detail: '日线级别处于等待确认状态。',
    reason: '等待时空确认',
    statusExplanation: {
      tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
      ruleState: '待确认',
      directionLabel: '中性',
      reason: '等待时空确认',
    },
  },
  {
    title: '55 / 233 线关系',
    status: 'warning',
    displayStatusLabel: '谨慎看',
    displayStatusIcon: '!',
    direction: 'bearish',
    directionLabel: '偏空',
    detail: '30分钟触发尚需量能确认。',
    reason: '量能未同步放大',
    statusExplanation: {
      tradeMeaning: '存在约束，不能直接放大动作',
      ruleState: '有约束',
      directionLabel: '偏空',
      reason: '量能未同步放大',
    },
  },
  {
    title: '量能确认',
    status: 'info',
    displayStatusLabel: '观察中',
    displayStatusIcon: '○',
    direction: 'neutral',
    directionLabel: '中性',
    detail: '60分钟节奏进入观察区。',
    reason: '等待下一段确认',
    statusExplanation: {
      tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
      ruleState: '待确认',
      directionLabel: '中性',
      reason: '等待下一段确认',
    },
  },
  {
    title: '级别权限',
    status: 'failed',
    displayStatusLabel: '暂不做',
    displayStatusIcon: '×',
    direction: 'bearish',
    directionLabel: '偏空',
    detail: '15分钟入场点尚未成立。',
    reason: '入场触发条件缺失',
    statusExplanation: {
      tradeMeaning: '当前不支持按这条规则交易',
      ruleState: '不成立',
      directionLabel: '偏空',
      reason: '入场触发条件缺失',
    },
  },
  {
    title: '执行计划',
    status: 'passed',
    displayStatusLabel: '可执行',
    displayStatusIcon: '✓',
    direction: 'bullish',
    directionLabel: '偏多',
    detail: '风险回撤边界已定义。',
    reason: '止损与失效位明确',
    statusExplanation: {
      tradeMeaning: '这条规则已满足，可纳入当前执行判断',
      ruleState: '已满足',
      directionLabel: '偏多',
      reason: '止损与失效位明确',
    },
  },
]
```

Then assert:

```ts
assert.match(html, /可执行/);
assert.match(html, /观察中/);
assert.match(html, /谨慎看/);
assert.match(html, /暂不做/);
assert.match(html, /交易含义/);
assert.match(html, /规则状态/);
assert.match(html, /当前方向/);
assert.doesNotMatch(html, />通过</);
assert.doesNotMatch(html, />警示</);
assert.doesNotMatch(html, />提示</);
assert.doesNotMatch(html, />失败</);
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
```

Expected:

```text
Property 'displayStatusLabel' does not exist
```

- [ ] **Step 3: Extend rule chain item type**

Modify `AnalysisPageRuleChainItem` in `src/lib/trinity-analysis-page-view-model.ts`:

```ts
export interface AnalysisPageRuleChainItem {
  title: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  displayStatusLabel: string;
  displayStatusIcon: string;
  direction: DirectionTone;
  directionLabel: string;
  detail: string;
  reason: string;
  statusExplanation: ReturnType<typeof buildStatusExplanation>;
}
```

Add helper:

```ts
function decorateRuleChainItem({
  title,
  status,
  direction,
  detail,
  reason,
}: {
  title: string;
  status: TrinityJudgmentCriterion['status'];
  direction: DirectionTone;
  detail: string;
  reason: string;
}): AnalysisPageRuleChainItem {
  const statusMeta = getActionStatusMeta(status);
  return {
    title,
    status,
    displayStatusLabel: statusMeta.label,
    displayStatusIcon: statusMeta.icon,
    direction,
    directionLabel: getDirectionMeta(direction).label,
    detail,
    reason,
    statusExplanation: buildStatusExplanation({ status, direction, reason }),
  };
}
```

In `buildRuleChain()`, wrap every returned item with `decorateRuleChainItem()`. Use category-specific direction:

```ts
const decisionDirection = directionFromBias(decision.conclusion.bias);
const categoryDirection = category === 'spacetime'
  ? directionFromBias(decision.spacetime.direction_bias)
  : category === 'structure'
    ? directionFromStructure(decision.structure.direction)
    : decisionDirection;
```

Return decorated object:

```ts
return decorateRuleChainItem({
  title,
  status: criterion.status,
  direction: categoryDirection,
  detail: category === 'execution'
    ? normalizeExecutionDetail(criterion.detail)
    : normalizeRuleChainText(criterion.detail),
  reason: normalizeRuleChainText(criterion.label),
});
```

- [ ] **Step 4: Update TrinityRuleChain UI**

Modify `src/components/stock/TrinityRuleChain.tsx` imports:

```ts
import { getDirectionMeta } from '@/lib/trinity-display-vocabulary';
```

Remove `STATUS_META`. In render loop:

```tsx
const directionMeta = getDirectionMeta(item.direction);
```

Use card class:

```tsx
className={cn('gap-3 py-4 shadow-none', directionMeta.cardClassName)}
```

Replace badge with tooltip:

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge variant="outline" className={cn('cursor-help', directionMeta.badgeClassName)}>
        <span className="mr-1">{item.displayStatusIcon}</span>
        {item.displayStatusLabel}
      </Badge>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-sm text-sm leading-6">
      <div className="space-y-1">
        <div className="font-medium">{item.displayStatusLabel}</div>
        <p>交易含义：{item.statusExplanation.tradeMeaning}</p>
        <p>规则状态：{item.statusExplanation.ruleState}</p>
        <p>当前方向：{item.statusExplanation.directionLabel}</p>
        <p>当前原因：{item.statusExplanation.reason}</p>
      </div>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Update description:

```ts
const description = sourceLabel
  ? `${sourceLabel}${sourceLabel.endsWith('。') ? '' : '。'}每张卡展示方向、可执行度、判定依据和当前原因。`
  : '每张卡展示方向、可执行度、判定依据和当前原因。';
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm ts-check
```

Expected:

```text
fail 0
tsc exit 0
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/trinity-analysis-page-view-model.ts src/components/stock/TrinityRuleChain.tsx tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
git commit -m "实现：统一规则链交易状态与方向标签"
```

---

### Task 6: 周期详情改为级别子 Tab

**Files:**
- Modify: `src/components/stock/AnalysisPeriodDetails.tsx`
- Modify: `src/app/stock/[code]/analysis/page.tsx`
- Modify: `tests/helpers/tsx-test-loader.ts`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: Add failing test for period tabs**

Append to `tests/analysis-page-sections.test.ts`:

```ts
type AnalysisPeriodDetailsModule = typeof import('../src/components/stock/AnalysisPeriodDetails.tsx');

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
            trinity_decision: {
              level: 'daily',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '等待30分钟触发',
              },
              structure: {
                type: 'C单平台式',
                qualification: 'standard',
                direction: 'flat',
                explainability: { status: 'passed', reason: 'C平台成立', evidence: [] },
              },
              execution: {
                triggers: ['30分钟放量突破'],
                risk_flags: ['跌回平台下沿'],
                position_sizing: { reason: '不超过轻仓' },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
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
                },
              },
            },
          } as any,
        },
      ],
    })
  );

  assert.match(html, /周期详情/);
  assert.match(html, /日线/);
  assert.match(html, /该级别简明决策/);
  assert.match(html, /规则摘要/);
  assert.match(html, /证据区/);
  assert.match(html, /来源：日线三位一体判定/);
  assert.match(html, /触发条件/);
  assert.match(html, /风险条件/);
  assert.match(html, /风控约束/);
  assert.match(html, /结构类型/);
  assert.match(html, /标准C类结构/);
  assert.match(html, /共振对象：周线 → 日线/);
  assert.match(html, /上一级：周线/);
  assert.match(html, /当前级别：日线/);
  assert.doesNotMatch(html, /周期摘要/);
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
node --test tests/analysis-page-sections.test.ts
```

Expected:

```text
The input did not match /该级别简明决策/
```

- [ ] **Step 3: Add Tabs rewrite to test loader**

Modify `tests/helpers/tsx-test-loader.ts` `uiStubUrl`:

```ts
  export const Tabs = ({ children, className, ...props }) =>
    React.createElement('div', { ...props, className, 'data-slot': 'tabs' }, children);
  export const TabsList = slot('div', 'tabs-list');
  export const TabsTrigger = slot('button', 'tabs-trigger');
  export const TabsContent = slot('div', 'tabs-content');
```

Modify `rewriteImports()`:

```ts
    .replaceAll('"@/components/ui/tabs"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/tabs'", `'${uiStubUrl}'`)
```

- [ ] **Step 4: Replace Accordion with Tabs**

Modify imports in `src/components/stock/AnalysisPeriodDetails.tsx`:

```ts
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getActionStatusMeta, getDirectionMeta, getStructureTagMeta, directionFromBias } from '@/lib/trinity-display-vocabulary';
```

Remove Accordion imports.

Update props:

```ts
interface AnalysisPeriodDetailsProps {
  sections: AnalysisPeriodSection[];
  defaultLevelKey?: string | null;
}
```

Add helpers:

```ts
const PERIOD_LEVEL_LABELS: Record<string, string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

function resolvePeriodDecisionSource(section: AnalysisPeriodSection) {
  return section.period?.trinity_decision
    ? `来源：${section.label}三位一体判定`
    : '来源：结构解释链路回退';
}

function resolveLevelLabel(level?: string | null) {
  return level ? PERIOD_LEVEL_LABELS[level] ?? level : '未知级别';
}

function resolvePeriodDirection(section: AnalysisPeriodSection) {
  return directionFromBias(section.period?.trinity_decision?.conclusion.bias ?? null);
}

function resolvePeriodActionStatus(section: AnalysisPeriodSection) {
  const decision = section.period?.trinity_decision;
  if (!decision) {
    return getActionStatusMeta('info');
  }
  if (decision.conclusion.can_trade) {
    return getActionStatusMeta('passed');
  }
  if (decision.trade_qualification.position_permission === 'no_position') {
    return getActionStatusMeta('warning');
  }
  return getActionStatusMeta('info');
}

function resolvePeriodTriggers(section: AnalysisPeriodSection) {
  const decision = section.period?.trinity_decision;
  return decision?.execution.triggers?.length ? decision.execution.triggers : section.period?.structure?.execution?.trigger ?? [];
}

function resolvePeriodRisks(section: AnalysisPeriodSection) {
  const decision = section.period?.trinity_decision;
  return decision?.execution.risk_flags?.length ? decision.execution.risk_flags : section.period?.structure?.execution?.invalidation ?? [];
}

function resolvePeriodGuardrail(section: AnalysisPeriodSection) {
  return section.period?.trinity_decision?.execution.position_sizing.reason
    ?? section.period?.structure?.execution?.wait_reason
    ?? '暂无明确风控约束';
}

function resolveResonanceEvidence(section: AnalysisPeriodSection) {
  const nesting = section.period?.trinity_decision?.level_nesting;
  if (!nesting?.parent_level || !nesting.child_level) {
    return '级别共振：暂无父子级别共振数据。';
  }

  return [
    `共振对象：${resolveLevelLabel(nesting.parent_level)} → ${resolveLevelLabel(nesting.child_level)}`,
    `成立依据：${nesting.permission.reason}`,
    `仍需确认：${section.period?.trinity_decision?.conclusion.wait_reason ?? '等待触发级别确认'}`,
  ].join('｜');
}

function resolveBackgroundEvidence(section: AnalysisPeriodSection) {
  const nesting = section.period?.trinity_decision?.level_nesting;
  const gate = section.period?.structure?.interpretation?.spacetime_gate;
  const parentLabel = resolveLevelLabel(nesting?.parent_level);
  const currentLabel = resolveLevelLabel(nesting?.child_level ?? section.key);

  return [
    `上一级：${parentLabel}`,
    `当前级别：${currentLabel}`,
    `背景来源：${gate?.parent_status ?? '上一级时空状态 + 结构方向'}`,
    `交易含义：${gate?.wait_reason ?? nesting?.permission.reason ?? '等待当前级别确认'}`,
  ].join('｜');
}
```

Add render helpers:

```tsx
function LabelList({ fallback, items }: { fallback: string; items: Array<string | null | undefined> }) {
  const visibleItems = items.filter((item): item is string => Boolean(item));
  if (!visibleItems.length) {
    return <p className="text-sm text-muted-foreground">{fallback}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {visibleItems.map((item) => <Badge key={item} variant="secondary" className="whitespace-normal">{item}</Badge>)}
    </div>
  );
}

function PeriodDecisionCard({ section }: { section: AnalysisPeriodSection }) {
  const direction = resolvePeriodDirection(section);
  const directionMeta = getDirectionMeta(direction);
  const actionMeta = resolvePeriodActionStatus(section);
  const structureTag = getStructureTagMeta(section.period?.trinity_decision?.structure.type ?? section.period?.structure?.structure_type);
  return (
    <section className={`rounded-xl border p-4 ${directionMeta.cardClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">该级别简明决策</h3>
          <p className="text-xs text-muted-foreground">{resolvePeriodDecisionSource(section)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={directionMeta.badgeClassName}>{directionMeta.label}</Badge>
          <Badge variant="outline">{actionMeta.label}</Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn('cursor-help', structureTag.className)}>{structureTag.label}</Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm text-sm leading-6">
                <div className="space-y-1">
                  <div className="font-medium">结构类型：{structureTag.label}</div>
                  <p>{structureTag.explanation}</p>
                  <p>交易含义：{structureTag.tradeMeaning}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">触发条件</div>
          <div className="mt-2"><LabelList fallback="暂无明确触发条件" items={resolvePeriodTriggers(section)} /></div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">风险条件</div>
          <div className="mt-2"><LabelList fallback="暂无明确风险条件" items={resolvePeriodRisks(section)} /></div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">风控约束</div>
          <p className="mt-2 rounded-lg border bg-background/70 p-2 text-sm">{resolvePeriodGuardrail(section)}</p>
        </div>
      </div>
    </section>
  );
}

function PeriodRuleSummary({ section }: { section: AnalysisPeriodSection }) {
  return (
    <section className="space-y-3 rounded-xl border bg-background/70 p-4">
      <h3 className="text-sm font-semibold">规则摘要</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <div><div className="text-xs text-muted-foreground">结构</div><p className="mt-1 text-sm">{resolveStructureEvidence(section)}</p></div>
        <div><div className="text-xs text-muted-foreground">时空</div><p className="mt-1 text-sm">{resolveSpacetimeStatus(section)}</p></div>
        <div><div className="text-xs text-muted-foreground">均线 / 量能</div><p className="mt-1 text-sm">{resolveMovingAverageStatus(section)}</p></div>
        <div><div className="text-xs text-muted-foreground">级别共振</div><p className="mt-1 text-sm">{resolveResonanceEvidence(section)}</p></div>
        <div><div className="text-xs text-muted-foreground">大背景</div><p className="mt-1 text-sm">{resolveBackgroundEvidence(section)}</p></div>
      </div>
    </section>
  );
}
```

Replace the return body with Tabs:

```tsx
export function AnalysisPeriodDetails({ sections, defaultLevelKey }: AnalysisPeriodDetailsProps) {
  if (!sections.length) {
    return null;
  }

  const defaultValue =
    sections.find((section) => section.key === defaultLevelKey)?.key ??
    sections.find((section) => section.defaultOpen)?.key ??
    sections.find((section) => section.key === 'daily' || section.label === '日线')?.key ??
    sections[0]?.key;

  return (
  <section className="space-y-3" aria-label="周期详情">
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">周期详情</h2>
      <p className="text-sm text-muted-foreground">按级别切换查看该级别自己的简明决策、规则摘要和证据。</p>
    </div>

    <Tabs defaultValue={defaultValue} className="space-y-4">
      <TabsList className="flex flex-wrap justify-start">
        {sections.map((section) => (
          <TabsTrigger key={section.key} value={section.key}>{section.label}</TabsTrigger>
        ))}
      </TabsList>

      {sections.map((section) => {
        const explainabilityStructure = buildExplainabilityStructure(section.period);
        return (
          <TabsContent key={section.key} value={section.key} className="space-y-4">
            <PeriodDecisionCard section={section} />
            <PeriodRuleSummary section={section} />
            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">证据区</h3>
                <p className="text-xs text-muted-foreground">{[section.rangeLabel, resolveSummary(section)].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="rounded-md border border-dashed bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{resolveTopologyTitle(section)}</div>
                <div className="mt-1">{resolveStructureEvidence(section)}</div>
              </div>
              {explainabilityStructure ? (
                <StructureExplainabilityPanel
                  structure={explainabilityStructure}
                  executionSummary={buildExecutionSummary(section.period)}
                  structureColors={STRUCTURE_COLORS}
                />
              ) : null}
            </section>
          </TabsContent>
        );
      })}
    </Tabs>
  </section>
  );
}
```

Update `src/app/stock/[code]/analysis/page.tsx`:

```tsx
<AnalysisPeriodDetails
  sections={periodSections}
  defaultLevelKey={pageViewModel.globalStrategy.primaryConstraintLevel}
/>
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/analysis-page-sections.test.ts tests/structure-explainability-panel.test.ts
pnpm ts-check
```

Expected:

```text
fail 0
tsc exit 0
```

- [ ] **Step 6: Commit**

```bash
git add src/components/stock/AnalysisPeriodDetails.tsx src/app/stock/'[code]'/analysis/page.tsx tests/helpers/tsx-test-loader.ts tests/analysis-page-sections.test.ts
git commit -m "实现：将周期详情升级为级别子Tab"
```

---

### Task 7: 调整 AI 提示词的全局作用域说明

**Files:**
- Modify: `src/app/api/stock/ai-analysis/route.ts`
- Create: `tests/ai-analysis-prompt-source.test.ts`

- [ ] **Step 1: Add failing source test for prompt wording**

Create `tests/ai-analysis-prompt-source.test.ts`:

```ts
import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const routeSource = await fs.readFile('src/app/api/stock/ai-analysis/route.ts', 'utf8');

test('AI prompt defines global scope by three trading combinations', () => {
  assert.match(routeSource, /页面级综合结论/);
  assert.match(routeSource, /中线主策略组合（周线→日线）/);
  assert.match(routeSource, /短线执行组合（日线→30分钟）/);
  assert.match(routeSource, /超短线 \/ T 组合（60分钟→15分钟）/);
  assert.match(routeSource, /主约束级别/);
  assert.match(routeSource, /触发级别/);
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
node --test tests/ai-analysis-prompt-source.test.ts
```

Expected:

```text
The input did not match /页面级综合结论/
```

- [ ] **Step 3: Update prompt wording**

In `src/app/api/stock/ai-analysis/route.ts`, find the prompt section that currently says:

```text
1. **维度一（周线→日线）**：判断大级别趋势方向
2. **维度二（日线→30分钟）**：寻找具体买卖点
3. **维度三（60分钟→15分钟）**：日内或短线操作
```

Replace with:

```text
你需要生成“页面级综合结论”，它不是单一日线结论，而是综合以下三条交易组合：
1. **中线主策略组合（周线→日线）**：周线定大背景、方向和仓位上限，日线定中线结构和主策略窗口。
2. **短线执行组合（日线→30分钟）**：日线定主策略和风险边界，30分钟负责触发、回踩确认和具体买卖点。
3. **超短线 / T 组合（60分钟→15分钟）**：60分钟定短周期节奏，15分钟负责微观触发和快进快出。

输出策略摘要时必须明确：
- 当前优先交易组合
- 主约束级别
- 触发级别
- 当前方向：偏多 / 偏空 / 中性
- 当前动作：可执行 / 观察中 / 谨慎看 / 暂不做
```

保留现有 JSON summary contract，不修改 `parseAiReportContract()` 的输入输出字段，避免影响 AI 结果解析兼容性。

- [ ] **Step 4: Run prompt test**

Run:

```bash
node --test tests/ai-analysis-prompt-source.test.ts
```

Expected:

```text
pass 1
fail 0
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stock/ai-analysis/route.ts tests/ai-analysis-prompt-source.test.ts
git commit -m "实现：明确AI综合判断的交易组合作用域"
```

---

### Task 8: 全量回归与最终提交整理

**Files:**
- Inspect: touched files from Task 1-7.

- [ ] **Step 1: Run focused UI and ViewModel tests**

Run:

```bash
node --test tests/trinity-display-vocabulary.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts tests/structure-explainability-panel.test.ts tests/structure-explainability-view-model.test.ts tests/ai-analysis-prompt-source.test.ts
```

Expected:

```text
fail 0
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
pnpm ts-check
```

Expected:

```text
tsc -p tsconfig.json
```

and exit code `0`.

- [ ] **Step 3: Run browser smoke test on port 5001**

Run dev server on the project default development port:

```bash
PORT=5001 pnpm dev
```

Expected:

```text
ready
```

Open a stock analysis page and verify visually:

- 顶部展示 `页面级综合结论`
- 硬门控标题为 `主策略硬门控`
- 存在 `交易周期总线`
- 不再展示 `维度一 / 维度二 / 维度三`
- 周期详情使用 `周线 / 日线 / 60分钟 / 30分钟 / 15分钟` 子 Tab
- 红色表示偏多，绿色表示偏空，灰色表示中性

- [ ] **Step 4: Check git status and commit remaining fixes**

Run:

```bash
git status --short
```

Expected before the final status check:

```text
No uncommitted implementation changes except intentional test artifacts or task commits.
```

Inspect with:

```bash
git diff --stat
```

When `git diff --stat` prints files, inspect the diff and commit remaining fixes with a Chinese message that describes the actual change.
