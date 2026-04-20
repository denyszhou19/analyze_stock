import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';
import type { AnalysisPageRuleChainItem } from '../src/lib/trinity-analysis-page-view-model.ts';

type TradingCycleBusModule = typeof import('../src/components/stock/TradingCycleBus.tsx');
type TrinityRuleChainModule = typeof import('../src/components/stock/TrinityRuleChain.tsx');
type AnalysisSummaryPanelModule = typeof import('../src/components/stock/AnalysisSummaryPanel.tsx');
type AnalysisPeriodDetailsModule = typeof import('../src/components/stock/AnalysisPeriodDetails.tsx');

const periodDetailsSource = await fs.readFile('src/components/stock/AnalysisPeriodDetails.tsx', 'utf8');

function createExplainableField(label: string, value: string) {
  return {
    label,
    value,
    hoverTitle: `${label}说明`,
    hoverItems: [
      { label: '这句话是什么意思', value: `${label}的补充说明` },
      { label: '为什么这么判断', value: value },
    ],
  };
}

function createSignalTag(label: string, tone: 'bullish' | 'bearish' | 'warning' | 'neutral') {
  const [category = '结构', result = label] = label.split('｜');
  return {
    key: 'structure' as const,
    category: category as AnalysisPageRuleChainItem['signalTags'][number]['category'],
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

function createRuleItem(
  overrides: Partial<{
    title: string;
    status: 'passed' | 'failed' | 'warning' | 'info';
    displayStatusLabel: string;
    displayStatusIcon: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    directionLabel: string;
    detail: string;
    reason: string;
    summary: string;
    recommendation: string;
    signalTags: AnalysisPageRuleChainItem['signalTags'];
    detailHover: AnalysisPageRuleChainItem['detailHover'];
    statusExplanation: {
      tradeMeaning: string;
      ruleState: '已满足' | '待确认' | '有约束' | '不成立';
      directionLabel: '偏多' | '偏空' | '中性';
      reason: string;
    };
  }> = {}
) {
  return {
    title: '结构资格',
    status: 'passed' as const,
    displayStatusLabel: '可执行',
    displayStatusIcon: '✓',
    direction: 'bullish' as const,
    directionLabel: '偏多',
    detail: '周线方向允许向下钻取。',
    reason: '父级方向一致',
    summary: '结构结论摘要',
    recommendation: '继续按规则跟踪',
    signalTags: [],
    detailHover: {
      title: `${overrides.title ?? '结构资格'}说明`,
      items: [
        { label: '这句话是什么意思', value: '补充说明' },
        { label: '为什么这么判断', value: overrides.detail ?? '周线方向允许向下钻取。' },
        { label: '当前限制', value: overrides.reason ?? '父级方向一致' },
        { label: '下一步条件', value: '等待下一步信号' },
        { label: '判定依据', value: '当前类别专属依据' },
      ],
    },
    statusExplanation: {
      tradeMeaning: '这条规则已满足，可纳入当前执行判断',
      ruleState: '已满足' as const,
      directionLabel: '偏多' as const,
      reason: '父级方向一致',
    },
    ...overrides,
  };
}

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
          relationHint: '周线看背景，日线看执行',
          summary: '周线偏多，日线等待确认',
          recommendation: '先等日线确认',
          signalTags: [],
          parentConstraint: createExplainableField('父级约束', '周线：大方向偏多'),
          triggerLevel: createExplainableField('触发级别', '日线：等待确认'),
          triggerLevelLabel: '日线',
          suitableAction: createExplainableField('适合动作', '等待日线确认'),
          majorRisk: createExplainableField('主要风险', '日线仍未突破平台上沿'),
          explanation: '周线定约束，日线给触发；已有方向或预案，但还差确认，不急着动作',
        },
        {
          key: 'shortline',
          label: '短线执行组合｜日线 → 30分钟',
          levels: ['daily', 'hour30'],
          direction: 'neutral',
          directionLabel: '中性',
          actionLabel: '谨慎看',
          relationHint: '日线看背景，30分钟看执行',
          summary: '日线还没完全放行，30分钟先看确认',
          recommendation: '先等30分钟放量突破平台上沿',
          signalTags: [createSignalTag('时空｜中偏弱', 'warning')],
          parentConstraint: {
            label: '父级约束',
            value: '日线：仍未完全放行',
            hoverTitle: '父级约束说明',
            hoverItems: [
              { label: '这句话是什么意思', value: '上一级还没有完全放开当前执行权限。' },
              { label: '为什么这么判断', value: '日线结构和触发条件都还需要进一步确认。' },
            ],
          },
          triggerLevel: createExplainableField('触发级别', '30分钟：放量突破平台上沿'),
          triggerLevelLabel: '30分钟',
          suitableAction: createExplainableField('适合动作', '等待30分钟确认后再决定是否轻仓试探'),
          majorRisk: createExplainableField('主要风险', '30分钟冲高但量能不足会再次回到等待'),
          explanation: '日线定约束，30分钟给触发；存在约束，不能直接放大动作',
        },
        {
          key: 'intraday_t',
          label: '超短线 / T 组合｜60分钟 → 15分钟',
          levels: ['hour60', 'hour15'],
          direction: 'bearish',
          directionLabel: '偏空',
          actionLabel: '暂不做',
          relationHint: '60分钟看背景，15分钟看执行',
          summary: '60分钟偏弱，15分钟不单独放行',
          recommendation: '先继续等待',
          signalTags: [],
          parentConstraint: createExplainableField('父级约束', '60分钟：偏弱'),
          triggerLevel: createExplainableField('触发级别', '15分钟：等待确认'),
          triggerLevelLabel: '15分钟',
          suitableAction: createExplainableField('适合动作', '只观察'),
          majorRisk: createExplainableField('主要风险', '15分钟反弹不能推翻上级'),
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
  assert.match(html, /状态：观察中/);
  assert.match(html, /适合动作/);
  assert.match(html, /主要风险/);
  assert.match(html, /周线：大方向偏多/);
  assert.match(html, /日线还没完全放行，30分钟先看确认/);
  assert.match(html, /先等30分钟放量突破平台上沿/);
  assert.match(html, /时空｜中偏弱/);
  assert.match(html, /父级约束说明/);
  assert.match(html, /这句话是什么意思/);
  assert.doesNotMatch(html, /日线定约束，30分钟给触发/);
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
        createRuleItem({
          summary: '延伸结构可观察，但不能按标准节点操作',
          recommendation: '先按边界看，不按标准节点下手',
          signalTags: [createSignalTag('结构｜延伸C', 'neutral')],
          detailHover: {
            title: '结构资格说明',
            items: [
              { label: '这句话是什么意思', value: '当前结构还能观察，但已不适合按标准节点机械执行。' },
              { label: '为什么这么判断', value: '结构已经进入延伸阶段，标准编号解释力下降。' },
              { label: '当前限制', value: '不能把当前段落直接当作标准 C 节点操作。' },
              { label: '下一步条件', value: '继续观察平台边界与确认节奏。' },
              { label: '判定依据', value: '延伸结构更依赖边界与执行段确认。' },
            ],
          },
          detail: '周线方向允许向下钻取。',
          reason: '父级方向一致',
        }),
        createRuleItem({
          title: 'MACD 时空',
          status: 'info',
          displayStatusLabel: '观察中',
          displayStatusIcon: '○',
          direction: 'neutral',
          directionLabel: '中性',
          detail: '日线级别处于等待确认状态。',
          reason: '等待时空确认',
          summary: '时空仍待确认',
          recommendation: '先等时空确认',
          statusExplanation: {
            tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
            ruleState: '待确认',
            directionLabel: '中性',
            reason: '等待时空确认',
          },
        }),
        createRuleItem({
          title: '55 / 233 线关系',
          status: 'warning',
          displayStatusLabel: '谨慎看',
          displayStatusIcon: '!',
          direction: 'bearish',
          directionLabel: '偏空',
          detail: '30分钟触发尚需量能确认。',
          reason: '量能未同步放大',
          summary: '均线仍有限制',
          recommendation: '先等均线确认',
          statusExplanation: {
            tradeMeaning: '存在约束，不能直接放大动作',
            ruleState: '有约束',
            directionLabel: '偏空',
            reason: '量能未同步放大',
          },
        }),
        createRuleItem({
          title: '量能确认',
          status: 'info',
          displayStatusLabel: '观察中',
          displayStatusIcon: '○',
          direction: 'neutral',
          directionLabel: '中性',
          detail: '60分钟节奏进入观察区。',
          reason: '等待下一段确认',
          summary: '量能还没补齐',
          recommendation: '先看量能变化',
          statusExplanation: {
            tradeMeaning: '已有方向或预案，但还差确认，不急着动作',
            ruleState: '待确认',
            directionLabel: '中性',
            reason: '等待下一段确认',
          },
        }),
        createRuleItem({
          title: '级别权限',
          status: 'failed',
          displayStatusLabel: '暂不做',
          displayStatusIcon: '×',
          direction: 'bearish',
          directionLabel: '偏空',
          detail: '15分钟入场点尚未成立。',
          reason: '入场触发条件缺失',
          summary: '当前级别权限不放行',
          recommendation: '先等父子级别重新对齐',
          statusExplanation: {
            tradeMeaning: '当前不支持按这条规则交易',
            ruleState: '不成立',
            directionLabel: '偏空',
            reason: '入场触发条件缺失',
          },
        }),
        createRuleItem({
          title: '执行计划',
          status: 'passed',
          displayStatusLabel: '可执行',
          displayStatusIcon: '✓',
          direction: 'bullish',
          directionLabel: '偏多',
          detail: '风险回撤边界已定义。',
          reason: '止损与失效位明确',
          summary: '执行边界已定义',
          recommendation: '按计划执行',
          statusExplanation: {
            tradeMeaning: '这条规则已满足，可纳入当前执行判断',
            ruleState: '已满足',
            directionLabel: '偏多',
            reason: '止损与失效位明确',
          },
        }),
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
  assert.match(html, /可执行/);
  assert.match(html, /观察中/);
  assert.match(html, /谨慎看/);
  assert.match(html, /暂不做/);
  assert.match(html, /交易含义/);
  assert.match(html, /规则状态/);
  assert.match(html, /当前方向/);
  assert.match(html, /延伸结构可观察，但不能按标准节点操作/);
  assert.match(html, /先按边界看，不按标准节点下手/);
  assert.match(html, /结构｜延伸C/);
  assert.match(html, /结构资格说明/);
  assert.match(html, /当前限制/);
  assert.doesNotMatch(html, /周线方向允许向下钻取/);
  assert.match(html, /等待触发：已有预案，但触发条件尚未满足/);
  assert.doesNotMatch(html, />通过</);
  assert.doesNotMatch(html, />警示</);
  assert.doesNotMatch(html, />提示</);
  assert.doesNotMatch(html, />失败</);
});

