# 三位一体级别嵌套与可执行条件合同设计

## 0. 背景

上一阶段已经把交易周期总线展示层拆成三层：

- 当前动作状态
- 子级综合判断依据
- 父级约束

这解决了“父级约束不该混入执行标签”“次级别应替换成具体级别”这类展示问题，但后端级别嵌套判断仍然偏粗。

当前 `_build_trinity_level_nesting_decision()` 主要按父级强弱和子级结构粗略判断：

- 父级偏强 + 子级 A/B/C 近似视为支持
- 父级偏弱 + 子级 A/B 近似视为冲突
- 其他情况容易落成 `parent_unclear`

这与三位一体策略表不完全一致。三位一体真正需要的是：

> 父级时空状态查表，子级结构按 A/B/C/D 原型匹配，再结合标准/延伸/未完成/复杂等资格做执行强度降级，最终产出“等待条件 / 确认条件 / 失效条件”。

## 1. 设计结论

下一阶段采用合并方案：

> 在级别嵌套判断中接入 `SPACETIME_STRUCTURE_TABLE`，同时产出可执行条件合同。

这意味着后端不仅回答“父级是否支持子级”，还要给出：

- 当前父子级关系
- 子级结构原型和资格
- 操作框架
- 执行强度
- 等待条件
- 确认条件
- 失效条件
- 降级原因

前端仍然不直接暴露英文枚举。后端字段名可以使用英文；所有进入页面、hover、summary、recommendation 的用户可见文案必须是自然中文，并带具体级别。

### 1.1 策略硬闸门

`level_nesting` 不只是展示解释，而是最终交易权限的硬闸门：

- `blocked` / `structure_mismatch` / `parent_unclear`：最终交易资格只能是等待确认或不交易，不能给标准节点交易。
- `boundary_probe`：最多轻仓边界试探，不能升级为标准节点交易。
- `aligned + execution_strength == normal`：才允许进入标准节点交易候选。

因此，子级结构节点、均线门控、量能门控和执行触发只能在级别嵌套放行后参与细化，不能绕过父级级别嵌套。

## 2. 目标与非目标

### 2.1 目标

1. 让 `SPACETIME_STRUCTURE_TABLE` 成为级别嵌套判断的正式依据。
2. 把子级结构归一成 `family + qualification`：
   - `family`: `A / B / C / D / unknown`
   - `qualification`: `standard / extended / unfinished / complex / range / channel / failed / unknown`
3. 支持延伸 A/B/C/D：
   - 方向框架沿用对应 family
   - 执行强度降级
   - 确认要求提高
   - 用户说明中明确“拐点偏多 / 等确认”
4. 后端产出稳定的可执行条件数组：
   - `wait_conditions`
   - `confirm_conditions`
   - `invalidation_conditions`
5. 让最终交易资格读取 `level_nesting` 作为硬闸门，防止父级未放行时子级局部信号被升级成标准交易。
6. 让 view model 优先使用后端新条件展示交易周期总线，缺失时兼容旧字段。
7. 保证用户可见中文，不泄漏内部英文枚举。

### 2.2 非目标

1. 不重写结构识别算法。
2. 不一次性穷尽所有 B/D 节点的复杂推理。
3. 不在本阶段重做交易周期总线 UI 布局。
4. 不把 AI prompt 重构纳入本阶段。
5. 不把 `SPACETIME_STRUCTURE_TABLE` 的中文操作建议原样塞到前端。

## 3. 策略理解

### 3.1 父级时空是查表入口

父级时空状态不是普通标签，而是策略入口：

- `极强`：上涨 A/B，忽略一部分小级别顶部背离，但要防洗盘
- `强`：上涨 B；下跌 D 要谨慎
- `中偏强 / 中偏弱`：C 类平台边界逻辑
- `弱`：下跌 B 或上涨 D
- `极弱`：下跌 A/B，谨慎对待反弹

因此不能再简单把“强”解释成支持所有 A/B/C。

### 3.2 子级结构按原型匹配

子级结构先归一成原型：

- A：趋势推进 / 趋势延续
- B：双平台 / 波段机会
- C：中枢 / 平台边界
- D：三段式反弹或调整

匹配时使用 family，而不是展示名。比如：

- `B双平台式` 和 `延伸B类` 都归入 `B`
- `C单平台式` 和 `延伸C类` 都归入 `C`
- `D三段式` 和 `延伸D类` 都归入 `D`

### 3.3 qualification 决定执行强度

结构资格用于决定是否降级：

