# 三位一体判断合同第二阶段设计

## 0. 背景

`2026-04-21-trinity-analysis-page-judgment-display-design.md` 与第一阶段实现，已经完成了分析页展示重组：

- 页面先表达“当前综合判断”
- 标签恢复为主视可见
- 交易周期总线、规则链、周期详情、AI 区都按新的信息顺序展示

但第一阶段仍然有一个明确边界：

> 页面虽然已经会说人话，但很多关键判断仍然依赖前端推断，而不是后端显式合同。

这会带来三个直接问题：

1. 页面与 AI 仍可能吃到不同判断源。
2. 候选结构、等待状态、零轴强信号、共振、背离权重等语义还没有成为正式 payload。
3. `严格等待 / 候选可试 / 确认执行` 还没有真正成为后端融合判断结果，而是部分靠前端 helper 归纳。

因此，第二阶段的重点不再是页面展示，而是：

- 把关键判断语义补成正式后端合同
- 顺手补一部分当前明显缺失的判定产出
- 为后续 AI 输出重组建立统一判断源

## 1. 设计结论

第二阶段采用以下方案：

> 直接把新增判断字段补进现有主 payload，并在补字段的同时做小幅判断升级；AI 输出重组延后到第三阶段。

这意味着：

- 不新起旁路扩展层，不走 `extensions` 或独立 `judgment_v2`
- 新字段直接进入现有 `trinity_decision` 主体
- 新字段初期允许 `optional`，保证旧消费链兼容
- 先把“判断权威源”立住，再做 AI 输出重组

## 2. 目标与非目标

### 2.1 目标

第二阶段目标有六个：

1. 让候选结构、等待状态、零轴强信号、共振、背离权重成为正式后端合同。
2. 让综合判断三档成为后端融合判断结果，而不是前端二次归纳。
3. 让执行预案成为正式输出，而不是只靠旧 `execution` 字段零散拼接。
4. 让页面和后续 AI 共用同一套判断源。
5. 保持与现有 `trinity_decision` 兼容，不引入独立旁路 payload。
6. 只做小幅判断升级，不重写整套交易算法。

### 2.2 非目标

第二阶段明确不做：

1. 不重做分析页布局。
2. 不重写 AI 输出结构与 prompt。
3. 不重新定义整套 A/B/C/D 结构算法。
4. 不把所有历史判断链全部迁移到新字段后再上线。

## 3. 关键依赖关系

第二阶段必须按正确依赖实现，不能把它们错误拆成并列优先级：

### 3.1 输入层

先补齐以下判断输入：

- 候选结构
- 等待状态
- 零轴强信号
- 共振判断
- 背离权重

这些输入再与已有条件共同作用：

- 均线门槛
- 量能确认
- 突破/跌破家族
- 父子级别关系

### 3.2 融合层

在输入层之上，由后端正式产出：

- `严格等待`
- `候选可试`
- `确认执行`

同时给出：

- 当前最关键原因
- 其他支撑因素
- 其他限制因素

### 3.3 执行层

最后再正式输出：

- 先手点
- 确认点
- 失效点
- 当前适合动作

一句话总结：

> 第二阶段不是“补一些字段”，而是“补判断输入 → 产出融合判断 → 补执行预案”。

## 4. 挂载原则

### 4.1 直接进入主 payload

新字段直接补进现有主 payload，也就是 `trinity_decision`，而不是另起旁路层。

原因：

1. 这些内容已经属于正式判断结果，不是临时实验输出。
2. 页面和 AI 后面都要把它们当权威判断源。
3. 若走旁路层，极易出现页面读新字段、AI 读旧字段的双轨分叉。

### 4.2 按语义分块，不做平铺

虽然直接进入 `trinity_decision`，但不采用平铺方式，而是按语义分块挂载：

- 候选结构
- 等待状态
- 零轴强信号
- 共振判断
- 背离权重
- 综合判断
- 执行预案

这样做的目的不是增加嵌套，而是保证：

- 字段职责清晰
- 页面映射稳定
- AI 后续消费容易
- 测试能按块校验

## 5. 新合同分块设计

以下字段名是建议实现名，属于 `trinity_decision` 下的新增子块。

### 5.1 候选结构

职责：

