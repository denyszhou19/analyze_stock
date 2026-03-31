# 结构背景、原型与当前段判读模型设计

## 背景

现有分析页已经把 `structure.archetype / execution_phase / execution` 和结构拓扑图打通，但在真实阅读中仍有一个更基础的认知问题没有解决：

- 页面只展示一个 `trend_direction`，却同时承担了“大级别背景方向”“当前聚焦结构方向”“当前正在走的最后一段方向”三种不同语义。
- 在峰值切片场景中，`structure_start_point_id` 已经切到右侧结构起点，但 `trend_direction` 仍可能来自更大范围的背景判断，导致用户看到“起点明明从峰顶开始，标签却写上涨”。
- `A/B/C/D` 仍被用户自然理解为“已经发生的事实”，而不是“对进行中结构的原型判断”，这会把未完成结构误读成确定结论。

阳光电源周线是典型案例：

- 大级别仍保留上涨背景。
- 当前聚焦对象是峰值 `209.88` 之后的右侧结构。
- 当前正在走的是 `c3 -> live` 的下行尾段。
- 页面却同时显示 `C单平台式 + 上涨`，造成认知冲突。

本 spec 不继续在旧的 explainability/UI spec 上打补丁，而是补一份更聚焦的结构判读模型 spec，专门解决：

1. 大级别背景怎么定义。
2. `A/B/C/D` 原型在进行中阶段怎么表达，不把“候选”说成“完成”。
3. 当前段、下一确认、改判路径怎么稳定建模并上屏。

## 目标

- 把 `大级别背景`、`聚焦结构原型`、`当前执行段` 三层语义彻底拆开。
- 让 `A/B/C/D` 在未完成时明确显示为“原型候选 / 开展中 / 已确认 / 已完成”，而不是单值定论。
- 让页面能够同时回答三件事：
  - 现在的大级别背景偏什么。
  - 当前这轮结构更像什么原型。
  - 眼下正在走哪一段，下一步等什么确认。
- 为峰值切片、谷底切片和普通全结构视图提供统一语义。

## 非目标

- 本次不重写底层分型、笔和宏观组件识别算法。
- 本次不重写 `execution_phase / execution` 的交易规则。
- 本次不要求一次性完成所有后端改造和 UI 落地，但数据模型必须足够稳定，后续不推倒重来。
- 本次不引入“预测未来一定走成 A/B/C/D”的表述，所有结构只定义为当前最优原型判断。

## 设计依据

本设计采用两类基础原则：

- 经典趋势分析：
  趋势由峰谷序列定义。更高高点与更高低点构成上升趋势，更低高点与更低低点构成下降趋势，水平区间应视为整理而非趋势延续。
- 缠论结构分析：
  结构建立在确认拐点、分型、笔和走势类型之上；进行中的结构只能做类型归纳，不能把未完成结构当成已完成事实。

参考资料：

- Fidelity, Basic concepts of trend
- Fidelity, Pivot Points (High/Low)
- ChanLuns 缠论基础教程 / 走势分类相关页面

## 核心原则

### 1. 一个方向标签不再承载所有语义

后端与前端不得再仅依赖单个 `trend_direction` 描述整体结构。

统一拆成三层：

1. `macro_background`
   - 回答“大级别背景偏多、偏空还是整理”。
2. `focus_structure`
   - 回答“当前聚焦结构更像哪类原型”。
3. `current_leg`
   - 回答“眼下正在走的最后一段向上还是向下”。

### 2. `A/B/C/D` 是原型，不是未来必然完成的事实

任何 `A/B/C/D` 判断都必须带有成熟度状态：

- `candidate`
  已出现原型轮廓，但远未定型。
- `developing`
  当前最像该原型，内部结构正在展开。
- `confirmed`
  已满足该原型的标准关键点数量，结构已被确认。
- `completed`
  原型已完整走完，等待后续新结构承接。
- `invalidated`
  原型被破坏或升级/降级为其他原型。

没有成熟度状态的 `A/B/C/D` 标签，视为不合格输出。

### 3. 起点必须标明“是哪一层的起点”

至少存在三种合法起点：

- `macro_origin`
  大级别有效区间的原点。
- `focus_origin`
  当前聚焦结构的第一个确认拐点。
- `current_leg_origin`
  当前正在形成的最后一段起点。

