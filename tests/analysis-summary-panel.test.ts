import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import type {
  AnalysisPageGlobalStrategyViewModel,
  AnalysisPageStatusBarViewModel,
  AnalysisPageSummaryViewModel,
} from '../src/lib/trinity-analysis-page-view-model';
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';

type AnalysisSummaryPanelModule = typeof import('../src/components/stock/AnalysisSummaryPanel.tsx');
type AnalysisStatusBarModule = typeof import('../src/components/stock/AnalysisStatusBar.tsx');

function gate(label: string, value: string, source: string) {
  return {
    label,
    value,
    description: {
      title: label,
      meaning: `${label}说明`,
      tradeImpact: `当前值为「${value}」，AI 和页面结论不能突破这个限制。`,
      source,
    },
  };
}

function createSignalTag(
  label: string,
  tone: 'bullish' | 'bearish' | 'warning' | 'neutral'
) {
  const [category = '结构', result = label] = label.split('｜');
  return {
    key: 'structure' as const,
    category: category as AnalysisPageSummaryViewModel['signalTags'][number]['category'],
    result,
    label,
    tone,
    hover: {
      title: `${label}说明`,
      items: [
        { label: '这句话是什么意思', value: `${label}的补充说明` },
        { label: '为什么这么判断', value: `${label}对应的判定依据` },
      ],
    },
  };
}

const summaryViewModel: AnalysisPageSummaryViewModel = {
  mode: 'idle',
  headline: '等待',
  primaryActionLabel: '等待',
  judgmentLabel: '严格等待',
  relationLabel: '父级强冲突，子级逆父级',
  primaryReason: '等待 C 结构边界确认',
  triggerLabels: ['重新站上平台上沿'],
  riskLabels: ['不追高'],
  guardrail: '等待 C 结构边界确认',
  spacetimeSummary: '时空：中偏强，等待 C 结构边界确认',
  structureSummary: '结构：A五段式，A原型成立',
  executionSummary: '现在怎么做：先看重新站上平台上沿，确认看回踩 MA55 不破，失效看跌回平台下沿',
  signalTags: [
    createSignalTag('级别｜子级逆势', 'warning'),
    createSignalTag('执行｜回踩执行', 'neutral'),
  ],
  hardGateTitle: '主策略硬门控',
  hardGateSourceLabel: '当前硬门控来自主判定级别：日线；当前优先组合：短线执行组合｜日线 → 30分钟',
  hardGates: [
    gate('后端最终动作', '等待', 'trinity_decision.conclusion.action'),
    gate('交易模式', '等待确认', 'trinity_decision.trade_qualification.trade_mode'),
    gate('仓位权限', '空仓等待', 'trinity_decision.trade_qualification.position_permission'),
  ],
};

const globalStrategyViewModel: AnalysisPageGlobalStrategyViewModel = {
  scopeLabel: '综合范围：中线主策略组合、短线执行组合、超短线 / T 组合',
  primaryCombination: 'shortline',
  primaryCombinationLabel: '短线执行组合｜日线 → 30分钟',
  primaryConstraintLevel: 'daily',
  primaryConstraintLevelLabel: '日线',
  triggerLevel: 'hour30',
  triggerLevelLabel: '30分钟',
  direction: 'bullish',
  directionLabel: '偏多',
  actionLabel: '观察中',
  headline: '等待',
  primaryReason: '等待 C 结构边界确认',
  triggerLabels: ['重新站上平台上沿'],
  riskLabels: ['不追高'],
  guardrail: '等待 C 结构边界确认',
};

const statusBarViewModel: AnalysisPageStatusBarViewModel = {
  stockLabel: '浦发银行｜SH600000',
  analysisTimeLabel: '2026-04-18 15:00:00',
  integrityStatus: {
    label: '数据完整',
    detail: null,
  },
  aiStatus: {
    label: '未生成',
    tone: 'muted',
  },
  dataRanges: [
    {
      level: 'daily',
      label: '日线',
      countLabel: '近 240 根',
      coverageLabel: '2025-05-12 至 2026-04-18',
    },
  ],
};

