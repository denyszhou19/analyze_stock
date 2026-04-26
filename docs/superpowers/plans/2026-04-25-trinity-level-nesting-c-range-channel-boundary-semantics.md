# C / range / channel 边界深化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只针对 `2026-04-25-trinity-level-nesting-executable-conditions-design.md` 的 `11.4`，把 C / range / channel 从“泛化边界模板”升级成“优先使用真实边界价位驱动等待 / 确认 / 失效条件”。

**Architecture:** 继续以 `trinity_decision.level_nesting` 为唯一正式出口，不让前端自行推断边界。后端复用现有 `trinity_decision.structure.boundaries` 作为边界真源，并新增一个 `boundary_semantic` 结构块来描述当前边界模式、上下沿价格与解释原因；`wait_conditions / confirm_conditions / invalidation_conditions` 优先由 `boundary_semantic` 生成。标准 C、延伸 C、complex C、range、channel 都只走边界逻辑，不引入新的节点编号体系。

**Tech Stack:** Python 3, `unittest`, Next.js App Router, React 19, TypeScript, node:test, pnpm, HTTP regression via local Next API。

---

## 策略任务清单

本计划只做 `11.4 下一阶段二：C / range / channel 边界深化`，不提前动 `11.5`。

1. 标准 C 优先使用真实中枢上沿 / 下沿，不再只输出“平台上沿 / 中枢下沿”这类抽象词。
2. `range / channel` 单独输出上下沿、突破、跌破、回踩、反抽条件，不沿用 C 的泛平台模板。
3. `invalidation_conditions` 尽量带明确价位，例如：
   - `跌破30分钟中枢下沿10.40失效`
   - `反抽不过30分钟通道下沿11.40，按跌破有效处理`
4. `延伸C / complex C` 只沿用边界逻辑，不套标准节点，也不伪造 `node_semantic`。
5. 级别嵌套硬闸门不改变：
   - `blocked / structure_mismatch / parent_unclear` 仍然禁止升级标准交易
   - `boundary_probe` 仍然最多轻仓试探
   - `range / channel / 延伸C / complex C` 仍然只能边界条件交易或继续等待
6. 本计划完成后，允许进入 `11.5 量能 / 背离 / 均线权重融合`；在此之前不做权重系统化。

## 文件结构与职责

- Modify: `scripts/stock_analyzer.py`
  - 新增 C / range / channel 的边界语义 helper
  - 将边界语义写入 `level_nesting.boundary_semantic`
  - 用真实边界价位重写 C / range / channel 的条件模板
- Modify: `src/lib/stock-structure-types.ts`
  - 为 `TrinityLevelNestingDecision` 增加 `boundary_semantic`
- Modify: `src/lib/trinity-signal-tags.ts`
  - hover 展示边界语义、原因与上下沿价位
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
  - 保持“优先用 `wait_conditions`”不变，只补边界语义辅助展示
- Modify: `tests/test_trinity_decision_level_nesting.py`
  - 锁定标准 C / 延伸 C / range / channel 的边界条件与 fallback
- Modify: `tests/test_trinity_decision_trade_qualification.py`
  - 锁定 `range / channel / 延伸C` 不会升级为标准节点交易
- Modify: `tests/trinity-signal-tags.test.ts`
  - 锁定 hover 的中文边界合同
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
  - 锁定 trading bus 推荐、触发、风险优先使用具体边界价位
- Modify: `tests/analysis-page-sections.test.ts`
  - 锁定组件渲染的是中文边界条件，不泄漏内部字段

## 范围守卫

以下内容显式不在本计划内：

1. 不改 `SPACETIME_STRUCTURE_TABLE`。
2. 不重做 `trade_qualification` 主判定逻辑，只补边界结构不会绕过硬闸门的保护测试。
3. 不回头重做 B / D 节点语义。
4. 不把量能 / 背离 / 均线升级为边界模板的权重引擎。
5. 不重做交易周期总线布局，只让它读到更具体的边界条件。
6. 在缺少明确上下沿价位时，不伪造价格；必须回退到泛化边界文案。

### Task 0: 基线核对与工作区边界确认

**Files:**
- No source changes.

- [ ] **Step 1: 查看当前工作区状态**

Run:

```bash
git status --short
git log --oneline -5
```

Expected:

