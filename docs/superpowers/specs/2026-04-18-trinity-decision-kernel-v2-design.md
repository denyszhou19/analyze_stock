# 三位一体后端判定内核 v2 设计

## 目标

重设计后端判定内核，让系统能够稳定、规则化地产出完整的三位一体判断链：

1. 结构。
2. MACD 时空。
3. 均线物理状态。
4. 量能确认。
5. 级别嵌套。
6. 交易资格。
7. 执行动作。
8. 给页面和 AI 使用的判定依据与证据。

页面的职责是优先展示系统已经能确定的信息和判定标准。AI 智能体的职责是基于这些规则化结果做综合策略解读，而不是重新从原始字段里推导基础结论。

## 核心原则

新的内核遵循这条规则：

> 标准结构按节点交易；非标准结构按边界交易；所有交易动作必须经过时空、均线、量能和级别门控。

具体含义：

- 标准 `A/B/C/D` 结构，在时空和均线条件匹配时，可以产生节点型交易动作。
- 非标准结构仍然可以交易，但只能产生条件化的边界型策略。
- 突破 / 跌破类动作必须经过量能确认；缺少量能配合时只能保留为候选或等待。
- 未完成结构不能产生正式交易信号。
- AI 不允许把后端规则层给出的 `等待 / 规避 / 仅减仓` 结论升级成更激进的交易动作。

## 当前问题

现有系统已经有很多可复用能力：

- `scripts/stock_analyzer.py` 已经计算结构、MACD、均线物理、突破/跌破、级别嵌套和执行字段。
- `src/lib/ai-analysis-payload.ts` 已经把一部分字段整理给 AI。
- 分析页已经展示结构可解释性和执行摘要。

但最终判定链仍然是分散的：

- 结构分类看起来像确定结论，但时空和均线约束分散在其他字段里。
- 标准结构和非标准结构没有形成第一等的交易资格边界。
- 页面需要自己推断字段之间的关系，而不是消费一个权威判定对象。
- AI payload 有证据，但还没有一个统一的确定性决策层级。

## 课程规则提炼

### 1. 结构是全局要素，不是孤立形态

结构用于识别价格运动路径和关键拐点，但不能单独决定交易。`A/B/C/D` 必须结合时空和均线环境验证。

### 2. 起点必须分层

系统必须区分三类起点：

- `background_origin`：大区间分析窗口原点。
- `focus_origin`：当前结构的第一可解释锚点。
- `execution_origin`：最近可执行子结构锚点。

在山峰 / 山谷结构里，当前聚焦起点经常应该是主峰 / 主谷，而不是图上最左侧的可见点。

### 3. 标准结构按节点交易

标准结构可以使用内部节点：

- `A`：关键确认点通常围绕 `a4`；第三浪是主升 / 主跌段。
- `B`：关键确认点通常围绕 `b8`；双平台不得重叠。
- `C`：以平台上下沿作为操作边界。
- `D`：最小完整结构；`d3` 和 `d4` 是高价值的不稳定点 / 衰竭点。

### 4. 非标准结构按边界交易

非标准结构不能冒充标准节点结构。

典型非标准结构包括：

- `延伸C`：C 类平台超过标准点数后继续延展。
- `下降通道 / 上升通道`：上下边界主导判断。
- `大平台震荡`：大箱体上下沿主导判断。
- `未完成结构`：确认点不足，不能产生正式交易信号。
- `复杂结构`：形态不清晰，默认等待或风控；只有在时空和均线提供严格边界条件时，才允许条件化交易。

### 5. 时空过滤结构含义

MACD 时空不负责“画出结构”，但它决定某个结构解释是否被允许，或者是否必须降级。

| 状态 | 优先上涨结构 | 优先下跌结构 | 交易含义 |
| --- | --- | --- | --- |
| 极强 | A/B | 无 | 不轻信看空结构；回抽 MA55 往往是加仓机会。 |
| 强 | B | D | 趋势仍偏建设性；下跌 D 可能是买点机会。 |
| 中偏强 | C | C | 平台 / 中枢试仓区，只允许轻仓。 |
| 中偏弱 | C | C | 防御性平台区，必须严格止损。 |
| 弱 | D | B | 反弹常常是卖出 / 做 T 机会。 |
| 极弱 | 无 | A/B | 不轻信底部结构；反弹到 MA55 往往是减仓 / 规避机会。 |

### 6. MA55 决定执行合法性

MA55 是执行门控：

- 价格站上 MA55 且回踩确认不破：多头动作可以升级。
- 价格在 MA55 下方且 MA55 形成压制：多头动作降级；反弹更偏减仓 / 反 T。
- 结构高点和 MA55 重合：突破难度增加。
- 价格距离 MA55 偏离过大：追涨杀跌降级，提示均线牵引回归。

### 7. 量能确认突破 / 跌破有效性

成交量不是第四个“三位一体主要素”，但它是突破、跌破、回踩确认的必要验证因子。

量能主要回答：

- 价格突破结构上沿 / MA55 时，是否有资金参与。
- 价格跌破平台下沿 / MA55 时，风险是否被放大。
- 突破后的回踩是健康缩量，还是放量破位风险。
- 当前动作的置信度和仓位权限是否应该升级或降级。

量能不直接决定 `A/B/C/D`，也不单独产生买卖动作。它只影响：

- `breakthrough_state`
- `trade_mode`
- `confidence`
- `position_permission`
- `action`

### 8. 级别嵌套控制交易权限

分析自上而下，交易自下而上：

- 周线决定大方向权限。
- 日线决定主结构和战略偏向。
- 60 分钟 / 30 分钟决定执行时机。
- 15 分钟只能细化日内或短线做 T。

小级别信号如果和父级别冲突，必须降级。

## 目标数据模型

### `trinity_decision`

每个分析周期最终应输出：

