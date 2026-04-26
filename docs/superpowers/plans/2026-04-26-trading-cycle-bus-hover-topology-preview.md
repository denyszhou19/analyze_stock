# 交易周期总线 Hover 拓扑摘要 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只在交易周期总线内，为标签 hover 和说明 hover 增加轻量复用型结构拓扑摘要，并同步修复 tooltip 宽度与提前换行问题。

**Architecture:** 在 `buildAnalysisPageViewModel()` 中为每条交易组合补充父级/子级拓扑摘要预览数据；`TradingCycleBus`、`SignalTagList`、`ExplainableFact` 只消费这些预览数据，不自行推断结构图。结构图直接复用现有 `StructureTopologySvg` 与 explainability 数据，有 explainability 时叠加解释层，无 explainability 时退化成纯画线 + 客观摘要。

**Tech Stack:** TypeScript, React 19, Next.js App Router, node:test, `pnpm`, 现有 tooltip / structure topology 组件链路。

---

## 文件结构与职责

- Modify: `src/lib/trinity-analysis-page-view-model.ts`
  - 为交易组合补充父级/子级拓扑摘要 view model
  - 锁定“父级约束看父级，其他总线 hover 看子级”
- Create: `src/components/stock/TradingCycleTopologyPreviewCard.tsx`
  - 总线专用 hover 内容卡
  - 负责渲染拓扑图、三行摘要、纯画线 fallback
- Modify: `src/components/stock/SignalTagList.tsx`
  - 支持可选 `topologyPreview`
  - 在总线场景下渲染宽版 hover 卡
- Modify: `src/components/stock/ExplainableFact.tsx`
  - 支持可选 `topologyPreview`
  - 在总线说明 hover 中渲染宽版 hover 卡
- Modify: `src/components/stock/TradingCycleBus.tsx`
  - 把父级/子级拓扑摘要绑定到对应 hover 入口
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
  - 锁定父级/子级取图规则、annotated/raw_lines/unavailable 三种模式
- Modify: `tests/analysis-page-sections.test.ts`
  - 锁定总线 hover 真实渲染、宽版布局、纯画线 fallback、不泄漏英文内部枚举

## 范围守卫

以下内容不在本计划内：

1. 不修改页面底部原有结构拓扑区的位置和布局
2. 不给全页面所有标签 hover 添加拓扑图
3. 不新增后端字段，不修改后端判定
4. 不新增前端根据标签内容猜结构/猜级别的逻辑
5. 不把 hover 做成完整结构详情面板

### Task 0: 基线确认

**Files:**
- No source changes.

- [ ] **Step 1: 查看工作区与最近提交**

Run:

```bash
git status --short
git log --oneline -6
```

Expected:

- 工作区干净
- 最近提交包含 `2026-04-26-trading-cycle-bus-hover-topology-preview-design.md`

