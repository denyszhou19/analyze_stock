# 结构原型降级、阶段层与执行层升级设计

## 背景

当前 `stock_analyzer` 对结构的表达以 `A五段式 / B双平台式 / C单平台式 / D三段式` 为中心。这个表达适合解释走势“像什么”，但不适合作为交易决策的唯一入口，因为未来并不会先天以某个完整结构的名义展开，实际交易更依赖当前环境、所处阶段、触发条件和失效条件。

项目已经具备完整的三位一体分析基础：

- `MACD` 六种时空状态，负责给出大级别环境和强弱偏向。
- `ABCD` 结构识别，负责用结构语言解释走势原型。
- `ma_physics / breakthrough`，负责给出均线支撑压制、牵引、共振，以及突破/跌破的形态质量。
- `level_nesting / multi_dimension_operation / trading_decision`，负责跨级别联动和总览建议。

问题在于，当前“结构标签 -> 预测下一段 -> 输出动作”的链条过强，容易让前端和 AI 误把结构标签当成交易开关，弱化了“未来路径未知，只能做条件交易”的实战逻辑。

## 目标

本次改造采用“方案 2”：

- 保留三位一体，不移除 `MACD`、`ABCD`、级别嵌套、均线物理、突破/跌破分析。
- 将 `ABCD` 从“交易主开关”降级为“结构原型语言”。
- 新增“阶段层 + 执行层”，让交易结论优先来自当前阶段、均线物理、突破形态、级别联动和失效条件。
- 保持后端、AI payload、分析页的兼容性，先增量接入，再逐步调整展示权重。

## 非目标

- 不推翻现有三位一体话语体系。
- 不删除现有 `structure_type / structure_stage / prediction` 字段。
- 不在本次设计中重写结构识别算法本身。
- 不强制把所有自然语言结论替换成概率模型。

## 总体设计

每个周期的分析结果保留原有字段，并在 `structure` 下新增三个层次：

1. `archetype`
   说明这段走势当前更像哪种结构原型，以及这个判断的成熟度和置信度。
2. `execution_phase`
   说明当前处于哪个交易阶段，服务于“现在走到哪一步了”的判断。
3. `execution`
   说明此刻能不能做、该做什么、等什么触发、什么情况失效。

顶层继续保留三位一体的级别嵌套分析，并升级 `level_nesting.trading_decision`，让它成为“综合执行建议总线”。

## 补充策略约束

以下策略不是可选说明，而是本次设计必须编码进字段和规则层的硬约束：

### 级别嵌套分析（三维度）

- 维度一：`weekly -> daily`
  - 用于判断大级别趋势方向。
- 维度二：`daily -> hour30`
  - 用于寻找具体买卖点。
- 维度三：`hour60 -> hour15`
  - 用于日内或短线操作。

总原则：

- 分析自上而下。
- 交易自下而上。

这意味着：

- `weekly / daily` 决定环境偏向和是否允许进攻。
- `hour30 / hour15` 决定是否满足执行触发。
- 顶层 `trading_decision` 必须同时暴露主导级别和执行级别，避免“只看小级别就贸然交易”。

### 补仓/做T原则

- 15 分钟反弹：最多补总仓位的 `1/4`。
- 30 分钟反弹：最多补总仓位的 `1/3`。
- 60 分钟或日线反弹：最多补总仓位的 `1/2`。
- 多头排列只做正 T。
- 空头排列只做反 T。
- 做 T 以快进快出为原则，最多按 `3` 个点的短线收益预期执行“见好就收”。

### 仓位管理铁律

#### 起手与加仓法则

- 起手仓位用于轻仓试探，优先出现在：
  - `C` 类中枢底部试仓。
  - 突破回踩后的首个确认点。
- 加仓遵循正金字塔递减法则：
  - 第一次加仓：不超过起手仓位的 `100%`。
  - 第二次加仓：不超过第一次加仓的 `50%`。
  - 第三次加仓：不超过第二次加仓的 `50%`。
