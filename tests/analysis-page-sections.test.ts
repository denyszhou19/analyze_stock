import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';

type TradingCycleBusModule = typeof import('../src/components/stock/TradingCycleBus.tsx');
type TrinityRuleChainModule = typeof import('../src/components/stock/TrinityRuleChain.tsx');
type AnalysisSummaryPanelModule = typeof import('../src/components/stock/AnalysisSummaryPanel.tsx');

const periodDetailsSource = await fs.readFile('src/components/stock/AnalysisPeriodDetails.tsx', 'utf8');

test('TradingCycleBus renders three trading combinations with direction and trigger level', async () => {
  const { TradingCycleBus } = await importTsxModule<TradingCycleBusModule>(
    'src/components/stock/TradingCycleBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(TradingCycleBus, {
      combinations: [
        {
          key: 'midline',
          label: '中线主策略组合｜周线 → 日线',
          levels: ['weekly', 'daily'],
          direction: 'bullish',
          directionLabel: '偏多',
          actionLabel: '观察中',
          parentConstraint: '周线：大方向偏多',
          triggerLevelLabel: '日线',
          suitableAction: '等待日线确认',
          majorRisk: '日线仍未突破平台上沿',
          explanation: '周线定约束，日线给触发；已有方向或预案，但还差确认，不急着动作',
        },
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          parentConstraint: '日线：等待确认',
          triggerLevelLabel: '30分钟',
          suitableAction: '轻仓试探',
          majorRisk: '日线硬门控未放开',
          explanation: '日线定约束，30分钟给触发；存在约束，不能直接放大动作',
        },
        {
          key: 'intraday_t',
          label: '超短线 / T 组合｜60分钟 → 15分钟',
          levels: ['hour60', 'hour15'],
          direction: 'bearish',
          directionLabel: '偏空',
          actionLabel: '暂不做',
          parentConstraint: '60分钟：偏弱',
          triggerLevelLabel: '15分钟',
          suitableAction: '只观察',
          majorRisk: '15分钟反弹不能推翻上级',
          explanation: '60分钟定约束，15分钟给触发；当前不支持按这条规则交易',
        },
      ],
    })
  );

  assert.match(html, /交易周期总线/);
  assert.match(html, /中线主策略组合｜周线 → 日线/);
  assert.match(html, /短线执行组合｜日线 → 30分钟/);
  assert.match(html, /超短线 \/ T 组合｜60分钟 → 15分钟/);
  assert.match(html, /触发级别/);
  assert.match(html, /适合动作/);
  assert.match(html, /主要风险/);
  assert.doesNotMatch(html, /维度一/);
});

test('TrinityRuleChain renders six rule items and keeps failed status plus reason visible', async () => {
  const { TrinityRuleChain } = await importTsxModule<TrinityRuleChainModule>(
    'src/components/stock/TrinityRuleChain.tsx'
  );

  const html = renderQuietly(
    React.createElement(TrinityRuleChain, {
      sourceLabel:
        '本规则链默认按日线主判定展示；若日线缺失，则依次降级为周线、60分钟、30分钟、15分钟。',
      items: [
        { title: '结构资格', status: 'passed', detail: '周线方向允许向下钻取。', reason: '父级方向一致' },
        { title: 'MACD 时空', status: 'passed', detail: '日线级别处于可执行结构。', reason: '结构资格达标' },
        { title: '55 / 233 线关系', status: 'warning', detail: '30分钟触发尚需量能确认。', reason: '量能未同步放大' },
        { title: '量能确认', status: 'info', detail: '60分钟节奏进入观察区。', reason: '等待下一段确认' },
        { title: '级别权限', status: 'failed', detail: '15分钟入场点尚未成立。', reason: '入场触发条件缺失' },
        { title: '执行计划', status: 'passed', detail: '风险回撤边界已定义。', reason: '止损与失效位明确' },
      ],
    })
  );

  assert.match(html, /结构资格/);
  assert.match(html, /MACD 时空/);
  assert.match(html, /55 \/ 233 线关系/);
  assert.match(html, /量能确认/);
  assert.match(html, /级别权限/);
  assert.match(html, /执行计划/);
  assert.match(html, /本规则链默认按日线主判定展示/);
  assert.match(html, /失败/);
  assert.match(html, /15分钟入场点尚未成立/);
  assert.match(html, /入场触发条件缺失/);
  assert.match(html, /等待触发：已有预案，但触发条件尚未满足/);
});

test('AnalysisPeriodDetails keeps a pure data contract and renders structure explanation internally', () => {
  assert.match(periodDetailsSource, /export interface AnalysisPeriodSection/);
  assert.doesNotMatch(periodDetailsSource, /structureExplainabilitySlot/);
  assert.match(periodDetailsSource, /StructureExplainabilityPanel/);
  assert.match(periodDetailsSource, /buildExecutionSummary/);
  assert.match(periodDetailsSource, /结构说明/);
  assert.match(periodDetailsSource, /defaultValue/);
  assert.match(periodDetailsSource, /section\.period/);
});

test('AnalysisPeriodDetails normalizes internal field labels before rendering structure evidence', () => {
  assert.match(periodDetailsSource, /normalizeStructureDisplayText/);
  assert.match(
    periodDetailsSource,
    /const evidence = \[[\s\S]*?prediction\?\.prediction_alert[\s\S]*?\]\s*\.filter\(Boolean\)\s*\.join\('｜'\);[\s\S]*?return normalizeStructureDisplayText\(evidence\)/
  );
});

test('AnalysisSummaryPanel renders global strategy scope and hard gate explanations', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        mode: 'idle',
        headline: '等待放量突破后轻仓试探',
        primaryActionLabel: '等待',
        primaryReason: '日线仍需确认，只能等待30分钟触发',
        triggerLabels: ['30分钟放量突破平台上沿'],
        riskLabels: ['跌回日线平台下沿'],
        guardrail: '仓位不超过 20%',
        hardGateTitle: '主策略硬门控',
        hardGateSourceLabel: '当前硬门控来自主判定级别：日线',
        hardGates: [
          {
            label: '仓位权限',
            value: '轻仓试探',
            description: {
              title: '仓位权限',
              meaning: '后端允许的最大仓位动作范围。',
              tradeImpact: '当前值为「轻仓试探」，AI 和页面结论不能突破这个限制。',
              source: 'trinity_decision.trade_qualification.position_permission',
            },
          },
        ],
      },
      globalStrategy: {
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
        headline: '等待放量突破后轻仓试探',
        primaryReason: '日线仍需确认，只能等待30分钟触发',
        triggerLabels: ['30分钟放量突破平台上沿'],
        riskLabels: ['跌回日线平台下沿'],
        guardrail: '仓位不超过 20%',
      },
      onGenerate: () => undefined,
      canGenerate: true,
    })
  );

  assert.match(html, /页面级综合结论/);
  assert.match(html, /综合范围：中线主策略组合、短线执行组合、超短线 \/ T 组合/);
  assert.match(html, /当前优先组合/);
  assert.match(html, /短线执行组合｜日线 → 30分钟/);
  assert.match(html, /主约束级别/);
  assert.match(html, /触发级别/);
  assert.match(html, /主策略硬门控/);
  assert.match(html, /仓位权限/);
  assert.match(html, /后端允许的最大仓位动作范围/);
  assert.doesNotMatch(html, /后端硬门控/);
});