```ts
type TrinityDecision = {
  version: 'v2';
  level: 'weekly' | 'daily' | 'hour60' | 'hour30' | 'hour15';
  conclusion: TrinityConclusion;
  structure: TrinityStructureDecision;
  spacetime: TrinitySpacetimeDecision;
  moving_average: TrinityMovingAverageDecision;
  volume_confirmation: TrinityVolumeConfirmationDecision;
  level_nesting?: TrinityLevelNestingDecision;
  trade_qualification: TrinityTradeQualification;
  execution: TrinityExecutionDecision;
  judgment_criteria: TrinityJudgmentCriterion[];
  ai_summary_facts: string[];
};
```

### `conclusion`

```ts
type TrinityConclusion = {
  action: 'buy' | 'add' | 'hold' | 'reduce' | 'sell' | 't_trade' | 'wait' | 'avoid';
  action_label: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  can_trade: boolean;
  wait_reason?: string | null;
};
```

### `structure`

```ts
type TrinityStructureDecision = {
  background_origin?: TrinityAnchor | null;
  focus_origin?: TrinityAnchor | null;
  execution_origin?: TrinityAnchor | null;

  family:
    | 'standard'
    | 'extended'
    | 'channel'
    | 'range'
    | 'unfinished'
    | 'complex';

  type:
    | 'A五段式'
    | 'B双平台式'
    | 'C单平台式'
    | 'D三段式'
    | '延伸A'
    | '延伸B'
    | '延伸C'
    | '延伸D'
    | '上升通道'
    | '下降通道'
    | '大平台震荡'
    | '未完成结构'
    | '复杂结构';

  standard_candidate?: 'A五段式' | 'B双平台式' | 'C单平台式' | 'D三段式' | null;
  qualification: 'standard' | 'extended' | 'over_limit' | 'unfinished' | 'failed';
  direction: 'up' | 'down' | 'neutral';

  boundaries: {
    upper?: number | null;
    lower?: number | null;
    mid?: number | null;
    breakout_trigger?: number | null;
    breakdown_trigger?: number | null;
    stop_loss?: number | null;
  };

  node_map: {
    a4?: number | null;
    b8?: number | null;
    d3?: number | null;
    d4?: number | null;
    last_confirmed?: number | null;
  };

  can_trade_by_structure_nodes: boolean;
  can_trade_by_boundaries: boolean;

  explainability: {
    status: 'passed' | 'downgraded' | 'failed';
    reason: string;
    evidence: string[];
  };
};
```

### `spacetime`

```ts
type TrinitySpacetimeDecision = {
  status: '极强' | '强' | '中偏强' | '中偏弱' | '弱' | '极弱' | string;
  direction_bias: 'bullish' | 'bearish' | 'neutral';
  expected_structures: {
    up: string[];
    down: string[];
  };
  structure_match: boolean;
  mismatch_reason?: string | null;
  divergence_policy: {
    top_divergence_valid: boolean;
    bottom_divergence_valid: boolean;
    reason: string;
  };
};
```

### `moving_average`

```ts
type TrinityMovingAverageDecision = {
  ma55_role: 'support' | 'resistance' | 'neutral';
  ma233_role: 'support' | 'resistance' | 'neutral';
  price_position: {
    above_ma55: boolean;
    above_ma233: boolean;
    deviation_ma55_pct?: number | null;
    deviation_ma233_pct?: number | null;
  };
  breakthrough_state:
    | 'none'
    | 'breakout_pending'
    | 'valid_breakout'
    | 'pullback_confirmed'
    | 'false_breakout'
    | 'breakdown_pending'
    | 'valid_breakdown'
    | 'pullback_breakdown_confirmed'
    | 'false_breakdown';
  ma_gate: {
    allow_long: boolean;
    allow_short: boolean;
    reason: string;
  };
};
```

### `volume_confirmation`

```ts
type TrinityVolumeConfirmationDecision = {
  volume_ratio_5?: number | null;
  volume_ratio_20?: number | null;
  amount_ratio_20?: number | null;
  turnover_rate?: number | null;

  volume_state:
    | 'shrinking'
    | 'normal'
    | 'expanding'
    | 'climax'
    | 'unknown';

  breakout_volume:
    | 'confirmed'
    | 'weak'
    | 'climax_risk'
    | 'not_applicable';

  breakdown_volume:
    | 'confirmed'
    | 'weak'
    | 'climax_risk'
    | 'not_applicable';

  pullback_volume:
    | 'healthy_shrink'
    | 'danger_expand'
    | 'normal'
    | 'not_applicable';

  volume_gate: {
    supports_breakout: boolean;
    supports_breakdown: boolean;
    supports_pullback_confirmation: boolean;
    confidence_adjustment: 'upgrade' | 'neutral' | 'downgrade';
    reason: string;
  };
};
```

### `level_nesting`

```ts
type TrinityLevelNestingDecision = {
  parent_level?: string | null;
  child_level?: string | null;
  parent_bias: 'bullish' | 'bearish' | 'neutral';
  child_signal: 'long' | 'short' | 'wait';
  resonance: 'aligned' | 'conflict' | 'child_countertrend' | 'parent_unclear';
  permission: {
    allow_position_increase: boolean;
    allow_t_trade: boolean;
    allow_only_light_probe: boolean;
    reason: string;
  };
};
```

### `trade_qualification`

```ts
type TrinityTradeQualification = {
  trade_mode:
    | 'standard_node_trade'
    | 'conditional_boundary_trade'
    | 'wait_confirmation'
    | 'risk_control'
    | 'no_trade';
  position_permission:
    | 'full_signal'
    | 'half_position'
    | 'light_probe'
    | 't_trade_only'
    | 'reduce_only'
    | 'no_position';
  confidence: 'high' | 'medium' | 'low';
  reason: string[];
};
```

### `execution`

```ts
type TrinityExecutionDecision = {
  entry_style: 'node' | 'boundary' | 'pullback' | 'breakout' | 't_trade' | 'none';
  triggers: string[];
  invalidation: string[];
  confirmation: string[];
  position_sizing: {
    max_ratio?: number | null;
    reason: string;
    upgrade_condition?: string | null;
    downgrade_condition?: string | null;
  };
  risk_flags: string[];
};
```

