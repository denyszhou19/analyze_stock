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
    return function Component({ children, className, variant, size, asChild, ...props }) {
      return React.createElement(
        tag,
        { ...props, className, 'data-slot': slotName, 'data-variant': variant, 'data-size': size },
        children
      );
    };
  }

  export const Accordion = ({ children, className, ...props }) =>
    React.createElement('div', { ...props, className, 'data-slot': 'accordion' }, children);
  export const AccordionContent = slot('div', 'accordion-content');
  export const AccordionItem = slot('div', 'accordion-item');
  export const AccordionTrigger = slot('button', 'accordion-trigger');
  export const Tabs = ({ children, className, ...props }) =>
    React.createElement('div', { ...props, className, 'data-slot': 'tabs' }, children);
  export const TabsList = slot('div', 'tabs-list');
  export const TabsTrigger = slot('button', 'tabs-trigger');
  export const TabsContent = slot('div', 'tabs-content');
  export const Badge = slot('span', 'badge');
  export const Button = slot('button', 'button');
  export const Card = slot('section', 'card');
  export const CardAction = slot('div', 'card-action');
  export const CardContent = slot('div', 'card-content');
  export const CardDescription = slot('div', 'card-description');
  export const CardFooter = slot('div', 'card-footer');
  export const CardHeader = slot('div', 'card-header');
  export const CardTitle = slot('div', 'card-title');
  export const Separator = slot('hr', 'separator');
  export const TooltipProvider = ({ children, ...props }) =>
    React.createElement('div', { ...props, 'data-slot': 'tooltip-provider' }, children);
  export const Tooltip = ({ children, ...props }) =>
    React.createElement('div', { ...props, 'data-slot': 'tooltip' }, children);
  export const TooltipTrigger = slot('button', 'tooltip-trigger');
  export const TooltipContent = slot('div', 'tooltip-content');
`);

const lucideStubUrl = asDataModule(`
  import React from '${reactUrl}';
  export const Info = ({ className, ...props }) =>
    React.createElement('svg', { ...props, className, 'data-slot': 'icon-info' });
`);

const utilsStubUrl = asDataModule(`
  export function cn(...inputs) {
    return inputs.flat().filter(Boolean).join(' ');
  }
`);

const structureExplainabilityPanelStubUrl = asDataModule(`
  import React from '${reactUrl}';
  export function StructureExplainabilityPanel({ structure }) {
    const type = structure?.structure_type ?? '未识别结构';
    return React.createElement(
      'div',
      { 'data-slot': 'structure-explainability-panel' },
      React.createElement('div', null, '结构类型：' + type),
      React.createElement('div', null, '标准C类结构')
    );
  }
`);

const stockExecutionViewModelStubUrl = asDataModule(`
  export function buildExecutionSummary() {
    return {
      actionLabel: '等待',
      rationale: '等待触发',
    };
  }
`);

const structureExplainabilityViewModelStubUrl = asDataModule(`
  export function normalizeStructureDisplayText(value) {
    return value ?? '';
  }
`);

const trinityDecisionLabelsStubUrl = asDataModule(`
  export function formatDecisionActionLabel(action, actionLabel) {
    return actionLabel ?? action ?? '等待';
  }
