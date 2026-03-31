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

async function importStructureExplainabilityPanel() {
  const panelPath = path.resolve(
    process.cwd(),
    'src/components/stock/StructureExplainabilityPanel.tsx'
  );
  const source = await fs.readFile(panelPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: panelPath,
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

  const uiStubUrl = asDataModule(`
    import React from '${reactUrl}';
    function slot(tag, slotName) {
      return function Component({ children, className, ...props }) {
        return React.createElement(tag, { ...props, className, 'data-slot': slotName }, children);
      };
    }
    export const Badge = slot('span', 'badge');
    export const Card = slot('section', 'card');
    export const CardContent = slot('div', 'card-content');
    export const Separator = slot('hr', 'separator');
    export const TooltipProvider = ({ children }) => React.createElement(React.Fragment, null, children);
    export const Tooltip = ({ children }) => React.createElement(React.Fragment, null, children);
    export const TooltipTrigger = ({ children }) => React.createElement(React.Fragment, null, children);
    export const TooltipContent = ({ children, className, ...props }) =>
      React.createElement('div', { ...props, className, 'data-slot': 'tooltip-content' }, children);
  `);

  const topologyStubUrl = asDataModule(`
    import React from '${reactUrl}';
    export function StructureTopologySvg({ payload, explainability, className }) {
      return React.createElement(
        'div',
        {
          className,
          'data-slot': 'topology-svg',
          'data-has-payload': String(Boolean(payload)),
          'data-has-explainability': String(Boolean(explainability)),
        },
        'topology'
      );
    }
  `);

  const lucideStubUrl = asDataModule(`
    import React from '${reactUrl}';
    export function Info(props) {
      return React.createElement('svg', { ...props, 'data-slot': 'info-icon' });
    }
  `);

  const helperUrl = pathToFileURL(
    path.resolve(process.cwd(), 'src/lib/structure-explainability-view-model.ts')
  ).href;

  const rewritten = transpiled.outputText
    .replaceAll('"react/jsx-runtime"', `'${jsxRuntimeStubUrl}'`)
    .replaceAll("'../ui/badge'", `'${uiStubUrl}'`)
    .replaceAll("'../ui/card'", `'${uiStubUrl}'`)
    .replaceAll("'../ui/separator'", `'${uiStubUrl}'`)
    .replaceAll("'../ui/tooltip'", `'${uiStubUrl}'`)
    .replaceAll("'./StructureTopologySvg'", `'${topologyStubUrl}'`)
    .replaceAll(
      "'../../lib/structure-explainability-view-model'",
      `'${helperUrl}'`
    )
    .replaceAll("'lucide-react'", `'${lucideStubUrl}'`);

  return import(asDataModule(rewritten));
}

test('StructureExplainabilityPanel renders visible topology summary blocks and supporting sections', async () => {
  const { StructureExplainabilityPanel } = await importStructureExplainabilityPanel();

  const html = renderQuietly(
    React.createElement(StructureExplainabilityPanel, {
      structure: {
        structure_type: 'A五段式',
        trend_direction: '上涨',
        inflection_points: 4,
        description: '主升之后进入回抽确认',
        interpretation: {
          macro_background: {
            label: '偏多',
            direction: 'bullish',
          },
          focus_structure: {
            archetype_label: 'A五段式原型',
            maturity: 'developing',
            start_anchor: {
              point_id: 'a1',
              price: 10.5,
              date: '2026-03-21 00:00',
            },
            reference_origin: {
              point_id: null,
              price: 9.8,
              date: '2026-02-10 00:00',
            },
            display_reason: '主升趋势中的右侧确认阶段',
          },
          current_leg: {
            label: 'a4→live 上行形成中',
            direction: 'up',
            status: 'forming',
          },
          next_confirmation: {
            label: '等待 a5 确认',
            type: 'pivot',
            trigger: '等待新的确认拐点',
          },
          scenario_paths: [
            {
              code: 'up_break',
              label: '上破前高',
              trigger: '重新站上 12.80',
              effect: '延续 A 推进',
            },
            {
              code: 'down_break',
              label: '跌破回抽低点',
              trigger: '失守 11.60',
              effect: '转入更深修正',
            },
          ],
        },
        archetype: {
          primary: 'A五段式',
          reason: '第三段延伸后等待末端确认',
          alternatives: [{ type: 'C单平台式' }],
        },
        structure_details: {
          render_payload: {
            point_count: 4,
          },
          explainability: {
            structure_start_point_id: 'a1',
            current_point_id: 'a4',
            current_segment: {
              label: 'a3→a4',
            },
            next_segment_preview: {
              label: 'a4→a5',
            },
            display_reason: '当前处于主升后的确认段',
          },
          prediction: {
            current_stage: 'a4拐点',
            next_stage: 'a5确认',
            prediction_alert: '等待末段确认后再评估延续',
            key_price_levels: [
              { price: 12.3, type: '支撑', note: '回抽不破' },
            ],
            confidence: 'medium',
            action_hint: '等待确认量价配合',
          },
          peak_analysis: {
            is_peak_structure: true,
            peak_type: 'mountain_peak',
            peak_price: 13.2,
            peak_index: 3,
            left_structure: '上涨三笔',
            right_structure: '回落一笔',
            left_components: [],
            right_components: [],
            description: '左强右弱，观察确认质量',
          },
          left_structure_warning: {
            type: 'mountain_peak_left',
            title: '左侧结构偏强',
            left_structure: '上涨三笔',
            warning: '若回落放量需谨慎',
            risk_description: '左侧拉升过快时，右侧回撤容易扩大。',
            key_defense: '12.00',
            action_hint: '守住关键位再考虑跟进',
          },
          judgment_criteria: '放量突破前高，且回踩不破关键位。',
        },
      },
      executionSummary: {
        phaseLabel: '回抽确认',
        phaseReason: '主升后的回抽阶段',
        actionLabel: '等待',
        setupQuality: 'A',
        executionReason: '等待确认信号后再执行',
        timeframeCapLabel: '最多补仓 1/3',
        archetypeLabel: 'A五段式',
        archetypeReason: '第三段延伸后等待末端确认',
      },
      setupQualityLabel: 'A',
      structureColors: {
        A五段式: 'archetype-a',
      },
      getTrendStyle: (trend: string) => `trend-${trend}`,
    })
  );

  assert.match(html, /当前阶段/);
  assert.match(html, /执行建议/);
  assert.match(html, /结构原型/);
  assert.match(html, /背景 偏多/);
  assert.match(html, /当前段 a4→live 上行形成中/);
  assert.match(html, /背景/);
  assert.match(html, /结构起点/);
  assert.match(html, /当前段/);
  assert.match(html, /下一确认/);
  assert.match(html, /偏多/);
  assert.match(html, /A五段式原型/);
  assert.match(html, /开展中/);
  assert.match(html, /a4→live 上行形成中/);
  assert.match(html, /等待 a5 确认/);
  assert.match(html, /a1 @ 10.50/);
  assert.match(html, /参考原点 2026-02-10 @ 9.80/);
  assert.match(html, /改判路径/);
  assert.match(html, /上破前高/);
  assert.match(html, /跌破回抽低点/);
  assert.match(html, /prediction/);
  assert.match(html, /peak_analysis/);
  assert.match(html, /left_structure_warning/);
  assert.match(html, /judgment_criteria/);
  assert.match(html, /data-has-payload="true"/);
  assert.match(html, /data-has-explainability="true"/);
  assert.doesNotMatch(html, /trend-上涨/);
});

test('StructureExplainabilityPanel falls back gracefully when explainability is absent', async () => {
  const { StructureExplainabilityPanel } = await importStructureExplainabilityPanel();

  const html = renderQuietly(
    React.createElement(StructureExplainabilityPanel, {
      structure: {
        structure_type: '复杂结构',
        trend_direction: '震荡',
        inflection_points: 3,
        description: '等待更多拐点确认',
        structure_details: {
          prediction: {
            current_stage: '第3个拐点',
            next_stage: '结构完成，等待方向选择',
            prediction_alert: '当前结构仍未完成',
            key_price_levels: [],
            confidence: 'low',
            action_hint: '先观察，不追单',
          },
          judgment_criteria: '等待第4个拐点与方向选择位。',
        },
      },
      executionSummary: {
        phaseLabel: null,
        phaseReason: null,
        actionLabel: '等待',
        setupQuality: null,
        executionReason: null,
        timeframeCapLabel: null,
        archetypeLabel: null,
        archetypeReason: null,
      },
      setupQualityLabel: null,
      structureColors: {},
      getTrendStyle: (trend: string) => `trend-${trend}`,
    })
  );

  assert.match(html, /暂无 explainability 标注|prediction 回退/);
  assert.match(html, /第3个拐点/);
  assert.match(html, /结构完成，等待方向选择/);
  assert.doesNotMatch(html, /data-slot="topology-svg"/);
  assert.match(html, /暂无可视化拓扑/);
});

test('StructureExplainabilityPanel does not mislabel null peak_type as valley shape', async () => {
  const { StructureExplainabilityPanel } = await importStructureExplainabilityPanel();

  const html = renderQuietly(
    React.createElement(StructureExplainabilityPanel, {
      structure: {
        structure_type: '复杂结构',
        trend_direction: '震荡',
        inflection_points: 4,
        description: '峰值类型尚未确认',
        structure_details: {
          judgment_criteria: '等待峰值类型确认。',
          peak_analysis: {
            is_peak_structure: true,
            peak_type: null,
            peak_price: 11.8,
            peak_index: 2,
            left_structure: '震荡两笔',
            right_structure: '震荡一笔',
            left_components: [],
            right_components: [],
            description: '峰值存在，但方向属性尚未确认。',
          },
        },
      },
      executionSummary: {
        phaseLabel: null,
        phaseReason: null,
        actionLabel: '等待',
        setupQuality: null,
        executionReason: null,
        timeframeCapLabel: null,
        archetypeLabel: null,
        archetypeReason: null,
      },
      setupQualityLabel: null,
      structureColors: {},
      getTrendStyle: (trend: string) => `trend-${trend}`,
    })
  );

  assert.match(html, /峰值形态待确认/);
  assert.doesNotMatch(html, /山谷形态/);
});
