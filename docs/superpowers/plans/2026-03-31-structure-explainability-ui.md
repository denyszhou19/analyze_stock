# Structure Explainability UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable `structure_details.explainability` contract and upgrade the analysis page so users can directly see structure start, current segment, next segment, and a non-redundant archetype explanation without depending on a narrow hover card.

**Architecture:** Extend `scripts/stock_analyzer.py` so the existing structure pipeline assigns stable point/segment IDs, derives an `explainability` block from `structure_type + prediction + peak override`, and threads those IDs into the SVG render payload. On the frontend, add a small TypeScript view-model layer plus a dedicated structure section component so the page shows the topology as first-class content, keeps prediction/risk blocks as supporting context, and safely falls back when `explainability` is absent.

**Tech Stack:** Python 3 `unittest`, Next.js 16, React 19, TypeScript, node:test, Tailwind CSS

---

## File Structure

- Modify: `scripts/stock_analyzer.py`
  - Add structure-family resolution, stage-to-point mapping, explainability builder, and render-payload IDs.
- Modify: `tests/test_stock_analyzer_render_payload.py`
  - Add backend contract coverage for explainability, standard numbering, and complex fallback.
- Create: `src/lib/structure-explainability-view-model.ts`
  - Normalize explainability + archetype data into stable UI-facing labels and fallback text.
- Create: `tests/structure-explainability-view-model.test.ts`
  - Cover visible summary labels, archetype de-dup, and explainability-missing fallback.
- Modify: `src/components/stock/StructureTopologySvg.tsx`
  - Accept explainability metadata and render start/current/projected annotations on top of the existing SVG.
- Create: `src/components/stock/StructureExplainabilityPanel.tsx`
  - Own the structure summary cards, visible topology area, and supporting detail sections.
- Modify: `src/app/stock/[code]/analysis/page.tsx`
  - Replace the tooltip-centric structure block with the new panel component.

## Task 1: Add backend explainability contract and stable point/segment IDs

**Files:**
- Modify: `tests/test_stock_analyzer_render_payload.py`
- Modify: `scripts/stock_analyzer.py`

- [ ] **Step 1: Write the failing backend contract tests**

