import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import type { AnalysisPageSummaryViewModel } from '../src/lib/trinity-analysis-page-view-model';

// @ts-expect-error Node test runtime needs the explicit .ts extension here.
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';

type AnalysisSummaryPanelModule = typeof import('../src/components/stock/AnalysisSummaryPanel.tsx');
type AnalysisStatusBarModule = typeof import('../src/components/stock/AnalysisStatusBar.tsx');

const summaryViewModel: AnalysisPageSummaryViewModel = {
  mode: 'idle',
  headline: '等待',
  primaryActionLabel: '等待',
  primaryReason: '等待 C 结构边界确认',
  triggerLabels: ['重新站上平台上沿'],
  riskLabels: ['不追高'],
  guardrail: '等待 C 结构边界确认',
  hardGates: [
    { label: '后端最终动作', value: '等待' },
    { label: '交易模式', value: '等待确认' },
    { label: '仓位权限', value: '空仓等待' },
  ],
};

test('AnalysisSummaryPanel idle renders generation CTA and backend gates', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: summaryViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 综合判断尚未生成/);
  assert.match(html, /生成 AI 综合判断/);
  assert.match(html, /后端最终动作/);
});

test('AnalysisSummaryPanel ready renders AI headline without backend enum leakage', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        mode: 'ready',
        headline: 'AI 判断：等待缩量回踩后的二次确认',
        hardGates: [
          { label: '后端最终动作', value: '等待' },
          { label: '交易模式', value: '等待确认' },
        ],
      },
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 判断：等待缩量回踩后的二次确认/);
  assert.doesNotMatch(html, /wait_confirmation/);
});

test('AnalysisStatusBar renders data ranges with no legacy window copy', async () => {
  const { AnalysisStatusBar } = await importTsxModule<AnalysisStatusBarModule>(
    'src/components/stock/AnalysisStatusBar.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisStatusBar, {
      syncStatus: { label: '数据完整', detail: null },
      aiStatus: { label: '未生成', tone: 'muted' },
      dataRanges: [
        {
          level: 'daily',
          label: '日线',
          countLabel: '近 240 根',
          coverageLabel: '2025-05-12 至 2026-04-18',
        },
      ],
    })
  );

  assert.match(html, /本次判定使用的数据范围/);
  assert.match(html, /日线/);
  assert.match(html, /近 240 根/);
  assert.doesNotMatch(html, /当前分析窗口/);
});