- 工作区干净或只有当前计划文档改动
- 最近提交已经包含 `11.3 B / D 节点语义深化`

- [ ] **Step 2: 跑当前 11.3 基线测试**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
node --test tests/trinity-signal-tags.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
```

Expected:

- 三条命令全部 exit 0
- 当前 11.3 已稳定，再开始写 11.4 的失败测试

### Task 1: 先写 C / range / channel 边界语义失败测试

**Files:**
- Modify: `tests/test_trinity_decision_level_nesting.py`
- Modify: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 扩展测试 helper，让 payload 能携带真实边界价位**

在 `tests/test_trinity_decision_level_nesting.py` 里，把 `_payload()` 扩成下面的形状：

```python
    def _payload(
        self,
        *,
        status='强',
        structure_type='B双平台式',
        qualification='standard',
        direction='up',
        standard_candidate=None,
        node_map=None,
        current_leg=None,
        prediction=None,
        current_point_id=None,
        current_segment=None,
        probe_entry=None,
        confirm_entry=None,
        invalidation=None,
        next_confirmation_action=None,
        boundaries=None,
        boundary_levels=None,
    ):
        standard_candidate = standard_candidate or structure_type
        boundaries = boundaries or {'upper': 11.2, 'lower': 10.4, 'mid': 10.8}
        return {
            'macd': {'status': status},
            'trinity_decision': {
                'spacetime': {'status': status},
                'conclusion': {'bias': 'bullish' if direction == 'up' else 'bearish' if direction == 'down' else 'neutral'},
                'structure': {
                    'type': structure_type,
                    'standard_candidate': standard_candidate,
                    'qualification': qualification,
                    'direction': direction,
                    'boundaries': boundaries,
                    'node_map': node_map or {'a4': None, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': None},
                },
                'execution_plan': {
                    'probe_entry': probe_entry,
                    'confirm_entry': confirm_entry,
                    'invalidation': invalidation,
                },
                'wait_state': {
                    'next_confirmation_action': next_confirmation_action,
                },
            },
            'structure': {
                'trend_direction': '上涨' if direction == 'up' else '下跌' if direction == 'down' else '震荡',
                'structure_type': structure_type,
                'structure_details': {
                    'boundary_levels': boundary_levels or boundaries,
                    'prediction': prediction or {},
                    'explainability': {
                        'current_point_id': current_point_id,
                        'current_segment': current_segment,
                    },
                },
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': standard_candidate[0] if standard_candidate else None,
                        'standard_qualification': qualification,
                        'directional_bias': direction,
                    },
                    'current_leg': current_leg or {
                        'from_point_id': None,
                        'to_point_id': None,
                        'direction': direction,
                        'label': '待确认',
                    },
                },
            },
        }