### `judgment_criteria`

```ts
type TrinityJudgmentCriterion = {
  category: 'structure' | 'spacetime' | 'moving_average' | 'volume' | 'level_nesting' | 'execution';
  label: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  detail: string;
};
```

## 判定流程

### Step 1：构建基础事实

收集已有周期事实：

- 最新价。
- MACD 时空状态。
- MA55 / MA233 状态。
- 分型与笔。
- 结构详情。
- 突破 / 跌破与均线物理。
- 成交量、成交额、换手率及其均值比。
- 级别嵌套摘要。

这一层不产生交易结论。

### Step 2：判定结构资格

结构层先尝试标准 `A/B/C/D`。

如果标准资格失败：

- 点数 / 平台超限只表示标准 `A/B/C/D` 资格失败，不能直接等同于 `延伸C`。
- 需要保留 `standard_candidate`，再按形态二次归类为 `延伸A/B/C/D`、`上升通道`、`下降通道`、`大平台震荡`、`未完成结构` 或 `复杂结构`。
- 上下边界斜率清晰 -> `上升通道` 或 `下降通道`。
- 大横向箱体 -> `大平台震荡`。
- 确认点不足 -> `未完成结构`。
- 形态不清晰 -> `复杂结构`。

系统必须保留 `standard_candidate`，但只要不是标准结构，就阻止标准节点交易。

#### 标准 A/C/D 共同约束

标准结构必须同时满足“形态原型成立”和“点数窗口成立”。点数只能作为资格过滤，不能单独决定结构类型。

| 结构 | 标准窗口 | 核心原型 | 完整资格 |
| --- | --- | --- | --- |
| `A五段式` | 5 笔 / 6 点 | 趋势段 + 中继平台 + 趋势延续 | 一个主导中继平台，前后趋势段同向推进 |
| `C单平台式` | 5 笔 / 6 点 | 单一平台震荡 | 一个主导箱体，上下沿清晰，无有效趋势位移 |
| `D三段式` | 3 笔 / 4 点 | 最小 N 字 / 反 N 字 | 无成熟平台，三段单边构成最小完整结构 |

如果形态原型成立但点数超限，转入对应 `延伸A/B/C/D`。如果形态原型不成立，不能用点数硬套标准结构。

#### 标准 A 判定规则

`A五段式` 的本质是趋势推进中的一次中继整理，不是任意“有平台 + 有方向段”。

**1. A 候选条件**

满足以下任一条件，只能进入 `A五段式` 候选：

- 宏观组件为 `Directional + Platform + Directional`。
- 宏观组件为 `Directional + Platform`，但仅代表 A 的进行中候选。
- 宏观组件为 `Platform + Directional`，但仅代表平台突破后的 A 候选。
- 点数接近 5 笔 / 6 点，且中间存在一个主导中继平台。

候选不等于标准 A。只有形成完整趋势骨架后，才允许输出标准 `A五段式`。

**2. 趋势推进要求**

上涨 A 需要满足：

- 后一方向段相对前一方向段形成有效上移。
- 回踩段不应破坏前一轮趋势起点。
- 中继平台之后应出现向上脱离平台的位移。

下跌 A 需要满足：

- 后一方向段相对前一方向段形成有效下移。
- 反弹段不应破坏前一轮下跌起点。
- 中继平台之后应出现向下脱离平台的位移。

**3. 中继平台要求**

标准 A 只能有一个主导中继平台：

- 平台内部应有有效震荡，但不能扩张成大平台。
- 平台应服务于趋势中继，而不是主导整个结构。
- 平台点数超限时，不再是标准 A，应转 `延伸A`、`延伸C` 或 `大平台震荡`。

**4. 标准 A 资格**

只有同时满足以下条件，才输出标准 `A五段式`：

1. 通过 A 候选条件。
2. 只有一个主导中继平台。
3. 趋势段方向一致，并形成有效推进。
4. 点数符合 5 笔 / 6 点标准窗口。
5. 没有第二个成熟平台。
6. 没有通道化或大平台化。

**5. A 失败后的归类**

| 失败原因 | 归类 |
| --- | --- |
| 没有成熟平台，只有单边推进 | `D三段式` 或 `延伸D` |
| 中继平台超限并主导结构 | `延伸C` 或 `大平台震荡` |
| 出现第二个有效分离平台 | `B双平台式` 或 `延伸B` |
| 多段沿同一斜率推进 | `上升通道` 或 `下降通道` |
| 趋势推进不成立 | `C单平台式`、`未完成结构` 或 `复杂结构` |

页面应展示 A 判定链：

```text
A候选来源 -> 中继平台质量 -> 趋势推进 -> 点数窗口 -> 排除B/C/D/通道 -> 最终结构资格
```

#### B 双平台判定规则

当前系统不能只用“两个平台不重叠”或“9 笔”直接确认 `B双平台式`。新版内核应把 B 拆成“候选识别”和“资格确认”两步。

**1. B 候选条件**

满足以下任一条件，只能进入 `B双平台式` 候选：

- 宏观组件为 `Platform + Platform`。
- 宏观组件为 `Platform + Directional + Platform`。
- 笔数为 9 笔 / 确认点约 10 点，但尚未完成平台质量验证。

候选不等于标准 B。只要平台质量、分离度或连接段失败，就必须降级。

**2. 平台有效性**

两个平台都需要满足：

- 每个平台至少包含 3 笔有效震荡。
- 平台内部高低点能形成相对稳定的上沿和下沿。
- 平台不是由单根极端笔强行拉宽形成。
- 平台内震荡应以横向整理为主，不能表现为持续同斜率通道。

如果只有一个成熟平台，不能判 B；应转为 `C单平台式`、`延伸C`、`大平台震荡` 或 `未完成结构`。

**3. 双平台分离度**

B 的核心不是“两个平台”，而是“两个同级平台之间发生了有效位移”：

