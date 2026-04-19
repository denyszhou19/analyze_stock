# 三位一体可解释表达实现计划

> **给执行型 agent 的要求：** 实施本计划时，必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行。所有步骤使用复选框 `- [ ]` 语法追踪。

**目标：** 在不推翻现有线上分析页骨架的前提下，让 `交易周期总线`、`三位一体规则链`、`周期详情` 都使用统一的精简交易语言、统一的信号标签和统一的 hover 解释层。

**实现思路：** 先新增一层共享的信号标签归一化逻辑，再扩展现有 analysis page view model，让总线与规则链都能拿到“简短结论 + 操作建议 + 标签 + hover 解释”。`AnalysisPeriodDetails` 保持现有 Tab 结构，只在顶部补一个轻量级“周期结论头”，复用同一套标签与 tooltip 合同。

**技术栈：** Next.js App Router、React 19、TypeScript、shadcn/ui（Tooltip / Badge / Tabs）、Node test runner（`pnpm exec tsx --test`）

---

## 文件结构

### 新增文件

- `src/lib/trinity-signal-tags.ts`
  - 把 `trinity_decision` 与周期级别的突破/背离/时空字段统一映射为 `类别｜结果` 标签，并附带颜色语义和 hover 数据。
- `src/components/stock/SignalTagList.tsx`
  - 渲染统一风格的信号标签列表，并支持 tooltip 展开解释。
- `src/components/stock/ExplainableFact.tsx`
  - 渲染“字段值 + info 图标 + hover 解释”的共用组件，给总线四个信息块复用。
- `tests/trinity-signal-tags.test.ts`
  - 覆盖背离、时空、突破/跌破、量能、均线等信号的统一标签映射。

### 修改文件

- `src/lib/trinity-display-vocabulary.ts`
  - 增加统一的标签颜色语义 helper。
- `src/lib/trinity-analysis-page-view-model.ts`
  - 给交易周期总线与规则链补充 `summary`、`recommendation`、`signalTags`、`hover` 字段。
- `src/components/stock/TradingCycleBus.tsx`
  - 保留现有卡片骨架，只替换主句与四个信息块的表达方式。
- `src/components/stock/TrinityRuleChain.tsx`
  - 保留六张卡与状态 badge 结构，只把正文切成“当前判断 + 操作建议 + 标签”，把细节放入 hover。
- `src/components/stock/AnalysisPeriodDetails.tsx`
  - 在每个周期 Tab 顶部增加统一的“周期结论头”。
- `tests/trinity-display-vocabulary.test.ts`
  - 验证统一标签颜色语义。
- `tests/trinity-analysis-page-view-model.test.ts`
  - 验证 view model 新增字段与新文案。
- `tests/analysis-page-sections.test.ts`
  - 验证三个页面区块的最终渲染 HTML。

### 实施注意事项

- **不要**重做页面布局层次，本计划是表达层增强，不是页面重构。
- 继续复用当前 `Tooltip` 体系，不要新增另一套 hover / popover 机制。
- 信号标签必须短，保证在密集卡片里也能正常换行和扫描。
- 样式继续使用现有 `Badge`、`Tooltip`、`Tabs`、`cn()`。

---

### 任务 1：建立统一信号标签层

**文件：**
- 新建：`src/lib/trinity-signal-tags.ts`
- 测试：`tests/trinity-signal-tags.test.ts`
- 修改：`src/lib/trinity-display-vocabulary.ts`
- 测试：`tests/trinity-display-vocabulary.test.ts`

- [ ] **步骤 1：先写失败测试，锁定标签语法与颜色语义**

新增 `tests/trinity-signal-tags.test.ts`：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { PeriodAnalysisData, TrinityDecision } from '../src/lib/stock-structure-types.ts';

const {
  buildDecisionSignalTags,
  buildPeriodSignalTags,
} = await import(new URL('../src/lib/trinity-signal-tags.ts', import.meta.url).href) as typeof import('../src/lib/trinity-signal-tags.ts');

function createDecision(): TrinityDecision {
  return {
    version: 'v2',
    level: 'daily',
    conclusion: {
      action: 'wait',
      action_label: '等待',
      bias: 'bullish',
      confidence: 'medium',
      can_trade: false,
      wait_reason: '等待平台边界确认',
    },
    structure: {
      background_origin: null,
      focus_origin: null,
      execution_origin: null,
      family: 'extended',
      type: '延伸C',
      standard_candidate: 'C单平台式',
      qualification: 'extended',
      direction: 'up',
      boundaries: {},
      node_map: {},
      can_trade_by_structure_nodes: false,
      can_trade_by_boundaries: true,
      explainability: {
        status: 'downgraded',
        reason: '延伸结构停止标准编号',
        evidence: [],
      },
    },
    spacetime: {
      status: '中偏强',
      direction_bias: 'bullish',
      expected_structures: { up: ['C单平台式'], down: ['D三段式'] },
      structure_match: true,
      mismatch_reason: null,
      divergence_policy: {
        top_divergence_valid: false,
        bottom_divergence_valid: false,
        reason: '无背离确认',
      },
    },
    moving_average: {
      ma55_role: 'support',
      ma233_role: 'support',
      price_position: {
        above_ma55: true,
        above_ma233: true,
      },
      breakthrough_state: 'breakout_pending',
      ma_gate: {
        allow_long: true,
        allow_short: false,
        reason: 'MA55 上方运行，但突破仍待确认',
      },
    },
    volume_confirmation: {
      volume_state: 'normal',
      breakout_volume: 'weak',
      breakdown_volume: 'not_applicable',
      pullback_volume: 'healthy_shrink',
      volume_gate: {
        supports_breakout: false,
        supports_breakdown: false,
        supports_pullback_confirmation: true,
        confidence_adjustment: 'downgrade',
        reason: '突破量能偏弱',
      },
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
        reason: '父级偏多但子级仍在等待确认',
      },
    },
    trade_qualification: {
      trade_mode: 'wait_confirmation',
      position_permission: 'light_probe',
      confidence: 'medium',
      reason: ['等待确认'],
    },
    execution: {
      entry_style: 'breakout',
      triggers: ['30分钟放量突破平台上沿'],
      invalidation: ['跌回平台下沿'],
      confirmation: ['回踩 MA55 不破'],
      position_sizing: { reason: '只允许轻仓验证' },
      risk_flags: ['确认不足'],
    },
    judgment_criteria: [],
    ai_summary_facts: [],
  };
}