```

- [ ] **Step 2: 增加标准 C 真边界失败测试**

追加两个测试：

```python
    def test_standard_c_uses_real_pivot_boundaries_in_conditions(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='C单平台式',
                qualification='standard',
                direction='up',
                standard_candidate='C单平台式',
                boundaries={
                    'upper': 11.2,
                    'lower': 10.4,
                    'mid': 10.8,
                    'breakout_trigger': 11.2,
                    'breakdown_trigger': 10.4,
                    'stop_loss': 10.4,
                },
            ),
        )

        self.assertEqual(decision['boundary_semantic']['mode'], 'c_pivot')
        self.assertEqual(decision['boundary_semantic']['upper'], 11.2)
        self.assertEqual(decision['boundary_semantic']['lower'], 10.4)
        self.assertEqual(decision['boundary_semantic']['label'], 'C类中枢边界')
        self.assertEqual(decision['wait_conditions'][0], '等待30分钟突破平台上沿11.20')
        self.assertEqual(decision['confirm_conditions'][0], '30分钟放量突破平台上沿11.20')
        self.assertEqual(decision['invalidation_conditions'][0], '跌破30分钟中枢下沿10.40失效')

    def test_standard_c_without_real_boundaries_keeps_generic_platform_copy(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='C单平台式',
                qualification='standard',
                direction='up',
                standard_candidate='C单平台式',
                boundaries={'upper': None, 'lower': None, 'mid': None},
                boundary_levels={},
            ),
        )

        self.assertIsNone(decision['boundary_semantic'])
        self.assertTrue(any(item == '等待30分钟突破平台上沿' for item in decision['wait_conditions']))
        self.assertTrue(all('11.20' not in item and '10.40' not in item for item in decision['wait_conditions']))
    ```

- [ ] **Step 3: 增加 range / channel 专属边界失败测试**

追加两个测试：

```python
    def test_range_qualification_builds_box_boundary_conditions(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='大平台震荡',
                qualification='range',
                direction='neutral',
                standard_candidate=None,
                boundaries={
                    'upper': 11.2,
                    'lower': 10.4,
                    'mid': 10.8,
                    'breakout_trigger': 11.2,
                    'breakdown_trigger': 10.4,
                    'stop_loss': 10.4,
                },
            ),
        )

        self.assertEqual(decision['boundary_semantic']['mode'], 'range_box')
        self.assertEqual(decision['wait_conditions'][0], '等待30分钟突破区间上沿11.20或跌破区间下沿10.40')
        self.assertEqual(decision['confirm_conditions'][0], '30分钟突破11.20后回踩不破再确认')
        self.assertEqual(decision['invalidation_conditions'][0], '30分钟重新回到10.40-11.20区间内，按假突破/假跌破处理')

    def test_channel_qualification_builds_throwback_and_pullback_conditions(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='下降通道',
                qualification='channel',
                direction='down',
                standard_candidate=None,
                boundaries={
                    'upper': 12.6,
                    'lower': 11.4,
                    'mid': 12.0,
                    'breakout_trigger': 12.6,
                    'breakdown_trigger': 11.4,
                    'stop_loss': 12.6,
                },
            ),
        )

        self.assertEqual(decision['boundary_semantic']['mode'], 'channel_band')
        self.assertEqual(decision['wait_conditions'][0], '等待30分钟跌破通道下沿11.40或反抽通道上沿12.60不过')
        self.assertEqual(decision['confirm_conditions'][0], '30分钟跌破11.40后反抽不过再确认')
        self.assertEqual(decision['invalidation_conditions'][0], '30分钟重新站回通道上沿12.60上方，按跌破失败处理')
    ```

- [ ] **Step 4: 锁定延伸 C / range / channel 不会升级标准节点交易**

在 `tests/test_trinity_decision_trade_qualification.py` 追加：

```python
    def test_range_boundary_structure_stays_conditional_boundary_trade(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'range',
                'qualification': 'over_limit',
                'direction': 'neutral',
                'can_trade_by_structure_nodes': False,
                'can_trade_by_boundaries': True,
                'explainability': {'reason': '大平台震荡只看上下沿'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': True, 'reason': '均线未否决'}},
            volume_decision={
                'volume_gate': {
                    'supports_breakout': True,
                    'supports_breakdown': True,
                    'supports_pullback_confirmation': True,
                    'confidence_adjustment': 'neutral',
                    'reason': '量能未否决',
                }
            },
            execution_payload={'action': 'buy', 'direction': 'long'},
            level_nesting_decision={
                'resonance': 'boundary_probe',
                'execution_strength': 'light_probe',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '30分钟区间结构只允许边界轻仓试探',
                },
                'boundary_semantic': {
                    'mode': 'range_box',
                    'label': '区间上下沿',
                    'upper': 11.2,
                    'lower': 10.4,
                    'reason': '当前只允许按区间上下沿做边界确认',
                },
            },
        )

        self.assertEqual(decision['trade_mode'], 'conditional_boundary_trade')
        self.assertEqual(decision['position_permission'], 'light_probe')
        self.assertNotEqual(decision['trade_mode'], 'standard_node_trade')
    ```

- [ ] **Step 5: 运行 Python 套件，确认失败点落在 11.4 新合同上**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
```

Expected:

- FAIL
- 失败应集中在 `boundary_semantic` 缺失、C / range / channel 条件仍然过于泛化

### Task 2: 新增边界语义合同，但先不重写全部条件

**Files:**
- Modify: `scripts/stock_analyzer.py`

- [ ] **Step 1: 新增边界语义 helper**

在 `_family_condition_templates()` 附近新增两个 helper：