- `standard`：可按标准框架输出
- `extended`：沿用 family，但降级为轻仓 / 等确认 / 强化边界
- `unfinished`：只观察，不给正式执行
- `complex`：只看边界，不套标准节点
- `range / channel`：按上下沿、突破/跌破、均线门控处理
- `failed / unknown`：等待结构补齐

一句话：

> 延伸类不是不能用，而是沿用标准类方向框架，执行强度降级，确认条件提高。

## 4. 后端合同

### 4.1 挂载位置

继续挂在现有 `trinity_decision.level_nesting` 下，避免新增旁路 payload。

### 4.2 字段草案

```python
level_nesting = {
    "parent_level": "daily",
    "child_level": "hour30",
    "parent_spacetime_status": "中偏强",
    "child_structure_type": "延伸C类",
    "child_structure_family": "C",
    "child_structure_qualification": "extended",
    "child_structure_direction": "上涨",
    "structure_match": True,
    "resonance": "boundary_probe",
    "operation_bias": "long",
    "operation_frame": "platform_boundary",
    "execution_strength": "light_probe",
    "downgrade_reason": "延伸C沿用C类边界逻辑，但拐点偏多，需等待边界确认",
    "permission": {
        "allow_position_increase": False,
        "allow_t_trade": True,
        "allow_only_light_probe": True,
        "reason": "日线中偏强，30分钟延伸C命中平台边界逻辑，只允许轻仓等待确认"
    },
    "wait_conditions": [
        "等待30分钟有效突破平台上沿",
        "等待30分钟突破后回踩不破"
    ],
    "confirm_conditions": [
        "30分钟放量突破确认",
        "30分钟回踩平台上沿不破"
    ],
    "invalidation_conditions": [
        "30分钟跌回平台下沿失效",
        "30分钟跌破MA55且反抽不过失效"
    ]
}
```

### 4.3 枚举说明

`resonance` 内部可使用英文枚举：

- `aligned`：父级支持子级
- `boundary_probe`：平台边界试探
- `child_countertrend`：子级逆父级
- `structure_mismatch`：结构错配
- `parent_unclear`：父级缺失或无法判断
- `blocked`：父级明确未放行

`operation_frame` 内部可使用英文枚举：

- `trend_continuation`
- `swing_platform`
- `platform_boundary`
- `three_leg_reversal`
- `range_boundary`
- `wait_structure`

`execution_strength` 内部可使用英文枚举：

- `normal`
- `light_probe`
- `wait_confirmation`
- `observe_only`
- `risk_control_first`

这些枚举不能直接进入前端显示。view model 必须映射为中文。

## 5. 判断流程

### 5.1 提取父级

沿用现有父级映射：

- 日线的父级：周线
- 60分钟的父级：日线
- 30分钟的父级：日线
- 15分钟的父级：60分钟

父级缺失时：

- `resonance = parent_unclear`
- `execution_strength = wait_confirmation`
- `permission.allow_position_increase = False`
- 输出中文原因：`周线缺失，日线只能等待确认`

### 5.2 提取父级时空状态

优先使用父级 `trinity_decision.spacetime.status`，兼容父级 `macd.status`。

父级状态必须是：

- `极强`
- `强`
- `中偏强`
- `中偏弱`
- `弱`
- `极弱`

其他值按 `parent_unclear` 处理。

### 5.3 提取子级结构

优先从子级 `trinity_decision.structure` 读取：

- `type`
- `qualification`
- `direction`

若 `trinity_decision.structure` 不完整，可兼容 `structure.interpretation.focus_structure`：

- `archetype_family`
- `standard_qualification`
- `type`

### 5.4 结构归一

新增私有 helper：

```python
_resolve_trinity_structure_match_profile(structure_decision, child_payload) -> dict
```

返回：

```python
{
    "type": "延伸C类",
    "family": "C",
    "qualification": "extended",
    "direction": "上涨",
}
```

归一规则：

- `A五段式` → `family = A, qualification = standard`
- `延伸A`（兼容别名：`延伸A类`）→ `family = A, qualification = extended`
- `B双平台式` → `family = B, qualification = standard`
- `延伸B`（兼容别名：`延伸B类`）→ `family = B, qualification = extended`
- `C单平台式` → `family = C, qualification = standard`
- `延伸C`（兼容别名：`延伸C类`）→ `family = C, qualification = extended`
- `D三段式` → `family = D, qualification = standard`
- `延伸D`（兼容别名：`延伸D类`）→ `family = D, qualification = extended`
- `unfinished / complex / range / channel` 保留资格并降级

### 5.5 查表匹配

使用父级时空状态查 `SPACETIME_STRUCTURE_TABLE`。

如果子级方向是上涨：

- 使用 `上涨结构`
- 使用 `上涨操作`

