# 结构聚焦起点纠偏与不可解释降级设计

## 背景

最近的阳光电源日线案例暴露了当前结构识别链路里一个比 UI 更基础的问题：

- 后端先用 `_find_valid_range()` 通过“最早满足区间长度的 MACD 切换点 + 附近局部极值”选出左边界。
- 这个左边界同时被当作：
  - 大级别有效区间原点
  - 当前聚焦结构起点
  - 标准结构编号起点
- 一旦左边界选错，后面的聚类、结构分类、编号映射和解释文案就会被整条链带歪。

本次真实案例中：

- `valid_range.start_price` 被切在 `168.7`
- 结构聚类结果被识别为 `Directional(1笔) + Platform(14笔)`
- 分类器据此直接返回 `A五段式 / 趋势启动阶段`
- 前端又把整段走势编号成 `a1 ... a15`

这会形成一个非常误导的结果：

- 图形直观看不出标准 `A五段式`
- 结构却被展示成 `A五段式原型`
- 甚至出现“标准 A 结构，但编号已经走到 a15”的明显语义冲突

这不是单纯的展示问题，而是“原点选择、峰值切片、结构分类、标准编号映射”四层语义没有分开的系统性问题。

## 目标

- 把 `macro origin` 和 `focus origin` 彻底拆开，不再让 `_find_valid_range()` 的左边界自动承担当前结构起点。
- 让中段主峰/主谷在满足条件时，优先成为当前聚焦结构的起点。
- 在结构无法被诚实解释为标准 `A/B/C/D` 时，强制降级为 `复杂结构 / 等待确认`。
- 避免再次出现“结构叫标准 A/B/C/D，但编号已经远超标准结构点数”的结果。
- 保留原始聚类与候选识别结果，不把非标准结构从后端结果中删除，只禁止它们继续冒充标准 `A/B/C/D` 主语义。
- 为第二阶段引入“延伸 C 类 / 下行通道 / 巨型中枢”等正式分类预留接口，但本阶段不实现这些新分类。

## 非目标

- 本阶段不重写底层分型与笔生成算法。
- 本阶段不引入完整的“延伸 C 类”新分类体系。
- 本阶段不重写 `execution_phase / execution` 的策略逻辑。
- 本阶段不大改 UI 版式，只要求 UI 能消费更诚实的结构结果。

## 现状问题链路

当前链路可概括为：

1. `_find_valid_range()` 决定左边界。
2. 左边界裁出 `recent` 有效区间。
3. 整个区间直接送入宏观组件聚类。
4. 聚类结果直接映射成 `A/B/C/D`。
5. 若未触发峰值切片 override，则全量结构类型直接成为主结果。
6. 标准编号从当前聚焦起点重新编号，但这个“起点”其实仍继承了错误左边界。

这条链路的核心缺陷：

- `valid_range` 的职责过重。
- 峰值切片只在少数场景作为覆盖逻辑出现，没有成为“重新寻找当前聚焦结构起点”的正式入口。
- `A/B/C/D` 一旦命中聚类模式，就直接上屏，缺少最后一道“结构可解释性校验”。

## 设计原则

### 1. 有效区间原点不等于当前结构起点

`valid_range.start_*` 只回答：

- 大区间从哪里开始看
- 当前分析样本从哪里截取

它不再自动回答：

- 当前结构应该从哪里开始编号
- 当前结构应该从哪里开始解释

### 2. 当前结构起点必须是“第一可解释锚点”

聚焦起点必须满足三件事：

1. 从该点向右，能自然展开当前结构原型。
2. 该点能被用户肉眼理解为当前结构的开始，而不是上一段走势的尾巴。
3. 从该点出发后，不会马上出现“标准结构名成立，但标准编号明显失真”的情况。

### 3. 结构原型必须经过解释性校验

标准 `A/B/C/D` 不再是“聚类命中即展示”的结果，而是：

- 聚类候选
- 经起点重选后复核
- 再经过结构可解释性校验
- 通过后才允许成为主结构语义

否则必须降级。

### 4. 不能为了保留标准编号而牺牲诚实性

如果某个案例当前只能被解释为：

- 复杂震荡
- 延伸结构
- 大平台通道
- 等待确认

那么主输出必须是 `复杂结构 / 等待确认`。

不能因为后端内部仍希望复用 `A/B/C/D` 映射，就把它硬贴成标准结构。

这里的“降级”只作用于主展示语义，不等于删除原始识别结果：

- `raw_classification`
- `macro_components`
- `peak_analysis`
- `judgment_criteria`

仍然保留，供后续第二阶段的“延伸结构正式分类”继续使用。

## 方案比较

### 方案 1：绝对极值硬锁定

规则：

- 下跌结构一律从区间内绝对最高点开始。
- 上涨结构一律从区间内绝对最低点开始。

优点：

- 实现最直接。
- 能快速修掉“168.7 而不是 209.9”这类错误。

