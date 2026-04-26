# 量能 / 背离 / 均线权重融合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只针对 `2026-04-25-trinity-level-nesting-executable-conditions-design.md` 的 `11.5`，把量能、背离、均线从旁路信号升级成 `level_nesting.wait_conditions / confirm_conditions / invalidation_conditions` 的正式修饰层。

**Architecture:** 后端继续以 `trinity_decision.level_nesting` 为唯一正式出口，不新增新的公开合同字段。实现上复用已经存在的 `moving_average`、`volume_confirmation`、`divergence_weight` 三个判定块，在 `stock_analyzer.py` 内部新增一个“修饰层上下文 + 修饰层条件” helper，把结构主框架先生成，再把量能 / 背离 / 均线修饰语句按优先级并入条件数组。前端原则上不新增逻辑，只通过现有 view model 优先消费这些更具体的中文条件文案。

**Tech Stack:** Python 3, `unittest`, Next.js App Router, React 19, TypeScript, node:test, pnpm, HTTP regression via local Next API。

---

## 策略任务清单

本计划只做 `11.5 下一阶段三：量能 / 背离 / 均线权重融合`，不回头改 `11.3` 与 `11.4` 的结构主框架。

1. 量能不再只在单独 badge 中显示，而要正式进入 `confirm_conditions` / `wait_conditions`。
2. 背离不重新发明检测器，直接消费 `divergence_weight` 的现有结果，把“压制 / 加分”翻译成用户可执行的等待、确认、失效语言。
3. 均线不单独作为旁路说明，而要进入确认与失效条件，例如：
   - `站上30分钟MA55后回踩不破再确认`
   - `跌破30分钟MA55且反抽不过失效`
4. 修饰层不能绕过前两阶段的硬闸门：
   - `blocked / structure_mismatch / parent_unclear` 仍然禁止升级标准交易
   - `boundary_probe` 仍然最多轻仓试探
   - `node_semantic / boundary_semantic` 仍然是主结构语义，量能 / 背离 / 均线只是修饰层
5. 本计划完成后，`wait_conditions / confirm_conditions / invalidation_conditions` 要能同时表达：
   - 结构触发
   - 量能确认
   - 背离压制或加分
   - MA55 / MA233 的确认或失效

## 文件结构与职责

- Modify: `scripts/stock_analyzer.py`
  - 新增量能 / 背离 / 均线修饰层 helper
  - 把修饰层并入 `_build_level_nesting_conditions()`
  - 必要时微调 wait/judgment 原因优先级，让抑制型背离与量能不足能落到中文等待语句里
- Modify: `tests/test_trinity_decision_level_nesting.py`
  - 锁定修饰层进入 `wait_conditions / confirm_conditions / invalidation_conditions`
- Modify: `tests/test_trinity_decision_phase2_contract.py`
  - 锁定完整 `trinity_decision` 合同在背离压制、量能不足、均线门控下的最终等待语义
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
  - 锁定交易组合推荐、触发、下一步条件优先显示修饰后的中文条件
- Modify: `tests/analysis-page-sections.test.ts`
  - 锁定页面渲染新的中文修饰层文案，不泄漏内部英文枚举

## 范围守卫

以下内容显式不在本计划内：

1. 不新增新的公开 API 合同字段；优先复用现有 `wait_conditions / confirm_conditions / invalidation_conditions`。
2. 不重做顶背离 / 底背离识别算法；直接消费已有 `divergence_weight` 结果。
3. 不重做 `SPACETIME_STRUCTURE_TABLE`。
4. 不回头改 B / D 节点推理和 C / range / channel 边界建模。
5. 不重做交易周期总线布局或卡片结构。
6. 不让前端自行根据 MA、量能、背离原始字段推导条件；前端只消费后端最终中文条件。

### Task 0: 基线核对与 11.5 边界确认

**Files:**
- No source changes.

- [ ] **Step 1: 查看当前工作区与最近提交**

Run:

```bash
git status --short
git log --oneline -6
```

Expected:

- 工作区干净
- 最近提交已经包含 `11.4` 的后端、前端和计划文档