```python
class TestStockAnalyzerRenderPayload(unittest.TestCase):
    def test_build_structure_explainability_maps_standard_stage_labels(self) -> None:
        line_geometry = {
            "price_range": {"min": 100.0, "max": 125.0, "range": 25.0},
            "points": [
                {"sequence": 0, "price": 100.0, "date": "2024-01-01 00:00:00", "type": "bottom", "role": "from"},
                {"sequence": 1, "price": 112.0, "date": "2024-01-05 00:00:00", "type": "top", "role": "to"},
                {"sequence": 2, "price": 106.0, "date": "2024-01-10 00:00:00", "type": "bottom", "role": "to"},
                {"sequence": 3, "price": 125.0, "date": "2024-01-16 00:00:00", "type": "current", "role": "to", "is_current": True},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "上涨", "length": 4},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "下跌", "length": 5},
                {"sequence": 2, "from_point": 2, "to_point": 3, "direction": "上涨", "length": 6, "is_current": True},
            ],
            "point_count": 4,
            "segment_count": 3,
        }

        labeled_geometry, explainability = self.analyzer._build_structure_explainability(
            structure_type="D三段式",
            line_geometry=line_geometry,
            prediction={"current_stage": "d3拐点", "next_stage": "d4拐点（结构完成）"},
            peak_analysis=None,
        )

        self.assertEqual(explainability["structure_family"], "D")
        self.assertEqual(explainability["structure_start_point_id"], "d1")
        self.assertEqual(explainability["current_point_id"], "d3")
        self.assertEqual(explainability["current_segment"]["label"], "d2→d3")
        self.assertEqual(explainability["next_segment_preview"]["label"], "d3→d4")
        self.assertEqual(labeled_geometry["points"][0]["point_id"], "d1")
        self.assertEqual(labeled_geometry["segments"][2]["segment_id"], "d3-d4")

    def test_build_structure_explainability_degrades_for_complex_structure(self) -> None:
        line_geometry = {
            "price_range": {"min": 90.0, "max": 118.0, "range": 28.0},
            "points": [
                {"sequence": 0, "price": 90.0, "date": "2024-02-01 00:00:00", "type": "bottom", "role": "from"},
                {"sequence": 1, "price": 105.0, "date": "2024-02-08 00:00:00", "type": "top", "role": "to"},
                {"sequence": 2, "price": 96.0, "date": "2024-02-15 00:00:00", "type": "bottom", "role": "to"},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "上涨", "length": 4},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "下跌", "length": 4},
            ],
            "point_count": 3,
            "segment_count": 2,
        }

        labeled_geometry, explainability = self.analyzer._build_structure_explainability(
            structure_type="复杂结构",
            line_geometry=line_geometry,
            prediction={"current_stage": "第3个拐点", "next_stage": "结构完成，等待方向选择"},
            peak_analysis=None,
        )

        self.assertEqual(explainability["structure_family"], "complex")
        self.assertEqual(explainability["structure_start_point_id"], "p1")
        self.assertEqual(explainability["current_point_id"], "p3")
        self.assertIsNone(explainability["next_segment_preview"])
        self.assertTrue(explainability["display_reason"])
        self.assertEqual(labeled_geometry["segments"][0]["segment_id"], "p1-p2")
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run: `python3 -m unittest tests.test_stock_analyzer_render_payload -v`

Expected: FAIL with `AttributeError` for missing `_build_structure_explainability`, or assertion failures because `point_id`, `segment_id`, and `structure_details.explainability` do not exist yet.

- [ ] **Step 3: Implement structure-family resolution, ID decoration, and explainability building**

Add the helper family in `scripts/stock_analyzer.py` near the render-payload helpers:

```python
    def _resolve_structure_family(self, structure_type: str) -> Tuple[str, Optional[str]]:
        mapping = {
            'A五段式': ('A', 'a'),
            'B双平台式': ('B', 'b'),
            'C单平台式': ('C', 'c'),
            'D三段式': ('D', 'd'),
        }
        if structure_type in mapping:
            return mapping[structure_type]
        if structure_type == '结构未完成':
            return ('unfinished', None)
        return ('complex', None)

    def _extract_stage_point_id(self, stage: str, prefix: Optional[str], point_ids: List[str]) -> Optional[str]:
        if not stage or not prefix:
            return None
        match = re.search(rf'{prefix}(\\d+)', stage.lower())
        if not match:
            return None
        candidate = f'{prefix}{match.group(1)}'
        return candidate if candidate in point_ids else None

    def _build_structure_explainability(
        self,
        structure_type: str,
        line_geometry: Dict[str, Any],
        prediction: Dict[str, Any],
        peak_analysis: Optional[Dict[str, Any]],
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        family, prefix = self._resolve_structure_family(structure_type)
        labeled_points = []
        for index, point in enumerate(line_geometry.get('points', []), start=1):
            point_id = f'{prefix}{index}' if prefix else f'p{index}'
            labeled_points.append({**point, 'point_id': point_id})

        labeled_segments = []
        for segment in line_geometry.get('segments', []):
            from_id = labeled_points[segment['from_point']]['point_id']
            to_id = labeled_points[segment['to_point']]['point_id']
            labeled_segments.append({**segment, 'segment_id': f'{from_id}-{to_id}'})

        labeled_geometry = {
            **line_geometry,
            'points': labeled_points,
            'segments': labeled_segments,
        }

        point_ids = [point['point_id'] for point in labeled_points]
        current_point_id = self._extract_stage_point_id(
            str((prediction or {}).get('current_stage', '')),
            prefix,
            point_ids,
        ) or (point_ids[-1] if point_ids else None)

        next_point_id = self._extract_stage_point_id(
            str((prediction or {}).get('next_stage', '')),
            prefix,
            point_ids,
        )

        point_index_map = {point['point_id']: idx for idx, point in enumerate(labeled_points)}
        current_segment = None
        if current_point_id and current_point_id in point_index_map:
            current_index = point_index_map[current_point_id]
            if current_index > 0:
                from_id = labeled_points[current_index - 1]['point_id']
                current_segment = {
                    'from_point_id': from_id,
                    'to_point_id': current_point_id,
                    'label': f'{from_id}→{current_point_id}',
                }

        next_segment_preview = None
        if current_point_id and next_point_id and current_point_id in point_index_map and next_point_id in point_index_map:
            next_segment_preview = {
                'from_point_id': current_point_id,
                'to_point_id': next_point_id,
                'label': f'{current_point_id}→{next_point_id}',
                'status': 'projected',
            }

        explainability = {
            'structure_family': family,
            'structure_start_point_id': labeled_points[0]['point_id'] if labeled_points else None,
            'current_point_id': current_point_id,
            'current_segment': current_segment,
            'next_segment_preview': next_segment_preview,
            'point_labels': [
                {
                    'point_id': point['point_id'],
                    'label': point['point_id'] if prefix else '',
                    'role': 'current' if point['point_id'] == current_point_id else 'start' if idx == 0 else 'normal',
                }
                for idx, point in enumerate(labeled_points)
            ],
            'segment_labels': [
                {
                    'segment_id': segment['segment_id'],
                    'from_point_id': labeled_points[segment['from_point']]['point_id'],
                    'to_point_id': labeled_points[segment['to_point']]['point_id'],
                    'label': f"{labeled_points[segment['from_point']]['point_id']}→{labeled_points[segment['to_point']]['point_id']}",
                    'role': 'current' if current_segment and segment['segment_id'] == f"{current_segment['from_point_id']}-{current_segment['to_point_id']}" else 'normal',
                }
                for segment in labeled_segments
            ],
            'display_reason': 'prediction.current_stage 映射到当前已确认锚点' if prefix else '复杂结构使用通用锚点编号展示当前路径',
        }
        return labeled_geometry, explainability
```

- [ ] **Step 4: Thread explainability into `detect_structure()` and copy IDs into the render payload**

Reorder the structure pipeline so `prediction` is built before the final SVG payload, then attach `explainability`:

```python
        result['structure_details']['strokes'] = stroke_list
        line_geometry = self._build_line_geometry(stroke_list)
        result['structure_details']['line_geometry'] = line_geometry

        # ... existing classification / judgment / prediction logic ...
        result['structure_details']['prediction'] = self._analyze_structure_prediction(
            structure_type=result['structure_type'],
            inflection_count=inflection_count,
            trend_direction=result['trend_direction'],
            last_fractal=valid_fractals[-1] if valid_fractals else None,
            current_price=float(recent.iloc[-1]['close']) if len(recent) else 0.0,
            macd_status=macd_status,
        )

        labeled_geometry, explainability = self._build_structure_explainability(
            structure_type=result['structure_type'],
            line_geometry=line_geometry,
            prediction=result['structure_details']['prediction'],
            peak_analysis=result['structure_details'].get('peak_analysis'),
        )
        result['structure_details']['line_geometry'] = labeled_geometry
        result['structure_details']['explainability'] = explainability
        result['structure_details']['render_payload'] = self._build_render_payload(labeled_geometry)
```

Also extend `_build_render_payload()` so every point and segment carries IDs through to the frontend:

```python
            render_points.append({
                'sequence': point.get('sequence', 0),
                'point_id': point.get('point_id'),
                # ...existing fields...
            })

            render_segments.append({
                'sequence': segment.get('sequence', 0),
                'segment_id': segment.get('segment_id'),
                # ...existing fields...
            })
```

- [ ] **Step 5: Run the backend tests and confirm the contract passes**

Run: `python3 -m unittest tests.test_stock_analyzer_render_payload -v`

Expected: PASS with the new explainability tests plus the existing render-payload tests.

- [ ] **Step 6: Commit the backend contract**

```bash
git add tests/test_stock_analyzer_render_payload.py scripts/stock_analyzer.py
git commit -m "feat: add structure explainability payload"
```

## Task 2: Add the frontend explainability view-model and annotated SVG renderer

**Files:**
- Create: `tests/structure-explainability-view-model.test.ts`
- Create: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/components/stock/StructureTopologySvg.tsx`

- [ ] **Step 1: Write the failing frontend view-model tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildStructureExplainabilityViewModel } = await import(
  new URL('../src/lib/structure-explainability-view-model.ts', import.meta.url).href
);

