# 交易周期总线三位一体信号清晰化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让交易周期总线按三位一体策略清楚表达“父级约束、子级依据、当前动作”，避免抽象的“父级不明 / 次级别共振 / 等待触发”。

**Architecture:** 本阶段优先改展示层和 view model，不改 `scripts/stock_analyzer.py` 的确定性合同。交易周期总线按组合语境生成标签：父级约束只展示父级三位一体证据，当前动作状态展示具体父级/子级级别，hover 中所有“父级/子级/次级别”替换为周线、日线、60分钟、30分钟、15分钟等具体级别。

**Tech Stack:** Next.js App Router, React 19, TypeScript, node:test, shadcn/ui Tooltip/Badge, Tailwind CSS v4。

---

## 文件结构与职责

- Modify: `src/lib/trinity-analysis-page-view-model.ts`
  - 生成交易组合语境化标签。
  - 过滤父级约束标签中的 `级别 / 执行`。
  - 用具体级别重写组合 summary、recommendation、hover 的等待条件。
- Modify: `src/components/stock/TradingCycleBus.tsx`
  - 消费新的父级约束标签字段。
  - 保持父级约束、子级依据、当前动作状态三层展示。
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
  - 锁定 VM 中具体级别文案、父级标签过滤、执行条件去抽象化。
- Modify: `tests/analysis-page-sections.test.ts`
  - 锁定组件 HTML 不再出现父子级明细、父级约束不重复展示级别/执行标签。

## Task 1: 锁定交易组合标签职责

**Files:**
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 写 view model 失败测试**

在 `tests/trinity-analysis-page-view-model.test.ts` 的交易组合断言附近增加断言：

```ts
assert.equal(shortline.relationLabel, '日线未放行，30分钟先看确认');
assert.deepEqual(shortline.actionStateTags.map((tag) => tag.label), [
  '级别｜日线未放行',
  '执行｜30分钟等待触发',
]);
assert.deepEqual(shortline.parentConstraintTags.map((tag) => tag.label), [
  '时空｜中偏强',
  '突破/跌破｜有效突破',
  '量能｜突破量弱',
  '均线｜MA55支撑',
  '结构｜A五段式',
]);
assert.ok(
  shortline.actionStateTags.every((tag) =>
    tag.hover.items.every((item) => !item.value.includes('次级别'))
  )
);
```

- [ ] **Step 2: 写组件失败测试**

在 `tests/analysis-page-sections.test.ts` 的 `TradingCycleBus groups signal tags into three layered sections` 中确认：

```ts
assert.match(html, /级别｜日线未放行/);
assert.match(html, /执行｜30分钟等待触发/);
assert.doesNotMatch(html, /级别｜父级不明/);
assert.doesNotMatch(html, /次级别结构继续共振/);
assert.doesNotMatch(html, /父级约束[\s\S]*级别｜/);
assert.doesNotMatch(html, /父级约束[\s\S]*执行｜/);
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
```

Expected: FAIL，失败原因应为仍出现 `父级不明`、父级约束重复 `级别 / 执行`，或缺少新字段 `parentConstraintTags`。

## Task 2: 在 view model 生成组合语境标签

**Files:**
- Modify: `src/lib/trinity-analysis-page-view-model.ts`

- [ ] **Step 1: 扩展类型**

给 `AnalysisPageTradingCombinationViewModel` 增加：

```ts
parentConstraintTags: AnalysisPageSignalTagViewModel[];
```

- [ ] **Step 2: 增加父级证据过滤函数**

```ts
function buildParentConstraintTags(decision: TrinityDecision | null): AnalysisPageSignalTagViewModel[] {
  return filterSignalTagsByKeys(buildDecisionSignalTags(decision), [
    'spacetime',
    'divergence',
    'breakthrough',
    'volume',
    'moving_average',
    'structure',
  ]);
}
```

- [ ] **Step 3: 增加组合级别标签函数**