- [ ] **Step 2: 跑 11.4 基线测试**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_phase2_contract.py
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
```

Expected:

- 三条命令全部 exit 0
- 当前 `11.4` 稳定，再开始写 `11.5` 的失败测试

### Task 1: 先写 11.5 失败测试，锁定修饰层目标

**Files:**
- Modify: `tests/test_trinity_decision_level_nesting.py`
- Modify: `tests/test_trinity_decision_phase2_contract.py`

- [ ] **Step 1: 扩展级别嵌套测试 helper，让 child payload 能携带已有判定块**

在 `tests/test_trinity_decision_level_nesting.py` 里，把 `_payload()` 扩成下面的形状：

```python
    def _payload(
        self,
        *,
        status='强',
        structure_type='C单平台式',
        qualification='standard',
        direction='up',
        boundaries=None,
        boundary_levels=None,
        moving_average=None,
        volume_confirmation=None,
        divergence_weight=None,
        probe_entry=None,
        confirm_entry=None,
        invalidation=None,
        next_confirmation_action=None,
        execution_confirmation=None,
        execution_invalidation=None,
    ):
        boundaries = boundaries if boundaries is not None else {
            'upper': 11.2,
            'lower': 10.4,
            'mid': 10.8,
            'breakout_trigger': 11.2,
            'breakdown_trigger': 10.4,
            'stop_loss': 10.4,
        }
        boundary_levels = boundary_levels if boundary_levels is not None else dict(boundaries)
        return {
            'macd': {'status': status},
            'trinity_decision': {
                'spacetime': {'status': status},
                'conclusion': {'bias': 'bullish' if direction == 'up' else 'bearish' if direction == 'down' else 'neutral'},
                'structure': {
                    'type': structure_type,
                    'standard_candidate': structure_type,
                    'qualification': qualification,
                    'direction': direction,
                    'boundaries': dict(boundaries),
                    'node_map': {'a4': None, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': None},
                },
                'moving_average': moving_average or {
                    'ma55_role': 'support',
                    'ma233_role': 'neutral',
                    'breakthrough_state': 'breakout_pending',
                    'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': '站上MA55前先观察'},
                },
                'volume_confirmation': volume_confirmation or {
                    'breakout_volume': 'weak',
                    'breakdown_volume': 'not_applicable',
                    'pullback_volume': 'normal',
                    'volume_gate': {'confidence_adjustment': 'downgrade', 'reason': '突破量弱，等待二次确认'},
                },
                'divergence_weight': divergence_weight or {
                    'status': 'neutral',
                    'label': '背离影响中性',
                    'reason': '暂无足够背离强化或削弱信号',
                    'impact_on_judgment': 'neutral',
                },
                'execution_plan': {
                    'probe_entry': probe_entry,
                    'confirm_entry': confirm_entry,
                    'invalidation': invalidation,
                },
                'wait_state': {
                    'next_confirmation_action': next_confirmation_action,
                },
                'execution': {
                    'confirmation': execution_confirmation or [],
                    'invalidation': execution_invalidation or [],
                },
            },
            'structure': {
                'trend_direction': '上涨' if direction == 'up' else '下跌' if direction == 'down' else '震荡',
                'structure_type': structure_type,
                'structure_details': {
                    'boundary_levels': dict(boundary_levels),
                },
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': structure_type[0],
                        'standard_qualification': qualification,
                        'directional_bias': direction,
                    },
                },
            },
        }