```python
    def _format_level_nesting_boundary_price(self, value: Optional[float]) -> Optional[str]:
        normalized = self._normalize_trinity_price(value)
        if normalized is None:
            return None
        return f'{normalized:.2f}'

    def _build_level_nesting_boundary_semantic(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        family: str,
        qualification: str,
        level_label: str,
        direction: str,
    ) -> Optional[Dict[str, Any]]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        decision = child_payload.get('trinity_decision') or {}
        structure_decision = decision.get('structure') or {}
        boundaries = structure_decision.get('boundaries') or {}
        upper = self._normalize_trinity_price(boundaries.get('upper'))
        lower = self._normalize_trinity_price(boundaries.get('lower'))
        if upper is None or lower is None or upper <= lower:
            return None

        if family == 'C' and qualification in {'standard', 'extended', 'complex'}:
            mode = 'c_pivot'
            label = 'C类中枢边界'
            reason = f'{level_label}优先按中枢上沿{upper:.2f} / 下沿{lower:.2f}处理'
        elif qualification == 'range':
            mode = 'range_box'
            label = '区间上下沿'
            reason = f'{level_label}当前按区间上沿{upper:.2f} / 下沿{lower:.2f}等待方向选择'
        elif qualification == 'channel':
            mode = 'channel_band'
            label = '通道上下沿'
            reason = (
                f'{level_label}当前按通道下沿{lower:.2f}等待跌破或反抽确认'
                if direction == 'down'
                else f'{level_label}当前按通道上沿{upper:.2f}等待突破或回踩确认'
            )
        else:
            return None

        return {
            'mode': mode,
            'label': label,
            'upper': upper,
            'lower': lower,
            'mid': self._normalize_trinity_price(boundaries.get('mid')),
            'breakout_trigger': self._normalize_trinity_price(boundaries.get('breakout_trigger') or upper),
            'breakdown_trigger': self._normalize_trinity_price(boundaries.get('breakdown_trigger') or lower),
            'stop_loss': self._normalize_trinity_price(boundaries.get('stop_loss') or lower),
            'reason': reason,
        }
```

- [ ] **Step 2: 在 `level_nesting` 返回合同中挂上 `boundary_semantic`**

在 `_build_trinity_level_nesting_decision()` 里：

```python
        boundary_semantic = self._build_level_nesting_boundary_semantic(
            child_payload=child_payload,
            family=family,
            qualification=qualification,
            level_label=child_label,
            direction=direction,
        )
```

并在两条返回分支里补：

```python
                'boundary_semantic': None,
```

与：

```python
            'boundary_semantic': boundary_semantic,
```

- [ ] **Step 3: 运行 Python 套件，确认失败从“字段缺失”缩小到“条件文案仍不够具体”**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
```

Expected:

- 仍可能 FAIL
- 但失败应从“没有 `boundary_semantic`”缩小为“条件模板还没使用真实边界价位”

### Task 3: 用边界语义重写 C / range / channel 条件模板，且不破坏硬闸门

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `tests/test_trinity_decision_level_nesting.py`
- Modify: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 新增边界语义条件模板 helper**

在 `_build_level_nesting_boundary_semantic()` 附近新增：

```python
    def _build_boundary_semantic_conditions(
        self,
        *,
        level_label: str,
        boundary_semantic: Optional[Dict[str, Any]],
        qualification: str,
        direction: str,
    ) -> Optional[Dict[str, List[str]]]:
        boundary_semantic = boundary_semantic if isinstance(boundary_semantic, dict) else {}
        mode = boundary_semantic.get('mode')
        upper = self._format_level_nesting_boundary_price(boundary_semantic.get('upper'))
        lower = self._format_level_nesting_boundary_price(boundary_semantic.get('lower'))
        if not upper or not lower:
            return None

        if mode == 'c_pivot':
            return {
                'wait_conditions': [f'等待{level_label}突破平台上沿{upper}', f'等待{level_label}回踩平台上沿{upper}不破'],
                'confirm_conditions': [f'{level_label}放量突破平台上沿{upper}', f'{level_label}突破后回踩{upper}不破'],
                'invalidation_conditions': [f'跌破{level_label}中枢下沿{lower}失效', f'{level_label}跌回中枢内，按假突破处理'],
            }
        if mode == 'range_box':
            return {
                'wait_conditions': [f'等待{level_label}突破区间上沿{upper}或跌破区间下沿{lower}'],
                'confirm_conditions': [f'{level_label}突破{upper}后回踩不破再确认', f'{level_label}跌破{lower}后反抽不过再确认'],
                'invalidation_conditions': [f'{level_label}重新回到{lower}-{upper}区间内，按假突破/假跌破处理'],
            }
        if mode == 'channel_band' and direction == 'down':
            return {
                'wait_conditions': [f'等待{level_label}跌破通道下沿{lower}或反抽通道上沿{upper}不过'],
                'confirm_conditions': [f'{level_label}跌破{lower}后反抽不过再确认', f'{level_label}反抽通道上沿{upper}失败后继续转弱'],
                'invalidation_conditions': [f'{level_label}重新站回通道上沿{upper}上方，按跌破失败处理'],
            }
        if mode == 'channel_band':
            return {
                'wait_conditions': [f'等待{level_label}突破通道上沿{upper}或回踩通道下沿{lower}不破'],
                'confirm_conditions': [f'{level_label}突破{upper}后回踩不破再确认', f'{level_label}回踩通道下沿{lower}后重新转强'],
                'invalidation_conditions': [f'{level_label}跌破通道下沿{lower}失效', f'{level_label}突破后重新跌回通道内，按假突破处理'],
            }
        return None
