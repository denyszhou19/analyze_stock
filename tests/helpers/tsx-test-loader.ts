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

function rewriteImports(code: string): string {
  return code
    .replaceAll('"react/jsx-runtime"', `'${jsxRuntimeStubUrl}'`)
    .replaceAll("'react/jsx-runtime'", `'${jsxRuntimeStubUrl}'`)
    .replaceAll('"@/components/ui/accordion"', `'${uiStubUrl}'`)
    .replaceAll("'@/components/ui/accordion'", `'${uiStubUrl}'`)
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
    .replaceAll('"../ui/accordion"', `'${uiStubUrl}'`)
    .replaceAll("'../ui/accordion'", `'${uiStubUrl}'`)
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
  const source = await fs.readFile(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filePath,
  });

  return import(asDataModule(rewriteImports(transpiled.outputText))) as Promise<TModule>;
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