test('buildStructureExplainabilityViewModel exposes visible start current and next labels', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: 'A五段式',
    description: '趋势结构',
    archetype: {
      primary: 'A五段式',
      reason: 'Directional -> Platform',
      alternatives: [{ type: 'C单平台式', confidence: 0.35, reason: '平台段占比仍高' }],
    },
    structure_details: {
      explainability: {
        structure_family: 'A',
        structure_start_point_id: 'a1',
        current_point_id: 'a4',
        current_segment: { from_point_id: 'a3', to_point_id: 'a4', label: 'a3→a4' },
        next_segment_preview: {
          from_point_id: 'a4',
          to_point_id: 'a5',
          label: 'a4→a5',
          status: 'projected',
        },
        point_labels: [],
        segment_labels: [],
        display_reason: '当前阶段 a4 由 prediction.current_stage 映射而来',
      },
      prediction: {
        current_stage: 'a4拐点',
        next_stage: 'a5拐点（第五浪）',
        prediction_alert: '第五浪即将开始',
        key_price_levels: [],
        confidence: 'medium',
        action_hint: '等待确认',
      },
    },
  });

  assert.equal(result.topology.startLabel, 'a1');
  assert.equal(result.topology.currentLabel, 'a4');
  assert.equal(result.topology.currentSegmentLabel, 'a3→a4');
  assert.equal(result.topology.nextSegmentLabel, 'a4→a5');
  assert.equal(result.archetype.primaryLabel, 'A五段式');
  assert.deepEqual(result.archetype.alternativeLabels, ['C单平台式']);
});

