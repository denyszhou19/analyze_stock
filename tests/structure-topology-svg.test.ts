import test from 'node:test';
import assert from 'node:assert/strict';

const { buildProjectedSegmentOverlay } = await import(
  new URL('../src/lib/structure-topology-projection.ts', import.meta.url).href
);

test('buildProjectedSegmentOverlay returns a synthetic projected line when next preview is beyond payload geometry', () => {
  const payload = {
    viewport: {
      width: 320,
      height: 160,
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
    },
    points: [
      { sequence: 0, point_id: 'd1', x: 40, y: 120 },
      { sequence: 1, point_id: 'd2', x: 120, y: 60 },
      { sequence: 2, point_id: 'd3', x: 200, y: 100 },
    ],
    segments: [
      { sequence: 0, segment_id: 'd1-d2', from_point: 0, to_point: 1, x1: 40, y1: 120, x2: 120, y2: 60 },
      { sequence: 1, segment_id: 'd2-d3', from_point: 1, to_point: 2, x1: 120, y1: 60, x2: 200, y2: 100 },
    ],
  };
  const explainability = {
    current_point_id: 'd3',
    next_segment_preview: {
      from_point_id: 'd3',
      to_point_id: 'd4',
      label: 'd3→d4',
      status: 'projected',
    },
  };

  const overlay = buildProjectedSegmentOverlay(payload, explainability);

  assert.ok(overlay);
  assert.equal(overlay?.x1, 200);
  assert.equal(overlay?.y1, 100);
  assert.equal(overlay?.label, 'd3→d4');
  assert.equal(overlay?.targetLabel, 'd4');
});

test('buildProjectedSegmentOverlay returns null when preview segment already exists in payload', () => {
  const payload = {
    viewport: {
      width: 320,
      height: 160,
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
    },
    points: [
      { sequence: 0, point_id: 'a1', x: 40, y: 120 },
      { sequence: 1, point_id: 'a2', x: 120, y: 80 },
    ],
    segments: [
      { sequence: 0, segment_id: 'a1-a2', from_point: 0, to_point: 1, x1: 40, y1: 120, x2: 120, y2: 80 },
    ],
  };
  const explainability = {
    current_point_id: 'a2',
    next_segment_preview: {
      from_point_id: 'a1',
      to_point_id: 'a2',
      label: 'a1→a2',
      status: 'projected',
    },
  };

  assert.equal(buildProjectedSegmentOverlay(payload, explainability), null);
});