页面主展示默认突出 `focus_origin`，但当 `focus_mode != full_range` 时，必须补充说明这不是大级别背景原点。

### 4. 进行中尾段不能伪装成“已确认新拐点”

实时最新价只能是 `live_point`，不能直接占用下一个正式编号。

例如：

- `c3` 是最后确认拐点。
- `c3 -> live` 是当前进行段。
- 只有当新的顶/底分型被确认后，`live` 才能升级成 `c4`。

否则会出现“图上已经画出 c4，但文字还说下一步等 c4”的自相矛盾。

## 总体数据模型

在 `structure` 下新增或升级以下模型层：

```ts
type StructureInterpretation = {
  macro_background: {
    direction: 'bullish' | 'bearish' | 'range' | 'mixed';
    label: '偏多' | '偏空' | '整理' | '混合';
    confidence: 'low' | 'medium' | 'high';
    basis: string[];
  };

  focus_structure: {
    focus_mode: 'full_range' | 'peak_slice_right' | 'valley_slice_right';
    archetype_family: 'A' | 'B' | 'C' | 'D' | 'complex' | 'unfinished';
    archetype_label: string;
    maturity: 'candidate' | 'developing' | 'confirmed' | 'completed' | 'invalidated';
    directional_bias: 'up' | 'down' | 'range' | 'two_way';
    summary: string;
    start_anchor: {
      point_id: string | null;
      price: number | null;
      date: string | null;
      semantic: 'focus_origin';
    };
    reference_origin?: {
      point_id: string | null;
      price: number | null;
      date: string | null;
      semantic: 'macro_origin';
    } | null;
    display_reason: string;
  };

  current_leg: {
    last_confirmed_point_id: string | null;
    live_point_id: 'live' | null;
    from_point_id: string | null;
    to_point_id: string | 'live' | null;
    direction: 'up' | 'down' | 'flat' | 'unknown';
    status: 'forming' | 'confirmed' | 'absent';
    label: string;
  };

  next_confirmation: {
    type: 'pivot' | 'breakout' | 'breakdown' | 'completion' | 'direction_choice';
    label: string;
    trigger: string;
    target_point_id?: string | null;
  } | null;

  scenario_paths: Array<{
    code: string;
    label: string;
    trigger: string;
    effect: string;
  }>;
};
```

说明：

- `macro_background` 取代现有单一 `trend_direction` 的背景职责。
- `focus_structure` 回答“当前最像什么”，不是“已经铁定是什么”。
- `current_leg` 单独描述最后一段。
- `next_confirmation` 只表达“下一步等什么确认”，不再假装预测唯一未来。
- `scenario_paths` 提供上破/下破后的改判路径，解决“如果最后一笔涨上去怎么办”的问题。

## 背景层判定规则

### 1. `macro_background` 的职责

`macro_background` 回答的是：

- 大级别环境更偏多还是偏空。
- 当前聚焦结构是发生在强背景顺势中，还是发生在反向修正中。

它不回答当前最后一段涨跌。

### 2. `macro_background` 的默认判定依据

默认至少综合以下三类证据：

1. 均线系统
   - 价格相对 `MA55 / MA233` 的位置
   - `MA55` 与 `MA233` 的相对关系
2. 最近确认峰谷序列
   - 是否仍保持更高高点/更高低点
   - 是否已转为更低高点/更低低点
3. 有效区间原点到当前的结构破坏程度
   - 是否只是修正
   - 是否已破坏上升/下降骨架

### 3. `macro_background` 的输出规则

- 满足“价格在 MA55/MA233 上方 + MA55 在 MA233 上方 + 关键低点未系统性下破”时，优先输出 `bullish / 偏多`。
- 满足“价格在 MA55/MA233 下方 + MA55 在 MA233 下方 + 关键高点持续下移”时，优先输出 `bearish / 偏空`。
- 若峰谷序列和均线关系相互冲突，输出 `mixed / 混合`。
- 若价格在显著水平区间反复震荡，输出 `range / 整理`。

### 4. 阳光电源周线案例

截至 `2026-03-27`：

- 价格 `163.35` 在 `MA55=118.57` 与 `MA233=85.61` 上方。
- 均线仍是 `MA55 > MA233`。
- 峰值后虽有回撤，但未把更大级别背景彻底打成空头骨架。

因此更合理的表达是：

- `macro_background = 偏多`
- 而不是“当前聚焦结构 = 上涨”

