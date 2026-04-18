# Structure Focus Origin Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate `macro origin` from `focus origin`, prioritize peak/valley slice candidates for the focused structure start, and downgrade non-explainable standard structures to `复杂结构 / 等待确认` without deleting raw classification data.

**Architecture:** Extend `scripts/stock_analyzer.py` with a new focus-origin analysis layer, run focused reclassification before explainability labeling, and add a final explainability validator that can downgrade the public structure result while preserving raw classification and debug evidence. Then propagate the new fields through Python/TypeScript contracts so UI and AI consumers can show the downgraded state honestly.

**Tech Stack:** Python (`unittest`, `pandas`), TypeScript, Next.js view-model/payload code, existing analyzer pipeline helpers.

---

## File Map

**Primary backend**

- Modify: `scripts/stock_analyzer.py`
  - Keep `_find_valid_range()` as macro-range resolver only.
  - Add focus-origin analysis helpers.
  - Add raw-vs-public classification split.
  - Add explainability downgrade gate before prediction/explainability/UI payload wiring.

**Python tests**

- Modify: `tests/test_stock_analyzer_render_payload.py`
  - Add regression tests for focus-origin candidate selection, downgrade output, and start-point labeling.
- Modify: `tests/test_structure_interpretation_model.py`
  - Add interpretation contract tests for `start_anchor_source`, `explainability_status`, and downgrade reason.

**TypeScript contracts / consumers**

- Modify: `src/lib/stock-structure-types.ts`
  - Add `focus_origin_analysis`, `raw_classification`, and new focus-structure fields.
- Modify: `src/lib/ai-analysis-payload.ts`
  - Include downgraded focus-origin facts in the compact AI payload.
- Modify: `src/lib/structure-explainability-view-model.ts`
  - Surface downgrade status and source-aware anchor metadata.
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
  - Prefer downgraded semantics and suppress standard-structure framing when explainability is downgraded.

**Frontend tests**

- Modify: `tests/ai-analysis-payload.test.ts`
- Modify: `tests/structure-explainability-view-model.test.ts`
- Modify: `tests/structure-explainability-panel.test.ts`

## Task 1: Lock The Backend Contract With Failing Tests

**Files:**
- Modify: `tests/test_stock_analyzer_render_payload.py`
- Modify: `tests/test_structure_interpretation_model.py`
- Test: `tests/test_stock_analyzer_render_payload.py`
- Test: `tests/test_structure_interpretation_model.py`

- [ ] **Step 1: Write the failing Python regression tests for focus-origin analysis and downgrade behavior**

```python
    def test_detect_structure_prefers_peak_extreme_as_focus_origin_when_mid_peak_forms_right_side_structure(self) -> None:
        df = build_wave_dataframe()
        result = self.analyzer.detect_structure(df)

        details = result["structure_details"]
        focus_origin = details["focus_origin_analysis"]

        self.assertEqual(focus_origin["selected_origin_kind"], "peak_extreme")
        self.assertEqual(focus_origin["selected_point_index"], 2)
        self.assertEqual(result["interpretation"]["focus_structure"]["start_anchor_source"], "peak_extreme")

    def test_detect_structure_downgrades_standard_archetype_when_point_count_exceeds_explainable_limit(self) -> None:
        result = self.analyzer.detect_structure(self.df)

        self.assertEqual(result["structure_type"], "复杂结构")
        self.assertEqual(result["structure_stage"], "等待确认")
        self.assertEqual(result["interpretation"]["focus_structure"]["explainability_status"], "downgraded")
        self.assertIn("标准点数上限", result["interpretation"]["focus_structure"]["downgrade_reason"])
        self.assertEqual(result["structure_details"]["raw_classification"]["type"], "A五段式")

    def test_build_structure_interpretation_carries_focus_origin_source_and_downgrade_reason(self) -> None:
        interpretation = self.analyzer._build_structure_interpretation(
            structure_type="复杂结构",
            trend_direction="下跌",
            explanation={
                "structure_start_point_id": "p1",
                "display_reason": "聚焦起点改为峰值切片右侧",
                "focus_origin_source": "peak_extreme",
                "explainability_status": "downgraded",
                "downgrade_reason": "标准点数上限超出，已降级",
            },
            prediction={"current_stage": "第3个拐点", "next_stage": "方向选择"},
            moving_averages={"price_vs_ma55": "below", "price_vs_ma233": "below", "ma_status": "空头排列"},
            peak_analysis={"is_peak_structure": True, "peak_type": "mountain_peak", "peak_price": 209.9},
            labeled_points=[
                {"point_id": "p1", "price": 209.9, "date": "2025-11-07 00:00"},
                {"point_id": "p2", "price": 164.4, "date": "2025-11-24 00:00"},
                {"point_id": "live", "price": 127.2, "date": "2026-04-03 00:00", "is_current": True},
            ],
            valid_range={"start_date": "2025-07-14", "start_price": 76.66},
        )

        focus = interpretation["focus_structure"]
        self.assertEqual(focus["start_anchor_source"], "peak_extreme")
        self.assertEqual(focus["explainability_status"], "downgraded")
        self.assertIn("标准点数上限", focus["downgrade_reason"])
```