test('buildDecisionSignalTags emits unified category-result labels', () => {
  const tags = buildDecisionSignalTags(createDecision(), { max: 5 });

  assert.deepEqual(
    tags.map((tag) => tag.label),
    ['时空｜中偏强', '突破/跌破｜突破候选', '量能｜突破量弱', '均线｜MA55支撑', '结构｜延伸C']
  );
  assert.equal(tags[0].tone, 'bullish');
  assert.equal(tags[1].tone, 'warning');
  assert.equal(tags[2].hover.title, '量能｜突破量弱');
});

test('buildPeriodSignalTags prefers breakthrough and divergence signals when present', () => {
  const period: PeriodAnalysisData = {
    period: 'hour30',
    macd: {
      status: '中偏弱',
      divergence_note: '注意顶背离',
    },
    breakthrough: {
      pattern_type: '假突破',
      pattern_name: '假突破',
      direction: 'up',
      is_valid: false,
    },
  };

  const tags = buildPeriodSignalTags(period, { max: 4 });

  assert.deepEqual(
    tags.map((tag) => tag.label),
    ['背离｜顶背离', '突破/跌破｜假突破风险', '时空｜中偏弱']
  );
  assert.equal(tags[0].tone, 'bearish');
  assert.equal(tags[1].tone, 'warning');
});
```

更新 `tests/trinity-display-vocabulary.test.ts`：

```ts
test('maps signal tag tones to stable badge classes', () => {
  const bullish = vocabulary.getSignalTagToneMeta('bullish');
  const bearish = vocabulary.getSignalTagToneMeta('bearish');
  const warning = vocabulary.getSignalTagToneMeta('warning');
  const neutral = vocabulary.getSignalTagToneMeta('neutral');

  assert.match(bullish.badgeClassName, /rose|red/);
  assert.match(bearish.badgeClassName, /emerald|green/);
  assert.match(warning.badgeClassName, /amber|orange/);
  assert.match(neutral.badgeClassName, /slate|gray/);
});
```

- [ ] **步骤 2：运行测试，确认当前实现确实缺功能**

运行：

```bash
pnpm exec tsx --test tests/trinity-signal-tags.test.ts tests/trinity-display-vocabulary.test.ts
```

预期结果：

- `tests/trinity-signal-tags.test.ts` 因缺少 `../src/lib/trinity-signal-tags.ts` 失败
- `tests/trinity-display-vocabulary.test.ts` 因缺少 `getSignalTagToneMeta` 失败

- [ ] **步骤 3：实现共享标签构建器和颜色 helper**

新建 `src/lib/trinity-signal-tags.ts`：

```ts
import type { PeriodAnalysisData, TrinityDecision } from '@/lib/stock-structure-types';
import type { SignalTagTone } from '@/lib/trinity-display-vocabulary';

export interface SignalTagHover {
  title: string;
  items: Array<{ label: string; value: string }>;
}

export interface TrinitySignalTag {
  key: string;
  label: string;
  tone: SignalTagTone;
  hover: SignalTagHover;
}

function makeTag(
  key: string,
  label: string,
  tone: SignalTagTone,
  hover: SignalTagHover
): TrinitySignalTag {
  return { key, label, tone, hover };
}

function normalizeBreakthroughLabel(patternType?: string | null): { label: string; tone: SignalTagTone } | null {
  if (!patternType || patternType === '无突破') {
    return patternType ? { label: '突破/跌破｜无突破', tone: 'neutral' } : null;
  }

  if (patternType.includes('假突破') || patternType.includes('假跌破')) {
    return { label: `突破/跌破｜${patternType}风险`, tone: 'warning' };
  }
  if (patternType.includes('有效突破') || patternType.includes('回抽突破')) {
    return { label: `突破/跌破｜${patternType === '回抽突破' ? '回抽突破确认' : patternType}`, tone: 'bullish' };
  }
  if (patternType.includes('有效跌破') || patternType.includes('回抽跌破')) {
    return { label: `突破/跌破｜${patternType === '回抽跌破' ? '回抽跌破确认' : patternType}`, tone: 'bearish' };
  }

  return { label: `突破/跌破｜${patternType === '普通突破' ? '突破候选' : patternType}`, tone: 'warning' };
}

function normalizeDivergenceLabel(note?: string | null): { label: string; tone: SignalTagTone } | null {
  if (!note) {
    return null;
  }
  if (note.includes('顶背离')) {
    return { label: '背离｜顶背离', tone: 'bearish' };
  }
  if (note.includes('底背离')) {
    return { label: '背离｜底背离', tone: 'bullish' };
  }
  if (note.includes('钝化')) {
    return { label: '背离｜背离钝化', tone: 'warning' };
  }
  return { label: '背离｜无有效背离', tone: 'neutral' };
}