- 追加筹码必须发生在“浮盈 + 有效突破 + 更强状态确认”之后，不允许逆势摊低成本。

#### 固定止损铁律

- 依据什么级别建仓，就必须依据什么级别止损。
- 若基于日线结构建仓，则日线破位必须触发日线级别止损。
- 严禁在原建仓级别失效后，擅自放大到更高级别寻找“新支撑位”来自我安慰式死扛。

#### 右侧补仓铁律

- 禁止左侧补仓，不允许在下跌半山腰摊平。
- 右侧补仓必须同时满足：
  - 价格完成 `V` 型反转。
  - 有效突破 `MA55`。
  - 或者出现确认的日线底分型。
- 补仓资金必须单独具备止损止盈计划。
- 补仓额度仍受执行级别限制，遵守 `15m=1/4`、`30m=1/3`、`60m/日线=1/2` 的上限。

#### 倒金字塔跟踪止盈

- 触发条件优先为：
  - `A` 类结构末端（如 `a5-a6`）。
  - `B` 类结构末端（如 `b9`）。
  - 同时伴随 15/30 分钟顶背离。
- 止盈采用倒金字塔：
  - 首次抛售较大比例利润筹码。
  - 后续随着回落逐步减少抛售量。
  - 保留底仓以应对“时间换空间”的横盘继续上行。

## 数据模型

### 单周期结构层

现有 `structure` 字段保留：

- `structure_type`
- `structure_stage`
- `trend_direction`
- `inflection_points`
- `segment_count`
- `description`
- `structure_details`

新增字段：

```ts
structure: {
  structure_type: string;
  structure_stage: string;
  trend_direction: string;
  inflection_points: number;
  segment_count: number;
  description: string;
  structure_details?: Record<string, unknown>;

  archetype: {
    primary: 'A五段式' | 'B双平台式' | 'C单平台式' | 'D三段式' | '复杂结构' | '结构未完成';
    maturity: 'early' | 'mid' | 'late';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    alternatives: Array<{
      type: string;
      confidence: number;
      reason: string;
    }>;
  };

  execution_phase: {
    code:
      | 'trend_launch'
      | 'platform_building'
      | 'breakout_attempt'
      | 'pullback_confirm'
      | 'trend_continuation'
      | 'correction_in_progress'
      | 'exhaustion_risk';
    label: string;
    bias: 'bullish' | 'bearish' | 'neutral';
    tradable: boolean;
    maturity: 'early' | 'mid' | 'late';
    reason: string;
  };

  execution: {
    can_trade: boolean;
    action: 'buy' | 'sell' | 'hold' | 'wait' | 'reduce' | 'add';
    direction: 'long' | 'short' | 'neutral';
    setup_quality: 'A' | 'B' | 'C' | 'avoid';
    rationale: string;
    timing_timeframe?: 'daily' | 'hour60' | 'hour30' | 'hour15';
    timeframe_cap_ratio?: number;
    trigger: string[];
    invalidation: string[];
    confirmation: string[];
    entry_style: 'breakout_follow' | 'pullback_confirm' | 'platform_reversal' | 'trend_hold' | 'wait';
    position_sizing: {
      starter: string;
      initial: string;
      add_on: string;
      max: string;
      pyramid_rule: {
        model: 'positive_pyramid';
        add_step_rules: string[];
      };
    };
    t_trade_rule: {
      mode: 'positive_only' | 'negative_only' | 'disabled';
      max_quick_take_profit_points: number;
    };
    risk_rules: {
      stop_loss_basis: 'same_timeframe';
      no_timeframe_upcast_after_break: true;
      no_left_side_averaging_down: true;
      right_side_add_only: true;
      right_side_add_conditions: string[];
    };
    take_profit_plan: {
      model: 'inverted_pyramid' | 'none';
      triggers: string[];
      ladder: string[];
      keep_runner: boolean;
    };
    key_levels: Array<{
      price: number;
      type: 'entry' | 'add' | 'stop' | 'support' | 'resistance' | 'target';
      note: string;
    }>;
    risk_flags: string[];
    wait_reason?: string;
  };
}
```

