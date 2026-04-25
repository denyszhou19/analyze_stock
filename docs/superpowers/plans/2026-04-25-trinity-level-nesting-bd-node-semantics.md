# B / D 节点语义深化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只针对 `2026-04-25-trinity-level-nesting-executable-conditions-design.md` 的 `11.3`，把 B / D 标准结构从“泛化 family 模板”升级为“后端明确给出节点语义，再驱动等待 / 确认 / 失效条件”。

**Architecture:** 继续以 `trinity_decision.level_nesting` 为唯一正式出口，不让前端自己判断节点。后端新增一个 `node_semantic` 结构块，复用现有 `structure_details.prediction`、`interpretation.current_leg`、`structure.node_map` 与 explainability 字段，优先识别 B 类的 `b1 / b3 / b5 / b7` 操作点和 D 类的 `d1 / d2 / d3 / d4` 节奏，再把节点语义写入等待 / 确认 / 失效条件。

**Tech Stack:** Python 3, `unittest`, Next.js App Router, React 19, TypeScript, node:test, pnpm, HTTP regression via local Next API。

---

## 策略任务清单

本计划只做 `11.3 下一阶段一：B / D 节点语义深化`，不提前动 `11.4` 与 `11.5`。

1. 只对 `qualification == 'standard'` 的 B / D 结构尝试输出精确节点语义；`extended / unfinished / complex / range / channel` 继续沿用 family 级别文案，不伪造节点。
2. B 类输出的是“更接近哪类操作点”，而不是强行把全部 `b1-b10` 完整重建；第一版只锁定 `b1 / b3 / b5 / b7`。
3. D 类输出的是“当前更接近 `d1 / d2 / d3 / d4` 哪个节奏”，并保留现有 `d3` 不稳定点语义。
4. 节点语义必须以后端为准，前端只展示：
   - 节点标签
   - 节点原因
   - 节点驱动出的等待 / 确认 / 失效条件
5. 级别嵌套硬闸门不改变：
   - `blocked / structure_mismatch / parent_unclear` 仍然禁止升级标准交易
   - `boundary_probe` 仍然最多轻仓试探
   - B / D 节点语义只能细化执行节奏，不能绕过父级闸门
6. 本计划完成后，允许进入 `11.4 C / range / channel 边界深化`；在此之前不做真实中枢上下沿和通道反抽模板。

## 文件结构与职责

- Modify: `scripts/stock_analyzer.py`
  - 新增 B / D 节点语义提取 helper
  - 将节点语义写入 `level_nesting.node_semantic`
  - 用节点语义细化 B / D 的条件模板与 permission 文案
- Modify: `src/lib/stock-structure-types.ts`
  - 为 `TrinityLevelNestingDecision` 增加 `node_semantic`
- Modify: `src/lib/trinity-signal-tags.ts`
  - hover 展示节点语义标签与原因
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
  - 保持“优先用 `wait_conditions`”不变，只补节点语义辅助展示
- Modify: `tests/test_trinity_decision_level_nesting.py`
  - 锁定 B / D 节点语义、节点条件与非标准结构 fallback
- Modify: `tests/test_trinity_decision_trade_qualification.py`
  - 锁定节点语义不会冲掉级别嵌套硬闸门
- Modify: `tests/trinity-signal-tags.test.ts`
  - 锁定节点语义 hover 的中文合同
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
  - 锁定 recommendation / trigger / risk 使用具体 B / D 节点条件
- Modify: `tests/analysis-page-sections.test.ts`
  - 锁定组件渲染的是中文节点语义，不泄漏内部字段

## 范围守卫

以下内容显式不在本计划内：

1. 不改 `SPACETIME_STRUCTURE_TABLE`。
2. 不重做 `trade_qualification` 的主判定逻辑，只验证节点语义不会破坏硬闸门。
3. 不补 C / range / channel 的真实边界价位。
4. 不把量能 / 背离 / 均线升级为节点语义的权重引擎。
5. 不重做交易周期总线布局，只让它读到更具体的中文条件。

### Task 0: 基线核对与工作区边界确认

**Files:**
- No source changes.