缺点：

- 容易把局部结构识别全部拉回到全区间极值。
- 会伤害级别嵌套和局部交易结构分析。
- 对非峰值型样本过于粗暴。

### 方案 2：聚焦起点候选器 + 峰值切片优先 + 不可解释降级

规则：

- `valid_range` 保留为 `macro origin`。
- 新增 `focus origin resolver`，专门寻找“当前结构真正从哪里开始解释”。
- 若存在中段主峰/主谷且其右侧或左侧形成独立结构，则优先尝试极值切片。
- 若结构仍无法被诚实解释为标准 `A/B/C/D`，则降级为 `复杂结构 / 等待确认`。

优点：

- 能修正本次案例。
- 不会粗暴覆盖所有局部结构场景。
- 与现有 spec 中“起点必须是第一可解释锚点”的原则一致。

缺点：

- 实现复杂度高于方案 1。
- 第一阶段只能先修诚实性，不能立刻给出完整的新分类名称。

### 方案 3：直接引入“延伸 C 类 / 下行通道 / 巨型中枢”正式分类

规则：

- 在方案 2 基础上，新增一套可交易的新结构家族。

优点：

- 最贴近人工分析语言。
- 对这类案例表达更完整。

缺点：

- 范围明显扩大。
- 会牵动执行层、AI、UI、测试和文档。
- 不适合作为本轮第一阶段整改。

## 选定方案

本阶段采用方案 2。

第一阶段只解决三件事：

1. 起点重选。
2. 峰值切片优先。
3. 不可解释时降级。

不在本阶段直接引入完整的“延伸 C 类”新分类。

因此本阶段的输出策略是：

- 标准且可解释的结构，继续保留标准 `A/B/C/D`
- 非标准但当前还没有正式新类名承接的结构，先诚实降级为 `复杂结构 / 等待确认`
- 不是“剔除非标准结构”，而是“暂不让非标准结构冒充标准结构”

## 目标数据模型

### 1. 保留 `valid_range`，但重新定义职责

继续保留：

- `structure_details.valid_range.start_date`
- `structure_details.valid_range.start_price`
- `structure_details.valid_range.origin_type`

但这些字段只再表示：

- 宏观分析区间原点
- 不再直接作为结构拓扑和标准编号的默认起点

### 2. 新增 `focus_origin_analysis`

在 `structure_details` 下新增：

```ts
type StructureFocusOriginAnalysis = {
  macro_origin: {
    point_index: number | null;
    price: number | null;
    date: string | null;
    source: 'valid_range';
  } | null;

  candidates: Array<{
    kind: 'macro_origin' | 'peak_extreme' | 'valley_extreme';
    point_index: number | null;
    price: number | null;
    date: string | null;
    reason: string;
    selected: boolean;
  }>;

  selected_origin_kind: 'macro_origin' | 'peak_extreme' | 'valley_extreme' | 'none';
  selected_point_index: number | null;
  explainability_status: 'passed' | 'failed' | 'downgraded';
  explainability_reason: string;
};
```

### 3. 新增原始分类与展示分类分离

在 `structure_details` 下新增：

```ts
type RawStructureClassification = {
  type: string;
  stage: string;
  description: string;
  component_summary: string[];
};
```

用途：

- `raw_classification` 保留聚类器最初的命中结果。
- 主 `structure_type / structure_stage / description` 允许在解释性校验后被改写为更诚实的结果。

### 4. 升级 `focus_structure`

在 `interpretation.focus_structure` 下新增：

```ts
{
  start_anchor_source: 'macro_origin' | 'peak_extreme' | 'valley_extreme' | 'none';
  explainability_status: 'passed' | 'failed' | 'downgraded';
  downgrade_reason?: string | null;
}
```

这样前端和 AI 都能知道：

- 这个起点是怎么来的
- 当前原型是否通过了解释性校验
- 是否已经被降级

## 后端流程调整

### 1. 阶段一：保留现有 `valid_range`

`_find_valid_range()` 暂不承担“当前聚焦结构起点”的职责，只继续输出大区间原点。

### 2. 阶段二：总是生成峰值候选

`_analyze_peak_structure()` 继续基于全量 `stroke_list` 运行。

但它的结果从“可选覆盖逻辑”升级为“聚焦起点候选源”。

也就是说：

- 即使最终不覆盖主结构类型
- 只要识别出中段主峰/主谷
- 它也必须参与后续的起点选择

### 3. 阶段三：新增 `focus origin resolver`

新增一个独立函数，例如：

```python
def _resolve_focus_origin(...):
    ...
```

它至少接收：

- `valid_range_info`
- `line_geometry`
- `peak_analysis`
- `stroke_list`
- `trend_direction`

它的职责不是分类，而是回答：

- 当前结构从哪个点开始解释最合理

第一阶段候选仅包含：