test('buildStructureExplainabilityViewModel degrades safely when explainability is absent', () => {
  const result = buildStructureExplainabilityViewModel({
    structure_type: '复杂结构',
    description: '复杂结构，需人工确认',
    archetype: {
      primary: '复杂结构',
      reason: 'Unknown',
      alternatives: [],
    },
    structure_details: {
      prediction: {
        current_stage: '第3个拐点',
        next_stage: '结构完成，等待方向选择',
        prediction_alert: '结构复杂',
        key_price_levels: [],
        confidence: 'low',
        action_hint: '人工确认',
      },
    },
  });

  assert.equal(result.topology.startLabel, null);
  assert.equal(result.topology.currentLabel, null);
  assert.equal(result.topology.nextSegmentLabel, null);
  assert.equal(result.topology.hasExplainability, false);
  assert.match(result.topology.fallbackText ?? '', /prediction/);
});
```

- [ ] **Step 2: Run the frontend view-model test to verify it fails**

Run: `node --test tests/structure-explainability-view-model.test.ts`

Expected: FAIL because `src/lib/structure-explainability-view-model.ts` does not exist yet.

- [ ] **Step 3: Implement the explainability view-model helper**

Create `src/lib/structure-explainability-view-model.ts`:

```ts
export interface StructureExplainabilityViewModel {
  topology: {
    hasExplainability: boolean;
    startLabel: string | null;
    currentLabel: string | null;
    currentSegmentLabel: string | null;
    nextSegmentLabel: string | null;
    displayReason: string | null;
    fallbackText: string | null;
  };
  archetype: {
    primaryLabel: string | null;
    alternativeLabels: string[];
    reason: string | null;
  };
}

