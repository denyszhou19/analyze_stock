# Structure Interpretation Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `structure-interpretation-model-design` spec by adding stable `interpretation` output to the analyzer, switching the analysis page to consume it, and exposing the same semantics to downstream AI payloads before any hover-card work begins.

**Architecture:** Extend `scripts/stock_analyzer.py` with a new `structure.interpretation` contract that separates `macro_background`, `focus_structure`, `current_leg`, `next_confirmation`, and `scenario_paths`. Keep the existing topology SVG geometry intact, but stop using one ambiguous `trend_direction` as the UI’s primary semantic source. Then update TypeScript contracts, view models, and the analysis panel to render the new model, and finally pass the same interpretation summary into the AI payload.

**Tech Stack:** Python 3 `unittest`, pandas, TypeScript, React server-render tests with `node:test`, Next.js app code

---

## File Map

- Modify: `scripts/stock_analyzer.py`
  - Add backend helpers for `macro_background`, `focus_structure`, `current_leg`, `next_confirmation`, and `scenario_paths`
  - Update `detect_structure()` to emit `structure.interpretation`
  - Preserve existing render geometry while fixing the last live point semantics (`live` instead of pre-allocating the next formal point id)
- Create: `tests/test_structure_interpretation_model.py`
  - Backend contract tests for the new interpretation object and live-tail semantics
- Modify: `tests/test_stock_analyzer_render_payload.py`
  - Adjust explainability expectations so the latest unconfirmed endpoint is `live`, not a formal `a4/b4/c4/d4`
- Modify: `src/lib/stock-structure-types.ts`
  - Add TypeScript interfaces for `StructureInterpretation`
- Modify: `src/lib/structure-explainability-view-model.ts`
  - Add a stable summary view model for background / focus archetype / maturity / current leg / next confirmation
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
  - Replace the ambiguous trend badge and summary text with interpretation-driven badges and blocks
- Modify: `tests/structure-explainability-view-model.test.ts`
  - Cover interpretation-first summaries and fallback behavior
- Modify: `tests/structure-explainability-panel.test.ts`
  - Assert the analysis panel shows background / archetype maturity / current leg / next confirmation instead of only `trend_direction`
- Modify: `src/lib/ai-analysis-payload.ts`
  - Include a compact interpretation summary in AI payloads
- Modify: `tests/ai-analysis-payload.test.ts`
  - Lock the new payload contract

## Task 1: Add backend contract tests for the interpretation model

**Files:**
- Create: `tests/test_structure_interpretation_model.py`
- Modify: `tests/test_stock_analyzer_render_payload.py`

- [ ] **Step 1: Write the failing backend contract tests**

```python
import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class StructureInterpretationModelTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_structure_interpretation_marks_peak_slice_platform_as_developing(self) -> None:
        interpretation = self.analyzer._build_structure_interpretation(
            structure_type='C单平台式',
            trend_direction='上涨',
            explanation={'structure_start_point_id': 'c1'},
            prediction={'current_stage': 'c3拐点', 'next_stage': 'c4拐点'},
            moving_averages={
                'MA55': 118.57,
                'MA233': 85.61,
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            peak_analysis={
                'is_peak_structure': True,
                'peak_type': 'mountain_peak',
                'peak_price': 209.88,
            },
            labeled_points=[
                {'point_id': 'c1', 'price': 209.88, 'date': '2025-11-14 00:00'},
                {'point_id': 'c2', 'price': 141.10, 'date': '2026-02-06 00:00'},
                {'point_id': 'c3', 'price': 181.99, 'date': '2026-03-20 00:00'},
                {'point_id': 'live', 'price': 163.35, 'date': '2026-03-27 00:00', 'is_current': True},
            ],
            valid_range={
                'start_date': '2022-05-06',
                'start_price': 42.52,
            },
        )

        self.assertEqual(interpretation['macro_background']['label'], '偏多')
        self.assertEqual(interpretation['focus_structure']['focus_mode'], 'peak_slice_right')
        self.assertEqual(interpretation['focus_structure']['maturity'], 'developing')
        self.assertEqual(interpretation['current_leg']['label'], 'c3→live 下行形成中')
        self.assertEqual(interpretation['next_confirmation']['type'], 'pivot')
        self.assertEqual(interpretation['scenario_paths'][0]['code'], 'up_break')

    def test_build_structure_interpretation_uses_mixed_background_when_ma_and_swings_conflict(self) -> None:
        interpretation = self.analyzer._build_structure_interpretation(
            structure_type='A五段式',
            trend_direction='下跌',
            explanation={'structure_start_point_id': 'a1'},
            prediction={'current_stage': 'a3拐点', 'next_stage': 'a4拐点'},
            moving_averages={
                'MA55': 100.0,
                'MA233': 98.0,
                'price_vs_ma55': 'below',
                'price_vs_ma233': 'above',
                'ma_status': '缠绕',
            },
            peak_analysis=None,
            labeled_points=[
                {'point_id': 'a1', 'price': 10.0, 'date': '2024-01-01 00:00'},
                {'point_id': 'a2', 'price': 14.0, 'date': '2024-01-08 00:00'},
                {'point_id': 'a3', 'price': 11.5, 'date': '2024-01-15 00:00'},
                {'point_id': 'live', 'price': 13.2, 'date': '2024-01-22 00:00', 'is_current': True},
            ],
            valid_range=None,
        )

        self.assertEqual(interpretation['macro_background']['direction'], 'mixed')
        self.assertEqual(interpretation['focus_structure']['archetype_family'], 'A')
    }
```

