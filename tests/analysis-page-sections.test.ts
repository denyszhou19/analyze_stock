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

test('AnalysisPeriodDetails prefers daily as default and renders deterministic period fields', async () => {
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
          period: {
            macd: {
              status: '中偏强',
              divergence_note: '顶背离未确认',
            },
            moving_averages: {
              ma_status: 'MA55 之上运行',
            },
            ma_physics: {
              support_pressure: {
                status: 'MA55支撑有效',
              },
            },
            breakthrough: {
              pattern_type: '回踩确认',
            },
            structure: {
              structure_type: 'A五段式',
              description: '日线处于主结构确认阶段。',
              interpretation: {
                spacetime_gate: {
                  parent_status: '周线偏多',
                  wait_reason: '等待日线回踩结束',
                  required_confirmation: '重新站上前高',
                },
              },
              execution_phase: {
                label: '回抽确认',
              },
              execution: {
                action: 'wait',
                wait_reason: '等待确认信号后再执行',
                rationale: '当前仅观察不追价',
              },
            },
          },
        },
        {
          key: 'intraday',
          label: '30分钟',
          defaultOpen: true,
          summary: '30分钟等待执行触发。',
          rangeLabel: '近 160 根',
          topologyTitle: '30分钟拓扑结构图',
          period: {
            structure: {
              structure_type: 'C单平台式',
              description: '30分钟等待执行触发。',
            },
          },
        },
      ],
    })
  );

  assert.match(html, /日线[\s\S]*默认展开|默认展开[\s\S]*日线/);
  assert.match(html, /日线/);
  assert.match(html, /结构证据/);
  assert.match(html, /日线拓扑结构图/);
  assert.match(html, /A五段式/);
  assert.match(html, /周线偏多/);
  assert.match(html, /MA55支撑有效/);
  assert.match(html, /等待确认信号后再执行/);
  assert.equal(html.match(/默认展开/g)?.length, 1);
  assert.doesNotMatch(html, /data-default-open/);
});