- 表达当前正在形成中的结构候选
- 与正式结构并行，不替代正式结构

建议字段：

```ts
candidate_structure?: {
  candidate_type: string;
  candidate_label: string;
  current_leg: string;
  direction: 'up' | 'down' | 'neutral';
  reason: string;
  upgrade_condition: string;
  invalidation: string;
}
```

语义要求：

- `candidate_type`：候选结构类型，例如 `D`、`A延续`、`C`
- `candidate_label`：给页面/AI 直接显示的中文，例如 `D候选`
- `current_leg`：当前处于哪一段，例如 `d3进行中`
- `upgrade_condition`：升级成正式结构的条件
- `invalidation`：候选失效条件

设计原则：

- 允许 `live` 段参与候选结构判断
- 不允许把候选结构伪装成正式结构

### 5.2 等待状态

职责：

- 解释“为什么现在还是等待”
- 明确“卡点”和“下一确认动作”

建议字段：

```ts
wait_state?: {
  wait_type: string;
  wait_label: string;
  current_block: string;
  next_confirmation_action: string;
  reason: string;
}
```

语义要求：

- `wait_type`：等待类型，例如 `父级未放行`、`等待触发`、`等待量能`、`等待回抽确认`
- `wait_label`：页面可直接显示的短中文
- `current_block`：当前卡在哪
- `next_confirmation_action`：下一步具体看什么

设计原则：

- 不再只给一个模糊 `wait_reason`
- 要让“等待”变成可解释、可执行的状态

### 5.3 零轴强信号

职责：

- 把零轴金叉/死叉及其派生形态显式化
- 让它们不再只是 MACD 文本描述中的隐含语义

建议字段：

```ts
zero_axis_signal?: {
  formed: boolean;
  signal_type: string;
  signal_label: string;
  reason: string;
  impact_on_judgment: 'promote' | 'suppress' | 'neutral';
}
```

语义要求：

- `signal_type` 可包括：
  - `zero_axis_golden_cross`
  - `zero_axis_death_cross`
  - `secondary_confirmation`
  - `formation_failure`
- `signal_label` 必须给出中文显示语义
- `impact_on_judgment` 直接说明它对综合判断的影响

设计原则：

- `零轴金叉 / 零轴死叉` 属于高优先级强信号
- 二次确认与失败都应显式表达

### 5.4 共振判断

职责：

- 把“支持 / 冲突 / 硬限制”显式化
- 不再让共振只停留在零散说明字段中

建议字段：

```ts
resonance_state?: {
  status: 'supportive' | 'conflicting' | 'neutral';
  reason: string;
  impact_on_judgment: 'promote' | 'suppress' | 'neutral';
  is_hard_constraint: boolean;
}
```

语义要求：

- `status`：共振支持、冲突、中性
- `reason`：为什么支持或冲突
- `impact_on_judgment`：对综合判断的影响
- `is_hard_constraint`：是不是硬限制

设计原则：

- 共振不能只作为装饰性标签
- 必须参与综合判断

### 5.5 背离权重

职责：

- 明确背离当前是加分、减分，还是硬压制
- 不再只让背离以标签形式存在

建议字段：

```ts
divergence_weight?: {
  status: 'supportive' | 'suppressive' | 'hard_block' | 'neutral';
  label: string;
  reason: string;
  impact_on_judgment: 'promote' | 'suppress' | 'neutral';
}
```

语义要求：

- `status`：背离当前属于支持、压制、硬阻断还是中性
- `label`：例如 `顶背离压制`、`底背离加分`
- `reason`：说明为什么当前是这个权重
- `impact_on_judgment`：直接说明影响

### 5.6 综合判断

职责：

- 作为融合结果输出，而不是独立输入

建议字段：

```ts
judgment?: {
  level: 'strict_wait' | 'candidate_probe' | 'confirmed_execute';
  label: '严格等待' | '候选可试' | '确认执行';
  current_best_action: string;
  critical_reason: string;
  supporting_factors: string[];
  limiting_factors: string[];
}
```

语义要求：

- `level`：机器稳定枚举
- `label`：页面/AI 直接使用的中文
- `current_best_action`：当前最适合动作
- `critical_reason`：当前最关键原因
- `supporting_factors`：其他支撑因素
- `limiting_factors`：其他限制因素