### 顶层执行总线

升级 `level_nesting.trading_decision`，保留旧字段并新增稳定字段：

```ts
trading_decision: {
  decision_type: '加仓' | '做T' | '观望';
  t_type: '正T' | '反T' | '突破做T' | '接刀子做T' | null;
  core_questions: Record<string, unknown>;
  analysis: string;
  action_hint: string;

  can_trade: boolean;
  action: 'buy' | 'sell' | 'hold' | 'wait' | 'reduce' | 'add';
  direction: 'long' | 'short' | 'neutral';
  setup_quality: 'A' | 'B' | 'C' | 'avoid';
  rationale: string;
  analysis_order: 'top_down';
  execution_order: 'bottom_up';
  primary_timeframe: 'weekly' | 'daily' | 'hour60' | 'hour30' | 'hour15';
  timing_timeframe: 'daily' | 'hour60' | 'hour30' | 'hour15';
  timeframe_cap_ratio: number;
  trigger: string[];
  invalidation: string[];
  confirmation: string[];
  position_sizing: {
    starter: string;
    initial: string;
    add_on: string;
    max: string;
    pyramid_rule: {
      model: 'positive_pyramid';
      add_step_rules: string[];
    };
  };
  t_trade_rule: {
    mode: 'positive_only' | 'negative_only' | 'disabled';
    max_quick_take_profit_points: number;
  };
  risk_rules: {
    stop_loss_basis: 'same_timeframe';
    no_timeframe_upcast_after_break: true;
    no_left_side_averaging_down: true;
    right_side_add_only: true;
    right_side_add_conditions: string[];
  };
  take_profit_plan: {
    model: 'inverted_pyramid' | 'none';
    triggers: string[];
    ladder: string[];
    keep_runner: boolean;
  };
  key_levels: Array<{
    price: number;
    type: string;
    note: string;
  }>;
  risk_flags: string[];
  wait_reason?: string;
}
```

## 规则定义

### `archetype` 的职责

`archetype` 只回答“更像什么结构原型”，不再回答“因此就该交易”。

推导来源：

- 现有 `structure_type`
- `structure_stage`
- `macro_components`
- `trend_direction`
- `stroke_count`
- `inflection_count`

基本规则：

- `primary` 直接复用当前结构分类结果。
- `maturity` 根据 `inflection_count`、`segment_count` 和 `structure_stage` 粗分为 `early / mid / late`。
- `confidence` 根据宏观组件形态是否清晰、是否存在峰值切片覆盖、是否落入复杂结构决定。
- `reason` 用一句话解释当前结构标签的直接来源，例如 `Directional -> Platform`、`Platform -> Directional`、`Platform + Directional + Platform`。
- `alternatives` 仅提供 1-2 个替代候选，不做复杂概率建模。

### `execution_phase` 的职责

`execution_phase` 回答“现在走到哪个交易阶段”，不是时空状态，也不是结构标签。

阶段集合：

- `trend_launch`
- `platform_building`
- `breakout_attempt`
- `pullback_confirm`
- `trend_continuation`
- `correction_in_progress`
- `exhaustion_risk`

推导来源：

- `macd.status`
- `moving_averages`
- `ma_physics.support_pressure / traction / resonance`
- `breakthrough.pattern_type / direction / is_valid / confidence`
- `structure.trend_direction`
- `structure.structure_details.strokes`
- `structure.structure_details.prediction`
- `level_nesting.spacetime_confirmation`
- `multi_dimension_operation`

优先级从高到低：

1. `exhaustion_risk`
2. `pullback_confirm`
3. `breakout_attempt`
4. `platform_building`
5. `correction_in_progress`
6. `trend_continuation`
7. `trend_launch`

命中原则：