- [ ] **Step 2: Run the targeted Python tests to verify they fail for the expected missing fields / old classification**

Run:

```bash
python3 -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q
```

Expected:

- FAIL
- Missing `focus_origin_analysis`
- Missing `start_anchor_source` / `explainability_status`
- Or assertion showing the public `structure_type` is still `A五段式`

- [ ] **Step 3: Add narrow test helpers for deterministic focus-origin cases**

```python
def build_focus_origin_regression_dataframe() -> pd.DataFrame:
    closes = [
        168.7, 135.2, 209.9, 164.4, 192.9, 174.3, 191.6, 160.3,
        185.2, 157.2, 176.6, 143.8, 159.3, 142.1, 182.0, 127.2,
    ]
    rows = []
    for index, close in enumerate(closes):
        rows.append(
            {
                "date": pd.Timestamp("2025-09-29") + pd.Timedelta(days=index * 7),
                "open": close,
                "high": close + 2.0,
                "low": close - 2.0,
                "close": close,
                "volume": 1000 + index,
                "MA55": 165.0 if index < 10 else 155.0,
                "DIF": 0.4 if index < 3 else -0.2,
                "DEA": 0.2 if index < 3 else -0.1,
            }
        )
    return pd.DataFrame(rows)
```

- [ ] **Step 4: Re-run the same Python tests to confirm they still fail for behavior, not test setup**

Run:

```bash
python3 -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q
```

Expected:

- FAIL
- No import/setup errors
- Assertions now fail on actual analyzer behavior

- [ ] **Step 5: Commit the test-only red state**

```bash
git add tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py
git commit -m "test: lock focus origin correction contracts"
```

