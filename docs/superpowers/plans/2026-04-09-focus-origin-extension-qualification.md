# Focus Origin Extension Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate `background_origin` from `focus_origin`, re-slice the current structure from `focus_origin`, and classify over-limit focused slices as `extended` or `complex` without reusing standard numbering.

**Architecture:** Keep `valid_range` as macro background context, introduce a focused classification layer on top of the focused slice, and let interpretation/UI consume both the prototype family and the standard qualification separately. Extended structures keep their prototype family (`A/B/C/D`) for strategy semantics but lose standard numbering privileges.

**Tech Stack:** Python 3 analysis engine, Next.js App Router, TypeScript, Node test runner, pytest, pnpm

---

### Task 1: Add failing tests for focus-slice extension qualification

**Files:**
- Modify: `tests/test_stock_analyzer_render_payload.py`
- Modify: `tests/test_structure_interpretation_model.py`
- Modify: `tests/structure-explainability-view-model.test.ts`
- Modify: `tests/ai-analysis-payload.test.ts`

- [ ] **Step 1: Write failing Python tests for extended-vs-complex structure output**

```python
def test_detect_structure_marks_extended_c_after_focus_origin_reslice(self) -> None:
    recent_df, full_strokes, valid_fractals, stroke_list, peak_analysis = (
        build_focus_origin_peak_regression_fixture()
    )
    # Arrange focused slice to remain platform-like after peak focus.
    # Expect public structure label to be 延伸C类 instead of 复杂结构.
```

- [ ] **Step 2: Write failing interpretation test for family/qualification split**

```python
def test_build_structure_interpretation_exposes_extended_focus_structure(self) -> None:
    interpretation = self.analyzer._build_structure_interpretation(
        structure_type='延伸C类',
        trend_direction='下跌',
        explanation={'structure_start_point_id': None},
        prediction={'current_stage': '进行中', 'next_stage': '等待边界确认'},
        moving_averages={'price_vs_ma55': 'below', 'price_vs_ma233': 'below', 'ma_status': '空头排列'},
        peak_analysis=None,
        labeled_points=[{'point_id': 'p1', 'price': 10.0, 'date': '2024-01-01'}],
        valid_range={'start_date': '2023-01-01', 'start_price': 20.0},
    )
    assert interpretation['focus_structure']['archetype_family'] == 'C'
    assert interpretation['focus_structure']['standard_qualification'] == 'extended'
```

- [ ] **Step 3: Write failing TS tests for view-model labels**

```ts
test('buildStructureExplainabilityViewModel exposes extended archetype without standard start label', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: '延伸C类',
    interpretation: {
      focus_structure: {
        archetype_label: '延伸C类原型',
        archetype_family: 'C',
        standard_qualification: 'extended',
      },
      current_leg: {
        label: 'p5→live 下行进行中',
      },
    },
  } as any);

  assert.equal(result.interpretation.archetypeLabel, '延伸C类原型');
  assert.equal(result.topology.startLabel, null);
});
```

- [ ] **Step 4: Run targeted tests and verify they fail for the expected reason**

Run: `python -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q`

Run: `node --test tests/structure-explainability-view-model.test.ts tests/ai-analysis-payload.test.ts`

Expected: failures mentioning missing `standard_qualification`, missing extended structure handling, or incorrect fallback to `复杂结构`

### Task 2: Implement focused classification and extension qualification in Python

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `src/lib/stock-structure-types.ts`

- [ ] **Step 1: Add focused classification helpers**

```python
def _resolve_structure_profile(self, structure_type: str) -> Tuple[str, Optional[str], str]:
    ...
```

Add helpers for:
- focused macro-component classification from `focus_origin`
- mapping public `structure_type` to `{family, prefix, qualification}`
- deriving `延伸A类 / 延伸B类 / 延伸C类 / 延伸D类`

- [ ] **Step 2: Route focused slice through the new classification layer**

```python
focused_macro_components = self._consolidate_boxes(focused_strokes, threshold=0.55)
focused_structure_type, focused_stage, focused_description, focused_criteria = (
    self._classify_structure_by_macro_components(focused_macro_components, result['trend_direction'])
)
```