- 背离明显、偏离 MA55 过大、结构末端、突破后远离均线且未确认，优先判 `exhaustion_risk`。
- `回抽突破 / 回抽跌破`，且 MA55/MA233 角色未失效，优先判 `pullback_confirm`。
- 正在突破/跌破关键边界但确认不足，判 `breakout_attempt`。
- 平台主导、边界未破，判 `platform_building`。
- 大方向仍在但当前是逆向修正，判 `correction_in_progress`。
- 突破确认已完成并顺趋势运行，判 `trend_continuation`。
- 刚从关键位置启动，尚未进入中继或延续，判 `trend_launch`。

### `execution` 的职责

`execution` 是单周期交易摘要层，只回答：

- 现在能不能做。
- 主动作是什么。
- 等什么触发。
- 何时失效。

推导顺序：

1. 大级别环境是否放行：
   - `macd.status`
   - `level_nesting`
   - `spacetime_confirmation`
2. 当前阶段是否可执行：
   - `execution_phase`
3. 均线物理是否支持：
   - `ma_physics.support_pressure`
   - `ma_physics.traction`
   - `ma_physics.resonance`
4. 突破/跌破形态质量：
   - `breakthrough.pattern_type`
   - `direction`
   - `is_valid`
   - `confidence`
5. 结构原型只做辅助解释：
   - `archetype`

基础判定规则：

- `can_trade = true`
  - 常见于 `pullback_confirm / trend_continuation`
  - 或者趋势环境明确、结构未破、执行触发已具备。
- `can_trade = false`
  - 常见于 `platform_building / breakout_attempt（未确认） / exhaustion_risk`
  - 或者时空和均线条件相互冲突，缺少执行优势。

动作建议：

- `buy`
  - 允许试仓或开多。
- `add`
  - 已有仓位可顺势加仓。
- `hold`
  - 已有仓位继续持有，不适合新开仓。
- `reduce`
  - 优先减仓、锁利润、防守。
- `sell`
  - 偏离场、止损或顺势卖出。
- `wait`
  - 等明确触发，不贸然操作。

`setup_quality` 规则：

- `A`
  - 时空、均线、阶段、突破质量高度一致。
- `B`
  - 大方向和阶段可行，但仍缺一层确认。
- `C`
  - 仅适合轻仓试错。
- `avoid`
  - 明确不适合出手。

### 级别嵌套与执行顺序

顶层 `trading_decision` 必须明确：

- `analysis_order = top_down`
- `execution_order = bottom_up`
- `primary_timeframe`
  - 当前判断环境和主方向所依赖的主导级别。
- `timing_timeframe`
  - 当前寻找具体执行触发的执行级别。

默认语义：

- `weekly -> daily`：大趋势与波段环境。
- `daily -> hour30`：最核心的买卖点触发层。
- `hour60 -> hour15`：日内与短线优化层。

如果主导级别与执行级别冲突，`execution` 默认降级为保守：

- `can_trade = false`
- 或者 `setup_quality` 至多为 `C`
- 并通过 `wait_reason` 明确指出冲突来自哪个维度。

### 补仓与做 T 规则落地

执行层必须把“补仓比例”和“做 T 方向限制”结构化表达出来。

补仓比例映射：

- `timing_timeframe = hour15` -> `timeframe_cap_ratio = 0.25`
- `timing_timeframe = hour30` -> `timeframe_cap_ratio = 0.3333`
- `timing_timeframe = hour60` 或 `daily` -> `timeframe_cap_ratio = 0.5`

做 T 规则映射：

- 多头排列 -> `t_trade_rule.mode = positive_only`
- 空头排列 -> `t_trade_rule.mode = negative_only`
- 条件不充分 -> `t_trade_rule.mode = disabled`
- `t_trade_rule.max_quick_take_profit_points = 3`

### 仓位管理与风控规则落地

#### 起手仓位与正金字塔加仓

`position_sizing` 必须编码：

- `starter`
  - 用于表达起手试仓位。