- [ ] **Step 2: Add the live-tail explainability regression to the existing render payload test**

```python
    def test_build_structure_explainability_uses_live_for_unconfirmed_tail(self) -> None:
        line_geometry = {
            'price_range': {'min': 10.0, 'max': 14.0, 'range': 4.0},
            'points': [
                {'sequence': 0, 'price': 10.0, 'date': '2024-01-01', 'type': 'bottom', 'role': 'from'},
                {'sequence': 1, 'price': 13.0, 'date': '2024-01-02', 'type': 'top', 'role': 'to'},
                {'sequence': 2, 'price': 11.0, 'date': '2024-01-03', 'type': 'bottom', 'role': 'to'},
                {'sequence': 3, 'price': 12.4, 'date': '2024-01-04', 'type': 'current', 'role': 'to', 'is_current': True},
            ],
            'segments': [
                {'sequence': 0, 'from_point': 0, 'to_point': 1, 'direction': '上涨', 'length': 1},
                {'sequence': 1, 'from_point': 1, 'to_point': 2, 'direction': '下跌', 'length': 1},
                {'sequence': 2, 'from_point': 2, 'to_point': 3, 'direction': '上涨', 'length': 1, 'is_current': True},
            ],
            'point_count': 4,
            'segment_count': 3,
        }

        labeled_geometry, explainability = self.analyzer._build_structure_explainability(
            'D三段式',
            line_geometry,
            {'current_stage': 'd3拐点', 'next_stage': 'd4拐点'},
            peak_analysis={},
        )

        self.assertEqual(labeled_geometry['points'][-1]['point_id'], 'live')
        self.assertEqual(explainability['current_point_id'], 'd3')
        self.assertEqual(explainability['current_segment']['label'], 'd3→live')
        self.assertEqual(explainability['next_segment_preview']['to_point_id'], 'd4')
```

- [ ] **Step 3: Run the Python tests to verify they fail first**

Run:

```bash
python3 -m unittest tests.test_structure_interpretation_model tests.test_stock_analyzer_render_payload -v
```

Expected:

- `AttributeError` for missing `_build_structure_interpretation`
- assertion failures because the current code still labels the live tail as a formal next point id such as `d4` or `c4`

- [ ] **Step 4: Commit the red tests**

```bash
git add tests/test_structure_interpretation_model.py tests/test_stock_analyzer_render_payload.py
git commit -m "test: cover structure interpretation model contract"
```

## Task 2: Implement the backend interpretation model and live-tail semantics

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_structure_interpretation_model.py`
- Test: `tests/test_stock_analyzer_render_payload.py`

- [ ] **Step 1: Add the new structure result slot and helper signatures**

```python
def _create_structure_result(self) -> Dict[str, Any]:
    return {
        'structure_type': 'unknown',
        'structure_stage': 'unknown',
        'trend_direction': 'unknown',
        'inflection_points': 0,
        'segment_count': 0,
        'description': '',
        'interpretation': {},
        'structure_details': {
            'top_fractals': [],
            'bottom_fractals': [],
            'strokes': [],
            'line_geometry': {},
            'render_payload': self._create_empty_render_payload(),
            'explainability': {},
            'judgment_criteria': '',
        },
    }