- [ ] **Step 1: 查看当前工作区状态**

Run:

```bash
git status --short
git log --oneline -3
```

Expected:

- 工作区干净或只有当前计划文档改动
- 最近两个提交包含：
  - `8af3313 优化：清晰化交易周期总线三层信号`
  - `5244822 实现：接入三位一体级别嵌套可执行条件`

- [ ] **Step 2: 跑当前级别嵌套基线测试**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
node --test tests/trinity-analysis-page-view-model.test.ts tests/trinity-signal-tags.test.ts tests/analysis-page-sections.test.ts
```

Expected:

- Python exit 0
- node:test exit 0
- 当前基线已经稳定，再开始写 11.3 的失败测试

### Task 1: 先写 B / D 节点语义失败测试

**Files:**
- Modify: `tests/test_trinity_decision_level_nesting.py`
- Modify: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 扩展测试 helper，让 payload 能携带 prediction / current_leg / explainability**

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
    ):
        standard_candidate = standard_candidate or structure_type
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
                    'boundaries': {'upper': 11.2, 'lower': 10.4, 'mid': 10.8},
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
                'structure_details': {
                    'prediction': prediction or {},
                    'explainability': {
                        'current_point_id': current_point_id,
                        'current_segment': current_segment,
                    },
                },
            },
        }
```

- [ ] **Step 2: 增加 B 类节点语义失败测试**

追加两个测试：

```python
    def test_standard_b_maps_b2_progress_to_b3_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='B双平台式',
                qualification='standard',
                direction='up',
                standard_candidate='B双平台式',
                current_leg={
                    'from_point_id': 'b2',
                    'to_point_id': 'live',
                    'direction': 'down',
                    'label': 'b2→live 下行形成中',
                },
                prediction={
                    'current_stage': 'b2拐点',
                    'next_stage': 'b3拐点',
                    'prediction_alert': '📍 B双平台式正在等待 b3 回踩确认',
                    'action_hint': '等待 b3 回踩完成后重新转强',
                },
                current_point_id='b2',
                current_segment={'label': 'b2→live'},
            ),
        )

        self.assertEqual(decision['node_semantic']['family'], 'B')
        self.assertEqual(decision['node_semantic']['actionable_node'], 'b3')
        self.assertEqual(decision['node_semantic']['label'], 'B类b3回踩确认')
        self.assertIn('b2→live 下行形成中', decision['node_semantic']['reason'])
        self.assertEqual(decision['wait_conditions'][0], '等待30分钟B类b3回踩确认')
        self.assertTrue(any('回踩平台上沿不破' in item or '平台边界' in item for item in decision['confirm_conditions']))

    def test_standard_b_maps_b4_progress_to_b5_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='B双平台式',
                qualification='standard',
                direction='up',
                standard_candidate='B双平台式',
                current_leg={
                    'from_point_id': 'b4',
                    'to_point_id': 'live',
                    'direction': 'down',
                    'label': 'b4→live 下行形成中',
                },
                prediction={'current_stage': 'b4拐点', 'next_stage': 'b5拐点'},
                current_point_id='b4',
            ),
        )

        self.assertEqual(decision['node_semantic']['actionable_node'], 'b5')
        self.assertEqual(decision['node_semantic']['label'], 'B类b5中继确认')
        self.assertEqual(decision['wait_conditions'][0], '等待30分钟B类b5中继确认')
    ```

- [ ] **Step 3: 增加 D 类节点语义失败测试**

追加两个测试：

