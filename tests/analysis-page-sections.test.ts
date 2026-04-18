import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';

// @ts-expect-error Node test runtime needs the explicit .ts extension here.
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';

type LevelDecisionBusModule = typeof import('../src/components/stock/LevelDecisionBus.tsx');
type TrinityRuleChainModule = typeof import('../src/components/stock/TrinityRuleChain.tsx');

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
      items: [
        { title: '规则一', status: 'passed', detail: '周线方向允许向下钻取。', reason: '父级方向一致' },
        { title: '规则二', status: 'passed', detail: '日线级别处于可执行结构。', reason: '结构资格达标' },
        { title: '规则三', status: 'warning', detail: '30分钟触发尚需量能确认。', reason: '量能未同步放大' },
        { title: '规则四', status: 'info', detail: '60分钟节奏进入观察区。', reason: '等待下一段确认' },
        { title: '规则五', status: 'failed', detail: '15分钟入场点尚未成立。', reason: '入场触发条件缺失' },
        { title: '规则六', status: 'passed', detail: '风险回撤边界已定义。', reason: '止损与失效位明确' },
      ],
    })
  );

  assert.equal(html.match(/规则[一二三四五六]/g)?.length, 6);
  assert.match(html, /失败/);
  assert.match(html, /15分钟入场点尚未成立/);
  assert.match(html, /入场触发条件缺失/);
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