`);

const displayVocabularyStubUrl = asDataModule(`
  export function normalizeTradingDisplayText(value) {
    return typeof value === 'string'
      ? value
          .trim()
          .replace(/\\bcomplex(?=候选)/gi, '复杂结构')
          .replace(/\\bcomplex\\b/gi, '复杂结构')
          .replace(/→\\s*live\\b/gi, '→进行中')
          .replace(/\\blive\\b/gi, '进行中')
          .replace(/current_stage\\s*/gi, '当前阶段')
          .replace(/next_stage\\s*/gi, '下一阶段')
      : '';
  }

  export function getActionStatusMeta(status) {
    if (status === 'passed') {
      return { label: '可执行', icon: '✓' };
    }
    if (status === 'warning') {
      return { label: '谨慎看', icon: '!' };
    }
    if (status === 'failed') {
      return { label: '暂不做', icon: '×' };
    }
    return { label: '观察中', icon: '○' };
  }

  export function getDirectionMeta(direction) {
    if (direction === 'bullish') {
      return {
        label: '偏多',
        badgeClassName: 'border-red-200 bg-red-50 text-red-700',
        cardClassName: 'border-red-200 bg-red-50 text-red-950',
        textClassName: 'text-red-700',
      };
    }
    if (direction === 'bearish') {
      return {
        label: '偏空',
        badgeClassName: 'border-green-200 bg-green-50 text-green-700',
        cardClassName: 'border-green-200 bg-green-50 text-green-950',
        textClassName: 'text-green-700',
      };
    }
    return {
      label: '中性',
      badgeClassName: 'border-slate-200 bg-slate-50 text-slate-700',
      cardClassName: 'border-slate-200 bg-slate-50 text-slate-900',
      textClassName: 'text-slate-700',
    };
  }

  export function directionFromBias(bias) {
    if (bias === 'bullish') {
      return 'bullish';
    }
    if (bias === 'bearish') {
      return 'bearish';
    }
    return 'neutral';
  }

  export function getStructureTagMeta(tag) {
    if (tag === 'C单平台式') {
      return {
        label: 'C单平台式',
        className: 'border-blue-200 bg-blue-50 text-blue-700',
        explanation: '标准C类结构中的单平台形态。',
        tradeMeaning: '适合围绕平台边界、突破与跌破回抽来组织交易语言。',
      };
    }
    return {
      label: tag || '未知结构',
      className: 'border-slate-200 bg-slate-50 text-slate-700',
      explanation: '当前结构标签暂无补充释义。',
      tradeMeaning: '等待更多结构证据后再决定。',
    };
  }

  export function getSignalTagToneMeta(tone) {
    if (tone === 'bullish') {
      return { badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700' };
    }
    if (tone === 'bearish') {
      return { badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    }
    if (tone === 'warning') {
      return { badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800' };
    }
    return { badgeClassName: 'border-slate-200 bg-slate-50 text-slate-700' };
  }
`);

const moduleUrlCache = new Map<string, Promise<string>>();

async function buildTsxDataModule(filePath: string): Promise<string> {
  const normalizedPath = path.resolve(filePath);
  const cachedPromise = moduleUrlCache.get(normalizedPath);
  if (cachedPromise) {
    return cachedPromise;
  }

  const moduleUrlPromise = (async () => {
    const source = await fs.readFile(normalizedPath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: normalizedPath,
    });

    return asDataModule(await rewriteImports(transpiled.outputText, normalizedPath));
  })();

  moduleUrlCache.set(normalizedPath, moduleUrlPromise);
  return moduleUrlPromise;
}

async function rewriteImports(code: string, filePath?: string): Promise<string> {
  const fileDir = filePath ? path.dirname(filePath) : process.cwd();
  let rewrittenCode = code;
  const stockComponentAliases = [
    {
      specifier: '@/components/stock/SignalTagList',
      target: path.resolve(process.cwd(), 'src/components/stock/SignalTagList.tsx'),
    },
    {
      specifier: '@/components/stock/ExplainableFact',
      target: path.resolve(process.cwd(), 'src/components/stock/ExplainableFact.tsx'),
    },
  ];

  for (const item of stockComponentAliases) {
    if (
      filePath !== item.target &&
      (rewrittenCode.includes(`"${item.specifier}"`) || rewrittenCode.includes(`'${item.specifier}'`))
    ) {
      const targetUrl = await buildTsxDataModule(item.target);
      rewrittenCode = rewrittenCode
        .replaceAll(`"${item.specifier}"`, `'${targetUrl}'`)
        .replaceAll(`'${item.specifier}'`, `'${targetUrl}'`);
    }
  }

  if (filePath) {
    const relativeStockImports = [
      {
        specifier: './SignalTagList',
        target: path.resolve(fileDir, 'SignalTagList.tsx'),
      },
      {
        specifier: './ExplainableFact',
        target: path.resolve(fileDir, 'ExplainableFact.tsx'),
      },
    ];

    for (const item of relativeStockImports) {
      if (
        filePath !== item.target &&
        (rewrittenCode.includes(`"${item.specifier}"`) || rewrittenCode.includes(`'${item.specifier}'`))
      ) {
        const targetUrl = await buildTsxDataModule(item.target);
        rewrittenCode = rewrittenCode
          .replaceAll(`"${item.specifier}"`, `'${targetUrl}'`)
          .replaceAll(`'${item.specifier}'`, `'${targetUrl}'`);
      }
    }
  }

  const sharedLibAliases = [
    {
      specifier: '@/lib/trinity-signal-tags',
      target: path.resolve(process.cwd(), 'src/lib/trinity-signal-tags.ts'),
    },
    {
      specifier: '@/lib/trinity-judgment-display',
      target: path.resolve(process.cwd(), 'src/lib/trinity-judgment-display.ts'),
    },
  ];

  for (const item of sharedLibAliases) {
    if (
      filePath !== item.target &&
      (rewrittenCode.includes(`"${item.specifier}"`) || rewrittenCode.includes(`'${item.specifier}'`))
    ) {
      const targetUrl = await buildTsxDataModule(item.target);
      rewrittenCode = rewrittenCode
        .replaceAll(`"${item.specifier}"`, `'${targetUrl}'`)
        .replaceAll(`'${item.specifier}'`, `'${targetUrl}'`);
    }
  }

  return rewrittenCode
    .replaceAll('"react/jsx-runtime"', `'${jsxRuntimeStubUrl}'`)
    .replaceAll("'react/jsx-runtime'", `'${jsxRuntimeStubUrl}'`)
    .replaceAll('"@/components/ui/accordion"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/accordion'", `'${uiStubUrl}'`)
    .replaceAll('"@/components/ui/tabs"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/tabs'", `'${uiStubUrl}'`)
    .replaceAll('"@/components/ui/badge"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/badge'", `'${uiStubUrl}'`)
    .replaceAll('"@/components/ui/button"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/button'", `'${uiStubUrl}'`)
    .replaceAll('"@/components/ui/card"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/card'", `'${uiStubUrl}'`)
    .replaceAll('"@/components/ui/separator"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/separator'", `'${uiStubUrl}'`)
    .replaceAll('"@/components/ui/tooltip"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/tooltip'", `'${uiStubUrl}'`)
    .replaceAll('"lucide-react"', `'${lucideStubUrl}'`)
    .replaceAll("'lucide-react'", `'${lucideStubUrl}'`)
    .replaceAll('"@/lib/utils"', `'${utilsStubUrl}'`)
    .replaceAll("'@/lib/utils'", `'${utilsStubUrl}'`)
    .replaceAll('"@/lib/trinity-display-vocabulary"', `'${displayVocabularyStubUrl}'`)
    .replaceAll("'@/lib/trinity-display-vocabulary'", `'${displayVocabularyStubUrl}'`)
    .replaceAll('"./trinity-display-vocabulary.ts"', `'${displayVocabularyStubUrl}'`)
    .replaceAll("'./trinity-display-vocabulary.ts'", `'${displayVocabularyStubUrl}'`)
    .replaceAll('"@/components/stock/StructureExplainabilityPanel"', `'${structureExplainabilityPanelStubUrl}'`)
    .replaceAll("'@/components/stock/StructureExplainabilityPanel'", `'${structureExplainabilityPanelStubUrl}'`)
    .replaceAll('"@/lib/stock-execution-view-model"', `'${stockExecutionViewModelStubUrl}'`)
    .replaceAll("'@/lib/stock-execution-view-model'", `'${stockExecutionViewModelStubUrl}'`)
    .replaceAll('"@/lib/structure-explainability-view-model"', `'${structureExplainabilityViewModelStubUrl}'`)
    .replaceAll("'@/lib/structure-explainability-view-model'", `'${structureExplainabilityViewModelStubUrl}'`)
    .replaceAll('"@/lib/trinity-decision-labels"', `'${trinityDecisionLabelsStubUrl}'`)
    .replaceAll("'@/lib/trinity-decision-labels'", `'${trinityDecisionLabelsStubUrl}'`)
    .replaceAll('"../ui/accordion"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/accordion'", `'${uiStubUrl}'`)
    .replaceAll('"../ui/tabs"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/tabs'", `'${uiStubUrl}'`)
    .replaceAll('"../ui/badge"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/badge'", `'${uiStubUrl}'`)
    .replaceAll('"../ui/button"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/button'", `'${uiStubUrl}'`)
    .replaceAll('"../ui/card"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/card'", `'${uiStubUrl}'`)
    .replaceAll('"../ui/separator"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/separator'", `'${uiStubUrl}'`)
    .replaceAll('"../ui/tooltip"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/tooltip'", `'${uiStubUrl}'`);
}

export async function importTsxModule<TModule>(relativePath: string): Promise<TModule> {
  const filePath = path.resolve(process.cwd(), relativePath);
  return import(await buildTsxDataModule(filePath)) as Promise<TModule>;
}

export function renderQuietly(element: React.ReactElement): string {
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