```python
    def test_standard_d_maps_d2_progress_to_d3_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='D三段式',
                qualification='standard',
                direction='up',
                standard_candidate='D三段式',
                current_leg={
                    'from_point_id': 'd2',
                    'to_point_id': 'live',
                    'direction': 'down',
                    'label': 'd2→live 下行形成中',
                },
                prediction={
                    'current_stage': 'd2拐点',
                    'next_stage': 'd3拐点',
                    'prediction_alert': '📍 D三段式进行中，等待 d3 拐点形成',
                    'action_hint': '等待底分型确认，d3 拐点是潜在买点',
                },
                current_point_id='d2',
            ),
        )

        self.assertEqual(decision['node_semantic']['family'], 'D')
        self.assertEqual(decision['node_semantic']['actionable_node'], 'd3')
        self.assertEqual(decision['node_semantic']['label'], 'D类d3反向修正完成')
        self.assertEqual(decision['wait_conditions'][0], '等待30分钟D类d3反向修正完成')
        self.assertTrue(any('d4' in item for item in decision['confirm_conditions']))

    def test_standard_d_keeps_unstable_d3_reason_when_prediction_marks_unstable_point(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='D三段式',
                qualification='standard',
                direction='up',
                standard_candidate='D三段式',
                prediction={
                    'current_stage': 'd3拐点',
                    'next_stage': 'd4拐点（结构完成）',
                    'prediction_alert': '⚠️ D三段式d3拐点（买入不稳定点）',
                    'action_hint': 'd3是不稳定买入点，可考虑轻仓尝试',
                    'unstable_point': {
                        'is_unstable': True,
                        'type': '买入不稳定点',
                        'description': '在\"弱\"状态上涨中，d3是买入不稳定点，后续可能继续上涨',
                    },
                },
                current_leg={
                    'from_point_id': 'd3',
                    'to_point_id': 'live',
                    'direction': 'up',
                    'label': 'd3→live 上行形成中',
                },
                current_point_id='d3',
            ),
        )

        self.assertEqual(decision['node_semantic']['actionable_node'], 'd3')
        self.assertIn('买入不稳定点', decision['node_semantic']['reason'])
        self.assertIn('d4结构完成', ''.join(decision['confirm_conditions']))
    ```

- [ ] **Step 4: 增加非标准结构不伪造节点测试**

```python
    def test_extended_b_does_not_fake_exact_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='延伸B类',
                qualification='extended',
                direction='up',
                standard_candidate='B双平台式',
                prediction={'current_stage': '延伸B进行中'},
            ),
        )

        self.assertIsNone(decision.get('node_semantic'))
        self.assertTrue(any('延伸结构' in item for item in decision['wait_conditions']))
        self.assertTrue(all('b3' not in item and 'b5' not in item for item in decision['wait_conditions']))
    ```

- [ ] **Step 5: 增加交易资格保护测试**

在 `tests/test_trinity_decision_trade_qualification.py` 增加：

```python
    def test_boundary_probe_with_b3_node_semantic_still_cannot_upgrade_to_standard_trade(self) -> None:
        qualification = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': True,
                'explainability': {'reason': 'B类结构成立'},
            },
            spacetime_decision={'mismatch_reason': ''},
            moving_average_decision={'ma_gate': {'passed': True, 'reason': 'MA55 支撑有效'}},
            volume_decision={'volume_gate': {'passed': True, 'reason': '放量确认'}},
            execution_payload={'action': 'buy', 'direction': 'long', 'can_trade': True},
            level_nesting_decision={
                'resonance': 'boundary_probe',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '日线仅允许 30 分钟 B类b3 轻仓等待确认',
                },
                'node_semantic': {
                    'family': 'B',
                    'actionable_node': 'b3',
                    'label': 'B类b3回踩确认',
                    'reason': '当前只到 b3 回踩确认阶段',
                },
            },
        )

        self.assertEqual(qualification['trade_mode'], 'conditional_boundary_trade')
        self.assertEqual(qualification['position_permission'], 'light_probe')
    ```

