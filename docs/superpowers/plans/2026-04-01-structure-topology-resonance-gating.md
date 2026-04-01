# 结构拓扑可解释性与时空门控实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让分析页结构拓扑严格服从“时空层 -> 结构层 -> 执行层”的判断顺序，正确展示聚焦起点/最后确认点/进行中点，并在结构不匹配或识别不清时明确降级为等待态或复杂结构。

**Architecture:** 先在 `stock_analyzer.py` 中补足时空门控与复杂结构降级的稳定字段，再让 TypeScript 视图模型把这些字段翻译成前端可消费的中文语义，最后重做 `StructureTopologySvg` 与 `StructureExplainabilityPanel` 的信息层级，确保图上不再伪造标准起点、不再把历史点叫成当前点、也不再把原型直接包装成交易结论。

**Tech Stack:** Python (`scripts/stock_analyzer.py`, `unittest`)、TypeScript (`node:test`)、React/Next.js App Router、Tailwind/shadcn/ui

---

## 文件结构

- 修改: `scripts/stock_analyzer.py`
  - 为 `interpretation` 增加时空门控字段，明确父级时空状态、允许的小级别结构、是否匹配、是否允许结构共振、等待原因和下一确认。
- 修改: `tests/test_structure_interpretation_model.py`
  - 覆盖时空门控、复杂结构降级、等待原因的 Python 单元测试。
- 修改: `tests/test_structure_phase_execution.py`
  - 保证 execution 层在门控不通过时回到等待态，并复用新的等待原因。
- 修改: `src/lib/stock-structure-types.ts`
  - 补齐前端类型，避免 UI 继续从模糊字段硬推语义。
- 修改: `src/lib/structure-explainability-view-model.ts`
  - 把后端门控字段转成 UI 用的主结论、等待态、聚焦点和下一确认摘要。
- 修改: `tests/structure-explainability-view-model.test.ts`
  - 验证新视图模型不再把 `current_point_id` 当成“当前段”，并能输出等待态。
- 修改: `src/components/stock/StructureTopologySvg.tsx`
  - 移除点位贴纸式“起点/当前”，改成轻量外环与中文化的图外语义。
- 修改: `tests/structure-topology-svg.test.ts`
  - 验证 SVG 不再输出英文 `live`、不再把历史确认点渲染成“当前”贴纸。
- 修改: `src/components/stock/StructureExplainabilityPanel.tsx`
  - 让 badge、摘要卡、补充卡只表达单一职责，并优先展示“可不可以做 / 等什么做 / 为什么不能做”。
- 修改: `tests/structure-explainability-panel.test.ts`
  - 验证面板中文化、去技术 key、复杂结构/不匹配结构的等待态表达。
- 修改: `src/lib/stock-execution-view-model.ts`
  - 让执行摘要优先显示等待原因而不是继续强化原型。
- 修改: `tests/stock-execution-view-model.test.ts`
  - 验证等待态 summary 的优先级。
- 修改: `src/lib/ai-analysis-payload.ts`
  - 将新的时空门控字段透传给 AI payload，避免 AI 继续把不匹配结构当作可执行结构。
- 修改: `tests/ai-analysis-payload.test.ts`
  - 验证 payload 保留门控字段与等待原因。

### Task 1: 后端补足时空门控与复杂结构降级

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_structure_interpretation_model.py`
- Test: `tests/test_structure_phase_execution.py`

- [ ] **Step 1: 写失败测试，固定“时空允许结构白名单”和“复杂结构不可作为正向触发”**

```python
def test_build_structure_interpretation_marks_unmatched_minor_structure_as_wait_state(self) -> None:
    interpretation = self.analyzer._build_structure_interpretation(
        structure_type='A五段式',
        trend_direction='上涨',
        explanation={'structure_start_point_id': 'a1'},
        prediction={'current_stage': 'a3拐点', 'next_stage': 'a4拐点'},
        moving_averages={
            'price_vs_ma55': 'above',
            'price_vs_ma233': 'above',
            'ma_status': '多头排列',
        },
        peak_analysis=None,
        labeled_points=[
            {'point_id': 'a1', 'price': 10.0, 'date': '2024-01-01 00:00'},
            {'point_id': 'a2', 'price': 12.0, 'date': '2024-01-02 00:00'},
            {'point_id': 'a3', 'price': 11.0, 'date': '2024-01-03 00:00'},
            {'point_id': 'live', 'price': 11.8, 'date': '2024-01-04 00:00', 'is_current': True},
        ],
        valid_range=None,
        parent_spacetime_status='中偏强',
    )

    gate = interpretation['spacetime_gate']
    self.assertEqual(gate['parent_status'], '中偏强')
    self.assertEqual(gate['allowed_child_structures'], ['C'])
    self.assertFalse(gate['child_structure_match'])
    self.assertFalse(gate['resonance_enabled'])
    self.assertIn('暂不操作', gate['wait_reason'])