```

- [ ] **Step 2: 在 `_build_level_nesting_conditions()` 中优先使用边界语义模板**

把函数签名改成：

```python
    def _build_level_nesting_conditions(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        level_label: str,
        family: str,
        qualification: str,
        direction: str,
        node_semantic: Optional[Dict[str, Any]] = None,
        boundary_semantic: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, List[str]]:
```

并在 `semantic_conditions` 后接上：

```python
        boundary_conditions = self._build_boundary_semantic_conditions(
            level_label=level_label,
            boundary_semantic=boundary_semantic,
            qualification=qualification,
            direction=direction,
        )
```

优先级改成：

```python
        if node_semantic_conditions:
            ...
        elif boundary_conditions:
            ...
        else:
            ...
```

同时在 `_build_trinity_level_nesting_decision()` 调用时传：

```python
            direction=direction,
            node_semantic=node_semantic,
            boundary_semantic=boundary_semantic,
```

- [ ] **Step 3: 把边界语义写进 permission 原因**

在 `_build_level_nesting_permission_reason()` 开头加：

```python
        boundary_semantic: Optional[Dict[str, Any]] = None,
```

并在 `node_label` 后加入：

```python
        boundary_label = (boundary_semantic or {}).get('label')
        if resonance in {'aligned', 'boundary_probe'} and not node_label and boundary_label:
            return f'{parent_label}{status_text}支持{child_label}{boundary_label}，但仍需按边界确认节奏执行'
```

调用处同步传入 `boundary_semantic=boundary_semantic`。

- [ ] **Step 4: 锁定延伸 C / complex C 只走边界逻辑**

在 `tests/test_trinity_decision_level_nesting.py` 再加：

```python
    def test_extended_c_uses_boundary_semantic_without_fake_node_semantic(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='延伸C类',
                qualification='extended',
                direction='up',
                standard_candidate='C单平台式',
                boundaries={
                    'upper': 11.2,
                    'lower': 10.4,
                    'mid': 10.8,
                    'breakout_trigger': 11.2,
                    'breakdown_trigger': 10.4,
                    'stop_loss': 10.4,
                },
            ),
        )

        self.assertIsNone(decision['node_semantic'])
        self.assertEqual(decision['boundary_semantic']['mode'], 'c_pivot')
        self.assertEqual(decision['wait_conditions'][0], '30分钟延伸结构沿用C类框架，等待边界确认')
        self.assertTrue(any('11.20' in item or '10.40' in item for item in decision['confirm_conditions']))
    ```

- [ ] **Step 5: 运行 Python 套件，确认后端闭环通过**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
```

Expected:

- PASS
- 标准 C / range / channel 已输出带边界价位的条件
- 延伸 C / complex C 不会伪造 `node_semantic`

### Task 4: 更新前端合同与展示，只展示后端边界语义

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/trinity-signal-tags.ts`
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Modify: `tests/trinity-signal-tags.test.ts`
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 扩展 TypeScript 类型**

在 `TrinityLevelNestingDecision` 中新增：

```ts
  boundary_semantic?: {
    mode?: 'c_pivot' | 'range_box' | 'channel_band' | string;
    label?: string | null;
    upper?: number | null;
    lower?: number | null;
    mid?: number | null;
    breakout_trigger?: number | null;
    breakdown_trigger?: number | null;
    stop_loss?: number | null;
    reason?: string | null;
  } | null;