test('AnalysisPeriodDetails keeps a pure data contract and renders structure explanation internally', () => {
  assert.match(periodDetailsSource, /export interface AnalysisPeriodSection/);
  assert.doesNotMatch(periodDetailsSource, /structureExplainabilitySlot/);
  assert.match(periodDetailsSource, /StructureExplainabilityPanel/);
  assert.match(periodDetailsSource, /buildExecutionSummary/);
  assert.match(periodDetailsSource, /结构说明/);
  assert.match(periodDetailsSource, /defaultLevelKey/);
  assert.match(periodDetailsSource, /TabsList/);
  assert.match(periodDetailsSource, /TabsTrigger/);
  assert.match(periodDetailsSource, /TabsContent/);
  assert.doesNotMatch(periodDetailsSource, /AccordionTrigger/);
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

test('AnalysisPeriodDetails renders level tabs with decision card, rule summary and evidence', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'daily',
      sections: [
        {
          key: 'daily',
          label: '日线',
          defaultOpen: true,
          rangeLabel: '近 240 根',
          summary: '日线等待确认',
          topologyTitle: '日线结构证据',
            period: {
              period: 'daily',
              macd: {
                status: '中偏弱',
                divergence_note: '注意顶背离',
              },
              breakthrough: {
                pattern_type: '普通突破',
                pattern_name: '普通突破',
                direction: 'up',
                is_valid: false,
              },
              moving_averages: {
                ma_status: '站上MA55',
              },
              trinity_decision: {
                level: 'daily',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '等待30分钟触发',
              },
              spacetime: {
                status: '中偏弱',
                direction_bias: 'neutral',
                expected_structures: {
                  up: ['C单平台式'],
                  down: ['D三段式'],
                },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: false,
                  bottom_divergence_valid: false,
                  reason: '注意顶背离',
                },
              },
              structure: {
                type: 'C单平台式',
                qualification: 'standard',
                direction: 'flat',
                explainability: { status: 'passed', reason: 'C平台成立', evidence: [] },
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: {
                  above_ma55: true,
                  above_ma233: false,
                },
                breakthrough_state: 'breakout_pending',
                ma_gate: {
                  allow_long: false,
                  allow_short: false,
                  reason: '站上MA55',
                },
              },
              volume_confirmation: {
                volume_state: 'expanding',
                breakout_volume: 'weak',
                breakdown_volume: 'not_applicable',
                pullback_volume: 'normal',
                volume_gate: {
                  supports_breakout: false,
                  supports_breakdown: false,
                  supports_pullback_confirmation: false,
                  confidence_adjustment: 'neutral',
                  reason: '突破量弱',
                },
              },
              execution: {
                triggers: ['30分钟放量突破'],
                risk_flags: ['跌回平台下沿'],
                position_sizing: { reason: '不超过轻仓' },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
                reason: ['等待确认'],
              },
              level_nesting: {
                parent_level: 'weekly',
                child_level: 'daily',
                parent_bias: 'bullish',
                child_signal: 'wait',
                resonance: 'aligned',
                permission: {
                  allow_position_increase: false,
                  allow_t_trade: false,
                  allow_only_light_probe: true,
                  reason: '周线偏多，日线等待触发',
                },
              },
              judgment_criteria: [],
            },
            structure: {
              structure_type: 'C单平台式',
              inflection_points: 6,
              description: 'C单平台式，等待突破',
              interpretation: {
                spacetime_gate: {
                  parent_status: '周线偏多',
                  resonance_enabled: true,
                  wait_reason: '日线等待30分钟放量突破',
                  required_confirmation: '30分钟放量突破',
                },
              },
              structure_details: {
                prediction: {
                  current_stage: 'c5拐点',
                  next_stage: 'c6确认',
                  prediction_alert: '等待平台边界确认',
                  key_price_levels: [],
                  confidence: 'medium',
                },
              },
            },
          } as any,
        },
      ],
    })
  );

  assert.match(html, /周期详情/);
  assert.match(html, /日线/);
  assert.match(html, /该级别简明决策/);
  assert.match(html, /日线等待30分钟触发/);
  assert.match(html, /先等30分钟放量突破/);
  assert.match(html, /时空｜中偏弱/);
  assert.match(html, /结构｜C单平台式/);
  assert.match(html, /突破\/跌破｜突破候选/);
  assert.match(html, /量能｜突破量弱/);
  assert.match(html, /信号含义/);
  assert.match(html, /交易含义/);
  assert.match(html, /规则摘要/);
  assert.match(html, /证据区/);
  assert.match(html, /来源：日线三位一体判定/);
  assert.match(html, /触发条件/);
  assert.match(html, /风险条件/);
  assert.match(html, /注意顶背离/);
  assert.match(html, /普通突破/);
  assert.match(html, /站上MA55/);
  assert.match(html, /风控约束/);
  assert.match(html, /结构类型/);
  assert.match(html, /标准C类结构/);
  assert.match(html, /共振对象：周线 → 日线/);
  assert.match(html, /上一级：周线/);
  assert.match(html, /当前级别：日线/);
  assert.doesNotMatch(html, /周期摘要/);
});