def _build_macro_background(self, moving_averages: Dict[str, Any], trend_direction: str, points: List[Dict[str, Any]]) -> Dict[str, Any]:
    price_vs_ma55 = moving_averages.get('price_vs_ma55')
    price_vs_ma233 = moving_averages.get('price_vs_ma233')
    ma_status = moving_averages.get('ma_status')
    if price_vs_ma55 == 'above' and price_vs_ma233 == 'above' and ma_status == '多头排列':
        return {
            'direction': 'bullish',
            'label': '偏多',
            'confidence': 'high',
            'basis': ['价格在 MA55 / MA233 上方', 'MA55 高于 MA233'],
        }
    if price_vs_ma55 == 'below' and price_vs_ma233 == 'below' and ma_status == '空头排列':
        return {
            'direction': 'bearish',
            'label': '偏空',
            'confidence': 'high',
            'basis': ['价格在 MA55 / MA233 下方', 'MA55 低于 MA233'],
        }
    return {
        'direction': 'mixed' if trend_direction != '震荡' else 'range',
        'label': '混合' if trend_direction != '震荡' else '整理',
        'confidence': 'medium',
        'basis': ['均线与结构方向未完全同向'],
    }

def _resolve_focus_structure_maturity(self, structure_type: str, prediction: Dict[str, Any], point_ids: List[str], has_live_tail: bool) -> str:
    confirmed_point_count = len([point_id for point_id in point_ids if point_id and point_id != 'live'])
    if has_live_tail:
        return 'developing'
    if structure_type == 'D三段式' and confirmed_point_count >= 4:
        return 'confirmed'
    if structure_type in ('A五段式', 'C单平台式') and confirmed_point_count >= 6:
        return 'confirmed'
    if structure_type == 'B双平台式' and confirmed_point_count >= 10:
        return 'confirmed'
    return 'candidate'

def _build_structure_interpretation(self, structure_type: str, trend_direction: str, explanation: Dict[str, Any], prediction: Dict[str, Any], moving_averages: Dict[str, Any], peak_analysis: Optional[Dict[str, Any]], labeled_points: List[Dict[str, Any]], valid_range: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        'macro_background': self._build_macro_background(moving_averages, trend_direction, labeled_points),
        'focus_structure': {},
        'current_leg': {},
        'next_confirmation': None,
        'scenario_paths': [],
    }
```

- [ ] **Step 2: Fix `_build_structure_explainability()` so the unconfirmed endpoint is `live`**

```python
for idx, point in enumerate(points):
    is_live_point = bool(point.get('is_current'))
    if is_live_point:
        point_id = 'live'
    elif prefix and idx >= start_index:
        point_id = f'{prefix}{idx - start_index + 1}'
    else:
        point_id = f'p{idx + 1}'
    labeled_points.append({**point, 'point_id': point_id})

current_segment = None
if labeled_points and labeled_points[-1]['point_id'] == 'live' and len(labeled_points) >= 2:
    last_confirmed = labeled_points[-2]
    current_segment = {
        'from_point_id': last_confirmed['point_id'],
        'to_point_id': 'live',
        'label': f"{last_confirmed['point_id']}→live",
    }
```

- [ ] **Step 3: Build the interpretation object in `detect_structure()` after explainability is labeled**

```python
labeled_geometry, explainability = self._build_structure_explainability(
    result['structure_type'],
    line_geometry,
    prediction,
    peak_analysis,
    structure_start_point_index=structure_start_point_index,
)
result['structure_details']['line_geometry'] = labeled_geometry
result['structure_details']['explainability'] = explainability
result['structure_details']['render_payload'] = self._build_render_payload(labeled_geometry)