- 上涨 B：第二平台下沿应有效高于第一平台上沿。
- 下跌 B：第二平台上沿应有效低于第一平台下沿。
- 允许设置一个价格容差，避免因为少量影线重叠导致误判。
- 如果两个平台大面积重叠，不能判标准 B，应优先归入 `大平台震荡` 或 `延伸C`。
- 如果多个平台沿同一斜率阶梯运行，应优先判断 `上升通道` / `下降通道`，不能简单取前两个平台判 B。

**4. 连接段质量**

`Platform + Directional + Platform` 的连接段必须提供真实位移：

- 连接段应突破第一平台边界。
- 连接段应把价格带入第二平台所在区间。
- 连接段不能只是第一平台箱体扩张的一部分。
- 连接段之后如果又形成第三个平台，应重新判断为 `延伸B`、`大平台震荡`、`通道` 或 `复杂结构`。

**5. 标准 B 资格**

只有同时满足以下条件，才输出标准 `B双平台式`：

1. 通过 B 候选条件。
2. 两个平台都通过平台有效性。
3. 两个平台通过有效分离度。
4. 连接段有效，或两个平台之间存在清晰位移。
5. 确认点数符合 B 的标准窗口：理想为 9 笔 / 10 点。
6. 没有额外成熟第三平台或明显通道化。

如果前四项成立，但点数已经超出标准窗口，应输出：

```text
type = '延伸B'
standard_candidate = 'B双平台式'
qualification = 'extended' 或 'over_limit'
can_trade_by_structure_nodes = false
can_trade_by_boundaries = true
```

**6. B 失败后的归类**

| 失败原因 | 归类 |
| --- | --- |
| 两个平台大面积重叠 | `大平台震荡` 或 `延伸C` |
| 只有一个成熟平台 | `C单平台式`、`延伸C` 或 `未完成结构` |
| 多个平台横向堆叠 | `大平台震荡` |
| 多个平台沿斜率推进 | `上升通道` 或 `下降通道` |
| 双平台后继续延伸出方向段 | `延伸B` |
| 9 笔但平台不成立 | `复杂结构` 或 `未完成结构` |

**7. 时空、均线、量能的职责**

结构层只负责判断“是不是标准 B / 延伸 B / 非 B”。MACD 时空、MA55 和量能不能把一个失败结构升级成标准 B，只能决定交易权限：

- `极强/强` 更支持上涨 B 的多头执行。
- `弱/极弱` 更支持下跌 B 的空头风险控制。
- `中偏强/中偏弱` 下的 B 需要更强边界和量能确认。
- MA55 决定能否执行买入、加仓、减仓或等待。
- 量能决定突破 / 跌破是否有效，影响置信度和仓位权限。

页面应展示 B 判定链：

```text
B候选来源 -> 平台1质量 -> 平台2质量 -> 分离度 -> 连接段质量 -> 点数窗口 -> 最终结构资格
```

#### 标准 C 判定规则

`C单平台式` 的本质是单一平台震荡，而不是“只要有平台就叫 C”。

**1. C 候选条件**

满足以下任一条件，只能进入 `C单平台式` 候选：

- 宏观组件只有一个，且类型为 `Platform`。
- 点数接近 5 笔 / 6 点，且高低点主要重叠在同一箱体内。

候选不等于标准 C。平台过大、平台升级、多平台堆叠或通道化，都不能输出标准 `C单平台式`。

**2. 单平台要求**

标准 C 必须只有一个主导平台，并满足：

- 平台上沿、下沿清晰可追踪。
- 平台内部高低点主要重叠，价格围绕同一箱体来回震荡。
- 没有形成有效趋势位移。
- 平台不是由多个成熟平台横向拼接而成。

**3. 标准 C 资格**

只有同时满足以下条件，才输出标准 `C单平台式`：

1. 通过 C 候选条件。
2. 只有一个主导平台。
3. 平台边界稳定，没有升级成更大箱体。
4. 没有形成趋势中继结构。
5. 点数符合 5 笔 / 6 点标准窗口。
6. 没有明显通道化。

**4. C 失败后的归类**

| 失败原因 | 归类 |
| --- | --- |
| 平台点数超限，但仍是单一箱体 | `延伸C` |
| 横向震荡升级为多平台大箱体 | `大平台震荡` |
| 平台后形成明确趋势中继推进 | `A五段式` 或 `延伸A` |
| 平台演化为两个有效分离平台 | `B双平台式` 或 `延伸B` |
| 上下边界斜率清晰 | `上升通道` 或 `下降通道` |
| 平台尚未成熟 | `未完成结构` |

页面应展示 C 判定链：

```text
C候选来源 -> 单平台质量 -> 边界稳定性 -> 点数窗口 -> 排除A/B/通道/大平台 -> 最终结构资格
```

#### 标准 D 判定规则

`D三段式` 是最小完整结构，强调三段单边推进，而不是任何短结构都叫 D。

**1. D 候选条件**

满足以下任一条件，只能进入 `D三段式` 候选：

- 宏观组件只有一个，且类型为 `Directional`。
- 点数接近 3 笔 / 4 点，且结构表现为最小 N 字 / 反 N 字。

候选不等于标准 D。只要出现成熟平台、额外方向段、通道化或箱体化，就不能再输出标准 `D三段式`。

**2. 单边推进要求**

上涨 D 需要满足：

- 三段结构形成最小完整上推。
- 中间回撤不应跌破起点级关键低点。
- 终段应相对前段形成有效上移。

下跌 D 需要满足：

- 三段结构形成最小完整下推。
- 中间反弹不应突破起点级关键高点。
- 终段应相对前段形成有效下移。

**3. 标准 D 资格**

只有同时满足以下条件，才输出标准 `D三段式`：

1. 通过 D 候选条件。
2. 没有成熟平台。
3. 三段单边推进成立。
4. 点数符合 3 笔 / 4 点标准窗口。
5. 没有额外方向段继续延伸。
6. 没有通道化。

**4. D 失败后的归类**