- `pyramid_rule.model = positive_pyramid`
- `pyramid_rule.add_step_rules`
  - 至少包含：
    - 第一次加仓 `<= 起手仓位 100%`
    - 第二次加仓 `<= 第一次加仓 50%`
    - 第三次加仓 `<= 第二次加仓 50%`

只有在以下条件同时较优时，才允许 `action = add`：

- 当前已有浮盈。
- 出现有效突破或回抽确认。
- 时空状态未转弱。

#### 同级别止损

`risk_rules` 必须固定表达：

- `stop_loss_basis = same_timeframe`
- `no_timeframe_upcast_after_break = true`

解释原则：

- 日线建仓失败，必须按日线止损。
- 30 分钟建仓失败，必须按 30 分钟止损。
- 不允许在原有建仓级别失效后，转去周线/月线找理由继续持有。

#### 禁止左侧补仓，仅允许右侧补仓

`risk_rules` 必须固定表达：

- `no_left_side_averaging_down = true`
- `right_side_add_only = true`
- `right_side_add_conditions`
  - 至少包含：
    - `V` 型反转
    - 有效突破 `MA55`
    - 或确认的日线底分型

若上述条件不满足，即便未触发绝对止损，也不允许生成“补仓”结论。

#### 倒金字塔跟踪止盈

`take_profit_plan` 必须支持：

- `model = inverted_pyramid`
- `triggers`
  - 至少支持：
    - `A` 类末端
    - `B` 类末端
    - 15/30 分钟顶背离
- `ladder`
  - 用于表达分批止盈比例，例如：
    - 首抛 `50%`
    - 二抛 `30%`
    - 三抛 `15%`
- `keep_runner = true`
  - 表达保留底仓让利润奔跑。

### 执行层关键字段来源

- `trigger`
  - 来自突破确认、回抽确认、平台边界、次级别止跌/止涨条件。
- `invalidation`
  - 来自最近确认分型、平台边界失守、MA55/MA233 失效、假突破回落。
- `confirmation`
  - 来自次级别 D 结构、MACD 共振、时空确认等加分项。
- `key_levels`
  - 汇总 `prediction.key_price_levels`、最近确认分型、平台上下沿、MA55/MA233、突破关键位。
- `timeframe_cap_ratio`
  - 来自执行级别对应的补仓比例上限。
- `risk_rules`
  - 来自同级别止损、禁止左侧补仓、只做右侧补仓等硬规则。
- `take_profit_plan`
  - 来自结构末端 + 小级别背离触发的倒金字塔止盈模型。

## 与现有代码的集成方式

### 后端分析器

主文件：

- `scripts/stock_analyzer.py`

新增 helper：

- `_build_structure_archetype(...)`
- `_detect_execution_phase(...)`
- `_build_period_execution(...)`

接线方式：

- 在 `analyze_single_period()` 内，现有 `ma_analysis / macd / structure / ma_physics / breakthrough` 全部产出后，补充 `structure.archetype / structure.execution_phase / structure.execution`。
- `detect_structure()` 仍保留现有分类逻辑，不被本次设计直接重写。

### 顶层交易决策

复用并升级：

- `analyze_trading_decision()`

新增稳定字段，但不删除旧字段。

同时修正当前实现中的一个数据接线问题：

- `analyze_trading_decision()` 当前尝试从 `results.get('nesting_analysis', {})` 读取 `spacetime_confirmation`，但传入的 `results` 不包含这个键。
- 本次改造需要改成显式传参，或者在 `analyze_level_nesting()` 内部直接把 `spacetime_confirmation` 传给 `analyze_trading_decision()`，避免时空确认结果失效。

### AI payload

主文件：

- `src/lib/ai-analysis-payload.ts`
- `src/app/api/stock/ai-analysis/route.ts`

新增提炼字段：

- `structure.archetype`
- `structure.execution_phase`
- `structure.execution`
- 顶层 `level_nesting.trading_decision` 的新稳定字段

Prompt 调整原则：

