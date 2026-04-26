# 交易周期总线 Hover 拓扑摘要设计

## 1. 背景

当前分析页的结构拓扑图位于页面较下方，用户在核对交易周期总线中的标签描述时，往往需要：

1. 先在总线里看到某个标签或 hover 文案
2. 再滚动到页面底部结构拓扑区
3. 再切换到对应级别
4. 再反向确认图和标签描述是否一致

这个往返路径过长，尤其在核对 `父级约束`、`子级综合判断依据`、`触发级别`、`主要风险` 这类强依赖结构语义的内容时，认知成本较高。

同时，现有 tooltip 存在一个明显可读性问题：右侧仍有空间时，正文就提前换行，导致 hover 看起来偏窄、偏碎，不利于快速扫读。

## 2. 目标

本次只在 **交易周期总线** 内新增一层轻量复用型 hover 拓扑摘要能力，让用户在查看总线标签或说明 hover 时，直接看到对应级别的结构图与最少必要摘要，快速核对“标签描述”和“结构图”是否一致。

本次目标：

1. 只在交易周期总线内支持 hover 拓扑摘要
2. `父级约束` 看父级拓扑，其他总线执行相关 hover 看子级拓扑
3. 结构图优先展示客观存在的基础结构线
4. explainability 完整时，再叠加当前段、当前点、下一确认等解释层信息
5. 修复总线 hover 宽度与换行体验，避免文字未铺满就提前换行

## 3. 非目标

本次不做：

1. 不修改页面底部原有结构拓扑区的位置与布局
2. 不把全页面所有 signal tag 的 hover 都改成带拓扑图
3. 不新增后端字段，不修改后端判定逻辑
4. 不新增前端根据标签内容“猜级别/猜结构”的逻辑
5. 不把 hover 做成完整结构详情面板

## 4. 核心交互

### 4.1 启用范围

仅限 [TradingCycleBus.tsx](/Users/denys/Documents/analyze_stock/src/components/stock/TradingCycleBus.tsx) 内的 hover。

包括两类入口：

1. 标签类 hover
   - `当前动作状态`
   - `子级综合判断依据`
   - `父级约束` 下方 signal tags
2. 说明类 hover
   - `父级约束`
   - `触发级别`
   - `适合动作`
   - `主要风险`

### 4.2 取图规则

#### 父级约束

凡是 `父级约束` 区域内的 hover，统一展示 **父级级别** 的结构拓扑摘要。

例如：

- `中线主策略组合｜周线 → 日线` 的 `父级约束` 看周线
- `短线执行组合｜日线 → 30分钟` 的 `父级约束` 看日线

#### 其他总线执行相关 hover

`当前动作状态`、`子级综合判断依据`、`触发级别`、`适合动作`、`主要风险` 统一展示 **子级 / 主执行级别** 的结构拓扑摘要。

例如：

- `短线执行组合｜日线 → 30分钟` 统一看 30 分钟
- `超短线 / T｜30分钟 → 15分钟` 统一看 15 分钟

### 4.3 图文一致性要求

hover 中展示的结构图与文字摘要必须来自 **同一级别、同一份结构数据**。

禁止：

1. 用父级文案配子级拓扑图
2. 用子级文案配父级拓扑图
3. 前端根据标签文案自行推断结构图

## 5. 图层展示规则

### 5.1 优先展示基础结构线

只要该级别存在 `structure.structure_details.render_payload`，hover 就必须显示基础结构线。

这是客观结构本体，不依赖 explainability 是否完整。

### 5.2 explainability 完整时

若该级别同时具备可用的 `structure.structure_details.explainability`，则在基础结构线之上叠加：

1. 起点锚点
2. 当前点 / 当前段
3. 已确认点
4. 下一确认预期

并在文字摘要中优先展示：

1. `当前结构`
2. `当前阶段`
3. `下一确认`

### 5.3 explainability 不完整时

若该级别没有完整 explainability，但仍有基础结构线，则：

1. 仍然显示“最纯粹的画线”
2. 不伪造当前段 / 下一确认 / 节点语义
3. 文字摘要退化为客观信息：
   - `当前结构`
   - `原始描述`
   - `数据状态`

### 5.4 连基础结构线都没有时

若该级别连 `render_payload` 都不存在，则 hover 显示：

1. `该级别暂无结构线数据`
2. 可附带当前级别的结构类型或等待文案

但不显示空白 SVG，也不显示猜测性结构图。

## 6. Hover 版式

### 6.1 总体布局