export function buildDecisionSignalTags(
  decision: TrinityDecision | null | undefined,
  options: { max?: number } = {}
): TrinitySignalTag[] {
  if (!decision) {
    return [];
  }

  const tags: TrinitySignalTag[] = [];
  tags.push(
    makeTag('spacetime', `时空｜${decision.spacetime.status}`, decision.spacetime.direction_bias === 'bearish' ? 'bearish' : decision.spacetime.direction_bias === 'bullish' ? 'bullish' : 'neutral', {
      title: `时空｜${decision.spacetime.status}`,
      items: [
        { label: '信号含义', value: '当前级别的 MACD 时空环境' },
        { label: '为什么成立', value: decision.spacetime.mismatch_reason ?? decision.spacetime.divergence_policy.reason },
        { label: '交易含义', value: decision.spacetime.structure_match ? '当前时空允许继续跟踪结构解释' : '当前时空会限制动作升级' },
        { label: '失效或降级', value: '若时空继续背离结构方向，则只能等待或降级执行' },
      ],
    })
  );

  const breakthroughLabel = decision.moving_average.breakthrough_state === 'valid_breakout'
    ? { label: '突破/跌破｜有效突破', tone: 'bullish' as const }
    : decision.moving_average.breakthrough_state === 'valid_breakdown'
      ? { label: '突破/跌破｜有效跌破', tone: 'bearish' as const }
      : decision.moving_average.breakthrough_state === 'breakout_pending'
        ? { label: '突破/跌破｜突破候选', tone: 'warning' as const }
        : decision.moving_average.breakthrough_state === 'breakdown_pending'
          ? { label: '突破/跌破｜跌破候选', tone: 'warning' as const }
          : null;

  if (breakthroughLabel) {
    tags.push(
      makeTag('breakthrough', breakthroughLabel.label, breakthroughLabel.tone, {
        title: breakthroughLabel.label,
        items: [
          { label: '信号含义', value: '均线与关键边界的穿越状态' },
          { label: '为什么成立', value: decision.moving_average.ma_gate.reason },
          { label: '交易含义', value: '突破/跌破状态会直接影响执行动作能否升级' },
          { label: '失效或降级', value: '若很快回到原边界一侧，则回退为等待确认' },
        ],
      })
    );
  }

  tags.push(
    makeTag('volume', `量能｜${decision.volume_confirmation.breakout_volume === 'weak' ? '突破量弱' : decision.volume_confirmation.breakout_volume === 'confirmed' ? '突破放量确认' : decision.volume_confirmation.volume_state === 'unknown' ? '未知' : '正常'}`, decision.volume_confirmation.breakout_volume === 'confirmed' ? 'bullish' : decision.volume_confirmation.breakout_volume === 'weak' ? 'warning' : 'neutral', {
      title: `量能｜${decision.volume_confirmation.breakout_volume === 'weak' ? '突破量弱' : decision.volume_confirmation.breakout_volume === 'confirmed' ? '突破放量确认' : decision.volume_confirmation.volume_state === 'unknown' ? '未知' : '正常'}`,
      items: [
        { label: '信号含义', value: '量能只负责验证突破、跌破和回踩是否有效' },
        { label: '为什么成立', value: decision.volume_confirmation.volume_gate.reason },
        { label: '交易含义', value: decision.volume_confirmation.breakout_volume === 'weak' ? '当前只能保留候选，不直接升级动作' : '量能对当前方向没有额外否决' },
        { label: '失效或降级', value: '若突破量能继续不足或回踩放量下跌，则信号降级' },
      ],
    })
  );

  tags.push(
    makeTag('moving-average', `均线｜MA55${decision.moving_average.ma55_role === 'support' ? '支撑' : decision.moving_average.ma55_role === 'resistance' ? '压制' : '中性'}`, decision.moving_average.ma55_role === 'support' ? 'bullish' : decision.moving_average.ma55_role === 'resistance' ? 'bearish' : 'neutral', {
      title: `均线｜MA55${decision.moving_average.ma55_role === 'support' ? '支撑' : decision.moving_average.ma55_role === 'resistance' ? '压制' : '中性'}`,
      items: [
        { label: '信号含义', value: 'MA55 当前承担的是支撑、压制还是中性角色' },
        { label: '为什么成立', value: decision.moving_average.ma_gate.reason },
        { label: '交易含义', value: decision.moving_average.ma55_role === 'support' ? '均线对当前方向形成保护' : '均线仍在限制动作升级' },
        { label: '失效或降级', value: '若重新跌回或站回均线另一侧，需要重新判定' },
      ],
    })
  );

  tags.push(
    makeTag('structure', `结构｜${decision.structure.type}`, 'neutral', {
      title: `结构｜${decision.structure.type}`,
      items: [
        { label: '信号含义', value: '当前主导结构类型' },
        { label: '为什么成立', value: decision.structure.explainability.reason },
        { label: '交易含义', value: decision.structure.can_trade_by_structure_nodes ? '可继续沿标准节点或边界理解动作' : '当前以边界或等待为主' },
        { label: '失效或降级', value: '若结构继续延伸或被破坏，需要重新分类' },
      ],
    })
  );

  return tags.slice(0, options.max ?? 3);
}