| 失败原因 | 归类 |
| --- | --- |
| 三段之后继续单边延伸 | `延伸D` |
| 中间形成成熟平台 | `A五段式`、`C单平台式` 或对应延伸结构 |
| 多段单边沿斜率推进 | `上升通道` 或 `下降通道` |
| 单边推进不清晰 | `未完成结构` 或 `复杂结构` |

页面应展示 D 判定链：

```text
D候选来源 -> 单边推进 -> 点数窗口 -> 排除平台/通道/延伸 -> 最终结构资格
```

#### 延伸 A/B/C/D 判定规则

延伸结构不是新的标准结构，而是：

```text
标准原型仍然成立
+ 已超出标准点数窗口
+ 停止标准节点编号
+ 改为边界/条件化交易
```

统一规则如下：

1. 必须先识别出 `standard_candidate = A/B/C/D`。
2. 必须先验证该标准原型的核心形态仍然成立。
3. 只有在标准原型成立但点数超限时，才允许输出 `延伸A/B/C/D`。
4. 一旦输出延伸结构，必须：
   - `can_trade_by_structure_nodes = false`
   - `can_trade_by_boundaries = true`
   - `qualification = 'extended'` 或 `qualification = 'over_limit'`
5. 如果原型已经被破坏，不能硬归为延伸结构，必须改判为 `上升通道`、`下降通道`、`大平台震荡`、`未完成结构` 或 `复杂结构`。

**1. 延伸A**

`延伸A` 表示标准 A 的趋势中继原型仍然成立，但走势已经超出标准 A 的点数窗口。

判定条件：

- 仍然能识别出“趋势段 + 中继平台 + 趋势延续”的 A 类骨架。
- 只有一个主导中继平台，没有形成合格第二平台。
- 走势继续沿原趋势方向推进，新增的是方向延续段、回踩修复段或再推动段。
- 点数超出标准 A 窗口。

失去 `延伸A` 资格的情况：

- 第二个平台成熟并与第一个平台形成有效分离 -> `B双平台式` 或 `延伸B`。
- 多个平台沿同斜率推进 -> `上升通道` 或 `下降通道`。
- 价格长时间横向堆叠，不再体现单一中继平台 -> `大平台震荡` 或 `延伸C`。

**2. 延伸B**

`延伸B` 表示双平台原型成立，但已超出标准 B 的 9 笔 / 10 点窗口，或双平台后继续延伸出额外方向段。

判定条件：

- `B双平台式` 候选成立。
- 两个平台都有效。
- 两个平台具备有效分离度，不是大面积重叠。
- 连接段有效，或者双平台之间存在明确位移。
- 点数已超出标准 B 窗口，或者标准 B 完成后继续延伸出方向段。

失去 `延伸B` 资格的情况：

- 两个平台大面积重叠 -> `大平台震荡` 或 `延伸C`。
- 多个平台沿单一斜率阶梯推进 -> `上升通道` 或 `下降通道`。
- 平台质量不成立，只是笔数碰巧达到 9 笔 -> `复杂结构` 或 `未完成结构`。

**3. 延伸C**

`延伸C` 表示单平台震荡原型仍然成立，但已经超出标准 C 的点数窗口。

判定条件：

- 仍然只有一个主导平台在控制价格波动。
- 上沿、下沿仍然清晰可追踪。
- 价格主要在同一箱体内反复震荡，没有形成有效趋势位移。
- 点数超出标准 C 窗口。

失去 `延伸C` 资格的情况：

- 横向箱体已经明显升级为多平台堆叠 -> `大平台震荡`。
- 上下边界斜率清晰 -> `上升通道` 或 `下降通道`。
- 出现有效趋势突破并形成趋势中继 -> `A五段式` 或 `延伸A`。
- 出现两个有效分离平台 -> `B双平台式` 或 `延伸B`。

**4. 延伸D**

`延伸D` 表示单边推进原型仍然成立，但已经超出标准 D 的点数窗口。

判定条件：

- 走势仍以单边推进为主。
- 没有形成成熟平台。
- 高低点持续沿同一方向抬高或降低。
- 点数超出标准 D 窗口。

失去 `延伸D` 资格的情况：

- 单边之后形成成熟平台 -> `A五段式`、`C单平台式` 或对应延伸结构。
- 多段单边逐步收敛成稳定斜率边界 -> `上升通道` 或 `下降通道`。
- 走势不再单边，而是进入横向震荡 -> `大平台震荡`、`延伸C` 或 `未完成结构`。

**5. 时空、均线、量能的职责**

时空、均线和量能只决定延伸结构能不能交易、怎么交易，不决定它是否属于 `延伸A/B/C/D`：

- MACD 时空负责方向匹配和信号降级。
- MA55 / MA233 负责执行门控。
- 成交量负责确认突破、跌破、回踩是否有效。
- 它们不能把一个原型失败的结构“提升”为延伸结构。

### Step 3：应用时空门控

比较结构方向、结构家族和 MACD 时空状态是否匹配。

示例：

- `极强 + 下跌A/B` -> 不匹配，下跌信号降级。
- `极弱 + 上涨A/B` -> 不匹配，上涨信号降级。
- `中偏强 + C/延伸C/range` -> 兼容，只允许轻仓试探。
- `弱 + 下降通道 / 下跌B候选` -> 偏空兼容。

### Step 4：应用均线门控

判断 MA55 当前允许做多、做空还是只能等待。

示例：

- 站上 MA55 且回踩确认 -> 允许多头升级。
- MA55 下方且 MA55 压制 -> 减仓 / 反 T 条件优先。
- 距离 MA55 过远 -> 不追，等待回踩或修复。
- 结构边界与 MA55 重合 -> 需要更强确认。

### Step 5：应用量能确认

判断突破、跌破和回踩是否获得量能配合。

示例：