设计原则：

- 不再使用“主因 / 次因”这种容易引发误解的说法
- 用“当前最关键原因 / 其他支撑因素 / 其他限制因素”替代

### 5.7 执行预案

职责：

- 正式输出当前预案，而不是让页面自己拼接

建议字段：

```ts
execution_plan?: {
  probe_entry: string;
  confirm_entry: string;
  invalidation: string;
  current_position_action: string;
}
```

语义要求：

- `probe_entry`：先手点
- `confirm_entry`：确认点
- `invalidation`：失效点
- `current_position_action`：当前适合动作，例如 `轻仓试`、`确认后加`、`继续等待`

## 6. 小幅判断升级范围

第二阶段不是单纯补字段，也要顺手补一部分当前明显缺失的判定产出。

### 6.1 候选结构正式产出

当前候选结构主要由展示层或人工阅读理解，第二阶段应把它变成正式后端产出。

最小升级范围：

- `live` 段可以正式参与候选结构判断
- 输出当前候选结构类型
- 输出当前进行段
- 输出升级条件与失效条件

### 6.2 等待语义显式化

当前很多等待仍然只是：

- `wait_reason`
- `等待确认`
- `等待触发`

第二阶段应把等待语义拆成：

- 等待类型
- 当前卡点
- 下一确认动作

### 6.3 零轴强事件显式化

当前零轴强信号主要还藏在时空判断描述里，第二阶段应把它们单独产出，并明确影响。

### 6.4 共振与背离显式参与综合判断

当前共振与背离虽然存在，但更多是隐含影响。

第二阶段应明确：

- 是否支持当前动作
- 是否压制当前动作
- 是否属于硬限制

### 6.5 综合判断后端化

第二阶段后，页面不再长期依赖前端 helper 自行归纳三档综合判断。

综合判断必须由后端基于各输入块融合后正式输出。

## 7. 与现有字段的关系

### 7.1 保持兼容

以下现有字段不删除：

- `conclusion`
- `structure`
- `spacetime`
- `moving_average`
- `volume_confirmation`
- `level_nesting`
- `trade_qualification`
- `execution`

新增字段与它们并存，初期允许页面采用：

- 新字段优先
- 老字段回退

### 7.2 不重复造另一套 payload

明确禁止：

- 新起 `ui_payload`
- 新起 `extensions.judgment_v2`
- 页面长期从两套判断源拼装结论

## 8. 页面与后续 AI 的关系

### 8.1 第二阶段对页面的意义

第二阶段完成后，页面将不再需要自己推断以下语义：

- 候选结构
- 等待类型
- 零轴强信号
- 共振影响
- 背离权重
- 综合判断
- 执行预案

### 8.2 第二阶段对 AI 的意义

第二阶段虽然不直接重做 AI 输出，但会先把 AI 后续要吃的正式判断源立住。

这样第三阶段做 AI 输出重组时，就不需要：

- 从旧字段里猜候选结构
- 从旧 wait_reason 里猜等待类型
- 从展示层 helper 里再拼综合判断

## 9. 验收标准

第二阶段完成后，应满足以下验收条件：

1. `trinity_decision` 中能稳定输出候选结构、等待状态、零轴强信号、共振判断、背离权重、综合判断、执行预案。
2. 综合判断三档由后端正式输出，不再主要依赖前端归纳。
3. 页面读取这些字段后，不再需要自己猜“为什么等待”“当前是什么候选结构”。
4. `零轴金叉 / 零轴死叉`、共振、背离对综合判断的影响是显式字段，而不是隐含文本语义。
5. 候选结构包含当前进行段、升级条件、失效条件。
6. 等待状态包含等待类型、当前卡点、下一确认动作。
7. 执行预案包含先手点、确认点、失效点、当前适合动作。

## 10. 第三阶段边界

第三阶段再处理：

- AI 输出结构重组
- AI prompt 升级
- AI 消费新判断源后的表达增强

也就是说，第二阶段先解决“判断结果从哪里来”，第三阶段再解决“AI 怎么把它说清楚”。

一句话总结：

> 第二阶段先把三位一体判断变成正式后端合同，第三阶段再让 AI 基于这套正式合同说得更完整。