```

```python
def test_build_structure_interpretation_degrades_unclear_structure_to_complex_wait_state(self) -> None:
    interpretation = self.analyzer._build_structure_interpretation(
        structure_type='复杂结构',
        trend_direction='上涨',
        explanation={'structure_start_point_id': 'p1'},
        prediction={'current_stage': '第3个拐点', 'next_stage': '方向选择'},
        moving_averages={
            'price_vs_ma55': 'above',
            'price_vs_ma233': 'above',
            'ma_status': '多头排列',
        },
        peak_analysis=None,
        labeled_points=[
            {'point_id': 'p1', 'price': 10.0, 'date': '2024-01-01 00:00'},
            {'point_id': 'p2', 'price': 12.0, 'date': '2024-01-02 00:00'},
            {'point_id': 'live', 'price': 11.5, 'date': '2024-01-03 00:00', 'is_current': True},
        ],
        valid_range=None,
        parent_spacetime_status='强',
    )

    gate = interpretation['spacetime_gate']
    self.assertEqual(interpretation['focus_structure']['archetype_family'], 'complex')
    self.assertFalse(gate['resonance_enabled'])
    self.assertEqual(gate['structure_readiness'], 'complex')
    self.assertIn('等待', gate['required_confirmation'])
```

```python
def test_build_period_execution_uses_spacetime_gate_wait_reason_before_generic_wait(self) -> None:
    execution = self.analyzer._build_period_execution(
        level='hour30',
        latest_price=163.35,
        macd_status='中偏强',
        moving_averages={'ma_status': '多头排列', 'price_vs_ma55': 'above'},
        ma_physics={'support_pressure': {}, 'traction': {}, 'resonance': {'convergence_strength': '弱'}},
        breakthrough={'pattern_type': '无突破', 'direction': None, 'is_valid': False, 'confidence': '低'},
        phase={'code': 'platform_building', 'label': '平台整理', 'bias': 'neutral', 'tradable': False, 'maturity': 'mid', 'reason': '等待平台确认'},
        archetype={'primary': 'A五段式', 'confidence': 'medium', 'reason': 'Directional -> Platform'},
        prediction={'key_price_levels': []},
        latest_confirmed_levels=[],
        spacetime_gate={
            'resonance_enabled': False,
            'wait_reason': '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作',
        },
    )

    self.assertEqual(execution['action'], 'wait')
    self.assertEqual(execution['wait_reason'], '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作')
