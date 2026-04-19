import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';

type LevelDecisionBusModule = typeof import('../src/components/stock/LevelDecisionBus.tsx');
type TrinityRuleChainModule = typeof import('../src/components/stock/TrinityRuleChain.tsx');
type AnalysisSummaryPanelModule = typeof import('../src/components/stock/AnalysisSummaryPanel.tsx');

const periodDetailsSource = await fs.readFile('src/components/stock/AnalysisPeriodDetails.tsx', 'utf8');

test('LevelDecisionBus renders three fixed dimension titles', async () => {
  const { LevelDecisionBus } = await importTsxModule<LevelDecisionBusModule>(
    'src/components/stock/LevelDecisionBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(LevelDecisionBus, {
      dimensions: [
        {
          title: '维度一｜周线 → 日线',
          primary: '周线偏多，日线等待回踩确认',
          detail: '先看周线方向，再看日线是否给出执行窗口。',
        },
        {
          title: '维度二｜日线 → 30分钟',
          primary: '日线确认后，30分钟等待触发',
          detail: '30分钟只负责执行，不重做上级判断。',
        },
        {
          title: '维度三｜60分钟 → 15分钟',
          primary: '60分钟定节奏，15分钟看进出场',
          detail: '短周期只补充入场节奏与风控。',
        },
      ],
    })
  );

  assert.equal(html.match(/维度一｜周线 → 日线/g)?.length, 1);
  assert.equal(html.match(/维度二｜日线 → 30分钟/g)?.length, 1);
  assert.equal(html.match(/维度三｜60分钟 → 15分钟/g)?.length, 1);
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