## Task 2: Add Focus-Origin Analysis And Raw Classification Preservation

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_stock_analyzer_render_payload.py`

- [ ] **Step 1: Add minimal backend helpers for focus-origin analysis**

```python
    def _build_focus_origin_analysis(
        self,
        valid_range: Optional[Dict[str, Any]],
        line_geometry: Dict[str, Any],
        peak_analysis: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        macro_origin = {
            "point_index": 0,
            "price": valid_range.get("start_price") if valid_range else None,
            "date": valid_range.get("start_date") if valid_range else None,
            "source": "valid_range",
        } if valid_range else None

        candidates: List[Dict[str, Any]] = []
        if macro_origin:
            candidates.append({
                "kind": "macro_origin",
                "point_index": 0,
                "price": macro_origin["price"],
                "date": macro_origin["date"],
                "reason": "来自有效区间左边界",
                "selected": False,
            })

        peak_point_index = self._resolve_peak_structure_start_point_index(line_geometry, peak_analysis)
        if isinstance(peak_point_index, int):
            points = list((line_geometry or {}).get("points", []))
            point = points[peak_point_index] if 0 <= peak_point_index < len(points) else {}
            candidates.append({
                "kind": "peak_extreme" if peak_analysis.get("peak_type") == "mountain_peak" else "valley_extreme",
                "point_index": peak_point_index,
                "price": point.get("price"),
                "date": point.get("date"),
                "reason": "来自中段主峰/主谷切片候选",
                "selected": False,
            })

        selected_kind = "none"
        selected_point_index = None
        explainability_status = "failed"
        explainability_reason = "未找到可解释的聚焦起点"

        if len(candidates) > 1 and candidates[-1]["kind"] in ("peak_extreme", "valley_extreme"):
            candidates[-1]["selected"] = True
            selected_kind = candidates[-1]["kind"]
            selected_point_index = candidates[-1]["point_index"]
            explainability_status = "passed"
            explainability_reason = "优先采用中段主峰/主谷候选作为当前聚焦起点"
        elif candidates:
            candidates[0]["selected"] = True
            selected_kind = candidates[0]["kind"]
            selected_point_index = candidates[0]["point_index"]
            explainability_status = "passed"
            explainability_reason = "回退使用宏观原点作为聚焦起点"

        return {
            "macro_origin": macro_origin,
            "candidates": candidates,
            "selected_origin_kind": selected_kind,
            "selected_point_index": selected_point_index,
            "explainability_status": explainability_status,
            "explainability_reason": explainability_reason,
        }
```

- [ ] **Step 2: Run the focused Python tests to verify the new helper fixes only the missing field assertions**

Run:

```bash
python3 -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q
```

Expected:

- Some assertions still FAIL
- Missing-field failures move to wrong public classification / downgrade behavior

- [ ] **Step 3: Preserve raw classification before any peak override or downgrade**

```python
        raw_classification = {
            "type": result["structure_type"],
            "stage": result["structure_stage"],
            "description": result["description"],
            "component_summary": [
                f'{component.type}({len(component.strokes)}笔)'
                for component in macro_components
            ],
        }
        result["structure_details"]["raw_classification"] = raw_classification
```

- [ ] **Step 4: Feed focus-origin analysis into the focus context**

```python
        focus_origin_analysis = self._build_focus_origin_analysis(
            valid_range_info,
            line_geometry,
            peak_analysis,
        )
        result["structure_details"]["focus_origin_analysis"] = focus_origin_analysis

        focus_context = self._build_structure_focus_context(
            line_geometry=line_geometry,
            peak_analysis=peak_analysis,
            confirmed_strokes=strokes,
            stroke_list=stroke_list,
            valid_fractals=valid_fractals,
            focus_origin_analysis=focus_origin_analysis,
        )
```

- [ ] **Step 5: Run the Python tests to verify raw classification and selected origin assertions pass**

Run:

```bash
python3 -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q
```

Expected:

- Fewer FAILs
- `focus_origin_analysis` and `raw_classification` assertions PASS
- Downgrade/public-structure assertions may still FAIL

- [ ] **Step 6: Commit the focused-origin helper work**

```bash
git add scripts/stock_analyzer.py tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py
git commit -m "feat: add focus origin analysis contracts"
```

## Task 3: Add Explainability Downgrade Gate To Public Structure Results

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_stock_analyzer_render_payload.py`
- Test: `tests/test_structure_interpretation_model.py`

- [ ] **Step 1: Add a validator that distinguishes raw classification from public classification**

```python
    def _validate_focus_structure_explainability(
        self,
        structure_type: str,
        inflection_count: int,
        focus_origin_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        standard_limits = {
            "A五段式": 6,
            "B双平台式": 10,
            "C单平台式": 6,
            "D三段式": 4,
        }

        limit = standard_limits.get(structure_type)
        if limit and inflection_count > limit:
            return {
                "passed": False,
                "status": "downgraded",
                "reason": f"标准点数上限超出：{structure_type} 允许 {limit} 个确认拐点，当前为 {inflection_count}",
            }

        return {
            "passed": True,
            "status": focus_origin_analysis.get("explainability_status", "passed"),
            "reason": focus_origin_analysis.get("explainability_reason", ""),
        }
```

- [ ] **Step 2: Run the targeted Python tests to verify the validator still leaves public output unchanged**

Run:

```bash
python3 -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q
```

Expected:

- FAIL
- Public `structure_type` still old value until integration step is added

- [ ] **Step 3: Integrate downgrade into `detect_structure()` before prediction / explainability labeling**

```python
        explainability_verdict = self._validate_focus_structure_explainability(
            result["structure_type"],
            inflection_count,
            focus_origin_analysis,
        )

        if not explainability_verdict["passed"]:
            result["structure_type"] = "复杂结构"
            result["structure_stage"] = "等待确认"
            result["description"] = "当前聚焦区间无法诚实解释为标准结构，已降级"
            judgment_criteria.append(f"⚠️ 解释性降级: {explainability_verdict['reason']}")

        result["structure_details"]["focus_origin_analysis"]["explainability_status"] = explainability_verdict["status"]
        result["structure_details"]["focus_origin_analysis"]["explainability_reason"] = explainability_verdict["reason"]
```

- [ ] **Step 4: Pass source/status/reason through `_build_structure_explainability()` and `_build_structure_interpretation()`**

```python
        explainability = {
            "structure_family": structure_family,
            "structure_start_point_id": labeled_points[start_index]["point_id"] if labeled_points else None,
            "current_point_id": current_point_id,
            "current_segment": current_segment,
            "next_segment_preview": next_segment_preview,
            "point_labels": point_labels,
            "segment_labels": segment_labels,
            "display_reason": display_reason,
            "focus_origin_source": focus_origin_analysis.get("selected_origin_kind"),
            "explainability_status": focus_origin_analysis.get("explainability_status"),
            "downgrade_reason": focus_origin_analysis.get("explainability_reason"),
        }
```

```python
                "start_anchor_source": explanation.get("focus_origin_source", "none"),
                "explainability_status": explanation.get("explainability_status", "passed"),
                "downgrade_reason": explanation.get("downgrade_reason"),
```

- [ ] **Step 5: Run the Python tests to verify the downgrade regression goes green**

Run:

```bash
python3 -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py -q
```

Expected:

- PASS
- Focus-origin and downgrade contract assertions all green

- [ ] **Step 6: Commit the downgrade gate**

```bash
git add scripts/stock_analyzer.py tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py
git commit -m "feat: downgrade non-explainable standard structures"
```

## Task 4: Update TypeScript Contracts, AI Payload, And Explainability UI Consumers

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/ai-analysis-payload.ts`
- Modify: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
- Modify: `tests/ai-analysis-payload.test.ts`
- Modify: `tests/structure-explainability-view-model.test.ts`
- Modify: `tests/structure-explainability-panel.test.ts`

- [ ] **Step 1: Write failing TypeScript tests for downgraded focus-origin semantics**

```ts
test('buildStructureExplainabilityViewModel exposes downgraded focus-origin metadata', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: '复杂结构',
    interpretation: {
      focus_structure: {
        archetype_label: '复杂结构',
        start_anchor_source: 'peak_extreme',
        explainability_status: 'downgraded',
        downgrade_reason: '标准点数上限超出',
      },
    },
    structure_details: {
      explainability: {
        structure_start_point_id: 'p1',
        display_reason: '峰值切片后聚焦右侧结构',
      },
      focus_origin_analysis: {
        selected_origin_kind: 'peak_extreme',
        explainability_status: 'downgraded',
        explainability_reason: '标准点数上限超出',
      },
      raw_classification: {
        type: 'A五段式',
        stage: '趋势启动阶段',
        description: 'A五段式，趋势启动 + 平台整理',
        component_summary: ['Directional(1笔)', 'Platform(14笔)'],
      },
    },
  });

  assert.equal(result.interpretation.explainabilityStatus, 'downgraded');
  assert.equal(result.interpretation.startAnchorSource, 'peak_extreme');
  assert.match(result.interpretation.downgradeReason || '', /标准点数上限/);
});
```

```ts
test('buildAiDecisionPayload includes focus-origin downgrade facts for daily structure', () => {
  const payload = buildAiDecisionPayload({
    periods: {
      daily: {
        structure: {
          structure_type: '复杂结构',
          structure_stage: '等待确认',
          trend_direction: '下跌',
          description: '当前聚焦区间无法诚实解释为标准结构，已降级',
          interpretation: {
            focus_structure: {
              archetype_label: '复杂结构',
              start_anchor_source: 'peak_extreme',
              explainability_status: 'downgraded',
              downgrade_reason: '标准点数上限超出',
            },
          },
          structure_details: {
            focus_origin_analysis: {
              selected_origin_kind: 'peak_extreme',
              explainability_status: 'downgraded',
              explainability_reason: '标准点数上限超出',
            },
            raw_classification: {
              type: 'A五段式',
              stage: '趋势启动阶段',
              description: 'A五段式，趋势启动 + 平台整理',
              component_summary: ['Directional(1笔)', 'Platform(14笔)'],
            },
          },
        },
      },
    },
  } as any);

  const daily = payload.periods.daily as any;
  assert.equal(daily.structure.interpretation.focus_structure.start_anchor_source, 'peak_extreme');
  assert.equal(daily.structure.interpretation.focus_structure.explainability_status, 'downgraded');
  assert.equal(daily.structure.raw_classification.type, 'A五段式');
});
```

- [ ] **Step 2: Run the TypeScript tests to verify they fail on missing fields**

Run:

```bash
node --test tests/ai-analysis-payload.test.ts tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts
```

Expected:

- FAIL
- Missing `focus_origin_analysis`, `raw_classification`, or downgraded view-model fields

- [ ] **Step 3: Add the new TypeScript interfaces and payload summarization**

```ts
export interface StructureFocusOriginAnalysis {
  macro_origin?: {
    point_index?: number | null;
    price?: number | null;
    date?: string | null;
    source?: string | null;
  } | null;
  candidates?: Array<{
    kind?: string | null;
    point_index?: number | null;
    price?: number | null;
    date?: string | null;
    reason?: string | null;
    selected?: boolean | null;
  }> | null;
  selected_origin_kind?: string | null;
  selected_point_index?: number | null;
  explainability_status?: string | null;
  explainability_reason?: string | null;
}