result['interpretation'] = self._build_structure_interpretation(
    structure_type=result['structure_type'],
    trend_direction=result['trend_direction'],
    explanation=explainability,
    prediction=prediction,
    moving_averages=self.analyze_ma_position(recent.iloc[-1]) if len(recent) else {},
    peak_analysis=peak_analysis,
    labeled_points=labeled_geometry.get('points', []),
    valid_range=valid_range_info,
)
```

- [ ] **Step 4: Implement the new helper with the exact semantics from the spec**

```python
def _build_structure_interpretation(
    self,
    structure_type: str,
    trend_direction: str,
    explanation: Dict[str, Any],
    prediction: Dict[str, Any],
    moving_averages: Dict[str, Any],
    peak_analysis: Optional[Dict[str, Any]],
    labeled_points: List[Dict[str, Any]],
    valid_range: Optional[Dict[str, Any]],
):
    point_ids = [point.get('point_id') for point in labeled_points]
    has_live_tail = bool(point_ids and point_ids[-1] == 'live')
    last_confirmed_point_id = point_ids[-2] if has_live_tail and len(point_ids) >= 2 else point_ids[-1] if point_ids else None

    macro_background = self._build_macro_background(moving_averages, trend_direction, labeled_points)

    focus_mode = 'full_range'
    if peak_analysis and peak_analysis.get('is_peak_structure'):
        focus_mode = 'peak_slice_right' if peak_analysis.get('peak_type') == 'mountain_peak' else 'valley_slice_right'

    family, _ = self._resolve_structure_family(structure_type)
    maturity = self._resolve_focus_structure_maturity(structure_type, prediction, point_ids, has_live_tail)

    current_direction = 'unknown'
    if has_live_tail and len(labeled_points) >= 2:
        current_direction = 'down' if labeled_points[-1]['price'] < labeled_points[-2]['price'] else 'up'

    return {
        'macro_background': macro_background,
        'focus_structure': {
            'focus_mode': focus_mode,
            'archetype_family': family,
            'archetype_label': f"{family}平台原型" if family == 'C' else structure_type,
            'maturity': maturity,
            'directional_bias': 'range' if family in ('B', 'C') else 'down' if current_direction == 'down' else 'up',
            'summary': prediction.get('prediction_alert') or structure_type,
            'start_anchor': {
                'point_id': explanation.get('structure_start_point_id'),
                'price': next((p.get('price') for p in labeled_points if p.get('point_id') == explanation.get('structure_start_point_id')), None),
                'date': next((p.get('date') for p in labeled_points if p.get('point_id') == explanation.get('structure_start_point_id')), None),
                'semantic': 'focus_origin',
            },
            'reference_origin': {
                'point_id': None,
                'price': valid_range.get('start_price') if valid_range else None,
                'date': valid_range.get('start_date') if valid_range else None,
                'semantic': 'macro_origin',
            } if valid_range else None,
            'display_reason': explanation.get('display_reason', ''),
        },
        'current_leg': {
            'last_confirmed_point_id': last_confirmed_point_id,
            'live_point_id': 'live' if has_live_tail else None,
            'from_point_id': last_confirmed_point_id,
            'to_point_id': 'live' if has_live_tail else None,
            'direction': current_direction,
            'status': 'forming' if has_live_tail else 'absent',
            'label': f'{last_confirmed_point_id}→live {"下行形成中" if current_direction == "down" else "上行形成中"}' if has_live_tail and last_confirmed_point_id else '待确认',
        },
        'next_confirmation': {
            'type': 'pivot',
            'label': f"等待{prediction.get('next_stage')}",
            'trigger': prediction.get('prediction_alert') or '等待下一确认拐点',
            'target_point_id': self._extract_stage_point_id(prediction.get('next_stage', ''), family.lower() if family in ('A', 'B', 'C', 'D') else None, point_ids),
        } if prediction.get('next_stage') else None,
        'scenario_paths': self._build_scenario_paths(structure_type, labeled_points, peak_analysis),
    }
