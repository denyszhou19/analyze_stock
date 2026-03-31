import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const { buildProjectedSegmentOverlay } = await import(
  new URL('../src/lib/structure-topology-projection.ts', import.meta.url).href
);

function asDataModule(code: string): string {
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

function renderQuietly(element: React.ReactElement) {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Each child in a list should have a unique "key" prop.')
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  try {
    return renderToStaticMarkup(element);
  } finally {
    console.error = originalConsoleError;
  }
}

async function importStructureTopologySvg() {
  const componentPath = path.resolve(
    process.cwd(),
    'src/components/stock/StructureTopologySvg.tsx'
  );
  const source = await fs.readFile(componentPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: componentPath,
  });
  const reactUrl = pathToFileURL(require.resolve('react')).href;
  const jsxRuntimeStubUrl = asDataModule(`
    import React from '${reactUrl}';
    export const Fragment = React.Fragment;
    export function jsx(type, props, key) {
      return React.createElement(type, { ...props, key });
    }
    export function jsxs(type, props, key) {
      return React.createElement(type, { ...props, key });
    }
  `);
  const projectionUrl = pathToFileURL(
    path.resolve(process.cwd(), 'src/lib/structure-topology-projection.ts')
  ).href;
  const rewritten = transpiled.outputText
    .replaceAll('"react/jsx-runtime"', `'${jsxRuntimeStubUrl}'`)
    .replaceAll("'@/lib/structure-topology-projection'", `'${projectionUrl}'`);

  return import(asDataModule(rewritten));
}

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
  assert.ok((overlay?.x2 ?? 0) > (overlay?.x1 ?? 0));
  assert.ok((overlay?.y2 ?? 0) < (overlay?.y1 ?? 0));
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

test('StructureTopologySvg renders in-chart start and current anchor markers from explainability fields', async () => {
  const { StructureTopologySvg } = await importStructureTopologySvg();

  const html = renderQuietly(
    React.createElement(StructureTopologySvg, {
      className: 'topology',
      payload: {
        version: 1,
        viewport: {
          width: 320,
          height: 160,
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          draw_width: 300,
          draw_height: 120,
          date_label_y: 148,
          label_box: {
            width: 40,
            height: 16,
            radius: 4,
          },
        },
        price_range: {
          min: 10,
          max: 15,
          range: 5,
        },
        points: [
          {
            point_id: 'a1',
            sequence: 0,
            type: 'bottom',
            role: 'anchor',
            price: 10.2,
            price_label: '10.2',
            date: '2026-03-01',
            date_label: '03-01',
            x: 40,
            y: 120,
            label_x: 40,
            label_y: 132,
            label_side: 'bottom',
            label_box_width: 40,
            label_box_height: 16,
            marker_radius: 3,
            marker_fill: '#fff',
            marker_stroke: '#333',
            marker_stroke_width: 1,
            show_date_label: true,
            date_label_y: 148,
            is_current: false,
          },
          {
            point_id: 'a2',
            sequence: 1,
            type: 'top',
            role: 'anchor',
            price: 14.6,
            price_label: '14.6',
            date: '2026-03-05',
            date_label: '03-05',
            x: 120,
            y: 60,
            label_x: 120,
            label_y: 48,
            label_side: 'top',
            label_box_width: 40,
            label_box_height: 16,
            marker_radius: 3,
            marker_fill: '#fff',
            marker_stroke: '#333',
            marker_stroke_width: 1,
            show_date_label: true,
            date_label_y: 148,
            is_current: false,
          },
          {
            point_id: 'a3',
            sequence: 2,
            type: 'bottom',
            role: 'anchor',
            price: 11.4,
            price_label: '11.4',
            date: '2026-03-10',
            date_label: '03-10',
            x: 210,
            y: 100,
            label_x: 210,
            label_y: 112,
            label_side: 'bottom',
            label_box_width: 40,
            label_box_height: 16,
            marker_radius: 3,
            marker_fill: '#fff',
            marker_stroke: '#333',
            marker_stroke_width: 1,
            show_date_label: true,
            date_label_y: 148,
            is_current: true,
          },
        ],
        segments: [
          {
            sequence: 0,
            segment_id: 'a1-a2',
            from_point: 0,
            to_point: 1,
            x1: 40,
            y1: 120,
            x2: 120,
            y2: 60,
            direction: 'up',
            length: 1,
            is_current: false,
            stroke: '#ef4444',
            stroke_width: 2,
            stroke_dasharray: null,
          },
          {
            sequence: 1,
            segment_id: 'a2-a3',
            from_point: 1,
            to_point: 2,
            x1: 120,
            y1: 60,
            x2: 210,
            y2: 100,
            direction: 'down',
            length: 1,
            is_current: true,
            stroke: '#22c55e',
            stroke_width: 2,
            stroke_dasharray: null,
          },
        ],
        point_count: 3,
        segment_count: 2,
      },
      explainability: {
        structure_family: 'A',
        structure_start_point_id: 'a1',
        current_point_id: 'a3',
        current_segment: {
          from_point_id: 'a2',
          to_point_id: 'a3',
          label: 'a2→a3',
        },
        next_segment_preview: null,
        point_labels: [
          { point_id: 'a1', label: 'a1', role: 'start' },
          { point_id: 'a3', label: 'a3', role: 'current' },
        ],
        segment_labels: [],
        display_reason: '起点与当前点应在图中直接标出',
      },
    })
  );

  assert.match(html, /data-point-role="start"/);
  assert.match(html, /data-point-role="current"/);
  assert.match(html, />起点</);
  assert.match(html, />当前</);
});