test('AnalysisSummaryPanel idle renders generation CTA and backend gates', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: summaryViewModel,
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 综合判断尚未生成/);
  assert.match(html, /生成 AI 综合判断/);
  assert.match(html, /严格等待/);
  assert.match(html, /父级强冲突，子级逆父级/);
  assert.match(html, /时空：中偏强，等待 C 结构边界确认/);
  assert.match(html, /结构：A五段式，A原型成立/);
  assert.match(html, /现在怎么做：先看重新站上平台上沿，确认看回踩 MA55 不破，失效看跌回平台下沿/);
  assert.match(html, /级别｜子级逆势/);
  assert.match(html, /执行｜回踩执行/);
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
          gate('后端最终动作', '等待', 'trinity_decision.conclusion.action'),
          gate('交易模式', '等待确认', 'trinity_decision.trade_qualification.trade_mode'),
        ],
      },
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 判断：等待缩量回踩后的二次确认/);
  assert.match(html, /严格等待/);
  assert.match(html, /父级强冲突，子级逆父级/);
  assert.doesNotMatch(html, /wait_confirmation/);
});

test('AnalysisSummaryPanel ready renders phase3 enhanced AI summary fields', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        mode: 'ready',
        headline: 'AI 判断：当前先等30分钟回抽确认',
        judgmentLabel: '候选可试',
        primaryReason: '父级支持，但30分钟回抽段未完成止跌确认',
        spacetimeSummary: '时空：日线中偏强，30分钟顺父级，零轴强信号偏支持',
        structureSummary: '结构：正式结构未完全确认，当前更偏 D 候选',
        executionSummary: '现在怎么做：先看30分钟止跌，确认后再加',
        candidateStructureSummary: {
          label: 'D候选',
          currentLeg: '30分钟回抽段',
          upgradeCondition: '30分钟回抽止跌并放量重新转强',
          invalidation: '跌回日线确认低点下方',
        },
        waitStateSummary: {
          label: '等待回抽确认',
          currentBlock: '30分钟回抽段尚未完成止跌确认',
          nextAction: '观察30分钟止跌并重新转强',
        },
      },
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 判断：当前先等30分钟回抽确认/);
  assert.match(html, /候选可试/);
  assert.match(html, /父级支持，但30分钟回抽段未完成止跌确认/);
  assert.match(html, /时空：日线中偏强，30分钟顺父级，零轴强信号偏支持/);
  assert.match(html, /结构：正式结构未完全确认，当前更偏 D 候选/);
  assert.match(html, /现在怎么做：先看30分钟止跌，确认后再加/);
  assert.match(html, /候选结构/);
  assert.match(html, /D候选｜30分钟回抽段/);
  assert.match(html, /30分钟回抽止跌并放量重新转强/);
  assert.match(html, /跌回日线确认低点下方/);
  assert.match(html, /等待状态/);
  assert.match(html, /等待回抽确认｜30分钟回抽段尚未完成止跌确认/);
  assert.match(html, /观察30分钟止跌并重新转强/);
});

test('AnalysisSummaryPanel renders judgment warning separately when AI points out backend tension', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        mode: 'ready',
        headline: 'AI 判断：后端当前仍等待',
        primaryReason: '当前仍未完成触发确认',
        judgmentWarning: '判断疑点：30分钟信号已明显转强，但后端当前结论仍偏保守',
      },
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /判断疑点/);
  assert.match(html, /判断疑点：30分钟信号已明显转强，但后端当前结论仍偏保守/);
  assert.match(html, /后端最终动作：等待/);
});

test('AnalysisSummaryPanel loading renders Chinese progress copy and disabled action', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        mode: 'loading',
      },
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 正在生成综合判断，请稍候。/);
  assert.match(html, /AI 综合判断生成中/);
  assert.match(html, /disabled/);
});

test('AnalysisSummaryPanel error renders fallback copy and retry action', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        mode: 'error',
        errorMessage: 'Codex CLI 执行失败 (exit 2): stderr detail',
      },
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 综合判断生成失败，当前展示后端确定性结论。/);
  assert.match(html, /Codex CLI 执行失败 \(exit 2\): stderr detail/);
  assert.match(html, /重试生成 AI 综合判断/);
  assert.match(html, /后端最终动作/);
});

test('AnalysisStatusBar renders data ranges with no legacy window copy', async () => {
  const { AnalysisStatusBar } = await importTsxModule<AnalysisStatusBarModule>(
    'src/components/stock/AnalysisStatusBar.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisStatusBar, statusBarViewModel)
  );

  assert.match(html, /标的：浦发银行｜SH600000/);
  assert.match(html, /分析时间：2026-04-18 15:00:00/);
  assert.match(html, /本次判定使用的数据范围/);
  assert.match(html, /日线/);
  assert.match(html, /近 240 根/);
  assert.doesNotMatch(html, /当前分析窗口/);
});