- 价格收盘突破结构上沿 / MA55，且成交量或成交额明显高于 20 日均值 -> `breakout_volume = confirmed`。
- 价格突破但量能没有放大 -> `breakout_volume = weak`，交易动作降级为等待确认。
- 价格放巨量冲高但收盘未站稳边界 -> `breakout_volume = climax_risk`，禁止追涨。
- 价格放量跌破平台下沿 / MA55 -> `breakdown_volume = confirmed`，风险升级。
- 跌破但快速收回且量能不放大 -> 假跌破风险，等待二次确认。
- 突破后回踩边界 / MA55 时缩量且不跌回 -> `pullback_volume = healthy_shrink`，可提升突破确认度。
- 回踩时放量下跌 -> `pullback_volume = danger_expand`，突破失败风险增加。

### Step 6：应用级别权限

父级别决定子级别信号能否执行。

示例：

- 周线偏多 + 日线边界突破 -> 允许加仓。
- 周线偏空 + 日线反弹至 MA55 -> 减仓 / 做 T。
- 父级别不清楚 -> 只能轻仓试探或等待。

### Step 7：确定交易模式

使用以下映射：

| 结构 | 时空 | 均线门控 | 量能门控 | 交易模式 |
| --- | --- | --- | --- | --- |
| 标准 A/B/C/D | 匹配 | 已确认 | 已确认或中性 | `standard_node_trade` |
| 标准 A/B/C/D | 匹配 | 未确认 | 任意 | `wait_confirmation` |
| 标准 A/B/C/D | 匹配 | 已确认 | 明显不支持 | `wait_confirmation` |
| 非标准结构 | 支持 | 已确认 | 已确认或中性 | `conditional_boundary_trade` |
| 非标准结构 | 支持 | 已确认 | 明显不支持 | `wait_confirmation` |
| 非标准结构 | 不支持 | 任意 | 任意 | `wait_confirmation` 或 `risk_control` |
| 未完成结构 | 任意 | 任意 | 任意 | `wait_confirmation` |
| 极弱 + MA55 压制 | 任意 | 压制 | 任意 | `risk_control` |

### Step 8：构建执行决策

把交易模式映射成最终动作：

- `standard_node_trade` 可以产生 `buy / add / hold / reduce / sell`。
- `conditional_boundary_trade` 可以产生带降级仓位权限和明确边界触发条件的 `buy / add / hold / reduce / t_trade / wait`。
- `wait_confirmation` 产生 `wait`。
- `risk_control` 产生 `reduce / t_trade / avoid`。
- `no_trade` 产生 `avoid`。

## 非标准结构交易规则

非标准结构只有同时满足以下三项，才允许交易：

1. 时空支持该方向，或者至少允许 C / range 试仓。
2. MA55 门控确认方向，或者提供清晰边界条件。
3. 量能确认不明显反对该方向。
4. 级别嵌套不阻止交易。

如果允许交易，仓位必须降级：

- 默认 `light_probe`。
- 不允许 `full_signal`。
- 不允许使用标准节点标签。
- 必须提供触发条件和失效条件。
- 突破 / 跌破类交易必须说明量能是否确认。

示例：

```text
延伸C + 中偏强 + 平台下沿 + MA55 未确认
= 只能轻仓试仓，跌破平台下沿严格止损。
```

示例：

```text
下降通道 + 弱 + 价格在 MA55 下方
= 反弹到通道上轨 / MA55 是减仓或反 T 条件。
```

示例：

```text
非标准平台 + 上破平台上沿 + 站上 MA55 + 缩量突破
= 只保留突破候选，等待回踩不破或二次放量确认。
```

示例：

```text
非标准平台 + 跌破平台下沿 + 放量 + 弱/极弱
= 风险升级，优先减仓或规避。
```

## 页面契约

页面应按以下顺序渲染 `trinity_decision`：

1. 最终结论。
2. 结构资格。
3. MACD 时空门控。
4. MA55 / MA233 门控。
5. 量能确认。
6. 级别嵌套权限。
7. 执行计划。
8. 判定标准。

页面不应从原始字段重新计算结论。

## AI 契约

AI 接收：

```ts
{
  deterministic_decision: TrinityDecision;
  raw_evidence_summary: Record<string, unknown>;
  scenario_paths: unknown[];
  open_questions: string[];
}
```

AI 必须：

1. 复述系统确定性结论。
2. 解释证据链。
3. 输出条件化执行语言。
4. 强调风险和失效条件。
5. 不推翻后端硬门控。

AI 可以补充策略表达，但不能把：

- `wait` 升级成 `buy`。
- `light_probe` 升级成 `full_signal`。
- `risk_control` 升级成 `add`。
- `unfinished` 升级成标准节点交易。

## 实施阶段

### Phase 1：统一输出 `trinity_decision`

先围绕现有输出建立包装层。

可能涉及文件：

- `scripts/stock_analyzer.py`
- `src/lib/stock-structure-types.ts`
- `src/lib/ai-analysis-payload.ts`
- 相关 Python 和 TypeScript 测试。

目标：

- 新增稳定的 `trinity_decision`。
- 暂不重写全部算法。
- 页面和 AI 可以开始消费同一个权威对象。
- 成交量字段第一阶段可先从已有 K 线数据计算均量比 / 成交额比，暂不引入外部数据源。

### Phase 2：扩展结构资格系统

新增第一等的非标准结构家族：

- `extended`
- `channel`
- `range`
- `unfinished`
- `complex`

目标：

- 防止非标准结构冒充标准 A/B/C/D。
- 保留 `standard_candidate`。
- 增加边界字段和边界交易标记。

### Phase 3：交易资格内核

实现：

- `standard_node_trade`
- `conditional_boundary_trade`
- `wait_confirmation`
- `risk_control`
- `no_trade`

目标：

- 让交易权限确定化。
- 降级非标准结构的交易强度。
- 输出触发条件、失效条件和仓位规则。
- 把量能确认纳入突破 / 跌破 / 回踩确认和仓位升级规则。

### Phase 4：页面与 AI 契约迁移

更新 UI 和 AI payload，让它们消费 `trinity_decision`。

目标：

- 页面清楚展示规则链。
- AI 收到确定性结论和证据。
- 原始详情保留为 debug 数据，但不再作为主契约。