```

- [ ] **Step 2: 运行失败测试，确认当前后端合同还不支持这些字段**

Run: `python3 -m unittest tests.test_structure_interpretation_model tests.test_structure_phase_execution -v`

Expected:
- `TypeError` because `_build_structure_interpretation` does not accept `parent_spacetime_status`
- or missing-key assertions on `spacetime_gate`

- [ ] **Step 3: 在 `stock_analyzer.py` 中新增时空门控 helper，并把它接进 interpretation / execution**

```python
def _build_spacetime_gate(
    self,
    parent_status: Optional[str],
    structure_type: str,
    trend_direction: str,
) -> Dict[str, Any]:
    structure_family, _ = self._resolve_structure_family(structure_type)
    advice = self.generate_operation_advice(
        major_status=parent_status,
        minor_structure=structure_family,
        minor_trend=trend_direction,
    ) if parent_status else {
        'matched_structures': [],
        'structure_match': False,
        'operation_advice': '',
        'explanation': '',
    }

    is_complex = structure_family in ('complex', 'unfinished')
    child_structure_match = bool(advice.get('structure_match')) and not is_complex
    resonance_enabled = bool(parent_status) and child_structure_match

    if is_complex:
        wait_reason = '当前结构仍属复杂/未完成状态，暂不作为结构共振触发，等待下一确认'
        structure_readiness = 'complex'
    elif resonance_enabled:
        wait_reason = None
        structure_readiness = 'matched'
    else:
        wait_reason = (
            f'{parent_status} 仅接受 {",".join(advice.get("matched_structures", [])) or "匹配结构"}，'
            f'当前 {structure_family} 原型暂不操作'
        )
        structure_readiness = 'unmatched'

    return {
        'parent_status': parent_status,
        'allowed_child_structures': advice.get('matched_structures', []),
        'child_structure_family': structure_family,
        'child_structure_match': child_structure_match,
        'resonance_enabled': resonance_enabled,
        'structure_readiness': structure_readiness,
        'wait_reason': wait_reason,
        'required_confirmation': '等待匹配结构完成确认或重新识别',
        'explanation': advice.get('explanation'),
    }
```

```python
def _build_structure_interpretation(..., parent_spacetime_status: Optional[str] = None) -> Dict[str, Any]:
    ...
    spacetime_gate = self._build_spacetime_gate(
        parent_status=parent_spacetime_status,
        structure_type=structure_type,
        trend_direction=trend_direction,
    )
    return {
        'macro_background': macro_background,
        'focus_structure': {...},
        'current_leg': {...},
        'next_confirmation': {...},
        'scenario_paths': ...,
        'spacetime_gate': spacetime_gate,
    }
