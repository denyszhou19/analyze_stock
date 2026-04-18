import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';

// @ts-expect-error Node test runtime needs the explicit .ts extension here.
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';

type LevelDecisionBusModule = typeof import('../src/components/stock/LevelDecisionBus.tsx');
type TrinityRuleChainModule = typeof import('../src/components/stock/TrinityRuleChain.tsx');
type AnalysisPeriodDetailsModule = typeof import('../src/components/stock/AnalysisPeriodDetails.tsx');

test('LevelDecisionBus renders three fixed dimension titles', async () => {
  const { LevelDecisionBus } = await importTsxModule<LevelDecisionBusModule>(
    'src/components/stock/LevelDecisionBus.tsx'
  );

  const html = renderQuietly(
    React.createElement(LevelDecisionBus, {
      dimensions: [
        {
          title: '周线 → 日线',
          primary: '周线偏多，日线等待回踩确认',
          detail: '先看周线方向，再看日线是否给出执行窗口。',
        },
        {
          title: '日线 → 30分钟',
          primary: '日线确认后，30分钟等待触发',
          detail: '30分钟只负责执行，不重做上级判断。',
        },
        {
          title: '60分钟 → 15分钟',
          primary: '60分钟定节奏，15分钟看进出场',
          detail: '短周期只补充入场节奏与风控。',
        },
      ],
    })
  );

  assert.match(html, /维度一｜周线 → 日线/);
  assert.match(html, /维度二｜日线 → 30分钟/);
  assert.match(html, /维度三｜60分钟 → 15分钟/);
});

test('TrinityRuleChain renders six rule items and keeps failed status visible', async () => {
  const { TrinityRuleChain } = await importTsxModule<TrinityRuleChainModule>(
    'src/components/stock/TrinityRuleChain.tsx'
  );

  const html = renderQuietly(
    React.createElement(TrinityRuleChain, {
      items: [
        { title: '规则一', status: 'passed', detail: '周线方向允许向下钻取。' },
        { title: '规则二', status: 'passed', detail: '日线级别处于可执行结构。' },
        { title: '规则三', status: 'warning', detail: '30分钟触发尚需量能确认。' },
        { title: '规则四', status: 'info', detail: '60分钟节奏进入观察区。' },
        { title: '规则五', status: 'failed', detail: '15分钟入场点尚未成立。' },
        { title: '规则六', status: 'passed', detail: '风险回撤边界已定义。' },
      ],
    })
  );

  assert.equal(html.match(/规则[一二三四五六]/g)?.length, 6);
  assert.match(html, /失败/);
  assert.match(html, /15分钟入场点尚未成立/);
});

test('AnalysisPeriodDetails defaults to open daily section and includes structure evidence area', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      sections: [
        {
          key: 'daily',
          label: '日线',
          defaultOpen: false,
          summary: '日线处于主结构确认阶段。',
          rangeLabel: '近 240 根',
          topologyTitle: '日线拓扑结构图',
          content: React.createElement('div', null, '日线复盘内容'),
        },
        {
          key: 'intraday',
          label: '30分钟',
          defaultOpen: true,
          summary: '30分钟等待执行触发。',
          rangeLabel: '近 160 根',
          topologyTitle: '30分钟拓扑结构图',
          content: React.createElement('div', null, '30分钟复盘内容'),
        },
      ],
    })
  );

  assert.match(html, /日线/);
  assert.match(html, /结构证据/);
  assert.match(html, /日线拓扑结构图/);
  assert.match(html, /日线复盘内容/);
  assert.match(html, /data-default-open="true"[^>]*data-section-key="daily"|data-section-key="daily"[^>]*data-default-open="true"/);
  assert.doesNotMatch(
    html,
    /data-default-open="true"[^>]*data-section-key="intraday"|data-section-key="intraday"[^>]*data-default-open="true"/
  );
});