```

- [ ] **Step 2: 增加三类失败测试，先锁目标语义**

在 `tests/test_trinity_decision_level_nesting.py` 追加下面三个测试：

```python
    def test_boundary_conditions_keep_price_and_append_volume_weak_confirmation(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='C单平台式',
                qualification='standard',
                direction='up',
                volume_confirmation={
                    'breakout_volume': 'weak',
                    'breakdown_volume': 'not_applicable',
                    'pullback_volume': 'normal',
                    'volume_gate': {'confidence_adjustment': 'downgrade', 'reason': '突破量弱，等待二次确认'},
                },
            ),
        )

        self.assertTrue(any(item == '等待30分钟突破平台上沿11.20' for item in decision['wait_conditions']))
        self.assertTrue(any('突破量弱' in item and '二次' in item for item in decision['confirm_conditions']))

    def test_supportive_ma55_pullback_modifier_enters_confirm_and_invalid_lists(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='B双平台式',
                qualification='standard',
                direction='up',
                moving_average={
                    'ma55_role': 'support',
                    'ma233_role': 'support',
                    'breakthrough_state': 'pullback_confirmed',
                    'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': 'MA55支撑有效'},
                },
            ),
        )

        self.assertTrue(any('MA55' in item and '回踩不破' in item for item in decision['confirm_conditions']))
        self.assertTrue(any('MA55' in item and '反抽不过' in item for item in decision['invalidation_conditions']))

    def test_suppressive_divergence_adds_wait_and_risk_copy_without_leaking_enum(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='C单平台式',
                qualification='standard',
                direction='up',
                divergence_weight={
                    'status': 'suppressive',
                    'label': '顶背离压制',
                    'reason': '顶背离仍在压制，先不追高',
                    'impact_on_judgment': 'suppress',
                },
            ),
        )

        self.assertTrue(any('顶背离压制' in item for item in decision['wait_conditions']))
        self.assertTrue(any('顶背离' in item for item in decision['invalidation_conditions']))
        self.assertTrue(all('suppressive' not in item for item in decision['wait_conditions'] + decision['confirm_conditions'] + decision['invalidation_conditions']))
```

- [ ] **Step 3: 增加完整 phase2 合同失败测试**

在 `tests/test_trinity_decision_phase2_contract.py` 追加一个完整合同用例：

```python
    def test_modifier_layers_flow_into_wait_state_and_judgment_copy(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台整理',
                'trend_direction': '上涨',
                'description': '30分钟平台待突破',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'directional_bias': 'up',
                    },
                    'spacetime_gate': {
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'wait_reason': '等待平台边界确认',
                        'required_confirmation': '等待30分钟放量突破平台上沿11.20',
                    },
                },
                'structure_details': {
                    'boundary_levels': {
                        'upper': 11.2,
                        'lower': 10.4,
                        'mid': 10.8,
                        'breakout_trigger': 11.2,
                        'breakdown_trigger': 10.4,
                        'stop_loss': 10.4,
                    },
                },
            },
            macd_payload={'status': '中偏强', 'top_divergence': True},
            moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'below', 'ma_status': '临近MA233压制'},
            breakthrough_payload={'pattern_type': 'breakout_pending', 'direction': 'up', 'is_valid': False},
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['等待30分钟突破平台上沿11.20'],
                'confirmation': ['突破后回踩11.20不破'],
                'invalidation': ['跌破10.40失效'],
                'rationale': '先看平台边界与量能确认',
            },
            level_nesting_payload={
                'parent_level': 'daily',
                'child_level': 'hour30',
                'parent_bias': 'bullish',
                'child_signal': 'long',
                'resonance': 'boundary_probe',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '日线中偏强，30分钟边界试探只允许轻仓等待确认',
                },
                'wait_conditions': ['等待30分钟突破平台上沿11.20'],
                'confirm_conditions': ['30分钟突破11.20后回踩不破再确认'],
                'invalidation_conditions': ['跌破30分钟中枢下沿10.40失效'],
            },
            period_payload={'volume_ratio_5': 0.98, 'volume_ratio_20': 1.02, 'amount_ratio_20': 1.01},
        )

        self.assertEqual(decision['judgment']['label'], '严格等待')
        self.assertIn('顶背离', decision['judgment']['critical_reason'])
        self.assertIn('顶背离', decision['divergence_weight']['label'])
```

- [ ] **Step 4: 运行 Python 套件，确认失败点落在 11.5 新目标**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_phase2_contract.py
```

Expected:

- 失败集中在：
  - 条件数组还没有出现 `量能弱 / 顶背离压制 / MA55回踩不破`
  - 完整合同里 `judgment` 或 `wait_state` 还没有优先读取这些修饰层语句

- [ ] **Step 5: Commit 失败测试**

```bash
git add tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_phase2_contract.py
git commit -m "测试：补齐11.5修饰层失败用例"
```

### Task 2: 在后端新增修饰层上下文与条件生成 helper

**Files:**
- Modify: `scripts/stock_analyzer.py`

- [ ] **Step 1: 新增修饰层上下文 helper**