- [ ] **Step 2: 运行当前总线相关前端基线测试**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
```

Expected:

- 两条命令全部通过
- 现有总线 hover 行为稳定，再开始写失败测试

### Task 1: 先写 view model 失败测试，锁定父级/子级取图规则

**Files:**
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
- Modify: `src/lib/trinity-analysis-page-view-model.ts`

- [ ] **Step 1: 为交易组合新增拓扑摘要合同失败测试**

在 `tests/trinity-analysis-page-view-model.test.ts` 追加一组围绕 `shortline` 的失败测试，覆盖三件事：

1. `parentConstraint` / `parentConstraintTags` 使用父级预览
2. `actionStateTags`、`judgmentBasisTags`、`triggerLevel`、`suitableAction`、`majorRisk` 使用子级预览
3. explainability 完整与不完整时，分别进入 `annotated` 与 `raw_lines`

测试形态示例：

```ts
test('trading combinations expose parent and child topology previews on the correct hover targets', () => {
  const result = createResult();
  result.periods.daily = {
    ...result.periods.daily,
    structure: {
      ...result.periods.daily.structure,
      structure_type: 'B双平台式',
      description: '日线平台整理后等待方向选择',
      structure_details: {
        ...result.periods.daily.structure?.structure_details,
        render_payload: { point_count: 4, segment_count: 3, viewport: { width: 100, height: 40 } },
        explainability: {
          structure_family: 'B',
          structure_start_point_id: 'b1',
          current_point_id: 'b3',
          current_segment: { from_point_id: 'b2', to_point_id: 'b3', label: 'b2→b3 回踩确认' },
          next_segment_preview: {
            from_point_id: 'b3',
            to_point_id: 'b5',
            label: '等待 b5 中继确认',
            status: 'projected',
          },
          point_labels: [],
          segment_labels: [],
          display_reason: '日线当前仍在平台整理阶段',
        },
      },
    },
  };
  result.periods.hour30 = {
    ...result.periods.hour30,
    structure: {
      ...result.periods.hour30.structure,
      structure_type: 'C单平台式',
      description: '30分钟平台待突破',
      structure_details: {
        ...result.periods.hour30.structure?.structure_details,
        render_payload: { point_count: 5, segment_count: 4, viewport: { width: 100, height: 40 } },
        explainability: {
          structure_family: 'C',
          structure_start_point_id: 'c1',
          current_point_id: 'c4',
          current_segment: { from_point_id: 'c4', to_point_id: 'live', label: 'c4→进行中 上行形成中' },
          next_segment_preview: {
            from_point_id: 'live',
            to_point_id: 'c5',
            label: '等待突破平台上沿确认',
            status: 'projected',
          },
          point_labels: [],
          segment_labels: [],
          display_reason: '30分钟当前处于平台待突破阶段',
        },
      },
    },
  };

  const vm = buildAnalysisPageViewModel({ result, integrity: createIntegrity(), aiState: { status: 'idle' } });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.equal(shortline?.parentTopologyPreview?.level, 'daily');
  assert.equal(shortline?.parentTopologyPreview?.mode, 'annotated');
  assert.equal(shortline?.parentTopologyPreview?.summaryRows[0]?.label, '当前结构');
  assert.equal(shortline?.childTopologyPreview?.level, 'hour30');
  assert.equal(shortline?.childTopologyPreview?.mode, 'annotated');
  assert.equal(shortline?.childTopologyPreview?.summaryRows[1]?.label, '当前阶段');
});
```

- [ ] **Step 2: 增加 explainability 缺失时的纯画线 fallback 失败测试**

在同一文件追加：

```ts
test('topology preview falls back to raw lines when render payload exists without explainability', () => {
  const result = createResult();
  result.periods.hour30 = {
    ...result.periods.hour30,
    structure: {
      ...result.periods.hour30.structure,
      structure_type: '复杂结构',
      description: '30分钟当前只有基础结构线',
      structure_details: {
        ...result.periods.hour30.structure?.structure_details,
        render_payload: { point_count: 5, segment_count: 4, viewport: { width: 100, height: 40 } },
        explainability: null,
      },
    },
  };

  const vm = buildAnalysisPageViewModel({ result, integrity: createIntegrity(), aiState: { status: 'idle' } });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.equal(shortline?.childTopologyPreview?.mode, 'raw_lines');
  assert.deepEqual(shortline?.childTopologyPreview?.summaryRows.map((row) => row.label), [
    '当前结构',
    '原始描述',
    '数据状态',
  ]);
});
```

- [ ] **Step 3: 运行单测，确认 RED**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts
```

Expected:

- 新增测试失败
- 失败点集中在缺少 `parentTopologyPreview` / `childTopologyPreview` 字段或 fallback 模式不对

- [ ] **Step 4: 在 view model 中补最小实现**

在 `src/lib/trinity-analysis-page-view-model.ts`：

1. 新增 `AnalysisPageTopologyPreviewViewModel`
2. 在 `AnalysisPageTradingCombinationViewModel` 上增加：
   - `parentTopologyPreview?: AnalysisPageTopologyPreviewViewModel | null`
   - `childTopologyPreview?: AnalysisPageTopologyPreviewViewModel | null`
3. 新增 helper：
   - `buildTopologyPreviewForLevel(result, level)`
   - `buildAnnotatedSummaryRows(...)`
   - `buildRawLinesSummaryRows(...)`
4. 在 `buildCombination()` 中分别注入父级和子级预览