```

- [ ] **Step 2: 在 `trinity-signal-tags.ts` hover 中展示边界语义**

把 `buildLevelNestingHoverItems()` 改成：

```ts
function buildLevelNestingHoverItems(
  decision: TrinityDecision
): Array<{ label: string; value?: string | null }> {
  const levelNesting = decision.level_nesting;
  const boundarySemantic = levelNesting?.boundary_semantic;
  return [
    { label: '父级偏向', value: parentBiasLabel(levelNesting?.parent_bias) },
    { label: '关系状态', value: levelNestingLabel(levelNesting?.resonance) },
    { label: '结构原型', value: levelNesting?.child_structure_family },
    { label: '结构资格', value: qualificationLabel(levelNesting?.child_structure_qualification) },
    { label: '边界语义', value: boundarySemantic?.label },
    { label: '边界原因', value: boundarySemantic?.reason },
    {
      label: '边界价位',
      value:
        boundarySemantic?.upper != null && boundarySemantic?.lower != null
          ? `上沿 ${boundarySemantic.upper.toFixed(2)} / 下沿 ${boundarySemantic.lower.toFixed(2)}`
          : null,
    },
    { label: '等待条件', value: levelNesting?.wait_conditions?.join('、') },
    { label: '确认条件', value: levelNesting?.confirm_conditions?.join('、') },
    { label: '失效条件', value: levelNesting?.invalidation_conditions?.join('、') },
    { label: '说明', value: levelNesting?.permission.reason ?? decision.conclusion.wait_reason },
  ].filter((item) => Boolean(item.value));
}
```

- [ ] **Step 3: 在 `trinity-analysis-page-view-model.ts` 优先用边界语义解释**

在组合触发 hover 里，把“为什么这么判断”优先改成：

```ts
        createHoverItem(
          '为什么这么判断',
          minor?.level_nesting?.node_semantic?.reason ??
            minor?.level_nesting?.boundary_semantic?.reason ??
            triggerHoverValue
        ),
```

并在 `buildCombinationActionStateTags()` 的 `级别` 标签 hover 中补：

```ts
      ...(nesting?.boundary_semantic?.label
        ? [{ label: '边界语义', value: nesting.boundary_semantic.label }]
        : []),
```

要求：

- 只消费后端 `boundary_semantic`
- 不在前端根据 `boundaries` 数字自己拼 `mode`

- [ ] **Step 4: 锁定 signal tag 测试**

在 `tests/trinity-signal-tags.test.ts` 新增：

```ts
test('buildDecisionSignalTags shows backend boundary semantic in Chinese hover only', () => {
  const tags = signalTags.buildDecisionSignalTags(
    createDecision({
      level_nesting: {
        parent_bias: 'bullish',
        child_signal: 'long',
        resonance: 'boundary_probe',
        boundary_semantic: {
          mode: 'c_pivot',
          label: 'C类中枢边界',
          upper: 11.2,
          lower: 10.4,
          reason: '30分钟优先按中枢上沿11.20 / 下沿10.40处理',
        },
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '日线中偏强支持30分钟C类中枢边界，但仍需按边界确认节奏执行',
        },
        wait_conditions: ['等待30分钟突破平台上沿11.20'],
        confirm_conditions: ['30分钟放量突破平台上沿11.20'],
        invalidation_conditions: ['跌破30分钟中枢下沿10.40失效'],
      },
    })
  );

  const tag = tags.find((item) => item.key === 'level_nesting');
  assert.ok(tag);
  assert.ok(tag.hover.items.some((item) => item.label === '边界语义' && item.value === 'C类中枢边界'));
  assert.ok(tag.hover.items.some((item) => item.label === '边界价位' && item.value?.includes('11.20')));
  assert.ok(tag.hover.items.every((item) => !String(item.value ?? '').includes('boundary_semantic')));
});
```

- [ ] **Step 5: 锁定 view model 推荐文案改成具体边界价位**

在 `tests/trinity-analysis-page-view-model.test.ts` 增加：

```ts
test('trading bus prefers concrete C boundary conditions over generic platform wording', () => {
  const result = createResult();
  const decision = result.periods.hour30.trinity_decision!;
  decision.level_nesting = {
    ...decision.level_nesting,
    resonance: 'boundary_probe',
    execution_strength: 'light_probe',
    boundary_semantic: {
      mode: 'c_pivot',
      label: 'C类中枢边界',
      upper: 11.2,
      lower: 10.4,
      reason: '30分钟优先按中枢上沿11.20 / 下沿10.40处理',
    },
    permission: {
      allow_position_increase: false,
      allow_t_trade: true,
      allow_only_light_probe: true,
      reason: '日线中偏强支持30分钟C类中枢边界，但仍需按边界确认节奏执行',
    },
    wait_conditions: ['等待30分钟突破平台上沿11.20'],
    confirm_conditions: ['30分钟放量突破平台上沿11.20', '30分钟突破后回踩11.20不破'],
    invalidation_conditions: ['跌破30分钟中枢下沿10.40失效'],
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.recommendation, '先等待30分钟突破平台上沿11.20');
  assert.equal(shortline.triggerLevel.value, '30分钟：突破平台上沿11.20');
  assert.equal(shortline.majorRisk.value, '跌破30分钟中枢下沿10.40失效');
});
```

- [ ] **Step 6: 锁定组件输出中文边界条件**

在 `tests/analysis-page-sections.test.ts` 增加或改成：

```ts
  assert.match(html, /等待30分钟突破平台上沿11\.20/);
  assert.match(html, /跌破30分钟中枢下沿10\.40失效/);
  assert.doesNotMatch(html, /boundary_semantic/);