test('AnalysisPeriodDetails prefers period breakthrough risk over broader decision candidate tags', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule<AnalysisPeriodDetailsModule>(
    'src/components/stock/AnalysisPeriodDetails.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisPeriodDetails, {
      defaultLevelKey: 'hour30',
      sections: [
        {
          key: 'hour30',
          label: '30分钟',
          defaultOpen: true,
          summary: '30分钟等待确认',
          period: {
            period: 'hour30',
            macd: {
              status: '中偏弱',
            },
            breakthrough: {
              pattern_type: '假突破',
              pattern_name: '假突破',
              direction: 'up',
              is_valid: false,
            },
            trinity_decision: {
              level: 'hour30',
              conclusion: {
                action: 'wait',
                action_label: '等待',
                bias: 'neutral',
                confidence: 'medium',
                can_trade: false,
                wait_reason: '等待15分钟进一步确认',
              },
              spacetime: {
                status: '中偏弱',
                direction_bias: 'neutral',
                expected_structures: {
                  up: ['C单平台式'],
                  down: ['D三段式'],
                },
                structure_match: true,
                mismatch_reason: null,
                divergence_policy: {
                  top_divergence_valid: false,
                  bottom_divergence_valid: false,
                  reason: '注意顶背离',
                },
              },
              structure: {
                type: 'C单平台式',
                qualification: 'standard',
                direction: 'flat',
                explainability: { status: 'passed', reason: 'C平台成立', evidence: [] },
              },
              moving_average: {
                ma55_role: 'support',
                ma233_role: 'neutral',
                price_position: {
                  above_ma55: true,
                  above_ma233: false,
                },
                breakthrough_state: 'breakout_pending',
                ma_gate: {
                  allow_long: false,
                  allow_short: false,
                  reason: '等待突破确认',
                },
              },
              volume_confirmation: {
                volume_state: 'normal',
                breakout_volume: 'weak',
                breakdown_volume: 'not_applicable',
                pullback_volume: 'normal',
                volume_gate: {
                  supports_breakout: false,
                  supports_breakdown: false,
                  supports_pullback_confirmation: false,
                  confidence_adjustment: 'neutral',
                  reason: '突破量弱',
                },
              },
              execution: {
                triggers: ['15分钟进一步确认'],
                risk_flags: ['再次跌回平台下沿'],
                position_sizing: { reason: '先保持轻仓观察' },
              },
              trade_qualification: {
                position_permission: 'light_probe',
                trade_mode: 'wait_confirmation',
                reason: ['等待确认'],
              },
              judgment_criteria: [],
            },
            structure: {
              structure_type: 'C单平台式',
              inflection_points: 6,
              description: '30分钟假突破风险正在增加',
            },
          } as any,
        },
      ],
    })
  );

  assert.match(html, /突破\/跌破｜假突破风险/);
  assert.doesNotMatch(html, /突破\/跌破｜突破候选/);
});