交易周期总线专用 hover 改为“宽版拓扑卡”，采用上下结构：

1. 上半区：结构图
2. 下半区：三行摘要

### 6.2 摘要排版

下半区不再使用现有连续段落流式排版，而改成两列说明式布局：

- 左列：固定标签
- 右列：正文内容

标准情况展示：

1. `当前结构`
2. `当前阶段`
3. `下一确认`

退化情况展示：

1. `当前结构`
2. `原始描述`
3. `数据状态`

### 6.3 宽度与换行修正

当前 tooltip 使用 `max-w-sm`，并带有全局 `text-balance`，导致文字在右侧仍有空间时就提前换行。

交易周期总线专用 hover 需要：

1. 从窄 tooltip 升级为宽版 hover
2. 桌面端最大宽度提升到约 `760-860px`
3. 移动端仍按视口收缩
4. 显式取消 `text-balance` 对总线专用 hover 的影响
5. 统一使用左对齐与更适合说明卡的换行策略

目标效果：

1. 文字尽量吃满可用宽度
2. 左侧标签列宽固定
3. 右侧正文自然展开，不提前碎裂换行

## 7. 数据复用方案

### 7.1 后端数据

直接复用每个周期已有数据：

1. `period.structure.structure_details.render_payload`
2. `period.structure.structure_details.explainability`
3. `period.structure.structure_type`
4. `period.structure.description`
5. `period.structure.interpretation`

本次不新增 API 字段。

### 7.2 前端 view model

在总线对应的 view model 中，为现有 hover 增加一个可选的“拓扑摘要预览数据”，供组件渲染：

- 展示级别
- `render_payload`
- `explainability`
- 摘要标题与三行摘要
- 当前是否为“纯画线模式”或“解释层模式”

这是现有 hover 的扩展能力，不是独立的新业务模型。

### 7.3 组件复用

直接复用：

1. [StructureTopologySvg.tsx](/Users/denys/Documents/analyze_stock/src/components/stock/StructureTopologySvg.tsx)
2. [structure-explainability-view-model.ts](/Users/denys/Documents/analyze_stock/src/lib/structure-explainability-view-model.ts)

不新建第二套结构图算法。

## 8. 实现边界

预计只涉及以下层：

1. [trinity-analysis-page-view-model.ts](/Users/denys/Documents/analyze_stock/src/lib/trinity-analysis-page-view-model.ts)
2. [TradingCycleBus.tsx](/Users/denys/Documents/analyze_stock/src/components/stock/TradingCycleBus.tsx)
3. [SignalTagList.tsx](/Users/denys/Documents/analyze_stock/src/components/stock/SignalTagList.tsx)
4. [ExplainableFact.tsx](/Users/denys/Documents/analyze_stock/src/components/stock/ExplainableFact.tsx)

必要时可补一个总线专用 hover 内容子组件，但不改其他页面模块的 hover 行为。

## 9. 验收标准

### 9.1 交互验收

1. 交易周期总线中，`父级约束` hover 展示父级拓扑摘要
2. 交易周期总线中，其他执行相关 hover 展示子级拓扑摘要
3. 图与文案级别必须一致

### 9.2 展示验收

1. 有 `render_payload` 时一定显示结构图
2. explainability 不完整时，仍能显示纯结构线
3. 无结构线数据时，显示明确的缺省文案
4. hover 文字不再出现明显“右侧有空白但正文提前换行”的情况

### 9.3 回归验收

1. 原有总线标签、说明 hover 的中文语义不丢失
2. 原有页面底部结构拓扑区不受影响
3. 其他分析页 tooltip 不被这次总线专用样式误伤

## 10. 风险与控制

### 风险 1：hover 过大遮挡总线卡片

控制方式：

1. 使用轻量拓扑摘要而非完整结构面板
2. 限定最大宽度
3. 内容只保留结构图 + 三行摘要

### 风险 2：图文不一致

控制方式：

1. 图与摘要都从同一级别的同一份 period 数据生成
2. 不允许前端根据标签文本自行推导结构图

### 风险 3：tooltip 样式误伤全站

控制方式：

1. 总线 hover 使用专用 className 或专用 hover 内容组件
2. 不全局修改所有 tooltip 的展示风格

## 11. 后续实现建议

实现顺序建议：

1. 先写 view model 测试，锁定父级/子级取图规则
2. 再写总线组件测试，锁定宽版 hover、中文摘要与 fallback
3. 最后再做最小生产代码改动

这样可以先把“图从哪来、文案怎么退化、宽度怎么表现”锁死，再落 UI。