在 `_build_level_nesting_conditions()` 附近新增：

```python
    def _build_level_nesting_modifier_context(
        self,
        child_payload: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        decision = child_payload.get('trinity_decision') or {}
        moving_average = decision.get('moving_average') or {}
        volume_confirmation = decision.get('volume_confirmation') or {}
        divergence_weight = decision.get('divergence_weight') or {}
        return {
            'ma55_role': moving_average.get('ma55_role'),
            'ma233_role': moving_average.get('ma233_role'),
            'breakthrough_state': moving_average.get('breakthrough_state'),
            'ma_reason': ((moving_average.get('ma_gate') or {}).get('reason')),
            'breakout_volume': volume_confirmation.get('breakout_volume'),
            'breakdown_volume': volume_confirmation.get('breakdown_volume'),
            'pullback_volume': volume_confirmation.get('pullback_volume'),
            'volume_reason': ((volume_confirmation.get('volume_gate') or {}).get('reason')),
            'divergence_status': divergence_weight.get('status'),
            'divergence_label': divergence_weight.get('label'),
            'divergence_reason': divergence_weight.get('reason'),
            'divergence_impact': divergence_weight.get('impact_on_judgment'),
        }
```

- [ ] **Step 2: 新增修饰层条件 helper**

在同一区域新增：

```python
    def _build_level_nesting_modifier_conditions(
        self,
        *,
        level_label: str,
        direction: str,
        modifier_context: Dict[str, Any],
    ) -> Dict[str, List[str]]:
        wait_items: List[str] = []
        confirm_items: List[str] = []
        invalid_items: List[str] = []

        divergence_label = modifier_context.get('divergence_label') or ''
        divergence_reason = modifier_context.get('divergence_reason') or ''
        if modifier_context.get('divergence_status') in {'hard_block', 'suppressive'}:
            wait_items.append(f'{level_label}{divergence_label}，先等背离钝化再确认')
            invalid_items.append(f'{level_label}{divergence_reason or divergence_label}，当前追价计划取消')
        elif modifier_context.get('divergence_status') == 'supportive':
            confirm_items.append(f'{level_label}{divergence_label}，止跌后可提高确认优先级')

        if direction == 'up' and modifier_context.get('breakout_volume') == 'weak':
            confirm_items.append(f'{level_label}突破量弱，等待二次放量确认')
        if direction == 'down' and modifier_context.get('breakdown_volume') == 'weak':
            confirm_items.append(f'{level_label}跌破量弱，等待二次放量确认')
        if modifier_context.get('pullback_volume') == 'healthy_shrink':
            confirm_items.append(f'{level_label}回踩缩量，确认后再执行')

        if modifier_context.get('ma55_role') == 'support' and modifier_context.get('breakthrough_state') in {'valid_breakout', 'pullback_confirmed'}:
            confirm_items.append(f'站上{level_label}MA55后回踩不破再确认')
            invalid_items.append(f'跌破{level_label}MA55且反抽不过失效')
        if modifier_context.get('ma55_role') == 'resistance' and modifier_context.get('breakthrough_state') in {'valid_breakdown', 'pullback_breakdown_confirmed'}:
            confirm_items.append(f'反抽{level_label}MA55不过再确认')
        if modifier_context.get('ma233_role') == 'resistance' and direction == 'up':
            wait_items.append(f'{level_label}尚未站上MA233，趋势加仓继续等待')
        if modifier_context.get('ma233_role') == 'support' and direction == 'down':
            invalid_items.append(f'{level_label}重新站回MA233上方，按跌破失败处理')

        return {
            'wait_conditions': wait_items,
            'confirm_conditions': confirm_items,
            'invalidation_conditions': invalid_items,
        }
```

- [ ] **Step 3: 把修饰层插入 `_build_level_nesting_conditions()`**

把 `_build_level_nesting_conditions()` 改成先生成结构主框架，再并入修饰层，顺序固定为：

1. `node_semantic` 或 `boundary_semantic` 或 family 模板
2. 修饰层条件
3. `execution_plan` / `wait_state` / `execution.confirmation` / `execution.invalidation`

更新骨架：