## 测试策略

### Python

新增测试覆盖：

- 标准结构 + 时空匹配 + 均线确认。
- 标准 `A五段式`：单一中继平台、前后趋势同向推进、5 笔 / 6 点。
- A 候选失败：出现第二个成熟平台 -> `B双平台式` 或 `延伸B`。
- A 候选失败：平台过大并主导结构 -> `延伸C` 或 `大平台震荡`。
- 标准 A 超限但单一中继平台原型仍成立 -> `延伸A`，禁止标准节点交易。
- 标准 `B双平台式`：双平台有效、分离度有效、连接段有效、9 笔 / 10 点。
- B 候选失败：9 笔但平台质量不成立 -> `复杂结构` 或 `未完成结构`。
- B 超限：双平台成立但点数超出标准窗口 -> `延伸B`，禁止标准节点交易。
- 双平台大面积重叠 -> `大平台震荡` 或 `延伸C`，不能输出标准 B。
- 标准 `C单平台式`：单一平台稳定、无趋势位移、5 笔 / 6 点。
- C 候选失败：多平台横向堆叠 -> `大平台震荡`。
- C 候选失败：平台后形成趋势中继 -> `A五段式` 或 `延伸A`。
- 单平台超限且箱体仍单一有效 -> `延伸C`；若升级为多平台横盘 -> `大平台震荡`。
- 标准 `D三段式`：无成熟平台、三段单边推进、3 笔 / 4 点。
- D 候选失败：三段后继续单边延伸 -> `延伸D`。
- D 候选失败：中间形成成熟平台 -> `A五段式`、`C单平台式` 或对应延伸结构。
- 单边超限且未形成成熟平台 -> `延伸D`；若演化为通道或平台 -> 改判对应结构。
- 标准结构 + 均线未确认 -> 等待。
- 标准结构 + 价格突破但量能未确认 -> 等待。
- 非标准延伸 C + 支持性时空 -> 条件化边界交易。
- 非标准通道 + 弱状态 / MA55 压制 -> 减仓或做 T。
- 非标准结构 + 放量突破边界 + MA55 支持 -> 条件化边界交易。
- 非标准结构 + 缩量突破边界 -> 等待确认。
- 放量跌破平台下沿 / MA55 -> 风险控制。
- 未完成结构 -> 只能等待。
- 极端时空不匹配 -> 降级。
- 五个级别各自输出合法的 `trinity_decision.level`：`weekly`、`daily`、`hour60`、`hour30`、`hour15`。
- 五个级别各自输出合法的结构资格、时空门控、均线门控和执行字段；缺失子模块时要有可解释降级，而不是静默缺字段。
- 级别矩阵：`weekly -> daily` 父子一致时允许升级、冲突时强制降级。
- 级别矩阵：`daily -> hour60` 父子一致时允许执行细化、冲突时降级为等待或轻仓。
- 级别矩阵：`daily -> hour30` 父子一致时允许执行细化、冲突时降级为等待或轻仓。
- 级别矩阵：`hour60 -> hour15` 父子一致时允许做 T / 微执行，冲突时禁止逆父级别放大仓位。
- 级别缺失场景：缺 `weekly`、缺 `hour60`、缺 `hour15` 时，系统仍能输出，但必须明确 `parent_unclear` / `child_missing` 类原因。
- `background_origin` 正确性：宏观原点在窗口内时要正确落点；在窗口外时不能偷换成窗口首点。
- `focus_origin` 正确性：主峰/主谷切片优先 `peak_extreme`，无峰谷时优先最近组件边界，再退回 `macro_origin`。
- `execution_origin` 正确性：应定位到最近可执行子结构锚点，不能错误复用 `background_origin` 或 `focus_origin`。
- 三类起点一致性：`background_origin`、`focus_origin`、`execution_origin` 允许不同，但必须满足语义分层，且返回明确来源说明。
- 标准结构必须从当前结构起点重新编号；延伸/复杂/未完成结构必须停止标准编号，只保留可解释锚点。
- 山峰 / 山谷场景下，`focus_origin` 应优先选择主峰 / 主谷，而不是图上最左侧可见点。
- 起点回退场景：没有峰谷、没有组件边界、窗口截断时，必须有稳定回退路径和可解释原因。

### TypeScript

新增测试覆盖：

- `stock-structure-types.ts` 类型契约。
- `TrinityDecision.level` 覆盖 `weekly`、`daily`、`hour60`、`hour30`、`hour15` 五个枚举值。
- AI payload 包含 `deterministic_decision`。
- 页面 view-model 能渲染结论、结构、时空、均线、量能、级别和执行区。
- AI payload 不遗漏交易资格、触发条件和失效条件。
- AI payload 不遗漏量能确认结果和量能对置信度的调整。
- AI payload 不遗漏 `background_origin`、`focus_origin`、`execution_origin` 及其来源说明。
- 页面 view-model 能正确展示“参考原点 / 聚焦起点 / 执行起点”，并处理“当前窗口未包含该原点”。
- 页面和 AI 不得把窗口首点误当作宏观原点，不得把 `focus_origin` 错映射为 `execution_origin`。
- `level_nesting` view-model / payload 必须覆盖父子一致、父子冲突、父级缺失三类状态。

### 测试文件落地清单

优先复用现有测试文件；只有当测试主题明显变成新内核契约时，才新增 `trinity_decision` 专项测试文件。

#### Python 测试文件