- [ ] **Step 6: 运行测试，确认先失败**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
```

Expected:

- FAIL
- 失败点应集中在：
  - `node_semantic` 缺失
  - `wait_conditions` 仍是泛化 `b1/b3/b5/b7` / `d1/d2/d3/d4`
  - `reason` 未包含当前执行段或不稳定点说明

### Task 2: 后端构建 B / D 节点语义合同

**Files:**
- Modify: `scripts/stock_analyzer.py`

- [ ] **Step 1: 新增节点语义 helper**

在 `_build_trinity_level_nesting_decision()` 前新增以下 helper：

```python
    def _extract_level_nesting_stage_token(self, value: Optional[str], prefix: str) -> Optional[str]:
        if not isinstance(value, str):
            return None
        match = re.search(rf'({prefix}\\d+)', value.lower())
        return match.group(1) if match else None

    def _resolve_b_actionable_node(self, stage_token: Optional[str]) -> Optional[str]:
        mapping = {
            'b1': 'b1',
            'b2': 'b3',
            'b3': 'b3',
            'b4': 'b5',
            'b5': 'b5',
            'b6': 'b7',
            'b7': 'b7',
        }
        return mapping.get(stage_token or '')

    def _resolve_d_actionable_node(self, stage_token: Optional[str]) -> Optional[str]:
        return {
            'd1': 'd1',
            'd2': 'd3',
            'd3': 'd3',
            'd4': 'd4',
        }.get(stage_token or '')
```

- [ ] **Step 2: 新增统一节点语义构建器**

继续新增：

```python
    def _build_level_nesting_node_semantic(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        family: str,
        qualification: str,
        level_label: str,
    ) -> Optional[Dict[str, Any]]:
        if family not in {'B', 'D'} or qualification != 'standard':
            return None

        child_payload = child_payload if isinstance(child_payload, dict) else {}
        structure_payload = child_payload.get('structure') or {}
        interpretation = structure_payload.get('interpretation') or {}
        details = structure_payload.get('structure_details') or {}
        prediction = details.get('prediction') or {}
        explainability = details.get('explainability') or {}
        current_leg = interpretation.get('current_leg') or {}
        stage_token = (
            self._extract_level_nesting_stage_token(prediction.get('current_stage'), family.lower())
            or self._extract_level_nesting_stage_token(prediction.get('next_stage'), family.lower())
            or self._extract_level_nesting_stage_token(current_leg.get('label'), family.lower())
            or self._extract_level_nesting_stage_token(explainability.get('current_point_id'), family.lower())
        )

        actionable_node = (
            self._resolve_b_actionable_node(stage_token)
            if family == 'B'
            else self._resolve_d_actionable_node(stage_token)
        )
        if not actionable_node:
            return None

        unstable_point = prediction.get('unstable_point') or {}
        label_map = {
            'b1': 'B类b1启动确认',
            'b3': 'B类b3回踩确认',
            'b5': 'B类b5中继确认',
            'b7': 'B类b7末端确认',
            'd1': 'D类d1起点观察',
            'd2': 'D类d2修正展开',
            'd3': 'D类d3反向修正完成',
            'd4': 'D类d4结构完成',
        }
        evidence = [
            current_leg.get('label') or '',
            prediction.get('current_stage') or '',
            prediction.get('next_stage') or '',
            explainability.get('current_point_id') or '',
        ]
        if family == 'D' and unstable_point.get('description'):
            evidence.insert(0, unstable_point.get('description'))

        reason = '；'.join([item for item in evidence if item]) or f'{level_label}{label_map[actionable_node]}'
        return {
            'family': family,
            'actionable_node': actionable_node,
            'label': label_map[actionable_node],
            'reason': reason,
            'evidence': [item for item in evidence if item][:3],
        }
```

- [ ] **Step 3: 将节点语义挂进 `level_nesting` 合同**

在 `_build_trinity_level_nesting_decision()` 中，`conditions = ...` 前加入：

```python
        node_semantic = self._build_level_nesting_node_semantic(
            child_payload=child_payload,
            family=family,
            qualification=qualification,
            level_label=child_label,
        )
```

并在返回值里补：

```python
            'node_semantic': node_semantic,
```

- [ ] **Step 4: 运行 Python 测试，确认合同字段开始出现**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py
```

Expected:

- 仍可能 FAIL
- 但失败应从“字段不存在”缩小为“条件文案还不够具体”

### Task 3: 用节点语义重写 B / D 条件模板，且不破坏硬闸门

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `tests/test_trinity_decision_level_nesting.py`
- Modify: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 新增节点语义条件模板 helper**

在 `_family_condition_templates()` 附近新增：