```

```python
def _build_period_execution(..., spacetime_gate: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    ...
    wait_reason = None
    if not can_trade:
        wait_reason = (
            (spacetime_gate or {}).get('wait_reason')
            or phase.get('reason')
            or '等待执行总线输出明确动作'
        )
```

- [ ] **Step 4: 把父级时空状态传入 `interpretation` 构建链路**

```python
parent_status_map = {
    'weekly': None,
    'daily': results.get('weekly', {}).get('macd', {}).get('status'),
    'hour60': results.get('daily', {}).get('macd', {}).get('status'),
    'hour30': results.get('daily', {}).get('macd', {}).get('status'),
    'hour15': results.get('hour60', {}).get('macd', {}).get('status'),
}
...
structure['interpretation'] = self._build_structure_interpretation(
    ...,
    parent_spacetime_status=parent_status_map.get(period_name),
)
structure['execution'] = self._build_period_execution(
    ...,
    spacetime_gate=structure['interpretation'].get('spacetime_gate'),
)
```

- [ ] **Step 5: 跑 Python 测试确认通过**

Run: `python3 -m unittest tests.test_structure_interpretation_model tests.test_structure_phase_execution tests.test_stock_analyzer_render_payload -v`

Expected:
- all selected tests `OK`

- [ ] **Step 6: 提交后端门控改造**

```bash
git add scripts/stock_analyzer.py tests/test_structure_interpretation_model.py tests/test_structure_phase_execution.py tests/test_stock_analyzer_render_payload.py
git commit -m "feat: add spacetime gating to structure interpretation"
```

### Task 2: 前端类型与视图模型接住等待态和角色语义

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/lib/stock-execution-view-model.ts`
- Modify: `src/lib/ai-analysis-payload.ts`
- Test: `tests/structure-explainability-view-model.test.ts`
- Test: `tests/stock-execution-view-model.test.ts`
- Test: `tests/ai-analysis-payload.test.ts`

- [ ] **Step 1: 写失败测试，固定新的前端数据 contract**

```ts
test('buildStructureExplainabilityViewModel prefers live point and wait-state wording over current_point_id', () => {
  const result = buildStructureExplainabilityViewModel({
    interpretation: {
      current_leg: {
        label: '164.6→150.8 下行进行中',
        from_point_id: 'c5',
        to_point_id: 'live',
      },
      next_confirmation: {
        label: '等待 c6 拐点',
      },
      spacetime_gate: {
        child_structure_match: false,
        resonance_enabled: false,
        wait_reason: '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作',
        required_confirmation: '等待 C 结构边界确认',
      },
      focus_structure: {
        archetype_label: 'A五段式原型',
        maturity: 'developing',
        start_anchor: { point_id: 'a1', price: 181.9, date: '2026-03-01' },
      },
    },
    structure_details: {
      explainability: {
        current_point_id: 'a3',
      },
    },
  });

  assert.equal(result.topology.currentSegmentLabel, '164.6→150.8 下行进行中');
  assert.equal(result.interpretation.waitReason, '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作');
  assert.equal(result.interpretation.executionStateLabel, '当前级别暂不操作');
});
```

```ts
test('buildExecutionSummary prefers spacetime wait_reason over archetype excitement', () => {
  const result = buildExecutionSummary({
    structure: {
      structure_type: 'A五段式',
      execution_phase: { label: '平台整理', reason: '等待确认' },
      execution: { action: 'wait', setup_quality: 'avoid', wait_reason: '等待匹配结构，不做触发' },
      interpretation: {
        spacetime_gate: {
          resonance_enabled: false,
          wait_reason: '等待匹配结构，不做触发',
        },
      },
    },
  });

  assert.equal(result.actionLabel, '等待');
  assert.equal(result.executionReason, '等待匹配结构，不做触发');
});
```

```ts
test('buildAiDecisionPayload keeps spacetime gate fields for AI consumers', () => {
  const result = buildAiDecisionPayload(sampleAnalysisData);
  assert.equal(result.periods?.daily?.structure?.interpretation?.spacetime_gate?.parent_status, '中偏弱');
  assert.equal(result.periods?.hour30?.structure?.interpretation?.spacetime_gate?.child_structure_match, false);
});
```

- [ ] **Step 2: 运行失败测试，确认 TS 类型和 view-model 还没接住这些字段**

Run: `node --test tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts tests/ai-analysis-payload.test.ts`

Expected:
- assertion failures on missing `waitReason` / `executionStateLabel` / `spacetime_gate`

- [ ] **Step 3: 扩展 TS 类型与 view-model**

```ts
export interface StructureInterpretationSpacetimeGate {
  parent_status?: string | null;
  allowed_child_structures?: string[] | null;
  child_structure_family?: string | null;
  child_structure_match?: boolean | null;
  resonance_enabled?: boolean | null;
  structure_readiness?: string | null;
  wait_reason?: string | null;
  required_confirmation?: string | null;
  explanation?: string | null;
}

export interface StructureInterpretation {
  ...
  spacetime_gate?: StructureInterpretationSpacetimeGate | null;
}
```

```ts
return {
  interpretation: {
    backgroundLabel: interpretation?.macro_background?.label ?? null,
    archetypeLabel: interpretation?.focus_structure?.archetype_label ?? null,
    maturityLabel: mapMaturityToChineseLabel(interpretation?.focus_structure?.maturity),
    currentLegLabel: interpretationCurrentLegLabel,
    nextConfirmationLabel: interpretationNextConfirmationLabel,
    executionStateLabel: gate?.resonance_enabled ? '结构共振已成立' : '当前级别暂不操作',
    waitReason: gate?.wait_reason ?? null,
    requiredConfirmation: gate?.required_confirmation ?? null,
    scenarioPathLabels,
    displayReason: interpretationDisplayReason,
  },
}
```

```ts
const gateWaitReason = structure?.interpretation?.spacetime_gate?.wait_reason ?? null;
return {
  ...
  executionReason: gateWaitReason ?? execution?.wait_reason ?? execution?.rationale ?? null,
}
```

- [ ] **Step 4: 让 AI payload 透传新门控字段**

```ts
spacetime_gate: periodData.structure.interpretation?.spacetime_gate
  ? compactRecord({
      parent_status: periodData.structure.interpretation.spacetime_gate.parent_status,
      allowed_child_structures: periodData.structure.interpretation.spacetime_gate.allowed_child_structures,
      child_structure_match: periodData.structure.interpretation.spacetime_gate.child_structure_match,
      resonance_enabled: periodData.structure.interpretation.spacetime_gate.resonance_enabled,
      wait_reason: periodData.structure.interpretation.spacetime_gate.wait_reason,
      required_confirmation: periodData.structure.interpretation.spacetime_gate.required_confirmation,
    })
  : undefined,
```

- [ ] **Step 5: 跑 TS 测试与类型检查**

Run: `node --test tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts tests/ai-analysis-payload.test.ts && pnpm ts-check`

Expected:
- tests pass
- `pnpm ts-check` exits `0`

- [ ] **Step 6: 提交类型和视图模型改造**

```bash
git add src/lib/stock-structure-types.ts src/lib/structure-explainability-view-model.ts src/lib/stock-execution-view-model.ts src/lib/ai-analysis-payload.ts tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts tests/ai-analysis-payload.test.ts
git commit -m "feat: expose spacetime gating in frontend view models"
```

### Task 3: 重做 SVG 角色表达，去掉误导性点位贴纸

**Files:**
- Modify: `src/components/stock/StructureTopologySvg.tsx`
- Test: `tests/structure-topology-svg.test.ts`

- [ ] **Step 1: 写失败测试，固定新的图内语义**

```ts
test('StructureTopologySvg uses lightweight anchor rings without 起点/当前贴纸', async () => {
  const { StructureTopologySvg } = await importStructureTopologySvg();
  const html = renderQuietly(
    React.createElement(StructureTopologySvg, {
      payload: samplePayload,
      explainability: {
        structure_start_point_id: 'c1',
        current_point_id: 'c5',
        live_point_id: 'live',
        point_labels: [
          { point_id: 'c1', label: 'c1', role: 'start' },
          { point_id: 'c5', label: 'c5', role: 'last_confirmed' },
        ],
      },
    })
  );

  assert.doesNotMatch(html, /起点/);
  assert.doesNotMatch(html, /当前/);
  assert.doesNotMatch(html, /live/);
  assert.match(html, /data-point-role="start"/);
  assert.match(html, /data-point-role="live"/);
});
```

```ts
test('StructureTopologySvg does not render internal point ids for complex structures', async () => {
  const { StructureTopologySvg } = await importStructureTopologySvg();
  const html = renderQuietly(
    React.createElement(StructureTopologySvg, {
      payload: samplePayload,
      explainability: {
        structure_family: 'complex',
        structure_start_point_id: 'p7',
        point_labels: [{ point_id: 'p7', label: '', role: 'start' }],
      },
    })
  );

  assert.doesNotMatch(html, /p7/);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `node --test tests/structure-topology-svg.test.ts`

Expected:
- assertions fail because SVG still renders `起点` / `当前` badge text

- [ ] **Step 3: 用更轻的角色视觉替换贴纸式标注**

```tsx
type PointAnchorRole = 'start' | 'last_confirmed' | 'live' | null;

function getAnchorVisuals(role: Exclude<PointAnchorRole, null>) {
  if (role === 'start') {
    return { stroke: '#d97706', fill: 'rgba(245, 158, 11, 0.12)', ringRadius: 8 };
  }
  if (role === 'live') {
    return { stroke: '#0891b2', fill: 'rgba(34, 211, 238, 0.12)', ringRadius: 7 };
  }
  return { stroke: '#64748b', fill: 'rgba(148, 163, 184, 0.10)', ringRadius: 6 };
}
```

```tsx
{anchorVisuals ? (
  <circle
    data-point-role={anchorRole}
    cx={point.x}
    cy={point.y}
    r={anchorVisuals.ringRadius}
    fill={anchorVisuals.fill}
    stroke={anchorVisuals.stroke}
    strokeWidth={1.25}
  />
) : null}
```

```tsx
{point.point_id && pointLabel?.label ? (
  <text
    x={point.x}
    y={point.y - 12}
    textAnchor="middle"
    fill="#cbd5e1"
    fontSize="9"
    fontWeight="700"
  >
    {pointLabel.label}
  </text>
) : null}
```

- [ ] **Step 4: 跑 SVG 测试**

Run: `node --test tests/structure-topology-svg.test.ts`

Expected:
- all tests pass

- [ ] **Step 5: 提交 SVG 语义清理**

```bash
git add src/components/stock/StructureTopologySvg.tsx tests/structure-topology-svg.test.ts
git commit -m "feat: simplify topology anchor semantics"
```

### Task 4: 重做分析面板层级，优先表达等待态与可解释性

**Files:**
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
- Test: `tests/structure-explainability-panel.test.ts`

- [ ] **Step 1: 写失败测试，固定新的面板结构**

```ts
test('StructureExplainabilityPanel prioritizes wait state and Chinese summaries over technical keys', async () => {
  const { StructureExplainabilityPanel } = await importStructureExplainabilityPanel();
  const html = renderQuietly(
    React.createElement(StructureExplainabilityPanel, {
      structure: {
        structure_type: 'A五段式',
        inflection_points: 7,
        description: '当前仍在选择方向',
        interpretation: {
          macro_background: { label: '中偏强' },
          focus_structure: {
            archetype_label: 'A五段式原型',
            maturity: 'developing',
            start_anchor: { price: 181.9, date: '2026-03-01' },
          },
          current_leg: { label: '164.6→150.8 下行进行中' },
          next_confirmation: { label: '等待 c6 拐点' },
          spacetime_gate: {
            child_structure_match: false,
            resonance_enabled: false,
            wait_reason: '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作',
            required_confirmation: '等待 C 结构边界确认',
          },
        },
        structure_details: {
          render_payload: { point_count: 4 },
          explainability: { structure_start_point_id: 'c1', current_point_id: 'c5' },
        },
      },
      executionSummary: {
        phaseLabel: '平台整理',
        phaseReason: '等待确认',
        actionLabel: '等待',
        setupQuality: 'avoid',
        timeframeCapLabel: null,
        executionReason: '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作',
        archetypeLabel: 'A五段式',
        archetypeReason: 'Directional -> Platform',
      },
      structureColors: {},
    })
  );

  assert.match(html, /当前级别暂不操作/);
  assert.match(html, /聚焦起点/);
  assert.match(html, /最后确认点/);
  assert.match(html, /进行中点/);
  assert.doesNotMatch(html, /left_structure_warning/);
  assert.doesNotMatch(html, /SCENARIO_PATHS/);
});
```

```ts
test('StructureExplainabilityPanel hides internal p-number labels for complex structures', async () => {
  ...
  assert.doesNotMatch(html, /p7/);
  assert.match(html, /复杂结构/);
  assert.match(html, /等待下一确认/);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `node --test tests/structure-explainability-panel.test.ts`

Expected:
- assertions fail because panel still renders uppercase technical section codes and duplicated cards

- [ ] **Step 3: 重构面板布局与文案**

```tsx
const visibleStateTitle =
  viewModel.interpretation.executionStateLabel ??
  executionSummary.phaseLabel ??
  '等待确认';

const visibleStateReason =
  viewModel.interpretation.waitReason ??
  executionSummary.executionReason ??
  topologyReason;
```

```tsx
<div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
  <Card className="border-border/60 shadow-none">
    <CardContent className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">背景 {visibleBackground}</Badge>
        <Badge variant="outline">原型 {visibleArchetypeLabel ?? '待确认'}</Badge>
        {visibleMaturity ? <Badge variant="outline">成熟度 {visibleMaturity}</Badge> : null}
      </div>
      <StructureTopologySvg payload={payload} explainability={explainability} className="w-full h-44" />
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryBlock label="聚焦起点" value={visibleStart} note={visibleStartMeta} />
        <SummaryBlock label="最后确认点" value={viewModel.topology.lastConfirmedLabel ?? '待确认'} />
        <SummaryBlock label="进行中点" value={viewModel.topology.liveLabel ?? '待确认'} note="进行中" />
        <SummaryBlock label="下一确认" value={visibleNext} note={viewModel.interpretation.requiredConfirmation} />
      </div>
    </CardContent>
  </Card>

  <Card className="border-border/60 shadow-none">
    <CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold text-foreground">{visibleStateTitle}</div>
      <p className="text-sm text-muted-foreground">{visibleStateReason}</p>
    </CardContent>
  </Card>
</div>
```

```tsx
<SupportSection title="改判路径">
  ...
</SupportSection>
<SupportSection title="判定标准">
  <div className="text-sm text-muted-foreground">{viewModel.interpretation.displayReason ?? '等待更多结构确认。'}</div>
</SupportSection>
```

- [ ] **Step 4: 跑 React 渲染测试**

Run: `node --test tests/structure-explainability-panel.test.ts`

Expected:
- all tests pass

- [ ] **Step 5: 提交分析面板重构**

```bash
git add src/components/stock/StructureExplainabilityPanel.tsx tests/structure-explainability-panel.test.ts
git commit -m "feat: prioritize wait state in structure panel"
```

### Task 5: 端到端回归与多级别校验

**Files:**
- Modify: none unless verification uncovers issues
- Test: `tests/test_structure_interpretation_model.py`
- Test: `tests/test_structure_phase_execution.py`
- Test: `tests/test_stock_analyzer_render_payload.py`
- Test: `tests/structure-explainability-view-model.test.ts`
- Test: `tests/stock-execution-view-model.test.ts`
- Test: `tests/structure-topology-svg.test.ts`
- Test: `tests/structure-explainability-panel.test.ts`
- Test: `tests/ai-analysis-payload.test.ts`

- [ ] **Step 1: 运行后端完整回归**

Run: `python3 -m unittest tests.test_structure_interpretation_model tests.test_structure_phase_execution tests.test_stock_analyzer_render_payload -v`

Expected:
- all tests `OK`

- [ ] **Step 2: 运行前端完整回归**

Run: `node --test tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts tests/structure-topology-svg.test.ts tests/structure-explainability-panel.test.ts tests/ai-analysis-payload.test.ts`

Expected:
- all tests pass

- [ ] **Step 3: 跑类型检查**

Run: `pnpm ts-check`

Expected:
- exits `0`

- [ ] **Step 4: 做多级别人工抽查**

Run:

```bash
python3 - <<'PY'
import json
from scripts.stock_analyzer import TrinityStockAnalyzer
from tests.test_stock_analyzer_render_payload import build_wave_dataframe

analyzer = TrinityStockAnalyzer()
result = analyzer.detect_structure(build_wave_dataframe())
print(json.dumps({
    "structure_type": result["structure_type"],
    "start_point": result["structure_details"]["explainability"]["structure_start_point_id"],
    "current_point": result["structure_details"]["explainability"]["current_point_id"],
    "spacetime_gate": result.get("interpretation", {}).get("spacetime_gate"),
}, ensure_ascii=False, indent=2))
PY
```

Expected:
- 输出中能看到 `spacetime_gate`
- 起点、当前点、等待原因字段完整

- [ ] **Step 5: 提交最终集成结果**

```bash
git add src/components/stock/StructureExplainabilityPanel.tsx src/components/stock/StructureTopologySvg.tsx src/lib/stock-structure-types.ts src/lib/structure-explainability-view-model.ts src/lib/stock-execution-view-model.ts src/lib/ai-analysis-payload.ts scripts/stock_analyzer.py tests/structure-explainability-panel.test.ts tests/structure-topology-svg.test.ts tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts tests/ai-analysis-payload.test.ts tests/test_structure_interpretation_model.py tests/test_structure_phase_execution.py tests/test_stock_analyzer_render_payload.py
git commit -m "feat: align topology UI with spacetime gating"
```

## 自检

- Spec 覆盖:
  - “时空层 -> 结构层 -> 执行层” 已由 Task 1、Task 2 覆盖。
  - “不匹配即不操作 / 复杂结构降级” 已由 Task 1、Task 4 覆盖。
  - “聚焦起点 / 最后确认点 / 进行中点 / 当前段” 已由 Task 2、Task 3、Task 4 覆盖。
  - “不显示 `p7` / 不显示英文 `live` / 不再用技术 key 做 UI 标题” 已由 Task 3、Task 4 覆盖。
  - “多级别回归验证” 已由 Task 5 覆盖。
- Placeholder 扫描:
  - 未保留 `TODO` / `TBD` / “后续补充” 一类占位内容。
- 类型一致性:
  - 新合同统一使用 `spacetime_gate`, `allowed_child_structures`, `child_structure_match`, `resonance_enabled`, `wait_reason`, `required_confirmation` 这组字段名。