| 文件 | 类型 | 负责范围 |
| --- | --- | --- |
| `tests/test_trinity_decision_structure_qualification.py` | 新增 | 标准 A/B/C/D、延伸 A/B/C/D、通道、大平台、未完成、复杂结构的结构资格内核 |
| `tests/test_trinity_decision_levels.py` | 新增 | 五个级别 `weekly/daily/hour60/hour30/hour15` 的 `trinity_decision.level` 和单级输出契约 |
| `tests/test_trinity_decision_level_nesting.py` | 新增 | 父子级别矩阵、级别冲突降级、缺级别回退 |
| `tests/test_trinity_decision_origins.py` | 新增 | `background_origin`、`focus_origin`、`execution_origin` 三类起点正确性 |
| `tests/test_trinity_decision_trade_qualification.py` | 新增 | `standard_node_trade`、`conditional_boundary_trade`、`wait_confirmation`、`risk_control`、`no_trade` |
| `tests/test_stock_analyzer_render_payload.py` | 扩展 | 继续覆盖 focus-origin 回归、图形点位、窗口外原点不误映射 |
| `tests/test_structure_interpretation_model.py` | 扩展 | 解释模型携带三类起点、结构资格、降级原因 |
| `tests/test_structure_phase_execution.py` | 扩展 | 执行周期、仓位上限、级别权限与交易决策联动 |

建议测试函数：

```text
test_trinity_decision_level_contract_for_all_levels
test_trinity_decision_level_missing_parent_downgrades_with_reason
test_weekly_daily_alignment_allows_daily_upgrade
test_weekly_daily_conflict_forces_daily_downgrade
test_daily_hour60_alignment_allows_execution_refinement
test_daily_hour30_conflict_downgrades_to_wait_or_light_probe
test_hour60_hour15_conflict_blocks_micro_signal_position_upgrade
test_background_origin_inside_window_maps_to_point
test_background_origin_outside_window_not_mapped_to_first_visible_point
test_focus_origin_prefers_peak_extreme_for_mountain_peak
test_focus_origin_prefers_valley_extreme_for_valley
test_focus_origin_prefers_recent_component_without_peak
test_execution_origin_uses_recent_executable_child_anchor
test_origin_layers_can_differ_but_keep_source_reasons
test_standard_structure_restarts_numbering_from_focus_origin
test_extended_structure_stops_standard_numbering
```

#### TypeScript 测试文件

| 文件 | 类型 | 负责范围 |
| --- | --- | --- |
| `tests/trinity-decision-types.test.ts` | 新增 | `TrinityDecision`、结构类型、级别枚举、起点字段类型契约 |
| `tests/trinity-decision-view-model.test.ts` | 新增 | 页面主 view-model 对结论、结构、时空、均线、量能、级别、执行的展示契约 |
| `tests/ai-analysis-payload.test.ts` | 扩展 | AI payload 保留 `deterministic_decision`、三类起点、级别权限、交易资格 |
| `tests/structure-explainability-view-model.test.ts` | 扩展 | 参考原点、聚焦起点、执行起点、窗口外原点展示 |
| `tests/structure-explainability-panel.test.ts` | 扩展 | 页面可见区域展示三类起点和判定链 |
| `tests/stock-execution-view-model.test.ts` | 扩展 | 执行动作、仓位权限、触发条件、失效条件、级别降级展示 |

建议测试函数：

```text
test_trinity_decision_level_union_accepts_all_five_levels
test_ai_payload_includes_deterministic_decision_for_all_levels
test_ai_payload_preserves_background_focus_execution_origins
test_ai_payload_preserves_level_nesting_permission
test_view_model_renders_origin_layers_without_recomputing_them
test_view_model_marks_macro_origin_outside_window
test_view_model_does_not_use_focus_origin_as_execution_origin
test_level_nesting_payload_handles_aligned_conflict_and_missing_parent
test_execution_view_model_renders_downgraded_position_permission
test_structure_panel_renders_standard_and_extended_numbering_rules
```

#### HTTP 回归检查点

全级别 HTTP 回归不仅检查接口成功，还要抽样断言：

- `periods.weekly.trinity_decision.level == 'weekly'`
- `periods.daily.trinity_decision.level == 'daily'`
- `periods.hour60.trinity_decision.level == 'hour60'`
- `periods.hour30.trinity_decision.level == 'hour30'`
- `periods.hour15.trinity_decision.level == 'hour15'`
- 每个周期都包含 `structure.background_origin`、`structure.focus_origin`、`structure.execution_origin` 字段；没有可用起点时必须显式为 `null` 并给出原因。
- `level_nesting` 必须能解释父子级别权限，不允许只返回文本摘要。
- AI payload 必须包含同一份 `deterministic_decision`，页面和 AI 不再各自推断交易结论。

### HTTP 回归

凡是修改 `scripts/stock_analyzer.py`，必须保留 `CLAUDE.md` 要求的 HTTP 回归：

```bash
curl -s "http://localhost:5000/api/stock/analysis?code=300274&levels=weekly"
```

同时建议追加一次全级别回归，确认级别矩阵和起点字段没有在聚合响应里丢失：

```bash
curl -s "http://localhost:5000/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15"
```

如果本地 `5000` 被占用，可以使用项目既有 fallback `5001`，但必须明确说明端口差异。

## 迁移说明

第一阶段不删除现有字段：

- `structure`
- `interpretation`
- `execution_phase`
- `execution`
- `ma_physics`
- `breakthrough`
- `level_nesting`

`trinity_decision` 初期应从这些字段派生。稳定后，页面和 AI 再逐步迁移到以 `trinity_decision` 为主契约。

## 待确认决策

1. `trinity_decision` 只按周期输出，还是额外输出一个跨周期顶层总决策。
2. 通道和箱体边界检测第一阶段采用启发式斜率区间，还是直接用确认分型回归。
3. 仓位比例默认只按级别决定，还是同时纳入置信度和父级别权限。
4. 有了 `trinity_decision` 后，AI 是否还接收原始笔 / 分型，还是只接收压缩证据摘要。

## 验收标准

- 后端输出稳定的 `trinity_decision` 对象。
- 标准结构和非标准结构拥有不同交易模式。
- 非标准结构只能通过条件化边界规则交易。
- MA55 和 MACD 时空门控必须出现在最终决策里。
- 量能确认必须影响突破 / 跌破有效性、置信度和仓位权限。
- 级别嵌套权限可以降级子级别交易信号。
- 页面可以不做推断地展示整条规则链。
- AI payload 包含确定性结论、交易资格、触发条件、失效条件和风险标记。