```ts
function buildCombinationLevelTag(
  majorLabel: string,
  minorLabel: string,
  major: TrinityDecision | null,
  minor: TrinityDecision | null
): AnalysisPageSignalTagViewModel | null {
  const relation = minor?.level_nesting ?? major?.level_nesting;
  const result = major?.trade_qualification.position_permission === 'no_position'
    ? `${majorLabel}未放行`
    : relation?.resonance === 'aligned'
      ? `${majorLabel}支持`
      : relation?.resonance === 'child_countertrend' || relation?.resonance === 'conflict'
        ? `${minorLabel}逆${majorLabel}`
        : `${majorLabel}未放行`;

  return buildCustomSignalTag('level_nesting', '级别', result, 'neutral', [
    { label: '父级别', value: majorLabel },
    { label: '子级别', value: minorLabel },
    { label: '说明', value: `${majorLabel}未完全放行，${minorLabel}只能等待确认。` },
  ]);
}
```

同时新增私有 helper `buildCustomSignalTag()`，按 `TrinitySignalTag` 结构生成标签，避免修改 `buildDecisionSignalTags()` 的全局语义。

- [ ] **Step 4: 增加组合执行标签函数**

```ts
function buildCombinationExecutionTag(
  minorLabel: string,
  minor: TrinityDecision | null
): AnalysisPageSignalTagViewModel | null {
  const trigger = resolvePrimaryTriggerText(minor).replace(/次级别/g, minorLabel);
  return buildCustomSignalTag('execution', '执行', `${minorLabel}等待触发`, 'neutral', [
    { label: '执行级别', value: minorLabel },
    { label: '当前动作', value: '继续等待' },
    { label: '等待条件', value: trigger },
  ]);
}
```

- [ ] **Step 5: 接入 `buildCombination()`**

在返回值里改为：

```ts
const parentConstraintTags = buildParentConstraintTags(major);
const actionStateTags = [
  buildCombinationLevelTag(majorLabel, minorLabel, major, minor),
  buildCombinationExecutionTag(minorLabel, minor),
].filter((tag): tag is AnalysisPageSignalTagViewModel => Boolean(tag));
```

并返回：

```ts
actionStateTags,
parentConstraintTags,
parentSignalTags: parentConstraintTags,
```

保留 `parentSignalTags` 作为兼容字段，组件过渡期可继续使用。

- [ ] **Step 6: 运行 view model 测试**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts
```

Expected: PASS。

## Task 3: 更新组件消费父级约束标签

**Files:**
- Modify: `src/components/stock/TradingCycleBus.tsx`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 组件优先使用 `parentConstraintTags`**

在 `TradingCycleBus` 中替换：

```ts
const parentSignalTags = combination.parentSignalTags ?? [];
```

为：

```ts
const parentConstraintTags = combination.parentConstraintTags?.length
  ? combination.parentConstraintTags
  : combination.parentSignalTags ?? [];
```

父级约束卡片内渲染 `parentConstraintTags`。

- [ ] **Step 2: 去掉未使用的 `childSignalTags`**

如果组件中只为已删除的父子级明细保留 `childSignalTags`，删除对应变量，避免误导。

- [ ] **Step 3: 运行组件测试**

Run:

```bash
node --test tests/analysis-page-sections.test.ts
```

Expected: PASS。

## Task 4: 验证与收尾

**Files:**
- No additional source files.

- [ ] **Step 1: 运行相关测试**

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
```

Expected: all tests pass。

- [ ] **Step 2: 运行类型检查**

```bash
pnpm exec tsc --noEmit
```

Expected: exit 0。

- [ ] **Step 3: 检查 diff**

```bash
git diff -- src/lib/trinity-analysis-page-view-model.ts src/components/stock/TradingCycleBus.tsx tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
```

Expected: diff 只包含交易周期总线标签职责、具体级别文案和测试更新。

## 后续阶段

- 将 `scripts/stock_analyzer.py` 中已有 `SPACETIME_STRUCTURE_TABLE` 真正接入 `_build_trinity_level_nesting_decision()`。
- 结构匹配按 A/B/C/D 原型处理，延伸 A/B/C/D 沿用同原型但执行强度降级。
- B 类补 `b1/b3/b5/b7`，D 类补 `d1/d2/d3/d4`，C 类补中枢上下沿和严格止损。