如果子级方向是下跌：

- 使用 `下跌结构`
- 使用 `下跌操作`

如果方向未知：

- 同时检查上涨/下跌结构
- 若 family 命中任一侧，降级为边界/等待确认
- 若都不命中，结构错配

### 5.6 关系判定

初版按以下优先级判定，前面的规则命中后不再继续向下匹配：

1. 父级缺失或状态未知 → `parent_unclear`
2. family 是 C 且父级状态是 `中偏强 / 中偏弱` → `boundary_probe`
3. 父级偏空但子级输出多头动作 → `child_countertrend`
4. 父级偏多但子级输出空头动作 → `child_countertrend`
5. family 命中上涨结构，方向为上涨 → `aligned`
6. family 命中下跌结构，方向为下跌 → `aligned`
7. family 不在查表结果中 → `structure_mismatch`

`boundary_probe` 不等同于强支持。它代表：

> 平台边界可观察或轻仓试探，但必须等待边界确认并严格止损。

### 5.7 qualification 降级

命中查表后再按资格降级：

- `standard`：保留表内操作框架
- `extended`：`normal` 降为 `light_probe` 或 `wait_confirmation`
- `unfinished`：降为 `observe_only`
- `complex`：降为 `wait_confirmation`，只看边界
- `range / channel`：降为 `light_probe` 或 `wait_confirmation`
- `failed / unknown`：降为 `observe_only`

降级后 `permission` 必须同步收紧：

- 降级后不能 `allow_position_increase = True`
- `extended` 最多 `allow_only_light_probe = True`
- `unfinished / failed` 不允许试仓

## 6. 条件生成

### 6.1 条件来源优先级

等待 / 确认 / 失效条件按以下优先级生成：

1. 现有后端字段：
   - `execution_plan.probe_entry`
   - `execution_plan.confirm_entry`
   - `execution_plan.invalidation`
   - `wait_state.next_confirmation_action`
2. 结构 family 模板：
   - A/B/C/D 对应模板
3. 均线 / 突破 / 量能 / 背离辅助字段：
   - `moving_average.breakthrough_state`
   - `volume_confirmation`
   - `divergence_weight`
4. 保守 fallback：
   - `等待{child_level_label}结构确认`

### 6.2 A 类模板

A 类是趋势推进或趋势延续。

等待条件：

- `等待{级别}有效突破结构上沿`
- `等待{级别}站上MA55后回踩不破`

确认条件：

- `{级别}放量突破确认`
- `{级别}回踩MA55不破`

失效条件：

- `{级别}跌回结构内按假突破处理`
- `{级别}跌破MA55且反抽不过失效`

### 6.3 B 类模板

B 类是双平台 / 波段机会。

等待条件：

- `等待{级别}B类结构 b1/b3/b5/b7 操作点确认`
- `等待{级别}平台边界回踩不破`

确认条件：

- `{级别}边界放量突破确认`
- `{级别}回踩平台上沿不破`

失效条件：

- `{级别}跌回平台下沿失效`
- `{级别}突破后量能失败并回落结构内，按假突破处理`

### 6.4 C 类模板

C 类是中枢 / 平台边界，不直接表达成多头或空头标签。

等待条件：

- `等待{级别}突破平台上沿`
- `等待{级别}回踩平台边界不破`

确认条件：

- `{级别}放量突破平台上沿`
- `{级别}突破后回踩不破`

失效条件：

- `{级别}跌破中枢下沿失效`
- `{级别}跌破MA55且反抽不过失效`

### 6.5 D 类模板

D 类是三段式反弹或调整。

等待条件：

- `关注{级别}D类结构 d1/d2/d3/d4 节奏`
- `等待{级别}d3或d4确认`

确认条件：

- `{级别}d3反向修正完成`
- `{级别}d4结构完成并出现确认信号`

失效条件：

- `{级别}跌破原建仓级别止损位立即退出`
- `{级别}反抽不过关键均线，按失败处理`

### 6.6 延伸类条件修饰

当 `qualification = extended`：

- 条件文案中加入 `延伸结构`
- 降级说明必须出现 `拐点偏多` 或 `确认要求提高`
- 执行强度不得高于 `light_probe`

示例：

- `30分钟延伸C沿用C类边界逻辑，等待平台边界突破/回踩确认`
- `30分钟延伸B仍按B类波段框架跟踪，但拐点偏多，只允许轻仓等待确认`

## 7. 前端与 view model 设计

### 7.1 用户可见中文规则

后端内部字段和枚举可以使用英文。

进入以下位置的文案必须是自然中文：