```python
    def _build_node_semantic_conditions(
        self,
        *,
        level_label: str,
        node_semantic: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, List[str]]]:
        if not node_semantic:
            return None

        actionable_node = node_semantic.get('actionable_node')
        templates = {
            'b1': {
                'wait': [f'等待{level_label}B类b1启动确认'],
                'confirm': [f'{level_label}B类b1启动后站稳平台上沿', f'{level_label}突破后回踩不破'],
                'invalid': [f'{level_label}跌回启动低点失效'],
            },
            'b3': {
                'wait': [f'等待{level_label}B类b3回踩确认'],
                'confirm': [f'{level_label}回踩平台边界不破并重新转强', f'{level_label}边界放量突破确认'],
                'invalid': [f'{level_label}跌破平台下沿失效'],
            },
            'b5': {
                'wait': [f'等待{level_label}B类b5中继确认'],
                'confirm': [f'{level_label}二次回踩确认后重新转强', f'{level_label}突破中继平台上沿'],
                'invalid': [f'{level_label}跌回中继平台下沿失效'],
            },
            'b7': {
                'wait': [f'等待{level_label}B类b7末端确认'],
                'confirm': [f'{level_label}末端转强并出现确认信号'],
                'invalid': [f'{level_label}末端再度跌回平台内失效'],
            },
            'd1': {
                'wait': [f'等待{level_label}D类d2修正展开'],
                'confirm': [f'{level_label}d2修正段形成'],
                'invalid': [f'{level_label}起点被反向吞没，D类重判'],
            },
            'd2': {
                'wait': [f'等待{level_label}D类d3反向修正完成'],
                'confirm': [f'{level_label}d3拐点出现并完成止跌/止涨'],
                'invalid': [f'{level_label}修正段失控，D类节奏重判'],
            },
            'd3': {
                'wait': [f'等待{level_label}D类d3反向修正完成'],
                'confirm': [f'{level_label}d4结构完成并出现确认信号'],
                'invalid': [f'{level_label}d3之后再次失守关键修正低点，按失败处理'],
            },
            'd4': {
                'wait': [f'等待{level_label}D类d4结构完成后的方向选择'],
                'confirm': [f'{level_label}d4终点确认后出现新的方向信号'],
                'invalid': [f'{level_label}d4终点确认失败，结构重新评估'],
            },
        }
        return templates.get(actionable_node)
```

- [ ] **Step 2: 在 `_build_level_nesting_conditions()` 里优先使用节点语义模板**

把函数签名改成：

```python
    def _build_level_nesting_conditions(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        level_label: str,
        family: str,
        qualification: str,
        node_semantic: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, List[str]]:
```

并在读取 `templates` 后改成：

```python
        semantic_templates = self._build_node_semantic_conditions(
            level_label=level_label,
            node_semantic=node_semantic,
        )
        if semantic_templates:
            templates = semantic_templates
```

同时在 `_build_trinity_level_nesting_decision()` 调用时把 `node_semantic=node_semantic` 传进去。

- [ ] **Step 3: 把节点语义写进 permission 原因**

在 `_build_level_nesting_permission_reason()` 开头多接一个参数：

```python
        node_semantic: Optional[Dict[str, Any]] = None,
```

并在返回前加入：

```python
        node_label = (node_semantic or {}).get('label')
        if resonance == 'aligned' and node_label:
            return f'{parent_label}{status_text}支持{child_label}{node_label}，但仍需按节点确认节奏执行'
```

在调用处同步传入 `node_semantic=node_semantic`。

- [ ] **Step 4: 锁定 D 类不稳定点不会冲掉硬闸门**

在 `tests/test_trinity_decision_trade_qualification.py` 再加一个测试：