## 聚焦结构层判定规则

### 1. `focus_mode`

聚焦模式分为：

- `full_range`
  直接看当前窗口内的完整结构。
- `peak_slice_right`
  从峰值右侧切片，只看峰值后的战术结构。
- `valley_slice_right`
  从谷值右侧切片，只看谷值后的战术结构。

当 `focus_mode != full_range` 时，必须同时满足：

- `focus_origin` 只代表当前聚焦结构起点。
- `display_reason` 说明“该起点不等于大级别原点”。

### 2. `A/B/C/D` 的统一成熟度框架

所有原型统一遵守：

- `candidate`
  只说明“目前更像”。
- `developing`
  说明“当前正在按该原型展开”。
- `confirmed`
  说明“关键点数已满足，结构被确认，但仍可能处在该结构的尾段或刚确认状态”。
- `completed`
  说明“标准结构已走完，且后续承接结构的首个确认锚点已出现，可以作为上一个结构归档”。
- `invalidated`
  说明“原型被破坏，或被升级/降级为其他原型”。

补充约束：

- 实时分析页面中的进行中结构，优先使用 `candidate / developing / confirmed`。
- `completed` 更适合用于回顾视图或结构已经完成交棒的场景。

### 3. A 原型规则

`A` 定义为趋势推进原型，强调方向推进而非平台重叠。

- `directional_bias`
  默认为 `up` 或 `down`，不应输出 `range`
- `candidate`
  已出现明显推进型骨架，但标准 `6` 个拐点尚未凑齐
- `developing`
  结构中段展开，主推进浪特征最明显
- `confirmed`
  达到 `5` 笔 `6` 拐点，仍保持推进式高低点关系
- `invalidated`
  若中段演化为显著平台重叠，则降级为 `C` 或复合结构

### 4. B 原型规则

`B` 定义为双平台原型，关键是两个平台段而非单次推进。

- `directional_bias`
  默认为 `range` 或 `two_way`
- `candidate`
  第一平台已形成，并出现通向第二平台的过渡段
- `developing`
  第二平台正在形成，但整体尚未完成
- `confirmed`
  达到标准双平台关键点数量，且两个平台关系成立
- `invalidated`
  若双平台收缩为单平台，则降级为 `C`
  若平台结束后持续单边推进，则升级为 `A` 或延伸结构

### 5. C 原型规则

`C` 定义为单平台整理原型，不默认等于“后面必涨”或“后面必跌”。

- `directional_bias`
  默认为 `range`
- `candidate`
  至少出现三个以上确认拐点，并形成可识别的重叠区间
- `developing`
  平台内部来回震荡，边界逐渐清晰，但尚未完成标准点数
- `confirmed`
  标准单平台关键点数量满足
- `invalidated`
  若上沿被有效突破并演化为推进结构，可升级为 `A`
  若下沿被有效跌破并演化为顺向杀跌，可升级为下行推进或复合下跌结构

重点：

- `C` 的“横盘”是结构属性，不是方向预测。
- “当前段向下”与“整体原型是 C”可以同时成立。

### 6. D 原型规则

`D` 定义为最小完整修正/反击原型。

- `directional_bias`
  取决于 `d1 -> d4` 的整体方向
- `candidate`
  已出现 `d1-d2-d3` 轮廓，但 `d4` 还未确认
- `developing`
  当前正处于 `d3 -> live` 的形成过程
- `confirmed`
  `d4` 被确认后，形成标准最小完整结构
- `invalidated`
  若 `d4` 后继续扩展成平台或更大级别推进，则升级为 `C`、`A` 或复合结构

## 当前段与下一确认规则

### 1. 当前段的定义

`current_leg` 统一定义为：

- 从最后一个确认拐点出发，
- 指向最新实时点 `live`，
- 表示当前正在形成、但尚未确认的最后一段。

因此：

- `current_leg = c3 -> live`
- 不等于 `next_segment_preview = c3 -> c4`

只有当 `live` 形成确认拐点后，`current_leg` 才能升级为 `c3 -> c4` 的已确认段。

### 2. `next_confirmation` 的定义

`next_confirmation` 不再表达“下一步一定到哪个编号点”，而表达：

- 下一步等什么确认
- 这个确认一旦发生，会把结构推进到哪里

例如：