export function buildStructureExplainabilityViewModel(structure?: any): StructureExplainabilityViewModel {
  const explainability = structure?.structure_details?.explainability;
  const prediction = structure?.structure_details?.prediction;
  const archetype = structure?.archetype;

  return {
    topology: {
      hasExplainability: Boolean(explainability),
      startLabel: explainability?.structure_start_point_id ?? null,
      currentLabel: explainability?.current_point_id ?? null,
      currentSegmentLabel: explainability?.current_segment?.label ?? null,
      nextSegmentLabel: explainability?.next_segment_preview?.label ?? null,
      displayReason: explainability?.display_reason ?? null,
      fallbackText: explainability
        ? null
        : prediction?.current_stage || prediction?.next_stage
          ? `prediction 回退: ${prediction?.current_stage || '未知'} / ${prediction?.next_stage || '未知'}`
          : '暂无 explainability 标注',
    },
    archetype: {
      primaryLabel: archetype?.primary ?? structure?.structure_type ?? null,
      alternativeLabels: Array.isArray(archetype?.alternatives)
        ? archetype.alternatives.map((item: any) => item.type).filter(Boolean)
        : [],
      reason: archetype?.reason ?? structure?.description ?? null,
    },
  };
}
```

- [ ] **Step 4: Upgrade the SVG component so it can draw start/current/projected annotations**

Extend `src/components/stock/StructureTopologySvg.tsx` to accept both render-payload IDs and the new explainability block:

```tsx
export interface StructureExplainabilityData {
  structure_family: 'A' | 'B' | 'C' | 'D' | 'complex' | 'unfinished';
  structure_start_point_id: string | null;
  current_point_id: string | null;
  current_segment: {
    from_point_id: string;
    to_point_id: string;
    label: string;
  } | null;
  next_segment_preview: {
    from_point_id: string;
    to_point_id: string;
    label: string;
    status: 'projected' | 'completion' | 'direction_choice';
  } | null;
  point_labels: Array<{
    point_id: string;
    label: string;
    role: 'start' | 'current' | 'normal' | 'projected';
  }>;
  segment_labels: Array<{
    segment_id: string;
    from_point_id: string;
    to_point_id: string;
    label: string;
    role: 'current' | 'projected' | 'normal';
  }>;
  display_reason: string;
}

export interface StructureRenderPoint {
  point_id?: string;
  sequence: number;
  // ...existing fields...
}

export interface StructureRenderSegment {
  segment_id?: string;
  sequence: number;
  // ...existing fields...
}

interface StructureTopologySvgProps {
  payload?: StructureRenderPayload;
  explainability?: StructureExplainabilityData | null;
  className?: string;
}
```

Use the new IDs to overlay visible labels and roles:

```tsx
  const pointLabelMap = new Map(
    (explainability?.point_labels || []).map(item => [item.point_id, item])
  );
  const currentSegmentId = explainability?.current_segment
    ? `${explainability.current_segment.from_point_id}-${explainability.current_segment.to_point_id}`
    : null;
  const projectedSegmentId = explainability?.next_segment_preview
    ? `${explainability.next_segment_preview.from_point_id}-${explainability.next_segment_preview.to_point_id}`
    : null;

  {segments.map((segment) => {
    const isCurrentSegment = segment.segment_id && segment.segment_id === currentSegmentId;
    const isProjectedSegment = segment.segment_id && segment.segment_id === projectedSegmentId;
    return (
      <line
        key={segment.sequence}
        x1={segment.x1}
        y1={segment.y1}
        x2={segment.x2}
        y2={segment.y2}
        stroke={isProjectedSegment ? '#94a3b8' : segment.stroke}
        strokeWidth={isCurrentSegment ? 3.5 : segment.stroke_width}
        strokeDasharray={isProjectedSegment ? '6,4' : segment.stroke_dasharray ?? undefined}
      />
    );
  })}
```

And annotate visible start/current labels:

```tsx
          {point.point_id && pointLabelMap.get(point.point_id)?.label ? (
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              fill={point.point_id === explainability?.current_point_id ? '#f8fafc' : '#cbd5e1'}
              fontSize="9"
              fontWeight="700"
            >
              {pointLabelMap.get(point.point_id)?.label}
            </text>
          ) : null}