export interface StructureRawClassification {
  type?: string | null;
  stage?: string | null;
  description?: string | null;
  component_summary?: string[] | null;
}
```

```ts
      raw_classification: periodData.structure?.structure_details?.raw_classification
        ? compactRecord({
            type: periodData.structure.structure_details.raw_classification.type,
            stage: periodData.structure.structure_details.raw_classification.stage,
            description: periodData.structure.structure_details.raw_classification.description,
            component_summary: periodData.structure.structure_details.raw_classification.component_summary,
          })
        : undefined,
```

- [ ] **Step 4: Update the view-model and panel to prefer downgraded semantics**

```ts
  interpretation: {
    backgroundLabel: string | null;
    archetypeLabel: string | null;
    maturityLabel: string | null;
    currentLegLabel: string | null;
    nextConfirmationLabel: string | null;
    executionStateLabel: string | null;
    waitReason: string | null;
    requiredConfirmation: string | null;
    scenarioPathLabels: string[];
    displayReason: string | null;
    startAnchorSource: string | null;
    explainabilityStatus: string | null;
    downgradeReason: string | null;
  };
```

```tsx
  const isDowngraded = viewModel.interpretation.explainabilityStatus === 'downgraded';
  const visibleArchetypeLabel = isDowngraded
    ? '复杂结构'
    : viewModel.interpretation.archetypeLabel ?? executionSummary.archetypeLabel ?? viewModel.archetype.primaryLabel;
  const archetypeNote = isDowngraded
    ? viewModel.interpretation.downgradeReason ?? archetypeContext
    : viewModel.archetype.alternativeLabels.length > 0
      ? `备选：${viewModel.archetype.alternativeLabels.join(' / ')}`
      : archetypeContext;