```python
        modifier_context = self._build_level_nesting_modifier_context(child_payload)
        modifier_conditions = self._build_level_nesting_modifier_conditions(
            level_label=level_label,
            direction=direction,
            modifier_context=modifier_context,
        )

        wait_items = [
            *base_wait_items,
            *(modifier_conditions.get('wait_conditions') or []),
            execution_plan.get('probe_entry'),
            wait_state.get('next_confirmation_action'),
        ]
        confirm_items = [
            *base_confirm_items,
            *(modifier_conditions.get('confirm_conditions') or []),
            execution_plan.get('confirm_entry'),
            *((execution.get('confirmation') or []) if isinstance(execution.get('confirmation'), list) else []),
        ]
        invalid_items = [
            *base_invalid_items,
            *(modifier_conditions.get('invalidation_conditions') or []),
            execution_plan.get('invalidation'),
            *((execution.get('invalidation') or []) if isinstance(execution.get('invalidation'), list) else []),
        ]
```

要求：

- 不打乱 `node_semantic / boundary_semantic` 作为主结构语义的优先级
- 修饰层必须排在旧 execution fallback 之前，避免被截断
- 继续通过 `_compact_condition_list()` 生成三条以内的最终列表

- [ ] **Step 4: 跑 Python 套件，确认失败测试转绿**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_phase2_contract.py
```

Expected:

- Task 1 的失败测试转绿
- 没有引入新的级别嵌套回归

- [ ] **Step 5: Commit 后端修饰层实现**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_phase2_contract.py
git commit -m "后端：接入11.5量能背离均线修饰层"
```

### Task 3: 锁定完整等待语义，不让抑制型信号留在旁路

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `tests/test_trinity_decision_phase2_contract.py`

- [ ] **Step 1: 增加等待语义回归测试**

在 `tests/test_trinity_decision_phase2_contract.py` 追加两个测试：

```python
    def test_wait_state_prefers_modifier_language_when_volume_is_weak(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台整理',
                'trend_direction': '上涨',
                'description': '30分钟平台待突破',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'directional_bias': 'up',
                    },
                    'spacetime_gate': {
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'wait_reason': '等待量能确认',
                        'required_confirmation': '等待30分钟突破平台上沿11.20并补量',
                    },
                },
                'structure_details': {
                    'boundary_levels': {
                        'upper': 11.2,
                        'lower': 10.4,
                        'mid': 10.8,
                        'breakout_trigger': 11.2,
                        'breakdown_trigger': 10.4,
                        'stop_loss': 10.4,
                    },
                },
            },
            macd_payload={'status': '中偏强'},
            moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'above', 'ma_status': '多头排列'},
            breakthrough_payload={'pattern_type': 'breakout_pending', 'direction': 'up', 'is_valid': False},
            execution_payload={'can_trade': False, 'action': 'wait', 'direction': 'long', 'trigger': ['等待30分钟突破平台上沿11.20']},
            level_nesting_payload={
                'parent_level': 'daily',
                'child_level': 'hour30',
                'parent_bias': 'bullish',
                'child_signal': 'long',
                'resonance': 'boundary_probe',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '日线中偏强，30分钟边界试探只允许轻仓等待确认',
                },
                'wait_conditions': ['等待30分钟突破平台上沿11.20'],
                'confirm_conditions': ['30分钟突破量弱，等待二次放量确认'],
                'invalidation_conditions': ['跌破30分钟中枢下沿10.40失效'],
            },
            period_payload={'volume_ratio_5': 1.01, 'volume_ratio_20': 1.03, 'amount_ratio_20': 1.02},
        )

        self.assertIn('量能', decision['wait_state']['current_block'])

    def test_judgment_supporting_factors_surface_ma_and_divergence_copy(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'B双平台式',
                'structure_stage': '回踩确认',
                'trend_direction': '上涨',
                'description': '30分钟B类回踩确认',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'B',
                        'standard_qualification': 'standard',
                        'directional_bias': 'up',
                    },
                    'spacetime_gate': {
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'wait_reason': '等待回踩与缩量确认',
                        'required_confirmation': '站上30分钟MA55后回踩不破',
                    },
                },
                'structure_details': {
                    'boundary_levels': {
                        'upper': 11.2,
                        'lower': 10.6,
                        'mid': 10.9,
                        'breakout_trigger': 11.2,
                        'breakdown_trigger': 10.6,
                        'stop_loss': 10.6,
                    },
                },
            },
            macd_payload={'status': '中偏强', 'bottom_divergence': True},
            moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'above', 'ma_status': '多头排列'},
            breakthrough_payload={'pattern_type': 'pullback_confirmed', 'direction': 'up', 'is_valid': True},
            execution_payload={'can_trade': True, 'action': 'buy', 'direction': 'long', 'trigger': ['回踩后买入']},
            level_nesting_payload={
                'parent_level': 'daily',
                'child_level': 'hour30',
                'parent_bias': 'bullish',
                'child_signal': 'long',
                'resonance': 'aligned',
                'permission': {
                    'allow_position_increase': True,
                    'allow_t_trade': True,
                    'allow_only_light_probe': False,
                    'reason': '日线偏多支持30分钟B类回踩确认',
                },
                'wait_conditions': ['等待30分钟B类b3回踩确认'],
                'confirm_conditions': ['站上30分钟MA55后回踩不破再确认'],
                'invalidation_conditions': ['跌破30分钟MA55且反抽不过失效'],
            },
            period_payload={'volume_ratio_5': 0.82, 'volume_ratio_20': 0.88, 'amount_ratio_20': 0.86},
        )

        self.assertTrue(any('MA55' in item or '底背离' in item for item in decision['judgment']['supporting_factors']))
```