```

- [ ] **Step 5: Run the frontend tests and type-check**

Run: `node --test tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts && pnpm ts-check`

Expected: PASS with the new view-model tests and no TypeScript errors in the updated SVG component.

- [ ] **Step 6: Commit the frontend explainability primitives**

```bash
git add tests/structure-explainability-view-model.test.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureTopologySvg.tsx
git commit -m "feat: add explainable structure topology primitives"
```

## Task 3: Replace the tooltip-only structure block with a visible explainability panel

**Files:**
- Create: `src/components/stock/StructureExplainabilityPanel.tsx`
- Modify: `src/app/stock/[code]/analysis/page.tsx`

- [ ] **Step 1: Create the new structure panel component**

Create `src/components/stock/StructureExplainabilityPanel.tsx` and move the structure-specific layout there:

```tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StructureTopologySvg } from '@/components/stock/StructureTopologySvg';
import { buildStructureExplainabilityViewModel } from '@/lib/structure-explainability-view-model';

export function StructureExplainabilityPanel({
  periodData,
  executionSummary,
  structureColors,
  trendBadgeClassName,
}: {
  periodData: any;
  executionSummary: any;
  structureColors: Record<string, string>;
  trendBadgeClassName: string;
}) {
  const viewModel = buildStructureExplainabilityViewModel(periodData?.structure);
  const explainability = periodData?.structure?.structure_details?.explainability;
  const payload = periodData?.structure?.structure_details?.render_payload;
  const prediction = periodData?.structure?.structure_details?.prediction;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">当前阶段</div>
            <Badge className="border border-sky-200 bg-sky-100 text-sky-700">
              {executionSummary.phaseLabel || '暂无阶段'}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {executionSummary.phaseReason || '等待更多结构与执行信号确认当前阶段。'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">执行建议</div>
            <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700">
              {executionSummary.actionLabel || '等待'}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {executionSummary.executionReason || '当前周期暂无额外执行说明。'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">结构原型</div>
            <Badge className={structureColors[viewModel.archetype.primaryLabel || ''] || 'border border-border bg-muted text-muted-foreground'}>
              {viewModel.archetype.primaryLabel || '暂无原型'}
            </Badge>
            {viewModel.archetype.alternativeLabels.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                备选原型: {viewModel.archetype.alternativeLabels.join(' / ')}
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {viewModel.archetype.reason || periodData?.structure?.description}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={structureColors[periodData.structure.structure_type] || ''}>
              {periodData.structure.structure_type}
            </Badge>
            <Badge className={trendBadgeClassName}>{periodData.structure.trend_direction}</Badge>
            <Badge variant="outline">{periodData.structure.inflection_points}个拐点</Badge>
          </div>

          {payload?.point_count ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/95 p-4">
              <StructureTopologySvg
                payload={payload}
                explainability={explainability}
                className="h-56 w-full sm:h-64"
              />
            </div>
          ) : null}

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">结构起点</div>
              <div className="text-sm font-semibold">{viewModel.topology.startLabel || '未标注'}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">当前段</div>
              <div className="text-sm font-semibold">{viewModel.topology.currentSegmentLabel || '未标注'}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">下一段预期</div>
              <div className="text-sm font-semibold">{viewModel.topology.nextSegmentLabel || '等待结构确认'}</div>
            </div>
          </div>

          {viewModel.topology.displayReason ? (
            <p className="text-sm text-muted-foreground">{viewModel.topology.displayReason}</p>
          ) : null}

          {!viewModel.topology.hasExplainability && viewModel.topology.fallbackText ? (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              {viewModel.topology.fallbackText}
            </div>
          ) : null}

          <Separator />

          {prediction ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-sm font-medium">{prediction.prediction_alert}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                当前阶段: {prediction.current_stage} / 下一阶段: {prediction.next_stage}
              </div>
            </div>
          ) : null}

          {periodData?.structure?.structure_details?.peak_analysis?.is_peak_structure ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              峰值分析: {periodData.structure.structure_details.peak_analysis.description}
            </div>
          ) : null}

          {periodData?.structure?.structure_details?.left_structure_warning ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              {periodData.structure.structure_details.left_structure_warning.title}
              {' - '}
              {periodData.structure.structure_details.left_structure_warning.action_hint}
            </div>
          ) : null}

          {periodData?.structure?.structure_details?.judgment_criteria ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {periodData.structure.structure_details.judgment_criteria}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Replace the existing structure-analysis block in the analysis page**

In `src/app/stock/[code]/analysis/page.tsx`, import the new component and replace the current tooltip-heavy JSX:

```tsx
import { StructureExplainabilityPanel } from '@/components/stock/StructureExplainabilityPanel';
```

Then replace the current block that starts at `/* 结构分析 */` with:

```tsx
<StructureExplainabilityPanel
  periodData={periodData}
  executionSummary={executionSummary}
  structureColors={STRUCTURE_COLORS}
  trendBadgeClassName={getTrendStyle(periodData.structure.trend_direction)}
/>
```

Delete the old giant `TooltipContent` that made topology, strokes, judgment criteria, peak analysis, and warnings live inside a narrow hover card. Keep only the small explanatory `Info` tooltip if you still want a compact legend.

- [ ] **Step 3: Run focused integration checks**

Run: `node --test tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts && pnpm ts-check`

Expected: PASS, with the page compiling against the new component and no stale type errors from the old tooltip markup.

- [ ] **Step 4: Run manual UI verification against the existing local URL**

Run: `pnpm dev`

Manual QA in the browser:
- Visit `http://localhost:5001/stock/300274/analysis`
- Confirm the structure graph is directly visible without hovering.
- Confirm you can answer “起点 / 当前段 / 下一段” from the visible panel.
- Confirm the archetype card shows either `备选原型` or `判断理由`, not just the same structure badge again.
- Confirm complex or missing-explainability cases still render the old prediction text instead of crashing.

- [ ] **Step 5: Commit the analysis-page UI integration**

```bash
git add src/components/stock/StructureExplainabilityPanel.tsx src/app/stock/[code]/analysis/page.tsx
git commit -m "feat: surface explainable structure analysis on page"
```

## Task 4: Final regression sweep

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `tests/test_stock_analyzer_render_payload.py`
- Create: `tests/structure-explainability-view-model.test.ts`
- Create: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/components/stock/StructureTopologySvg.tsx`
- Create: `src/components/stock/StructureExplainabilityPanel.tsx`
- Modify: `src/app/stock/[code]/analysis/page.tsx`

- [ ] **Step 1: Run the full targeted verification set**

Run:

```bash
python3 -m unittest tests.test_stock_analyzer_render_payload -v
node --test tests/structure-explainability-view-model.test.ts tests/stock-execution-view-model.test.ts
pnpm ts-check
```

Expected:
- Python explainability contract tests PASS
- Node view-model tests PASS
- TypeScript check PASS

- [ ] **Step 2: Inspect the diff before handoff**

Run:

```bash
git show --stat --oneline HEAD
git diff --stat -- scripts/stock_analyzer.py tests/test_stock_analyzer_render_payload.py tests/structure-explainability-view-model.test.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureTopologySvg.tsx src/components/stock/StructureExplainabilityPanel.tsx src/app/stock/[code]/analysis/page.tsx
```

Expected: only the explainability payload, SVG/component, and analysis-page files from this plan are included.

- [ ] **Step 3: Create the final handoff commit if you made follow-up fixups during verification**

```bash
git add scripts/stock_analyzer.py tests/test_stock_analyzer_render_payload.py tests/structure-explainability-view-model.test.ts src/lib/structure-explainability-view-model.ts src/components/stock/StructureTopologySvg.tsx src/components/stock/StructureExplainabilityPanel.tsx src/app/stock/[code]/analysis/page.tsx
git commit -m "chore: finalize structure explainability ui"
```