```

- [ ] **Step 5: Run the Python suite and make it pass**

Run:

```bash
python3 -m unittest tests.test_structure_interpretation_model tests.test_stock_analyzer_render_payload tests.test_structure_phase_execution -v
```

Expected:

- all targeted tests `OK`
- existing render payload geometry tests still pass

- [ ] **Step 6: Commit the backend interpretation model**

```bash
git add scripts/stock_analyzer.py tests/test_structure_interpretation_model.py tests/test_stock_analyzer_render_payload.py
git commit -m "feat: add structure interpretation model backend"
```

## Task 3: Switch the analysis page to interpretation-first semantics

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
- Test: `tests/structure-explainability-view-model.test.ts`
- Test: `tests/structure-explainability-panel.test.ts`

- [ ] **Step 1: Add the TypeScript contract for `structure.interpretation`**

```ts
export interface StructureInterpretation {
  macro_background?: {
    direction?: 'bullish' | 'bearish' | 'range' | 'mixed';
    label?: '偏多' | '偏空' | '整理' | '混合';
    confidence?: 'low' | 'medium' | 'high';
    basis?: string[];
  };
  focus_structure?: {
    focus_mode?: 'full_range' | 'peak_slice_right' | 'valley_slice_right';
    archetype_family?: 'A' | 'B' | 'C' | 'D' | 'complex' | 'unfinished';
    archetype_label?: string;
    maturity?: 'candidate' | 'developing' | 'confirmed' | 'completed' | 'invalidated';
    directional_bias?: 'up' | 'down' | 'range' | 'two_way';
    summary?: string;
    display_reason?: string;
  };
  current_leg?: {
    from_point_id?: string | null;
    to_point_id?: string | 'live' | null;
    direction?: 'up' | 'down' | 'flat' | 'unknown';
    status?: 'forming' | 'confirmed' | 'absent';
    label?: string;
  };
  next_confirmation?: {
    type?: 'pivot' | 'breakout' | 'breakdown' | 'completion' | 'direction_choice';
    label?: string;
    trigger?: string;
    target_point_id?: string | null;
  } | null;
  scenario_paths?: Array<{
    code?: string;
    label?: string;
    trigger?: string;
    effect?: string;
  }>;
}

export interface StructureData {
  structure_type: string;
  structure_stage: string;
  trend_direction: string;
  inflection_points: number;
  segment_count: number;
  description: string;
  archetype?: StructureArchetype | null;
  execution_phase?: StructureExecutionPhase | null;
  execution?: StructureExecution | null;
  interpretation?: StructureInterpretation | null;
  structure_details?: StructureDetails | null;
}
```

- [ ] **Step 2: Add a view-model helper that prefers interpretation over the old trend badge**

```ts
export function buildStructureExplainabilityViewModel(structure?: StructureExplainabilityInput) {
  const interpretation = structure?.interpretation;

  return {
    topology: {
      hasExplainability: Boolean(explainability),
      startLabel: explainability?.structure_start_point_id ?? null,
      currentLabel: interpretation?.current_leg?.label ?? explainability?.current_segment?.label ?? null,
      currentSegmentLabel: interpretation?.current_leg?.label ?? explainability?.current_segment?.label ?? null,
      nextSegmentLabel: interpretation?.next_confirmation?.label ?? explainability?.next_segment_preview?.label ?? null,
      displayReason: interpretation?.focus_structure?.display_reason ?? explainability?.display_reason ?? null,
      fallbackText: explainability ? null : buildFallbackText(prediction),
    },
    interpretation: {
      backgroundLabel: interpretation?.macro_background?.label ?? null,
      archetypeLabel: interpretation?.focus_structure?.archetype_label ?? structure?.archetype?.primary ?? structure?.structure_type ?? null,
      maturityLabel: interpretation?.focus_structure?.maturity ?? null,
      currentLegLabel: interpretation?.current_leg?.label ?? null,
      nextConfirmationLabel: interpretation?.next_confirmation?.label ?? null,
    },
    archetype: {
      primaryLabel,
      alternativeLabels,
      reason: archetype?.reason ?? structure?.description ?? null,
    },
  };
}
```

- [ ] **Step 3: Update the panel so the badges and summary blocks use the new interpretation fields**

```tsx
<div className="flex flex-wrap gap-2">
  {viewModel.interpretation.backgroundLabel ? (
    <Badge className="border border-blue-200 bg-blue-100 text-blue-700">
      背景 {viewModel.interpretation.backgroundLabel}
    </Badge>
  ) : null}
  <Badge className={structureColors[viewModel.interpretation.archetypeLabel || structure.structure_type] || ''}>
    {viewModel.interpretation.archetypeLabel || structure.structure_type}
  </Badge>
  {viewModel.interpretation.maturityLabel ? (
    <Badge variant="outline">成熟度 {viewModel.interpretation.maturityLabel}</Badge>
  ) : null}
  {viewModel.interpretation.currentLegLabel ? (
    <Badge className="border border-red-200 bg-red-50 text-red-700">
      {viewModel.interpretation.currentLegLabel}
    </Badge>
  ) : null}
</div>

<div className="grid gap-3 md:grid-cols-4">
  <SummaryBlock label="背景" value={viewModel.interpretation.backgroundLabel ?? '待确认'} />
  <SummaryBlock label="结构起点" value={visibleStart} />
  <SummaryBlock label="当前段" value={viewModel.interpretation.currentLegLabel ?? visibleCurrent} />
  <SummaryBlock label="下一确认" value={viewModel.interpretation.nextConfirmationLabel ?? visibleNext} />