```python
    def test_aligned_d3_unstable_stage_still_keeps_light_probe_instead_of_standard_node_trade(self) -> None:
        qualification = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': True,
                'explainability': {'reason': 'D类结构成立'},
            },
            spacetime_decision={'mismatch_reason': ''},
            moving_average_decision={'ma_gate': {'passed': True, 'reason': '均线支持'}},
            volume_decision={'volume_gate': {'passed': True, 'reason': '量能支持'}},
            execution_payload={'action': 'buy', 'direction': 'long', 'can_trade': True},
            level_nesting_decision={
                'resonance': 'aligned',
                'execution_strength': 'light_probe',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '当前仅到 D类d3 反向修正完成阶段，只允许轻仓观察',
                },
                'node_semantic': {
                    'family': 'D',
                    'actionable_node': 'd3',
                    'label': 'D类d3反向修正完成',
                    'reason': 'd3 属于不稳定点，不能直接升级为标准交易',
                },
            },
        )

        self.assertEqual(qualification['trade_mode'], 'conditional_boundary_trade')
        self.assertEqual(qualification['position_permission'], 'light_probe')
    ```

- [ ] **Step 5: 运行 Python 套件，确认后端闭环通过**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_trade_qualification.py
```

Expected:

- PASS
- `wait_conditions` / `confirm_conditions` 对 B / D 标准结构已变成具体节点语义

### Task 4: 更新前端合同与展示，只展示后端节点语义

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
  node_semantic?: {
    family: 'B' | 'D' | string;
    actionable_node:
      | 'b1'
      | 'b3'
      | 'b5'
      | 'b7'
      | 'd1'
      | 'd2'
      | 'd3'
      | 'd4'
      | 'unknown'
      | string;
    label: string;
    reason: string;
    evidence?: string[];
  } | null;
```

- [ ] **Step 2: 在 `trinity-signal-tags.ts` hover 中展示节点语义**

把 `buildLevelNestingHoverItems()` 改成：

```ts
function buildLevelNestingHoverItems(
  decision: TrinityDecision
): Array<{ label: string; value?: string | null }> {
  const levelNesting = decision.level_nesting;
  const nodeSemantic = levelNesting?.node_semantic;
  return [
    { label: '父级偏向', value: parentBiasLabel(levelNesting?.parent_bias) },
    { label: '关系状态', value: levelNestingLabel(levelNesting?.resonance) },
    { label: '结构原型', value: levelNesting?.child_structure_family },
    { label: '结构资格', value: qualificationLabel(levelNesting?.child_structure_qualification) },
    { label: '节点语义', value: nodeSemantic?.label },
    { label: '节点原因', value: nodeSemantic?.reason },
    { label: '等待条件', value: levelNesting?.wait_conditions?.join('、') },
    { label: '确认条件', value: levelNesting?.confirm_conditions?.join('、') },
    { label: '失效条件', value: levelNesting?.invalidation_conditions?.join('、') },
    { label: '说明', value: levelNesting?.permission.reason ?? decision.conclusion.wait_reason },
  ];
}
```

- [ ] **Step 3: 锁定 signal tag 测试**

在 `tests/trinity-signal-tags.test.ts` 新增：

```ts
test('buildDecisionSignalTags shows backend B / D node semantic in Chinese hover only', () => {
  const tags = signalTags.buildDecisionSignalTags(
    createDecision({
      level_nesting: {
        parent_bias: 'bullish',
        child_signal: 'long',
        resonance: 'aligned',
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '日线支持30分钟B类b3回踩确认，但仍需等待边界确认',
        },
        node_semantic: {
          family: 'B',
          actionable_node: 'b3',
          label: 'B类b3回踩确认',
          reason: '当前执行段为 b2→live 下行形成中',
        },
        wait_conditions: ['等待30分钟B类b3回踩确认'],
        confirm_conditions: ['30分钟回踩平台边界不破并重新转强'],
        invalidation_conditions: ['30分钟跌破平台下沿失效'],
      },
    })
  );

  const tag = tags.find((item) => item.key === 'level_nesting');
  assert.ok(tag);
  assert.ok(tag.hover.items.some((item) => item.label === '节点语义' && item.value === 'B类b3回踩确认'));
  assert.ok(tag.hover.items.some((item) => item.label === '节点原因' && item.value?.includes('b2→live')));
  assert.ok(tag.hover.items.every((item) => !String(item.value ?? '').includes('actionable_node')));
});
```

- [ ] **Step 4: 在 view model hover 中补节点语义解释，但不让前端自己推理**