export function buildPeriodSignalTags(
  period: PeriodAnalysisData | null | undefined,
  options: { max?: number } = {}
): TrinitySignalTag[] {
  if (!period) {
    return [];
  }

  const tags: TrinitySignalTag[] = [];
  const divergenceLabel = normalizeDivergenceLabel(period.macd?.divergence_note);
  if (divergenceLabel) {
    tags.push(makeTag('divergence', divergenceLabel.label, divergenceLabel.tone, {
      title: divergenceLabel.label,
      items: [
        { label: '信号含义', value: 'MACD 背离信号' },
        { label: '为什么成立', value: period.macd?.divergence_note ?? '未提供背离原因' },
        { label: '交易含义', value: '背离会影响当前方向的持续性判断' },
        { label: '失效或降级', value: '若价格与 MACD 重新同步，背离提醒降级' },
      ],
    }));
  }

  const breakthroughLabel = normalizeBreakthroughLabel(period.breakthrough?.pattern_type);
  if (breakthroughLabel) {
    tags.push(makeTag('breakthrough', breakthroughLabel.label, breakthroughLabel.tone, {
      title: breakthroughLabel.label,
      items: [
        { label: '信号含义', value: '当前最近一次突破/跌破形态' },
        { label: '为什么成立', value: period.breakthrough?.description ?? period.breakthrough?.pattern_name ?? '近期穿越均线或边界后的形态识别结果' },
        { label: '交易含义', value: breakthroughLabel.tone === 'warning' ? '当前只能作为候选或风险提示' : '当前可作为方向确认信号之一' },
        { label: '失效或降级', value: '若很快回到原边界一侧，则信号降级' },
      ],
    }));
  }

  if (period.macd?.status) {
    tags.push(makeTag('spacetime', `时空｜${period.macd.status}`, period.macd.status.includes('弱') ? 'bearish' : period.macd.status.includes('强') ? 'bullish' : 'neutral', {
      title: `时空｜${period.macd.status}`,
      items: [
        { label: '信号含义', value: '当前周期的 MACD 时空状态' },
        { label: '为什么成立', value: period.macd?.description ?? '来源于现有 MACD 时空判断链路' },
        { label: '交易含义', value: '时空状态决定当前结构解释是放行还是降级' },
        { label: '失效或降级', value: '若后续 MACD 状态切换，标签也需要切换' },
      ],
    }));
  }

  return tags.slice(0, options.max ?? 4);
}
```

修改 `src/lib/trinity-display-vocabulary.ts`：

```ts
export type SignalTagTone = 'bullish' | 'bearish' | 'warning' | 'neutral';