- 明确说明 `ABCD` 是结构原型，不是未来必然完成的事实。
- 优先解释和引用：
  - `level_nesting.trading_decision`
  - `period.structure.execution`
  - `period.structure.execution_phase`
  - `ma_physics / breakthrough`
- `archetype` 只做背景说明，不得单独作为交易开关。

### 前端分析页

主文件：

- `src/app/stock/[code]/analysis/page.tsx`

展示优先级调整：

1. `当前阶段`
   - 显示 `execution_phase.label`
2. `执行建议`
   - 显示 `execution.action / setup_quality / can_trade`
   - 展示触发条件、失效条件、关键价位
3. `结构原型`
   - 显示 `archetype.primary / confidence / reason / alternatives`
4. `结构诊断`
   - 继续展示原有拓扑图和判断依据，但作为辅助解释

兼容策略：

- 第一阶段保留 `structure_type / structure_stage / prediction` 的原位置，新增“当前阶段 / 执行建议”区块。
- 第二阶段将 `ABCD` 标题从“结构类型”降级为“结构原型”，并下调其视觉优先级。

## 错误处理

### 数据不全

- 若某周期缺少 `MA55 / MA233 / breakthrough / structure_details`，则 `execution_phase` 允许降级到更保守的 `platform_building / correction_in_progress`，并通过 `execution.action = wait` 表达“暂不操作”。
- `execution` 在信息不足时必须返回稳定值：
  - `can_trade = false`
  - `action = wait`
  - `setup_quality = avoid`
  - `wait_reason` 明确说明缺少哪类确认。

### 结构与执行冲突

允许出现以下场景：

- `archetype = A五段式`
- `execution_phase = exhaustion_risk`
- `execution.action = reduce`

这是允许且合理的。因为结构原型和执行阶段回答的是不同问题，不要求它们在文字上完全同向。

### 旧字段兼容

- `prediction` 暂不删除。
- 旧前端和旧 AI 如果仍使用旧字段，不应因新字段加入而报错。
- 新字段加入后，必须保证旧字段含义不被破坏。

## 验证方案

### Python

新增测试文件：

- `tests/test_structure_phase_execution.py`

覆盖场景：

- 平台整理
- 突破尝试
- 回抽确认
- 趋势延续
- 修正进行中
- 衰竭风险
- 弱势反弹

验证点：

- `archetype` 输出完整
- `execution_phase` 单值稳定
- `execution` 返回固定字段，不缺键
- 数据不足时能稳定降级到 `wait`

### TypeScript

扩展：

- `tests/ai-analysis-payload.test.ts`

验证点：

- payload 包含 `archetype / execution_phase / execution`
- 旧重字段仍被正确裁剪
- AI 决策 payload 优先携带新执行信息

### 手工回归

使用 2-3 只真实股票做对比：

- 改造前：是否过度依赖 `ABCD` 叙事
- 改造后：是否更多输出“当前阶段 / 等什么 / 哪里失效”
- 前端是否更容易看懂“现在能不能做”

## 实施顺序

### Phase 1：后端加字段

- 为单周期结构补 `archetype / execution_phase / execution`
- 升级 `level_nesting.trading_decision`
- 不先改大规模 UI

### Phase 2：AI 改消费重点

- payload 和 prompt 优先消费执行层
- `ABCD` 仅作背景解释

### Phase 3：前端重排展示

- 新增“当前阶段 / 执行建议”
- 将 `ABCD` 视觉降级为“结构原型”

### Phase 4：缩减旧 `prediction` 中心地位

- 保留兼容，但不再作为主要决策依据

## 成功标准

- 前端打开分析页时，用户首先看到“当前阶段 + 执行建议”，而不是只看到结构标签。
- AI 报告优先引用执行层，不再把 `A/B/C/D` 当作交易的唯一依据。
- 三位一体被保留，并通过“时空环境 + 结构原型 + 当前阶段 + 执行动作”形成更完整的闭环。
- 新字段加入后，旧字段和旧页面不报错，现有调用链可逐步迁移。