在 `src/lib/trinity-analysis-page-view-model.ts` 的组合触发 hover 里，把“为什么这么判断”优先改成：

```ts
        createHoverItem(
          '为什么这么判断',
          minor?.level_nesting?.node_semantic?.reason ??
            triggerHoverValue
        ),
```

并在 `buildCombinationActionStateTags()` 的 `级别` 标签 hover 中补一行：

```ts
      ...(nesting?.node_semantic?.label
        ? [{ label: '节点语义', value: nesting.node_semantic.label }]
        : []),
```

要求：

- 只消费后端 `node_semantic`
- 不在前端根据 `current_leg` 或 `b3 / d3` 文字自行反推节点

- [ ] **Step 5: 锁定 view model 推荐文案改成具体节点**

在 `tests/trinity-analysis-page-view-model.test.ts` 增加：

```ts
test('trading bus prefers B / D node semantic wait conditions over generic family wording', () => {
  const result = createResult();
  const decision = result.periods.hour30.trinity_decision!;
  decision.level_nesting = {
    ...decision.level_nesting,
    resonance: 'aligned',
    execution_strength: 'light_probe',
    permission: {
      allow_position_increase: false,
      allow_t_trade: true,
      allow_only_light_probe: true,
      reason: '日线支持30分钟B类b3回踩确认，但需继续等节点完成',
    },
    node_semantic: {
      family: 'B',
      actionable_node: 'b3',
      label: 'B类b3回踩确认',
      reason: '当前执行段为 b2→live 下行形成中',
    },
    wait_conditions: ['等待30分钟B类b3回踩确认'],
    confirm_conditions: ['30分钟回踩平台边界不破并重新转强'],
    invalidation_conditions: ['30分钟跌破平台下沿失效'],
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.recommendation, '先等30分钟B类b3回踩确认');
  assert.match(shortline.triggerLevel.value, /30分钟：B类b3回踩确认/);
  assert.equal(shortline.majorRisk.value, '30分钟跌破平台下沿失效');
});
```

- [ ] **Step 6: 锁定组件输出中文节点条件**

在 `tests/analysis-page-sections.test.ts` 增加或改成：

```ts
  assert.match(html, /等待30分钟B类b3回踩确认/);
  assert.doesNotMatch(html, /actionable_node/);
  assert.doesNotMatch(html, /node_semantic/);
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
- 页面继续只展示中文，不泄漏内部合同字段

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

- [ ] **Step 3: 手动 spot-check B / D 节点语义合同**

Run:

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15" | python3 -c "
import json,sys
r=json.load(sys.stdin)
for level in ['daily','hour60','hour30','hour15']:
    d=((r['data']['periods'].get(level) or {}).get('trinity_decision') or {})
    nesting=d.get('level_nesting') or {}
    print(level, nesting.get('node_semantic'))
    print('wait=', nesting.get('wait_conditions'))
    print('confirm=', nesting.get('confirm_conditions'))
"
```

Expected:

- B / D 标准结构层如果命中节点语义，应出现中文 `label`
- 非标准结构不应伪造 `b3 / d3` 之类的精确节点

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
  docs/superpowers/plans/2026-04-25-trinity-level-nesting-bd-node-semantics.md
git commit -m "实现：深化三位一体 B/D 节点语义"
```

Expected:

- commit succeeds
- 该提交只覆盖 `11.3 B / D 节点语义深化`

## 自检结论

本计划已经对齐 `11.3` 的四个目标：

1. B 类根据 `node_map / current_leg / structure explainability / prediction` 判断更接近 `b1 / b3 / b5 / b7`
2. D 类根据 `current_leg / prediction / unstable_point` 判断更接近 `d1 / d2 / d3 / d4`
3. 后端输出更具体节点条件，而不是泛化 `b1/b3/b5/b7` 与 `d1/d2/d3/d4`
4. 前端只展示后端给出的节点语义，不自己判断节点

同时显式排除了：

- `11.4 C / range / channel 边界深化`
- `11.5 量能 / 背离 / 均线权重融合`

因此，执行完成后可以直接进入 `11.4`，不需要回头再补 `11.3` 的边界说明。