</div>
```

- [ ] **Step 4: Add or update the TypeScript tests before the UI code lands**

```ts
test('buildStructureExplainabilityViewModel prefers interpretation fields over ambiguous trend text', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: 'C单平台式',
    trend_direction: '上涨',
    interpretation: {
      macro_background: { label: '偏多' },
      focus_structure: { archetype_label: 'C平台原型', maturity: 'developing', display_reason: '峰值后聚焦右侧结构' },
      current_leg: { label: 'c3→live 下行形成中' },
      next_confirmation: { label: '等待 c4 确认' },
    },
    structure_details: {
      explainability: {
        structure_start_point_id: 'c1',
        current_segment: { label: 'c2→c3' },
        next_segment_preview: { label: 'c3→c4' },
      },
    },
  });

  assert.equal(result.interpretation.backgroundLabel, '偏多');
  assert.equal(result.interpretation.archetypeLabel, 'C平台原型');
  assert.equal(result.interpretation.currentLegLabel, 'c3→live 下行形成中');
  assert.equal(result.topology.nextSegmentLabel, '等待 c4 确认');
});
```

```ts
assert.match(html, /背景/);
assert.match(html, /偏多/);
assert.match(html, /成熟度/);
assert.match(html, /c3→live 下行形成中/);
assert.match(html, /下一确认/);
assert.doesNotMatch(html, />上涨</);
```

- [ ] **Step 5: Run the TS tests and typecheck**

Run:

```bash
node --test tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts
pnpm ts-check
```

Expected:

- both test files pass
- `tsc` exits with code `0`

- [ ] **Step 6: Commit the interpretation-driven analysis page**

```bash
git add src/lib/stock-structure-types.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureExplainabilityPanel.tsx tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts
git commit -m "feat: show interpretation model in analysis panel"
```

## Task 4: Expose the interpretation model to downstream AI consumers

**Files:**
- Modify: `src/lib/ai-analysis-payload.ts`
- Test: `tests/ai-analysis-payload.test.ts`

- [ ] **Step 1: Extend the AI summary payload to include a compact interpretation block**

```ts
structure: compactRecord({
  type: periodData.structure?.structure_type,
  stage: periodData.structure?.structure_stage,
  trend: periodData.structure?.trend_direction,
  description: periodData.structure?.description,
  interpretation: periodData.structure?.interpretation
    ? compactRecord({
        macro_background: compactRecord({
          label: periodData.structure.interpretation.macro_background?.label,
          direction: periodData.structure.interpretation.macro_background?.direction,
          basis: periodData.structure.interpretation.macro_background?.basis,
        }),
        focus_structure: compactRecord({
          focus_mode: periodData.structure.interpretation.focus_structure?.focus_mode,
          archetype_label: periodData.structure.interpretation.focus_structure?.archetype_label,
          maturity: periodData.structure.interpretation.focus_structure?.maturity,
          directional_bias: periodData.structure.interpretation.focus_structure?.directional_bias,
          summary: periodData.structure.interpretation.focus_structure?.summary,
        }),
        current_leg: compactRecord({
          label: periodData.structure.interpretation.current_leg?.label,
          direction: periodData.structure.interpretation.current_leg?.direction,
          status: periodData.structure.interpretation.current_leg?.status,
        }),
        next_confirmation: periodData.structure.interpretation.next_confirmation
          ? compactRecord({
              label: periodData.structure.interpretation.next_confirmation.label,
              type: periodData.structure.interpretation.next_confirmation.type,
              trigger: periodData.structure.interpretation.next_confirmation.trigger,
            })
          : undefined,
        scenario_paths: periodData.structure.interpretation.scenario_paths,
      })
    : undefined,
  archetype: periodData.structure?.archetype
    ? compactRecord({
        primary: periodData.structure.archetype.primary,
        maturity: periodData.structure.archetype.maturity,
        confidence: periodData.structure.archetype.confidence,
        reason: periodData.structure.archetype.reason,
        alternatives: periodData.structure.archetype.alternatives,
      })
    : undefined,
}),
```

- [ ] **Step 2: Add a payload regression test that locks the new fields**

```ts
test('buildAiDecisionPayload includes interpretation summary for downstream strategy analysis', () => {
  const payload = buildAiDecisionPayload({
    periods: {
      daily: {
        latest_price: 163.35,
        structure: {
          structure_type: 'C单平台式',
          structure_stage: '峰值209.88后C单平台式',
          trend_direction: '上涨',
          description: '旧描述',
          interpretation: {
            macro_background: {
              label: '偏多',
              direction: 'bullish',
              basis: ['价格在 MA55 上方', 'MA55 高于 MA233'],
            },
            focus_structure: {
              focus_mode: 'peak_slice_right',
              archetype_label: 'C平台原型',
              maturity: 'developing',
              directional_bias: 'range',
              summary: '峰值后右侧平台整理',
            },
            current_leg: {
              label: 'c3→live 下行形成中',
              direction: 'down',
              status: 'forming',
            },
            next_confirmation: {
              label: '等待 c4 确认',
              type: 'pivot',
              trigger: '等待底分型确认',
            },
            scenario_paths: [
              { code: 'up_break', label: '上破上沿', trigger: '突破 181.99', effect: '升级为推进结构' },
            ],
          },
        },
      },
    },
  });

  assert.equal(payload.periods.daily.structure.interpretation.macro_background.label, '偏多');
  assert.equal(payload.periods.daily.structure.interpretation.focus_structure.archetype_label, 'C平台原型');
  assert.equal(payload.periods.daily.structure.interpretation.current_leg.label, 'c3→live 下行形成中');
});
```

- [ ] **Step 3: Run the AI payload test**

Run:

```bash
node --test tests/ai-analysis-payload.test.ts
```

Expected:

- test passes
- interpretation summary is present and compact

- [ ] **Step 4: Commit the AI payload update**

```bash
git add src/lib/ai-analysis-payload.ts tests/ai-analysis-payload.test.ts
git commit -m "feat: expose structure interpretation in ai payload"
```

## Final Verification

- [ ] **Step 1: Run the full targeted verification suite**

```bash
python3 -m unittest tests.test_structure_interpretation_model tests.test_stock_analyzer_render_payload tests.test_structure_phase_execution -v
node --test tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts tests/ai-analysis-payload.test.ts
pnpm ts-check
```

Expected:

- Python tests: `OK`
- Node tests: all pass
- `pnpm ts-check`: exit code `0`

- [ ] **Step 2: Smoke-check the real weekly case locally**

Run:

```bash
python3 - <<'PY'
import json, urllib.request
obj = json.load(urllib.request.urlopen("http://localhost:5001/api/stock/analysis?code=300274&levels=weekly"))
weekly = obj["data"]["periods"]["weekly"]["structure"]
print(json.dumps({
    "type": weekly["structure_type"],
    "trend_direction": weekly["trend_direction"],
    "interpretation": weekly.get("interpretation"),
}, ensure_ascii=False, indent=2))
PY
```

Expected:

- `interpretation.macro_background.label == "偏多"`
- `interpretation.focus_structure.focus_mode == "peak_slice_right"`
- `interpretation.current_leg.label` contains `c3→live`
- old `trend_direction` may still exist for compatibility, but the UI no longer treats it as the primary explanation

- [ ] **Step 3: Commit the final verification checkpoint**

```bash
git add scripts/stock_analyzer.py src/lib/stock-structure-types.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureExplainabilityPanel.tsx src/lib/ai-analysis-payload.ts tests/test_structure_interpretation_model.py tests/test_stock_analyzer_render_payload.py tests/structure-explainability-view-model.test.ts tests/structure-explainability-panel.test.ts tests/ai-analysis-payload.test.ts
git commit -m "feat: land structure interpretation model"
```

## Spec Coverage Self-Review

- `macro_background` has dedicated backend helpers and UI consumption: Task 2, Task 3, Task 4.
- `focus_structure` with `focus_mode`, `archetype_label`, and `maturity`: Task 2, Task 3, Task 4.
- `current_leg` and live-tail semantics: Task 1, Task 2, Task 3.
- `next_confirmation` and `scenario_paths`: Task 2, Task 3, Task 4.
- “Do not touch topology geometry” is preserved by only changing point/semantic ids and UI consumers, not the line geometry builder: Task 2 verification plus Final Verification.
- Hover criteria cards are intentionally deferred; this plan stops after the interpretation model is available to be consumed by the page and AI payload.