- [ ] **Step 5: 重新运行 view model 单测，确认转绿**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts
```

Expected:

- 新增测试通过
- 既有测试不回归

- [ ] **Step 6: Commit**

```bash
git add tests/trinity-analysis-page-view-model.test.ts src/lib/trinity-analysis-page-view-model.ts
git commit -m "前端：补充总线拓扑摘要视图模型"
```

### Task 2: 增加总线专用 hover 卡与组件接线

**Files:**
- Create: `src/components/stock/TradingCycleTopologyPreviewCard.tsx`
- Modify: `src/components/stock/SignalTagList.tsx`
- Modify: `src/components/stock/ExplainableFact.tsx`
- Modify: `src/components/stock/TradingCycleBus.tsx`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 先写总线 hover 真实渲染失败测试**

在 `tests/analysis-page-sections.test.ts` 追加：

1. 父级约束 hover 渲染父级结构标题/当前结构
2. 子级判断依据 hover 渲染子级结构标题/当前阶段/下一确认
3. explainability 缺失但 render payload 存在时显示“纯画线模式”摘要

测试形态示例：

```ts
test('TradingCycleBus hover renders parent preview for parent constraint and child preview elsewhere', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>('src/components/stock/TradingCycleBus.tsx');
  const vm = buildAnalysisPageViewModel({ result: createModifierRichResult(), integrity: createIntegrity(), aiState: { status: 'idle' } });

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: vm.tradingCombinations,
    })
  );

  assert.match(html, /日线结构拓扑摘要/);
  assert.match(html, /30分钟结构拓扑摘要/);
  assert.match(html, /当前结构：B双平台式/);
  assert.match(html, /当前阶段：c4→进行中 上行形成中/);
  assert.match(html, /下一确认：等待突破平台上沿确认/);
});
```

- [ ] **Step 2: 运行组件测试，确认 RED**

Run:

```bash
node --test tests/analysis-page-sections.test.ts
```

Expected:

- 新增测试失败
- 失败点集中在 hover 中还没有拓扑摘要卡

- [ ] **Step 3: 新建总线专用 hover 拓扑卡组件**

在 `src/components/stock/TradingCycleTopologyPreviewCard.tsx` 中：

1. 复用 `StructureTopologySvg`
2. 支持 `annotated` / `raw_lines` / `unavailable`
3. 渲染：
   - 标题
   - 结构图
   - 三行摘要

组件职责只做展示，不参与级别判断。

- [ ] **Step 4: 让 SignalTagList / ExplainableFact 支持可选拓扑摘要**

实现方式：

1. `SignalTagList` 新增可选 prop：`topologyPreview?: AnalysisPageTopologyPreviewViewModel | null`
2. `ExplainableFact` 新增可选 prop：`topologyPreview?: AnalysisPageTopologyPreviewViewModel | null`
3. 若传入 `topologyPreview`，则在 hover 顶部渲染 `TradingCycleTopologyPreviewCard`
4. 若未传入，保持现状

- [ ] **Step 5: 在 TradingCycleBus 中按区域接线**

在 `src/components/stock/TradingCycleBus.tsx` 中：

1. `父级约束` 卡片本体与其下 tags 传 `combination.parentTopologyPreview`
2. `当前动作状态`、`子级综合判断依据` 传 `combination.childTopologyPreview`
3. `触发级别`、`适合动作`、`主要风险` 传 `combination.childTopologyPreview`

- [ ] **Step 6: 重新运行组件测试，确认转绿**

Run:

```bash
node --test tests/analysis-page-sections.test.ts
```

Expected:

- 新增 hover 拓扑摘要测试通过
- 原有总线组件测试不回归

- [ ] **Step 7: Commit**

```bash
git add src/components/stock/TradingCycleTopologyPreviewCard.tsx src/components/stock/SignalTagList.tsx src/components/stock/ExplainableFact.tsx src/components/stock/TradingCycleBus.tsx tests/analysis-page-sections.test.ts
git commit -m "前端：接入总线 hover 拓扑摘要卡"
```

### Task 3: 修 tooltip 宽度、换行与回归细节

**Files:**
- Modify: `src/components/stock/SignalTagList.tsx`
- Modify: `src/components/stock/ExplainableFact.tsx`
- Modify: `tests/analysis-page-sections.test.ts`
- Modify: `tests/trinity-analysis-page-view-model.test.ts`

- [ ] **Step 1: 补宽版 hover 与换行行为测试**

在 `tests/analysis-page-sections.test.ts` 追加断言：

1. 总线 hover 使用宽版 class
2. 不再依赖窄版 `max-w-sm`
3. 说明字段使用两列式标签布局

至少锁这些文案/结构：

```ts
assert.match(html, /结构拓扑摘要/);
assert.match(html, /当前结构/);
assert.match(html, /当前阶段|原始描述/);
assert.match(html, /下一确认|数据状态/);
```

- [ ] **Step 2: 最小样式修正**

在 `SignalTagList` 与 `ExplainableFact` 中：

1. 仅当存在 `topologyPreview` 时启用总线专用宽版 tooltip class
2. 使用更宽的 `max-w-[min(86vw,52rem)]`
3. 用 `p-0 text-left [text-wrap:wrap]` 覆盖当前窄 tooltip 的视觉限制
4. 把摘要区排成“左标签 / 右正文”的两列说明式布局

- [ ] **Step 3: 跑完整前端回归**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
git diff --check
```

Expected:

- 三条命令全部通过

- [ ] **Step 4: Commit**

```bash
git add src/components/stock/SignalTagList.tsx src/components/stock/ExplainableFact.tsx tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
git commit -m "前端：优化总线 hover 拓扑摘要排版"
```

### Task 4: 最终验证与收口

**Files:**
- No new source files.

- [ ] **Step 1: 跑完整相关测试**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
git diff --check
```

Expected:

- 三条命令全部通过

- [ ] **Step 2: 人工 spot-check 关键合同**

确认：

1. 父级约束 hover 显示父级级别标题
2. 子级 hover 显示子级级别标题
3. `annotated` 模式显示 `当前结构 / 当前阶段 / 下一确认`
4. `raw_lines` 模式显示 `当前结构 / 原始描述 / 数据状态`
5. 不影响其他非总线 tooltip

- [ ] **Step 3: 清理测试副产物并确认工作区**

Run:

```bash
git status --short
```

Expected:

- 只有本计划相关变更

- [ ] **Step 4: Push**

```bash
git push origin stock_0316
```