```

- [ ] **Step 7: 运行前端测试**

Run:

```bash
node --test tests/trinity-signal-tags.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
```

Expected:

- node:test PASS
- type check PASS
- recommendation / trigger / risk 已优先展示具体边界价位

### Task 5: 回归验证与提交

**Files:**
- Modify only files from Tasks 1-4.

- [ ] **Step 1: 运行完整回归**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
node --test tests/trinity-signal-tags.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
git diff --check
```

Expected:

- 四条命令全部 exit 0

- [ ] **Step 2: 按 `CLAUDE.md` 跑 HTTP 回归**

Run:

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

Expected:

- `聚焦结构: C单平台式`
- `原始结构: 延伸C类`
- `聚焦起点来源: peak_extreme`
- `顶分型包含209.88: True`

- [ ] **Step 3: 手动 spot-check 边界语义合同**

Run:

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15" | python3 -c "
import json,sys
r=json.load(sys.stdin)
for level in ['daily','hour60','hour30','hour15']:
    d=((r['data']['periods'].get(level) or {}).get('trinity_decision') or {})
    nesting=d.get('level_nesting') or {}
    print(level, 'boundary=', nesting.get('boundary_semantic'))
    print('wait=', nesting.get('wait_conditions'))
    print('confirm=', nesting.get('confirm_conditions'))
    print('invalid=', nesting.get('invalidation_conditions'))
"
```

Expected:

- 若某层命中 C / range / channel 且存在真实边界价位，应出现 `boundary_semantic.label`
- 非标准层不应伪造 `node_semantic`
- wait / confirm / invalid 条件应优先体现明确边界价位

- [ ] **Step 4: 提交**

```bash
git add scripts/stock_analyzer.py \
  src/lib/stock-structure-types.ts \
  src/lib/trinity-signal-tags.ts \
  src/lib/trinity-analysis-page-view-model.ts \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_trinity_decision_trade_qualification.py \
  tests/trinity-signal-tags.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-page-sections.test.ts \
  docs/superpowers/plans/2026-04-25-trinity-level-nesting-c-range-channel-boundary-semantics.md
git commit -m "实现：深化三位一体 C/range/channel 边界语义"
```

Expected:

- commit succeeds
- 该提交只覆盖 `11.4 C / range / channel 边界深化`

## 自检结论

本计划已经对齐 `11.4` 的四个目标：

1. 标准 C 优先使用真实中枢上沿 / 下沿
2. `range / channel` 输出专属上下沿、突破、跌破、回踩、反抽条件
3. 失效条件尽量带明确边界价位
4. `延伸C / complex C` 只沿用边界逻辑，不套标准节点

同时显式排除了：

- `11.5 量能 / 背离 / 均线权重融合`
- B / D 节点语义返工
- 交易周期总线布局重构

因此，执行完成后可以直接进入 `11.5`，不需要回头再补 `11.4` 的边界说明。