const SIGNAL_TAG_TONE_META: Record<SignalTagTone, { badgeClassName: string }> = {
  bullish: { badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700' },
  bearish: { badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  warning: { badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700' },
  neutral: { badgeClassName: 'border-slate-200 bg-slate-50 text-slate-700' },
};

export function getSignalTagToneMeta(tone: SignalTagTone) {
  return SIGNAL_TAG_TONE_META[tone];
}
```

- [ ] **步骤 4：重新运行测试，确认标签层成立**

运行：

```bash
pnpm exec tsx --test tests/trinity-signal-tags.test.ts tests/trinity-display-vocabulary.test.ts
```

预期结果：

- 两个测试文件都通过
- 输出中显示全部 `pass`

- [ ] **步骤 5：提交这一层改动**

```bash
git add src/lib/trinity-signal-tags.ts src/lib/trinity-display-vocabulary.ts tests/trinity-signal-tags.test.ts tests/trinity-display-vocabulary.test.ts
git commit -m "实现：新增三位一体统一信号标签层"
```

### 任务 2：扩展分析页 view model，输出精简主句与 hover 数据

**文件：**
- 修改：`src/lib/trinity-analysis-page-view-model.ts`
- 测试：`tests/trinity-analysis-page-view-model.test.ts`

- [ ] **步骤 1：先写失败测试，锁定总线与规则链的新数据契约**

在 `tests/trinity-analysis-page-view-model.test.ts` 末尾追加：

```ts
test('trading combinations and rule chain expose compact copy, tags, and hover facts', () => {
  const result = createResult();
  result.periods.hour30 = {
    period: 'hour30',
    trinity_decision: createDecision({
      level: 'hour30',
      conclusion: {
        action: 'wait',
        action_label: '等待',
        bias: 'bullish',
        confidence: 'medium',
        can_trade: false,
        wait_reason: '等待30分钟触发',
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });

  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');
  assert.ok(shortline);
  assert.equal(shortline.summary, '日线还没完全放行，30分钟先看确认');
  assert.equal(shortline.recommendation, '先等重新站上平台上沿');
  assert.deepEqual(shortline.signalTags.map((tag) => tag.label), [
    '时空｜中偏强',
    '突破/跌破｜有效突破',
    '量能｜突破量弱',
  ]);
  assert.equal(shortline.parentConstraint.hoverTitle, '父级约束说明');
  assert.equal(shortline.parentConstraint.hoverItems[0]?.label, '这句话是什么意思');
  assert.match(shortline.parentConstraint.hoverItems[1]?.value ?? '', /等待 C 结构边界确认|结构边界未触发/);

  const structureRule = vm.ruleChain.items.find((item) => item.title === '结构资格');
  assert.ok(structureRule);
  assert.equal(structureRule.summary, 'A原型成立，但仍需等待更明确确认');
  assert.equal(structureRule.recommendation, '先按结构边界和确认节奏继续跟踪');
  assert.ok(structureRule.signalTags.some((tag) => tag.label.startsWith('结构｜')));
  assert.equal(structureRule.detailHover.title, '结构资格说明');
  assert.equal(structureRule.detailHover.items[2]?.label, '当前限制');
});
```

- [ ] **步骤 2：运行测试，确认现有 view model 还不支持这些字段**

运行：

```bash
pnpm exec tsx --test tests/trinity-analysis-page-view-model.test.ts
```

预期结果：

- 因 `shortline.summary`、`shortline.signalTags` 不存在而失败
- 因 `structureRule.detailHover` 不存在而失败

- [ ] **步骤 3：扩展类型和构建函数**

修改 `src/lib/trinity-analysis-page-view-model.ts`：

```ts
import {
  buildDecisionSignalTags,
  type TrinitySignalTag,
} from './trinity-signal-tags.ts';

export interface AnalysisPageHoverItem {
  label: string;
  value: string;
}

export interface AnalysisPageExplainableField {
  label: string;
  value: string;
  hoverTitle: string;
  hoverItems: AnalysisPageHoverItem[];
}

export interface AnalysisPageSignalTagViewModel extends TrinitySignalTag {}

export interface AnalysisPageTradingCombinationViewModel {
  key: TradingCombinationKey;
  label: string;
  levels: [TrinityLevel, TrinityLevel];
  direction: DirectionTone;
  directionLabel: string;
  actionLabel: string;
  relationHint: string;
  summary: string;
  recommendation: string;
  signalTags: AnalysisPageSignalTagViewModel[];
  parentConstraint: AnalysisPageExplainableField;
  triggerLevel: AnalysisPageExplainableField;
  suitableAction: AnalysisPageExplainableField;
  majorRisk: AnalysisPageExplainableField;
}

export interface AnalysisPageRuleChainItem {
  title: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  displayStatusLabel: string;
  displayStatusIcon: string;
  direction: DirectionTone;
  directionLabel: string;
  summary: string;
  recommendation: string;
  signalTags: AnalysisPageSignalTagViewModel[];
  detailHover: {
    title: string;
    items: AnalysisPageHoverItem[];
  };
  statusExplanation: ReturnType<typeof buildStatusExplanation>;
}

function buildExplainableField(
  label: string,
  value: string,
  hoverTitle: string,
  hoverItems: AnalysisPageHoverItem[]
): AnalysisPageExplainableField {
  return { label, value, hoverTitle, hoverItems };
}

function buildCombinationSummary(
  majorLabel: string,
  minorLabel: string,
  major: TrinityDecision | null,
  minor: TrinityDecision | null
) {
  if (!major) {
    return `${majorLabel}数据缺失，先等主级别补齐`;
  }
  if (major.trade_qualification.position_permission === 'no_position') {
    return `${majorLabel}还没完全放行，${minorLabel}先看确认`;
  }
  return `${minorLabel}可以继续盯触发，但先不放大动作`;
}

function buildCombinationRecommendation(minor: TrinityDecision | null) {
  return minor?.execution.triggers?.[0]
    ? `先等${minor.execution.triggers[0]}`
    : '先保持观察';
}
```

然后把 `buildCombination()` 的返回体替换为：

```ts
  const parentReason = major
    ? resolveChineseReason(
        [
          major.conclusion.wait_reason,
          major.trade_qualification.reason[0],
          major.execution.position_sizing.reason,
        ],
        '暂无额外约束'
      )
    : `${majorLabel}缺失`;

  const triggerText = minor?.execution.triggers?.[0] ?? `${minorLabel}等待确认`;
  const actionText = minor
    ? formatDecisionActionLabel(minor.conclusion.action, minor.conclusion.action_label)
    : '等待数据补齐';
  const riskText =
    minor?.execution.risk_flags?.[0] ??
    major?.execution.risk_flags?.[0] ??
    '暂无明确风险';

  return {
    key,
    label,
    levels,
    status,
    direction,
    directionLabel,
    actionLabel: statusMeta.label,
    relationHint: `${majorLabel}看背景，${minorLabel}看执行`,
    summary: buildCombinationSummary(majorLabel, minorLabel, major, minor),
    recommendation: buildCombinationRecommendation(minor),
    signalTags: [
      ...buildDecisionSignalTags(major, { max: 2 }),
      ...buildDecisionSignalTags(minor, { max: 2 }),
    ].slice(0, 3),
    parentConstraint: buildExplainableField('父级约束', `${majorLabel}：${parentReason}`, '父级约束说明', [
      { label: '这句话是什么意思', value: `${majorLabel}决定这条组合当前能否升级动作` },
      { label: '为什么这么判断', value: parentReason },
      { label: '当前限制', value: major?.trade_qualification.position_permission === 'no_position' ? '当前还不允许直接放大仓位' : '当前只放行到有限动作范围' },
      { label: '放行后怎么升级', value: `${majorLabel}一旦放行，${minorLabel}信号才可以升级成更强动作` },
    ]),
    triggerLevel: buildExplainableField('触发级别', minorLabel, '触发级别说明', [
      { label: '这句话是什么意思', value: `${minorLabel}负责寻找当前这条组合的具体触发与确认` },
      { label: '为什么这么判断', value: triggerText },
      { label: '现在盯什么', value: triggerText },
      { label: '什么情况取消', value: minor?.execution.invalidation?.[0] ?? '若先走坏则回退为观察' },
    ]),
    suitableAction: buildExplainableField('适合动作', actionText, '适合动作说明', [
      { label: '这句话是什么意思', value: '这是当前这条组合最合适的动作级别' },
      { label: '为什么这么判断', value: minor?.execution.position_sizing.reason ?? major?.execution.position_sizing.reason ?? '暂无额外原因' },
      { label: '现在建议怎么做', value: buildCombinationRecommendation(minor) },
      { label: '升级动作条件', value: minor?.execution.confirmation?.[0] ?? '等待更明确确认' },
    ]),
    majorRisk: buildExplainableField('主要风险', riskText, '主要风险说明', [
      { label: '这句话是什么意思', value: '这是当前最容易让这条组合失效的风险点' },
      { label: '为什么这么判断', value: riskText },
      { label: '什么情况取消', value: minor?.execution.invalidation?.[0] ?? '若先走坏则取消预案' },
      { label: '退回动作', value: '回到观察、等待或只做 T 的级别' },
    ]),
  };
```

同时调整 `decorateRuleChainItem()` 与各分支调用：

```ts
function decorateRuleChainItem({
  title,
  status,
  direction,
  summary,
  recommendation,
  signalTags,
  reason,
}: {
  title: string;
  status: TrinityJudgmentCriterion['status'];
  direction: DirectionTone;
  summary: string;
  recommendation: string;
  signalTags: AnalysisPageSignalTagViewModel[];
  reason: string;
}): AnalysisPageRuleChainItem {
  const statusMeta = getActionStatusMeta(status);

  return {
    title,
    status,
    displayStatusLabel: statusMeta.label,
    displayStatusIcon: statusMeta.icon,
    direction,
    directionLabel: getDirectionMeta(direction).label,
    summary,
    recommendation,
    signalTags,
    detailHover: {
      title: `${title}说明`,
      items: [
        { label: '这句话是什么意思', value: summary },
        { label: '为什么这么判断', value: reason },
        { label: '当前限制', value: status === 'passed' ? '当前这条规则没有额外限制' : recommendation },
        { label: '下一步条件', value: recommendation },
        { label: '判定依据', value: reason },
      ],
    },
    statusExplanation: buildStatusExplanation({ status, direction, reason }),
  };
}
```

结构资格 fallback 分支改成：

```ts
summary: decision.structure.explainability.status === 'passed'
  ? 'A原型成立，但仍需等待更明确确认'
  : '延伸结构可观察，但不能按标准节点操作',
recommendation: decision.structure.can_trade_by_structure_nodes
  ? '先沿结构确认节奏继续跟踪'
  : '先按结构边界和确认节奏继续跟踪',
signalTags: buildDecisionSignalTags(decision, { max: 1 }),
```

- [ ] **步骤 4：重新运行 view model 测试**

运行：

```bash
pnpm exec tsx --test tests/trinity-analysis-page-view-model.test.ts
```

预期结果：

- 所有测试通过
- 新测试能读到 `summary`、`recommendation`、`signalTags`、`detailHover`

- [ ] **步骤 5：提交 view model 改动**

```bash
git add src/lib/trinity-analysis-page-view-model.ts tests/trinity-analysis-page-view-model.test.ts
git commit -m "实现：扩展分析页视图模型支持解释层表达"
```

### 任务 3：在不改骨架的前提下更新交易周期总线与规则链组件

**文件：**
- 新建：`src/components/stock/SignalTagList.tsx`
- 新建：`src/components/stock/ExplainableFact.tsx`
- 修改：`src/components/stock/TradingCycleBus.tsx`
- 修改：`src/components/stock/TrinityRuleChain.tsx`
- 测试：`tests/analysis-page-sections.test.ts`

- [ ] **步骤 1：先改渲染测试，锁定最终 HTML**

更新 `tests/analysis-page-sections.test.ts` 里的 `TradingCycleBus` fixture：

```ts
{
  key: 'shortline',
  label: '短线执行组合｜日线 → 30分钟',
  levels: ['daily', 'hour30'],
  direction: 'bullish',
  directionLabel: '偏多',
  actionLabel: '观察中',
  relationHint: '日线看背景，30分钟看执行',
  summary: '日线还没完全放行，30分钟先看确认',
  recommendation: '先等30分钟放量突破平台上沿',
  signalTags: [
    {
      key: 'spacetime',
      label: '时空｜中偏弱',
      tone: 'bearish',
      hover: {
        title: '时空｜中偏弱',
        items: [{ label: '信号含义', value: '当前 MACD 时空环境偏弱' }],
      },
    },
  ],
  parentConstraint: {
    label: '父级约束',
    value: '日线：等待平台边界确认',
    hoverTitle: '父级约束说明',
    hoverItems: [{ label: '这句话是什么意思', value: '日线决定当前是否允许升级动作' }],
  },
  triggerLevel: {
    label: '触发级别',
    value: '30分钟',
    hoverTitle: '触发级别说明',
    hoverItems: [{ label: '现在盯什么', value: '30分钟放量突破平台上沿' }],
  },
  suitableAction: {
    label: '适合动作',
    value: '轻仓验证',
    hoverTitle: '适合动作说明',
    hoverItems: [{ label: '升级动作条件', value: '回踩 MA55 不破' }],
  },
  majorRisk: {
    label: '主要风险',
    value: '确认不足，容易回落失效',
    hoverTitle: '主要风险说明',
    hoverItems: [{ label: '什么情况取消', value: '跌回平台下沿' }],
  },
}
```

并把断言改成：

```ts
assert.match(html, /日线还没完全放行，30分钟先看确认/);
assert.match(html, /先等30分钟放量突破平台上沿/);
assert.match(html, /时空｜中偏弱/);
assert.match(html, /父级约束说明/);
assert.match(html, /这句话是什么意思/);
assert.doesNotMatch(html, /日线定约束，30分钟给触发/);
```

更新 `TrinityRuleChain` fixture：

```ts
{
  title: '结构资格',
  status: 'warning',
  displayStatusLabel: '谨慎看',
  displayStatusIcon: '!',
  direction: 'bullish',
  directionLabel: '偏多',
  summary: '延伸结构可观察，但不能按标准节点操作',
  recommendation: '先按边界看，不按标准节点下手',
  signalTags: [
    {
      key: 'structure',
      label: '结构｜延伸C',
      tone: 'neutral',
      hover: {
        title: '结构｜延伸C',
        items: [{ label: '信号含义', value: '当前主导结构是延伸 C' }],
      },
    },
  ],
  detailHover: {
    title: '结构资格说明',
    items: [{ label: '当前限制', value: '当前不能按标准节点操作' }],
  },
  statusExplanation: {
    tradeMeaning: '存在约束，不能直接放大动作',
    ruleState: '有约束',
    directionLabel: '偏多',
    reason: '延伸结构停止标准编号',
  },
}
```

并把断言改成：

```ts
assert.match(html, /延伸结构可观察，但不能按标准节点操作/);
assert.match(html, /先按边界看，不按标准节点下手/);
assert.match(html, /结构｜延伸C/);
assert.match(html, /结构资格说明/);
assert.match(html, /当前限制/);
assert.doesNotMatch(html, /周线方向允许向下钻取/);
```

- [ ] **步骤 2：运行渲染测试，确认组件还没跟上新契约**

运行：

```bash
pnpm exec tsx --test tests/analysis-page-sections.test.ts
```

预期结果：

- `TradingCycleBus` 因仍在渲染 `combination.explanation` 失败
- `TrinityRuleChain` 因仍在渲染 `detail / reason` 失败

- [ ] **步骤 3：新增共用展示组件并更新两个页面组件**

新建 `src/components/stock/SignalTagList.tsx`：

```tsx
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getSignalTagToneMeta } from '@/lib/trinity-display-vocabulary';
import { cn } from '@/lib/utils';
import type { AnalysisPageSignalTagViewModel } from '@/lib/trinity-analysis-page-view-model';

export function SignalTagList({
  tags,
  className,
}: {
  tags: AnalysisPageSignalTagViewModel[];
  className?: string;
}) {
  if (!tags.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => {
        const toneMeta = getSignalTagToneMeta(tag.tone);
        return (
          <TooltipProvider key={tag.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn('cursor-help', toneMeta.badgeClassName)}>
                  {tag.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm text-sm leading-6">
                <div className="space-y-1">
                  <div className="font-medium">{tag.hover.title}</div>
                  {tag.hover.items.map((item) => (
                    <p key={`${tag.key}-${item.label}`}>
                      {item.label}：{item.value}
                    </p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
```

新建 `src/components/stock/ExplainableFact.tsx`：

```tsx
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { AnalysisPageExplainableField } from '@/lib/trinity-analysis-page-view-model';

export function ExplainableFact({ fact }: { fact: AnalysisPageExplainableField }) {
  return (
    <div className="rounded-lg border bg-background/70 p-2">
      <div className="flex items-start gap-1">
        <span className="font-medium text-foreground">{fact.label}：</span>
        <span className="text-muted-foreground">{fact.value}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`${fact.label}说明`} className="mt-0.5 text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-sm leading-6">
              <div className="space-y-1">
                <div className="font-medium">{fact.hoverTitle}</div>
                {fact.hoverItems.map((item) => (
                  <p key={`${fact.label}-${item.label}`}>
                    {item.label}：{item.value}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
```

修改 `src/components/stock/TradingCycleBus.tsx`：

```tsx
import { ExplainableFact } from '@/components/stock/ExplainableFact';
import { SignalTagList } from '@/components/stock/SignalTagList';

// inside CardContent
<CardContent className="space-y-3 px-4 text-sm">
  <div className="space-y-1">
    <p className="leading-6 text-foreground">{combination.summary}</p>
    <p className="text-sm leading-6 text-muted-foreground">{combination.recommendation}</p>
    <p className="text-xs leading-5 text-muted-foreground">{combination.relationHint}</p>
  </div>

  <SignalTagList tags={combination.signalTags} />

  <div className="grid gap-2 text-xs text-muted-foreground">
    <ExplainableFact fact={combination.parentConstraint} />
    <ExplainableFact fact={combination.triggerLevel} />
    <ExplainableFact fact={combination.suitableAction} />
    <ExplainableFact fact={combination.majorRisk} />
  </div>
</CardContent>
```

修改 `src/components/stock/TrinityRuleChain.tsx`：

```tsx
import { SignalTagList } from '@/components/stock/SignalTagList';

// inside CardContent
<CardContent className="space-y-2 px-4 text-sm leading-6 text-muted-foreground">
  <div className="space-y-1">
    <p className="text-foreground">{item.summary}</p>
    <p>{item.recommendation}</p>
  </div>
  <SignalTagList tags={item.signalTags} />
  <p className="text-xs text-foreground/75">判定依据：{item.statusExplanation.reason}</p>
</CardContent>

// replace the status tooltip body
<div className="space-y-1">
  <div className="font-medium">{item.displayStatusLabel}</div>
  <p>交易含义：{item.statusExplanation.tradeMeaning}</p>
  <p>规则状态：{item.statusExplanation.ruleState}</p>
  <p>当前方向：{item.statusExplanation.directionLabel}</p>
  {item.detailHover.items.map((entry) => (
    <p key={`${item.title}-${entry.label}`}>
      {entry.label}：{entry.value}
    </p>
  ))}
</div>
```

- [ ] **步骤 4：重新运行 section 测试，确认 UI 已切换到新表达层**

运行：

```bash
pnpm exec tsx --test tests/analysis-page-sections.test.ts
```

预期结果：

- 所有 section render 测试通过
- HTML 中能看到新的主句、信号标签、hover 标题与解释字段

- [ ] **步骤 5：提交总线与规则链组件改动**

```bash
git add src/components/stock/SignalTagList.tsx src/components/stock/ExplainableFact.tsx src/components/stock/TradingCycleBus.tsx src/components/stock/TrinityRuleChain.tsx tests/analysis-page-sections.test.ts
git commit -m "实现：收紧总线与规则链表层表达并补充解释层"
```

### 任务 4：给周期详情增加统一“结论头”

**文件：**
- 修改：`src/components/stock/AnalysisPeriodDetails.tsx`
- 测试：`tests/analysis-page-sections.test.ts`

- [ ] **步骤 1：先写失败测试，锁定周期结论头**

扩展 `AnalysisPeriodDetails renders level tabs with decision card, rule summary and evidence` 测试：

```ts
assert.match(html, /该级别简明决策/);
assert.match(html, /日线等待30分钟触发/);
assert.match(html, /先等30分钟放量突破/);
assert.match(html, /时空｜中偏弱/);
assert.match(html, /结构｜C单平台式/);
assert.match(html, /突破\/跌破｜突破候选/);
assert.match(html, /量能｜突破量弱/);
assert.match(html, /信号含义/);
assert.match(html, /交易含义/);
```

同时把 fixture 补成：

```ts
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
```

- [ ] **步骤 2：运行测试，确认周期详情还没有信号带和建议句**

运行：

```bash
pnpm exec tsx --test tests/analysis-page-sections.test.ts
```

预期结果：

- 因 `AnalysisPeriodDetails` 还没渲染信号标签带和建议句而失败

- [ ] **步骤 3：实现周期结论头并复用共享标签层**

修改 `src/components/stock/AnalysisPeriodDetails.tsx`：

```tsx
import { SignalTagList } from '@/components/stock/SignalTagList';
import { buildDecisionSignalTags, buildPeriodSignalTags } from '@/lib/trinity-signal-tags';

function resolvePeriodRecommendation(section: AnalysisPeriodSection) {
  const firstTrigger = resolvePeriodTriggers(section)[0];
  if (firstTrigger) {
    return `先等${firstTrigger}`;
  }
  return '先保持观察，等待更明确确认';
}

function resolvePeriodConclusion(section: AnalysisPeriodSection) {
  return (
    section.period?.trinity_decision?.conclusion.wait_reason ??
    section.period?.structure?.interpretation?.spacetime_gate?.wait_reason ??
    resolveSummary(section)
  );
}

function resolvePeriodHeaderTags(section: AnalysisPeriodSection) {
  const periodTags = buildPeriodSignalTags(section.period, { max: 4 });
  const decisionTags = buildDecisionSignalTags(section.period?.trinity_decision, { max: 2 }).filter(
    (tag) => tag.key === 'volume' || tag.key === 'spacetime'
  );
  const structureTag = getStructureTagMeta(
    section.period?.trinity_decision?.structure.type ?? section.period?.structure?.structure_type ?? null
  );

  return [
    ...periodTags,
    ...decisionTags,
    {
      key: 'structure',
      label: `结构｜${structureTag.label}`,
      tone: 'neutral' as const,
      hover: {
        title: `结构｜${structureTag.label}`,
        items: [
          { label: '信号含义', value: structureTag.explanation },
          { label: '交易含义', value: structureTag.tradeMeaning },
        ],
      },
    },
  ]
    .filter((tag, index, tags) => tags.findIndex((item) => item.label === tag.label) === index)
    .slice(0, 4);
}
```

然后把 `PeriodDecisionCard` 里原先的摘要段落替换成：

```tsx
      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm leading-6 text-foreground">{resolvePeriodConclusion(section)}</p>
          <p className="text-sm leading-6 text-muted-foreground">{resolvePeriodRecommendation(section)}</p>
        </div>
        <SignalTagList tags={resolvePeriodHeaderTags(section)} />
      </div>
```

保留原有触发/风险/风控三块结构，但保证推荐语与触发条件是一致的：

```tsx
<div className="text-xs font-medium text-muted-foreground">触发条件</div>
<LabelList fallback="暂无明确触发条件" items={resolvePeriodTriggers(section)} />
```

- [ ] **步骤 4：重新运行周期详情测试**

运行：

```bash
pnpm exec tsx --test tests/analysis-page-sections.test.ts
```

预期结果：

- `AnalysisPeriodDetails` 相关断言全部通过
- HTML 中出现精简结论句和信号标签带

- [ ] **步骤 5：提交周期详情改动**

```bash
git add src/components/stock/AnalysisPeriodDetails.tsx tests/analysis-page-sections.test.ts
git commit -m "实现：为周期详情补充统一结论头与信号标签"
```

### 任务 5：做整套表达层回归验证

**文件：**
- 修改：无
- 测试：`tests/trinity-signal-tags.test.ts`
- 测试：`tests/trinity-display-vocabulary.test.ts`
- 测试：`tests/trinity-analysis-page-view-model.test.ts`
- 测试：`tests/analysis-page-sections.test.ts`

- [ ] **步骤 1：运行聚焦 TypeScript 测试集**

运行：

```bash
pnpm exec tsx --test tests/trinity-signal-tags.test.ts tests/trinity-display-vocabulary.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
```

预期结果：

- 四个测试文件全部通过
- 没有 section render / view model 回归

- [ ] **步骤 2：运行 TypeScript 编译检查**

运行：

```bash
pnpm ts-check
```

预期结果：

- 退出码为 `0`
- 没有新增类型错误

- [ ] **步骤 3：对当前 dev server 做页面烟雾验证**

在终端 A 中，如果本地开发服务器尚未运行，先启动：

```bash
pnpm dev
```

预期结果：

- Next dev server 正常启动在 `http://localhost:5001`
- 启动期间没有因为新增信号标签组件或 view model 字段而报模块 / 类型错误

在终端 B 中运行：

```bash
curl -s "http://localhost:5001/stock/300274/analysis" | head -n 20
```

预期结果：

- 返回分析页 HTML shell
- 没有 SSR 崩溃

---

## 自检

### 1. 规格覆盖检查

- `交易周期总线` 表层精简 + hover 解释：任务 2 + 任务 3
- `三位一体规则链` 表层精简 + hover 解释：任务 2 + 任务 3
- `周期详情` 新增统一结论头：任务 1 + 任务 4
- `统一信号标签字典`：任务 1
- `统一颜色语义`：任务 1
- `保持线上骨架`：任务 3 + 任务 4

没有遗漏的 spec 要求。

### 2. 占位符检查

- 没有 `TODO` / `TBD`
- 所有改代码步骤都包含具体代码
- 所有执行步骤都包含明确命令和预期结果

### 3. 类型一致性检查

- `SignalTagTone` 统一定义在 `src/lib/trinity-display-vocabulary.ts`
- `AnalysisPageExplainableField` 定义在 view model，供 `ExplainableFact` 复用
- `summary` / `recommendation` / `signalTags` 先在 view model 定义，再由组件消费

计划内部字段命名与任务顺序一致，可直接执行。