- [ ] **Step 2: 只做最小后端对齐，不重写主判定**

在 `_build_trinity_wait_state_decision()` 和 `_build_trinity_judgment_decision()` 做最小对齐：

```python
        if wait_reason and '量能' in wait_reason:
            wait_type = '等待量能确认'
        elif wait_reason and '背离' in wait_reason:
            wait_type = '等待背离钝化'
        elif wait_reason and 'MA55' in wait_reason:
            wait_type = '等待均线确认'
```

以及：

```python
        supporting_factors = [
            item for item in [
                (zero_axis_signal or {}).get('signal_label'),
                (divergence_weight or {}).get('label') if (divergence_weight or {}).get('impact_on_judgment') == 'promote' else None,
                (resonance_state or {}).get('reason') if (resonance_state or {}).get('status') == 'supportive' else None,
                execution_payload.get('rationale'),
            ]
            if item
        ]
```

要求：

- 不重排 `_build_trinity_trade_qualification()` 主逻辑
- 不新增新的顶底背离识别算法
- 只把已经存在的信号更清楚地落到等待/支持理由上

- [ ] **Step 3: 跑 Python 套件，确认完整合同转绿**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_phase2_contract.py
```

Expected:

- `wait_state` 与 `judgment` 现在能读到量能 / 背离 / 均线修饰语句

- [ ] **Step 4: Commit 完整语义对齐**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_phase2_contract.py
git commit -m "后端：对齐11.5等待与判断语义"
```

### Task 4: 锁定前端消费新文案，不新增前端推导

**Files:**
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 增加 view model 回归测试**

在 `tests/trinity-analysis-page-view-model.test.ts` 追加一个只依赖现有 `level_nesting` 数组的用例：

```typescript
test('trading combinations prefer modifier-enriched level nesting copy over legacy execution arrays', () => {
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
        wait_reason: '旧的泛化等待文案',
      },
      level_nesting: {
        parent_level: 'daily',
        child_level: 'hour30',
        parent_bias: 'bullish',
        child_signal: 'long',
        resonance: 'boundary_probe',
        execution_strength: 'light_probe',
        wait_conditions: ['等待30分钟突破平台上沿11.20', '30分钟尚未站上MA233，趋势加仓继续等待'],
        confirm_conditions: ['30分钟突破量弱，等待二次放量确认', '站上30分钟MA55后回踩不破再确认'],
        invalidation_conditions: ['顶背离仍在压制，当前追价计划取消'],
        permission: {
          allow_position_increase: false,
          allow_t_trade: true,
          allow_only_light_probe: true,
          reason: '日线中偏强，30分钟边界试探只允许轻仓等待确认',
        },
      },
      execution: {
        entry_style: 'boundary',
        triggers: ['旧的执行触发'],
        confirmation: ['旧的执行确认'],
        invalidation: ['旧的执行失效'],
        position_sizing: { reason: '旧的执行摘要' },
      },
    }),
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.equal(shortline?.recommendation, '先等待30分钟突破平台上沿11.20');
  assert.equal(shortline?.suitableAction.hoverItems.find((item) => item.label === '下一步条件')?.value, '30分钟突破量弱，等待二次放量确认、站上30分钟MA55后回踩不破再确认、旧的执行触发');
  assert.equal(shortline?.majorRisk.value, '顶背离仍在压制，当前追价计划取消');
});
```