- `等待 c4 顶/底分型确认`
- `等待上破平台上沿`
- `等待跌破平台下沿`

### 3. `scenario_paths`

对于进行中结构，必须同时输出至少两个场景：

- 主场景
- 反向场景

例如 `C` 平台进行中：

- `up_break`
  - `trigger`: 有效站回平台上沿并突破关键高点
  - `effect`: 平台向上突破，原型可能升级为 `A`
- `down_break`
  - `trigger`: 有效跌破平台下沿
  - `effect`: 平台破坏，转入下行延续或更大级别下跌结构

这样可以稳定回答：

- “如果最后一笔涨上去了怎么办？”
- “如果最后一笔跌下去了怎么办？”

而不是强行给出单一路径。

## UI 展示规则

### 1. 拓扑区的 badge 重排

结构区顶部不再同时展示：

- `C单平台式`
- `上涨`

这样的二元组合。

改为展示三枚不同职责的 badge：

1. `背景`
   - 例如：`偏多`
2. `原型`
   - 例如：`C平台原型`
   - 同时带成熟度，如 `开展中`
3. `当前段`
   - 例如：`c3→live 下行`

### 2. 起点展示规则

页面至少展示：

- `当前结构起点`
- `当前段`
- `下一确认`

在 `peak_slice_right / valley_slice_right` 场景下，还应在说明区补充：

- `背景原点`
- `当前结构起点仅用于右侧聚焦，不代表整段趋势起点`

### 3. 原型卡职责

原型卡不再只显示 `A/B/C/D` 名称。

至少同时展示：

- 原型标签
- 成熟度
- 改判条件

例如：

- `C平台原型`
- `开展中`
- `上破上沿可升级为 A；下破下沿转下行延续`

### 4. 当前段与下一确认文案

页面主文案统一为：

- `当前段`
  - `c3 → live，下行形成中`
- `下一确认`
  - `等待 c4 确认`
- `改判路径`
  - `上破 181.99/209.88：向上突破`
  - `下破 141.10：平台破坏`

## A/B/C/D 的统一验收口径

### 1. 所有原型都必须可回答

任何标准原型都必须能稳定回答以下问题：

1. 大级别背景偏什么。
2. 当前聚焦结构起点在哪里。
3. 当前最像哪类原型。
4. 这个原型是候选、开展中，还是已确认。
5. 当前段正在向哪边走。
6. 下一步等什么确认。
7. 上破/下破后如何改判。

### 2. 未完成结构不得冒充“已完成结构”

若标准关键点数量未满足：

- 不得只展示 `A五段式 / B双平台式 / C单平台式 / D三段式`
- 必须带成熟度状态
- 必须允许改判

### 3. 进行中尾段不得占用正式编号

若最后一段仍在形成：

- 图上终点必须是 `live`
- 正式编号不得提前前移
- `current_leg` 与 `next_confirmation` 不得互相冲突

### 4. 阳光电源周线案例验收

以 `300274` 周线、截至 `2026-03-27` 为例，页面至少应达到：

- 显示 `背景：偏多`
- 显示 `聚焦：峰值后右侧 C 平台原型`
- 显示 `成熟度：developing / 开展中`
- 显示 `当前结构起点：c1 @ 209.88`
- 显示 `当前段：c3 -> live，下行形成中`
- 显示 `下一确认：等待 c4 确认`
- 显示两条改判路径：
  - 向上重新夺回关键高点
  - 向下跌破平台下沿
- 不再出现单独的 `上涨` badge 紧贴 `C单平台式`，造成“结构起点从峰顶开始却仍写上涨”的歧义

## 与现有 spec 的关系

- 本 spec 补的是“结构判读模型层”。
- [2026-03-31-structure-explainability-ui-design.md](./2026-03-31-structure-explainability-ui-design.md) 继续负责“图上怎么画、卡片怎么排”。
- [2026-03-30-structure-phase-execution-layer-design.md](./2026-03-30-structure-phase-execution-layer-design.md) 继续负责 `archetype / execution_phase / execution` 的后端与 AI 决策链路。

后续实现顺序建议：

1. 先补 `macro_background / focus_structure / current_leg / next_confirmation / scenario_paths` 后端字段。
2. 再把分析页顶部 badge 与摘要块切到消费新字段。
3. 最后把 AI payload 切到优先使用“背景 + 原型成熟度 + 当前段 + 改判路径”的新模型。