- `relationLabel`
- `summary`
- `recommendation`
- `SignalTagList`
- hover title
- hover item value
- 规则链 detail
- AI payload 中给用户直接阅读的摘要字段

禁止直接暴露：

- `parent_unclear`
- `child_countertrend`
- `wait_confirmation`
- `extended`
- `boundary_probe`
- `structure_mismatch`

### 7.2 交易周期总线消费规则

view model 优先读取：

- `level_nesting.wait_conditions`
- `level_nesting.confirm_conditions`
- `level_nesting.invalidation_conditions`
- `level_nesting.execution_strength`
- `level_nesting.operation_frame`
- `level_nesting.downgrade_reason`

缺失时兼容旧字段：

- `execution_plan`
- `wait_state`
- `execution`

### 7.3 当前动作状态

当前动作状态应从级别嵌套结果生成：

- `级别｜日线未放行`
- `级别｜日线支持30分钟`
- `级别｜30分钟边界试探`
- `执行｜30分钟等待突破/回踩确认`
- `执行｜15分钟只允许做T观察`

### 7.4 子级综合判断依据

继续只展示执行层证据：

- 时空
- 结构
- 均线
- 背离
- 量能
- 突破/跌破

### 7.5 父级约束

继续只展示父级背景证据：

- 时空
- 结构
- 均线
- 背离
- 量能
- 突破/跌破

过滤：

- 级别
- 执行

## 8. 测试策略

### 8.1 Python 单元测试

更新 `tests/test_trinity_decision_level_nesting.py`。

新增覆盖：

1. `强 + B上涨结构` → `aligned`
2. `强 + A上涨结构` → `structure_mismatch` 或降级等待
3. `中偏强 + C上涨结构` → `boundary_probe`
4. `弱 + D上涨结构` → `aligned` 但执行谨慎
5. `弱 + B下跌结构` → `aligned` 或风险控制优先
6. `延伸C` → family 命中 C，qualification 为 extended，执行强度降级
7. `unfinished` → `observe_only`
8. 父级缺失 → `parent_unclear`

### 8.2 TypeScript view model 测试

更新 `tests/trinity-analysis-page-view-model.test.ts`。

覆盖：

1. 优先展示 `level_nesting.wait_conditions`
2. hover 不出现内部英文枚举
3. hover 不出现抽象 `次级别`
4. `extended` 映射为 `延伸结构`
5. `boundary_probe` 映射为 `边界试探`

### 8.3 组件测试

更新 `tests/analysis-page-sections.test.ts`。

覆盖：

1. 当前动作状态出现具体级别条件
2. 父级约束仍不展示 `级别 / 执行`
3. 子级综合判断依据不混入父级证据

### 8.4 HTTP 回归

因为会修改 `scripts/stock_analyzer.py`，必须按 `CLAUDE.md` 执行 HTTP 回归。