- [ ] **Step 2: 增加页面渲染回归测试**

在 `tests/analysis-page-sections.test.ts` 追加一个只锁中文渲染的断言：

```typescript
assert.match(html, /30分钟突破量弱，等待二次放量确认/);
assert.match(html, /站上30分钟MA55后回踩不破再确认/);
assert.match(html, /顶背离仍在压制，当前追价计划取消/);
assert.doesNotMatch(html, /supports_breakout|hard_block|suppressive/);
```

- [ ] **Step 3: 运行前端测试**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
```

Expected:

- 前端不需要新增推导代码，只靠后端最终中文条件即可通过测试

- [ ] **Step 4: Commit 前端回归锁定**

```bash
git add tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
git commit -m "测试：锁定11.5修饰层前端展示"
```

### Task 5: 统一验证与 HTTP 回归

**Files:**
- No new source files.

- [ ] **Step 1: 跑完整相关测试**

Run:

```bash
python3 -m unittest \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_trinity_decision_phase2_contract.py

node --test \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-page-sections.test.ts

pnpm exec tsc --noEmit
git diff --check
```

Expected:

- 四条命令全部 exit 0

- [ ] **Step 2: 跑 HTTP 回归**

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
print('原始结构:', (d.get('raw_classification') or {}).get('type'))
print('聚焦起点来源:', (d.get('focus_origin_analysis') or {}).get('selected_origin_kind'))
print('顶分型包含209.88:', 209.88 in [f['high'] for f in d.get('top_fractals',[])])
print('聚焦起点:', focus)
"
```

Expected:

- `聚焦结构: C单平台式`
- `原始结构: 延伸C类`
- `聚焦起点来源: peak_extreme`
- `顶分型包含209.88: True`

- [ ] **Step 3: Spot-check 五周期条件文案**

Run:

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15" | python3 -c "
import json,sys
r=json.load(sys.stdin)
periods=r['data']['periods']
for level in ['weekly','daily','hour60','hour30','hour15']:
    nesting=((periods.get(level) or {}).get('trinity_decision') or {}).get('level_nesting') or {}
    print(level)
    print('  wait=', nesting.get('wait_conditions'))
    print('  confirm=', nesting.get('confirm_conditions'))
    print('  invalid=', nesting.get('invalidation_conditions'))
"
```

Expected:

- 若某层出现 `MA55 / MA233 / 顶背离 / 底背离 / 量能弱 / 缩量回踩`，这些词应直接出现在 `wait/confirm/invalidation` 中
- 用户可见文案不出现 `hard_block`、`supports_breakout`、`suppressive` 等内部枚举

- [ ] **Step 4: 最终提交**

```bash
git status --short
git log --oneline -5
```

确认工作区只剩本计划相关改动后，再按阶段提交。

## 计划自检

本计划已经对齐 `11.5` 的三类目标：

1. **量能融合**：通过 `volume_confirmation` 进入 `confirm_conditions / wait_conditions`。
2. **背离融合**：通过 `divergence_weight` 进入 `wait_conditions / invalidation_conditions` 和完整判断语义。
3. **均线融合**：通过 `moving_average` 进入 `confirm_conditions / invalidation_conditions`。

同时刻意保持三条边界不变：

1. 不新增新的公开前端合同字段。
2. 不改结构主框架优先级，`node_semantic / boundary_semantic / family template` 仍是主语义。
3. 不重写顶底背离识别算法，只消费现有结果。

因此，执行完成后，`11.5` 会补齐“结构主框架 + 三个修饰器”的闭环，但不会把 `2026-04-25` 这条线拉成新的大重构。