```

- [ ] **Step 5: Run the TypeScript tests and type-check to verify the new contract passes**

Run:

```bash
node --test tests/ai-analysis-payload.test.ts tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts
pnpm ts-check
```

Expected:

- PASS
- `tsc -p tsconfig.json` exits 0

- [ ] **Step 6: Commit the contract and consumer updates**

```bash
git add src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureExplainabilityPanel.tsx tests/ai-analysis-payload.test.ts tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts
git commit -m "feat: expose downgraded focus-origin structure semantics"
```

## Task 5: Full Regression And Case Verification

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `tests/test_stock_analyzer_render_payload.py`
- Modify: `tests/test_structure_interpretation_model.py`
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/ai-analysis-payload.ts`
- Modify: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`

- [ ] **Step 1: Run the full targeted regression suite**

Run:

```bash
python3 -m pytest tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py tests/test_structure_phase_execution.py -q
node --test tests/structure-topology-svg.test.ts tests/structure-explainability-panel.test.ts tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts tests/ai-analysis-payload.test.ts
pnpm ts-check
```

Expected:

- All Python tests PASS
- All Node tests PASS
- Type check PASS

- [ ] **Step 2: Run the local daily analysis case check for 300274**

Run:

```bash
python3 - <<'PY'
import json, urllib.request
with urllib.request.urlopen('http://localhost:5001/api/stock/analysis?code=300274&levels=daily', timeout=120) as response:
    data = json.load(response)