基准命令：

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly" | python3 -c "
import json,sys
r=json.load(sys.stdin)
w=r['data']['periods'].get('weekly',{})
s=w.get('structure',{})
d=s.get('structure_details',{})
focus=((w.get('trinity_decision') or {}).get('structure') or {}).get('focus_origin') or {}
print('聚焦结构:', s.get('structure_type'))
print('聚焦笔数:', s.get('segment_count'))
print('原始结构:', (d.get('raw_classification') or {}).get('type'))
print('聚焦起点来源:', (d.get('focus_origin_analysis') or {}).get('selected_origin_kind'))
print('顶分型包含209.88:', 209.88 in [f['high'] for f in d.get('top_fractals',[])])
print('聚焦起点:', focus)
print('底分型:', [f['low'] for f in d.get('bottom_fractals',[])[-3:]])
"
```

若本地 5001 未启动，需要先启动 dev server，再运行回归。

## 9. 实现顺序建议

1. 先写 Python 单元测试，锁住查表语义和 extended 降级。
2. 实现结构归一 helper。
3. 接入 `SPACETIME_STRUCTURE_TABLE` 到 `_build_trinity_level_nesting_decision()`。
4. 生成 `wait_conditions / confirm_conditions / invalidation_conditions`。
5. 更新 TypeScript 类型。
6. 更新 view model 消费新条件。
7. 更新组件测试。
8. 跑 Python 测试、node 测试、type check。
9. 按 `CLAUDE.md` 跑 HTTP 回归。

## 10. 风险与约束

### 10.1 旧测试会变化

旧测试里 `强 + A五段式` 可能期望 aligned。新策略下，`强` 主要对应上涨 B，所以该断言需要调整。

### 10.2 条件模板不能过度自信

第一版条件生成必须保守。

当缺少边界、节点或量能细节时，可以写：

- `等待30分钟结构边界确认`
- `等待30分钟突破/回踩确认`

不能伪造不存在的具体价位或节点。

### 10.3 前端不做策略推理

view model 可以做中文映射和兼容 fallback，但不应重新判断 `强 + B` 是否支持。策略判断必须以后端 `level_nesting` 为准。

### 10.4 AGENTS.md 后续规范

建议后续把以下规则补入 `AGENTS.md`：

> 后端内部字段与枚举可使用英文；进入前端展示、view model label、hover、summary、recommendation 的用户可见文案必须使用自然中文，并尽量替换为具体级别、具体条件、具体动作，不直接暴露内部枚举或抽象层级词。

## 11. 阶段边界与后续路线图

### 11.1 本阶段交付边界

本阶段目标是建立三位一体级别嵌套的“可执行条件合同”，并实现第一版可用条件。

必须完成：

1. `_build_trinity_level_nesting_decision()` 接入 `SPACETIME_STRUCTURE_TABLE`。
2. 子级结构归一为 `family + qualification`。
3. 查表产出父子级关系：
   - `aligned`
   - `boundary_probe`
   - `child_countertrend`
   - `structure_mismatch`
   - `parent_unclear`
   - `blocked`
4. 按 qualification 做执行强度降级：
   - `standard` 保留标准框架
   - `extended` 降为轻仓 / 等确认 / 强调边界
   - `unfinished` 只观察
   - `complex` 只看边界，不套标准节点
   - `range / channel` 按边界逻辑降级
5. 产出第一版 `wait_conditions / confirm_conditions / invalidation_conditions`。
6. view model 和交易周期总线优先展示这些新条件。

本阶段的条件生成以“模板 + 现有后端字段优先”为主，不强行推导不存在的节点价位。

### 11.2 本阶段不深入展开的内容

以下内容本阶段只保留合同入口或第一版模板，不做完整深推：

1. 不根据真实当前节点精确判断 B 类当前处于 b1、b3、b5 还是 b7。
2. 不根据真实当前节点精确判断 D 类当前处于 d1、d2、d3 还是 d4。
3. 不在缺少明确边界价位时伪造 C 类中枢上下沿价格。
4. 不完整实现 range / channel 的专属上下沿条件模板。
5. 不把背离、量能、均线做成每类结构的精细权重系统。

### 11.3 下一阶段一：B / D 节点语义深化

下一阶段可以专门做 B / D 节点语义。

目标：

1. B 类根据 `node_map`、当前段、结构解释字段判断当前更接近 b1/b3/b5/b7 哪类操作点。
2. D 类根据 `node_map`、当前段、结构解释字段判断 d1/d2/d3/d4 节奏。
3. 后端输出更具体的节点条件：
   - `等待30分钟B类b3回踩确认`
   - `30分钟D类d3反向修正完成后再看d4`
4. 前端只展示节点语义，不自己判断节点。

### 11.4 下一阶段二：C / range / channel 边界深化

再下一阶段可以专门做边界结构深化。

目标：

1. C 类优先使用真实中枢上沿 / 下沿。
2. range / channel 单独输出上下沿、突破、跌破、回踩、反抽条件。
3. 失效条件尽量带明确边界：
   - `跌破30分钟中枢下沿失效`
   - `反抽不过通道下沿，按跌破有效处理`
4. 延伸 C / complex C 只沿用边界逻辑，不套标准节点。

### 11.5 下一阶段三：量能 / 背离 / 均线权重融合

最后再把量能、背离、均线做成更细的条件修饰层。

目标：

1. 突破类条件结合量能：
   - 放量突破确认
   - 突破量弱，等待二次确认
2. 背离条件结合新高 / 新低原则：
   - 未创新高不轻易判顶背离
   - 未创新低不轻易判底背离
3. 均线条件结合 MA55 / MA233：
   - 站上 MA55 后回踩不破
   - 跌破 MA55 且反抽不过失效

## 12. 验收标准

实现完成后必须满足：

1. `_build_trinity_level_nesting_decision()` 使用 `SPACETIME_STRUCTURE_TABLE` 判断父子级结构匹配。
2. 延伸 A/B/C/D 可按 family 命中策略表，并按 qualification 降级。
3. `level_nesting` 产出等待 / 确认 / 失效条件数组。
4. 交易周期总线优先展示新条件。
5. 用户可见文案不暴露内部英文枚举。
6. 用户可见文案不使用抽象 `次级别`。
7. 相关 Python / TypeScript / 组件测试通过。
8. 修改 `scripts/stock_analyzer.py` 后完成 HTTP 回归验证。