1. `macro_origin`
2. `peak_extreme`
3. `valley_extreme`

第一阶段不引入更多局部 pivot 候选，避免过度扩展。

### 4. 阶段四：聚焦区间重分类

在选出 `focus origin` 后，基于该起点向右切出 `focused_strokes`，再做一次结构解释。

这里不要求完全重写聚类器，但必须允许：

- 基于聚焦后的笔序列重新计算宏观组件
- 基于聚焦后的组件重新得到“当前最像什么”

### 5. 阶段五：结构可解释性校验

新增一个解释性校验层，例如：

```python
def _validate_focus_structure_explainability(...):
    ...
```

第一阶段至少包含以下校验：

#### 5.1 标准点数上限校验

若主结构仍输出标准 `A/B/C/D`，则标准编号必须保持在该结构的基本可解释范围内：

- `A`：最多 `6` 个确认拐点
- `C`：最多 `6` 个确认拐点
- `D`：最多 `4` 个确认拐点
- `B`：最多 `10` 个确认拐点

若已远超上限，且当前阶段没有专门的“延伸结构”正式分类承接，则：

- 不得继续展示为标准 `A/B/C/D`
- 必须降级

这条规则的直接目的，是阻止再次出现：

- `A五段式`
- 但 UI 编号已到 `a15`

#### 5.2 起点可读性校验

若从该起点向右：

- 无法肉眼读出该原型的起始节奏
- 或该点明显属于上一轮趋势尾声
- 或用户必须依赖内部编号才能理解结构

则校验失败。

#### 5.3 极值切片优先校验

若存在中段主峰/主谷，且从该极值向右或向左能形成更独立、更自洽的节奏，则优先使用极值切片结果。

当前案例里：

- `209.9` 是应优先尝试的聚焦起点
- `168.7` 不应继续作为当前结构起点

### 6. 阶段六：降级输出

若解释性校验失败，则主结构结果改写为：

- `structure_type = 复杂结构`
- `structure_stage = 等待确认`
- `description = 当前聚焦区间无法诚实解释为标准结构，已降级`

并同步：

- `focus_structure.archetype_family = complex`
- `focus_structure.archetype_label = 复杂结构`
- `focus_structure.explainability_status = downgraded`
- `focus_structure.downgrade_reason = ...`

## 对现有 UI 与 AI 的影响

### 1. UI

UI 不需要在本阶段重构，只需要消费更诚实的后端结果：

- 若结构已降级，则主卡不再显示 `A/B/C/D` 标准语义。
- 若 `start_anchor_source = peak_extreme`，则聚焦起点展示应明确来自峰值切片。
- 若已降级，不再显示标准编号，如 `a1 / b1 / c1 / d1`。

### 2. AI

AI 分析链路本阶段只需要收到更稳定的事实：

- 当前结构是否已降级
- 聚焦起点来自哪里
- 降级原因是什么

本阶段不改 AI 的大提示词框架。

## 阳光电源日线案例验收

以 `300274` 当前日线案例为准：

- 不得再把 `168.7` 作为当前聚焦结构起点。
- 必须优先检验 `209.9` 是否应成为聚焦起点。
- 不得再输出“标准 `A五段式`，但编号到 `a15`”的结果。
- 若 `209.9` 右侧仍无法稳定解释为标准 `A/B/C/D`，则主结果必须降级为 `复杂结构 / 等待确认`。
- 降级后，聚焦起点可只展示价格与日期，不强行展示标准编号。

## 回归测试要求

### 1. 新增后端单测

至少覆盖：

1. 中段主峰案例
   - 右侧形成独立下行结构时
   - `focus origin` 应优先落在峰顶
2. 标准结构点数超限案例
   - 不得继续输出标准 `A/B/C/D`
3. 起点可读性失败案例
   - 必须降级为 `复杂结构 / 等待确认`

### 2. 新增视图模型回归

至少覆盖：

- 当 `focus_structure.explainability_status = downgraded` 时
- 前端主语义必须落在“等待 / 不操作 / 复杂结构”
- 不再显示标准结构起点编号

### 3. 验证输出

在 `judgment_criteria` 中补充以下类型的调试信息：

- `macro origin` 来自哪里
- `focus origin` 候选有哪些
- 为什么最终选中某个起点
- 为什么结构被降级

这能帮助后续快速验证：

- 是起点选错
- 还是分类过度
- 还是降级阈值太严

## 第二阶段预留

本 spec 为后续第二阶段预留两类扩展，但不在本轮实现：

1. 正式新增：
   - `延伸 C 类`
   - `下行通道`
   - `巨型中枢`
2. 把这些新分类进一步接入：
   - `execution_phase`
   - `execution`
   - AI 智能分析提示词

第一阶段的成功标准不是“把所有复杂结构都命名清楚”，而是：

- 不再把解释不清的结构硬叫成标准 `A/B/C/D`
- 不再让错误起点污染整条分析链