structure = data['data']['periods']['daily']['structure']
print(structure['structure_type'])
print(structure['structure_stage'])
print(structure['interpretation']['focus_structure'].get('start_anchor_source'))
print(structure['interpretation']['focus_structure'].get('explainability_status'))
print(structure['interpretation']['focus_structure'].get('downgrade_reason'))
print(structure['structure_details'].get('raw_classification'))
PY
```

Expected:

- Public `structure_type` is no longer the old misleading standard `A五段式`
- `start_anchor_source` prefers `peak_extreme` when the case triggers
- `raw_classification.type` still preserves the original clustered result

- [ ] **Step 3: Review `judgment_criteria` output for explainability traceability**

Run:

```bash
python3 - <<'PY'
import json, urllib.request
with urllib.request.urlopen('http://localhost:5001/api/stock/analysis?code=300274&levels=daily', timeout=120) as response:
    data = json.load(response)
print(data['data']['periods']['daily']['structure']['structure_details']['judgment_criteria'])
PY
```

Expected:

- Includes macro-origin note
- Includes focus-origin candidate selection note
- Includes downgrade reason when downgrade applies

- [ ] **Step 4: Commit the final verified state**

```bash
git add scripts/stock_analyzer.py tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureExplainabilityPanel.tsx tests/ai-analysis-payload.test.ts tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts
git commit -m "feat: correct focus origin and downgrade non-explainable structures"
```

## Self-Review

### Spec coverage

- `macro origin` vs `focus origin` split: Task 2, Task 3.
- Peak/valley candidate priority: Task 2.
- Raw classification preserved: Task 2, Task 5.
- Downgrade instead of mislabeling standard structures: Task 3.
- UI / AI consume honest downgraded semantics: Task 4.
- 300274 case regression: Task 5.

### Placeholder scan

- No `TODO` / `TBD`.
- Every task includes exact files, commands, and concrete code snippets.

### Type consistency

- Python names are consistent across tasks: `focus_origin_analysis`, `raw_classification`, `start_anchor_source`, `explainability_status`, `downgrade_reason`.
- TypeScript fields mirror the same backend contract names.