Use the focused classification as the public structure candidate before explainability downgrade logic.

- [ ] **Step 3: Implement extension-vs-complex decision**

```python
if focused_family in ('A', 'B', 'C', 'D') and inflection_count > limit:
    result['structure_type'] = f'延伸{focused_family}类'
elif focused_family in ('A', 'B', 'C', 'D'):
    result['structure_type'] = focused_structure_type
else:
    result['structure_type'] = '复杂结构'
```

Keep:
- `valid_range` as background context
- raw full-range classification in `raw_classification`
- focused slice classification in a new `focus_classification`

- [ ] **Step 4: Update interpretation to consume qualification separately**

Expose:
- `focus_structure.archetype_family`
- `focus_structure.standard_qualification`
- `focus_structure.reference_origin`
- `current_leg`

Ensure extended structures:
- keep family semantics for strategy gating
- do not receive standard point prefixes

- [ ] **Step 5: Run targeted Python tests and confirm they pass**

Run: `python -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q`

Expected: PASS

### Task 3: Update TS consumers and panel hierarchy

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
- Modify: `src/lib/ai-analysis-payload.ts`

- [ ] **Step 1: Extend TS types for focused classification and qualification**

Add:
- `standard_qualification?: 'standard' | 'extended' | 'complex' | 'unfinished'`
- `focus_classification?: { ... }`

- [ ] **Step 2: Update the view model to prioritize current structure and current leg**

Rules:
- background origin stays in helper/meta text only
- extended archetypes show prototype family without standard numbering promises
- current leg and next confirmation become the main summary path

- [ ] **Step 3: Update panel labels and badges**

Rules:
- highlight `当前结构` and `当前执行段`
- keep `背景原点` only as secondary explanation
- for extended structures, avoid start labels that imply `a1/c1/d1`

- [ ] **Step 4: Update AI payload summarization**

Include:
- `focus_structure.archetype_family`
- `focus_structure.standard_qualification`
- `focus_classification`

- [ ] **Step 5: Run targeted Node/TS checks**

Run: `node --test tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts tests/ai-analysis-payload.test.ts`

Run: `pnpm ts-check`

Expected: PASS

### Task 4: HTTP regression and verification

**Files:**
- Verify only: `scripts/stock_analyzer.py` changes through HTTP API

- [ ] **Step 1: Run full focused test suite**

Run: `. .venv/bin/activate && python -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q`

Run: `node --test tests/structure-explainability-panel.test.ts tests/structure-explainability-view-model.test.ts tests/structure-topology-svg.test.ts tests/ai-analysis-payload.test.ts`

Run: `pnpm ts-check`

- [ ] **Step 2: Verify 300274 weekly HTTP output on port 5001**

Run: `curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly" | python3 -c "import json,sys;r=json.load(sys.stdin);w=r['data']['periods']['weekly']['structure'];print(w['structure_type']);print(w['structure_stage']);print(w['interpretation']['focus_structure'])"`

Expected:
- weekly remains non-`A五段式`
- weekly start anchor remains explainable

- [ ] **Step 3: Verify 300274 daily HTTP output on port 5001**

Run: `curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=daily" | python3 -c "import json,sys;r=json.load(sys.stdin);d=r['data']['periods']['daily']['structure'];print(d['structure_type']);print(d['structure_stage']);print(d['structure_details']['focus_origin_analysis']);print(d['interpretation']['focus_structure']);print(d['interpretation']['current_leg'])"`

Expected:
- daily no longer pretends the window-left point is the start
- focused structure uses focused classification
- over-limit focused slices resolve to `延伸X类` or `复杂结构`
- current leg remains visible and separate from background origin

- [ ] **Step 4: Review diff and commit**

Run: `git status --short`

Run: `git diff -- scripts/stock_analyzer.py src/lib/stock-structure-types.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureExplainabilityPanel.tsx src/lib/ai-analysis-payload.ts tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts tests/ai-analysis-payload.test.ts`
