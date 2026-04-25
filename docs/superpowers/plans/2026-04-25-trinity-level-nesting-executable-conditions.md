# 三位一体级别嵌套可执行条件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将三位一体级别嵌套判断接入 `SPACETIME_STRUCTURE_TABLE`，并产出可展示的等待 / 确认 / 失效条件。

**Architecture:** 后端在 `trinity_decision.level_nesting` 内新增结构化合同字段，不改变现有 `trinity_decision.structure.family` 的语义；A/B/C/D 原型写入 `level_nesting.child_structure_family`。`level_nesting` 是最终交易权限的硬闸门：父级未放行或结构错配时，任何子级局部信号都不能升级成标准交易；边界试探只能轻仓或等待确认。前端 view model 只做中文映射和展示选择，策略判断以后端 level nesting 为准。

**Tech Stack:** Python 3, `unittest`, Next.js App Router, React 19, TypeScript, node:test, pnpm, HTTP regression via local Next API。

---

## 策略硬闸门决策

本计划执行前已确认以下策略口径：

1. `level_nesting.resonance in {'blocked', 'structure_mismatch', 'parent_unclear'}` 时，最终交易资格必须降级为 `wait_confirmation` 或 `no_trade`，且 `position_permission = 'no_position'`。
2. `level_nesting.resonance == 'boundary_probe'` 时，最终交易资格最多是 `conditional_boundary_trade + light_probe`；条件未满足时必须是 `wait_confirmation + no_position`。
3. 只有 `level_nesting.resonance == 'aligned'` 且 `execution_strength == 'normal'` 时，才允许升级为 `standard_node_trade`。
4. 上述规则优先级高于子级结构节点、均线门控、量能门控和执行触发。也就是说，子级出现买点、站上 MA55、量能支持，都不能绕过父级级别嵌套闸门。

## 当前工作区前置条件

当前工作区已有上一阶段未提交 WIP：

- `src/components/stock/TradingCycleBus.tsx`
- `src/lib/trinity-analysis-page-view-model.ts`
- `tests/analysis-page-sections.test.ts`
- `tests/trinity-analysis-page-view-model.test.ts`
- `docs/superpowers/plans/2026-04-25-trading-cycle-bus-trinity-signal-clarity.md`

执行本计划前必须先决定这些 WIP 的处理方式。推荐做法：

1. 先把上一阶段交易周期总线展示层 WIP 作为一个独立提交。
2. 再执行本计划。

如果用户明确要求在当前 WIP 上继续，则每次提交只 stage 本任务相关文件，避免把无关文件混进提交。

## 文件结构与职责

- Modify: `scripts/stock_analyzer.py`
  - 新增级别嵌套结构 profile helper。
  - 新增查表匹配 helper。
  - 新增 A/B/C/D 第一版条件模板。
  - 修改 `_build_trinity_level_nesting_decision()` 产出新合同字段。
  - 修改 `_build_trinity_trade_qualification()`，让 `level_nesting` 成为最终交易资格硬闸门。
  - 修改 `_build_trinity_resonance_state()`，让 `blocked` / `structure_mismatch` / `boundary_probe` 进入判断摘要和硬约束链路。
- Modify: `src/lib/stock-structure-types.ts`
  - 扩展 `TrinityLevelNestingDecision` 类型。
  - 保持 `TrinityStructureDecision.family` 现有语义不变。
- Modify: `src/lib/trinity-signal-tags.ts`
  - 增加新 resonance 中文标签和 tone。
  - level nesting hover 增加等待 / 确认 / 失效条件。
- Modify: `src/lib/trinity-judgment-display.ts`
  - 增加新 resonance 的中文关系短句，避免 `boundary_probe` / `structure_mismatch` / `blocked` 被误显示为父级不明。
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
  - view model 优先使用 `level_nesting.wait_conditions` 等新字段。
  - action state / recommendation / trigger hover 使用具体级别条件。
- Modify: `tests/test_trinity_decision_level_nesting.py`
  - 锁定查表、归一、降级、条件合同。
- Modify: `tests/test_trinity_decision_trade_qualification.py`
  - 锁定级别嵌套对最终交易资格的硬闸门优先级。
- Modify: `tests/trinity-judgment-display.test.ts`
  - 锁定新 resonance 的中文关系短句。
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
  - 锁定前端 VM 消费新条件和中文展示。
- Modify: `tests/analysis-page-sections.test.ts`
  - 锁定组件不展示内部英文枚举、不回退抽象文案。

## Task 0: 工作区边界确认

**Files:**
- No source changes.

- [ ] **Step 1: 查看当前 WIP**

Run:

```bash
git status --short
git diff --stat
```

Expected: 能看到上一阶段 WIP 和本计划文件。不要自动丢弃任何 WIP。

- [ ] **Step 2: 确认上一阶段验证仍通过**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
pnpm exec tsc --noEmit
```

Expected: 两条命令 exit 0。

- [ ] **Step 3: 若需要提交上一阶段 WIP，只提交展示层文件**

Run only if user approves committing current WIP:

```bash
git add src/components/stock/TradingCycleBus.tsx \
  src/lib/trinity-analysis-page-view-model.ts \
  tests/analysis-page-sections.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  docs/superpowers/plans/2026-04-25-trading-cycle-bus-trinity-signal-clarity.md
git commit -m "优化：清晰化交易周期总线三层信号"
```

Expected: commit succeeds. If user does not approve, skip commit and continue with careful staging later.

## Task 1: 写 Python 失败测试锁定级别嵌套新合同

**Files:**
- Modify: `tests/test_trinity_decision_level_nesting.py`
- Modify: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 增加测试 helper**

在 `TrinityDecisionLevelNestingTest` 类内增加两个 helper，放在 `setUp()` 后面：

```python
    def _payload(
        self,
        *,
        status='强',
        structure_type='B双平台式',
        qualification='standard',
        direction='up',
        standard_candidate='B双平台式',
        probe_entry=None,
        confirm_entry=None,
        invalidation=None,
        next_confirmation_action=None,
    ):
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
                    'node_map': {'a4': None, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': None},
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
                    }
                },
            },
        }

    def _decision(self, *, parent_status='强', child_payload=None, level='hour30'):
        child_payload = child_payload or self._payload(status='强', structure_type='B双平台式', direction='up')
        return self.analyzer._build_trinity_level_nesting_decision(
            level=level,
            normalized_results={
                'daily': self._payload(status=parent_status, structure_type='B双平台式', direction='up'),
                level: child_payload,
            },
            raw_level_nesting={'summary': '测试级别嵌套'},
        )
```

- [ ] **Step 2: 更新旧的 strong + A 断言**

把旧测试 `test_build_trinity_level_nesting_allows_upgrade_when_weekly_daily_align` 改成 strong + B，避免继续锁定旧粗规则：

```python
    def test_build_trinity_level_nesting_allows_upgrade_when_strong_parent_matches_b_family(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': self._payload(status='强', structure_type='B双平台式', direction='up'),
                'daily': self._payload(status='强', structure_type='B双平台式', direction='up'),
            },
            raw_level_nesting={'summary': '周线强 / 日线B双平台式'},
        )

        self.assertEqual(decision['parent_level'], 'weekly')
        self.assertEqual(decision['child_level'], 'daily')
        self.assertEqual(decision['parent_spacetime_status'], '强')
        self.assertEqual(decision['child_structure_family'], 'B')
        self.assertEqual(decision['child_structure_qualification'], 'standard')
        self.assertEqual(decision['resonance'], 'aligned')
        self.assertEqual(decision['child_signal'], 'long')
        self.assertTrue(decision['permission']['allow_position_increase'])
        self.assertIn('日线', decision['permission']['reason'])
```

- [ ] **Step 3: 更新 C 类旧断言为 boundary_probe**

把旧测试 `test_build_trinity_level_nesting_maps_aligned_c_structure_to_long_signal` 的核心断言改为：

```python
        self.assertEqual(decision['resonance'], 'boundary_probe')
        self.assertEqual(decision['operation_frame'], 'platform_boundary')
        self.assertEqual(decision['execution_strength'], 'light_probe')
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertTrue(decision['permission']['allow_only_light_probe'])
        self.assertTrue(any('平台' in item or '边界' in item for item in decision['wait_conditions']))
```

- [ ] **Step 4: 增加 strong + A 结构错配测试**

追加测试：

```python
    def test_strong_parent_rejects_a_family_when_table_expects_b_for_uptrend(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': self._payload(status='强', structure_type='B双平台式', direction='up'),
                'daily': self._payload(status='强', structure_type='A五段式', direction='up', standard_candidate='A五段式'),
            },
            raw_level_nesting={'summary': '周线强 / 日线A五段式'},
        )

        self.assertEqual(decision['resonance'], 'structure_mismatch')
        self.assertEqual(decision['child_structure_family'], 'A')
        self.assertFalse(decision['structure_match'])
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertIn('周线强', decision['permission']['reason'])
        self.assertTrue(decision['wait_conditions'])
```

- [ ] **Step 5: 增加 extended C 降级测试**

追加测试：

```python
    def test_extended_c_matches_family_but_downgrades_execution_strength(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='延伸C类',
                qualification='extended',
                direction='up',
                standard_candidate='C单平台式',
                probe_entry='30分钟延伸C等待平台边界突破',
                confirm_entry='30分钟回踩平台上沿不破',
                invalidation='30分钟跌破平台下沿失效',
            ),
        )

        self.assertEqual(decision['resonance'], 'boundary_probe')
        self.assertEqual(decision['child_structure_family'], 'C')
        self.assertEqual(decision['child_structure_qualification'], 'extended')
        self.assertEqual(decision['execution_strength'], 'light_probe')
        self.assertIn('延伸C', decision['downgrade_reason'])
        self.assertIn('30分钟延伸C等待平台边界突破', decision['wait_conditions'])
        self.assertIn('30分钟回踩平台上沿不破', decision['confirm_conditions'])
        self.assertIn('30分钟跌破平台下沿失效', decision['invalidation_conditions'])
```

- [ ] **Step 6: 增加 weak + D 上涨谨慎测试**

追加测试：

```python
    def test_weak_parent_matches_uptrend_d_family_with_cautious_execution(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='D三段式',
                qualification='standard',
                direction='up',
                standard_candidate='D三段式',
            ),
        )

        self.assertEqual(decision['resonance'], 'aligned')
        self.assertEqual(decision['child_structure_family'], 'D')
        self.assertEqual(decision['operation_frame'], 'three_leg_reversal')
        self.assertIn(decision['execution_strength'], {'light_probe', 'risk_control_first'})
        self.assertTrue(any('d1/d2/d3/d4' in item or 'd3' in item or 'd4' in item for item in decision['wait_conditions']))
```

- [ ] **Step 7: 增加 unfinished 只观察测试**

追加测试：

```python
    def test_unfinished_structure_observe_only(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='未完成结构',
                qualification='unfinished',
                direction='neutral',
                standard_candidate=None,
            ),
        )

        self.assertEqual(decision['child_structure_qualification'], 'unfinished')
        self.assertEqual(decision['execution_strength'], 'observe_only')
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertFalse(decision['permission']['allow_only_light_probe'])
        self.assertTrue(any('观察' in item or '等待' in item for item in decision['wait_conditions']))
```

- [ ] **Step 8: 更新父级不明旧断言为硬闸门**

在 `tests/test_trinity_decision_trade_qualification.py` 中，把旧测试 `test_parent_unclear_light_probe_permission_downgrades_standard_node_position` 的最后断言从标准交易轻仓改成等待确认：

```python
        self.assertEqual(decision['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['position_permission'], 'no_position')
        self.assertEqual(decision['confidence'], 'low')
        self.assertTrue(any('父级' in reason for reason in decision['reason']))
```

同时把测试名改为：

```python
    def test_parent_unclear_blocks_standard_node_trade_even_when_child_conditions_pass(self) -> None:
```

- [ ] **Step 9: 增加结构错配阻断标准交易测试**

在 `tests/test_trinity_decision_trade_qualification.py` 中追加：

```python
    def test_structure_mismatch_blocks_standard_node_trade_even_when_child_conditions_pass(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': True,
                'node_map': {'a4': 21.6, 'b8': None, 'd3': None, 'd4': None},
                'explainability': {'reason': '日线A类标准多头节点已确认'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': '站上MA55'}},
            volume_decision={
                'volume_gate': {
                    'supports_breakout': True,
                    'supports_breakdown': False,
                    'supports_pullback_confirmation': True,
                    'confidence_adjustment': 'upgrade',
                    'reason': '量能支持突破',
                }
            },
            execution_payload={'action': 'buy', 'direction': 'long'},
            level_nesting_decision={
                'parent_level': 'weekly',
                'child_level': 'daily',
                'parent_bias': 'bullish',
                'child_signal': 'long',
                'resonance': 'structure_mismatch',
                'execution_strength': 'wait_confirmation',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': False,
                    'allow_only_light_probe': False,
                    'reason': '周线强与日线A类不匹配，先等待结构重新确认',
                },
            },
        )

        self.assertEqual(decision['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['position_permission'], 'no_position')
        self.assertEqual(decision['confidence'], 'low')
        self.assertTrue(any('结构重新确认' in reason for reason in decision['reason']))
```

- [ ] **Step 10: 增加边界试探最多轻仓测试**

在 `tests/test_trinity_decision_trade_qualification.py` 中追加：

```python
    def test_boundary_probe_never_upgrades_to_standard_node_trade(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': True,
                'node_map': {'a4': None, 'b8': 21.6, 'd3': None, 'd4': None},
                'explainability': {'reason': '30分钟C类平台边界触发'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': '边界上方'}},
            volume_decision={
                'volume_gate': {
                    'supports_breakout': True,
                    'supports_breakdown': False,
                    'supports_pullback_confirmation': True,
                    'confidence_adjustment': 'neutral',
                    'reason': '量能未否决',
                }
            },
            execution_payload={'action': 'buy', 'direction': 'long'},
            level_nesting_decision={
                'parent_level': 'daily',
                'child_level': 'hour30',
                'parent_bias': 'bullish',
                'child_signal': 'long',
                'resonance': 'boundary_probe',
                'execution_strength': 'light_probe',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '日线中偏强，30分钟C类只允许平台边界轻仓试探',
                },
            },
        )

        self.assertEqual(decision['trade_mode'], 'conditional_boundary_trade')
        self.assertEqual(decision['position_permission'], 'light_probe')
        self.assertNotEqual(decision['trade_mode'], 'standard_node_trade')
```

- [ ] **Step 11: 运行 Python 测试确认失败**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py
python3 -m unittest tests/test_trinity_decision_trade_qualification.py
```

Expected: FAIL，失败原因包含缺少 `parent_spacetime_status`、`child_structure_family`、`wait_conditions`，或最终交易资格仍把 `parent_unclear` / `structure_mismatch` / `boundary_probe` 升级成标准交易。

## Task 2: 后端实现结构归一与查表合同

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_trinity_decision_level_nesting.py`

- [ ] **Step 1: 增加级别中文标签常量**

在 `FREQUENCY_MAP` 后增加：

```python
    LEVEL_LABELS = {
        'weekly': '周线',
        'daily': '日线',
        'hour60': '60分钟',
        'hour30': '30分钟',
        'hour15': '15分钟',
    }
```

- [ ] **Step 2: 增加结构方向和父级状态 helper**

在 `_build_trinity_level_nesting_decision()` 前增加：

```python
    def _level_label(self, level: Optional[str]) -> str:
        return self.LEVEL_LABELS.get(level or '', level or '当前级别')

    def _resolve_level_nesting_parent_status(self, parent_payload: Dict[str, Any]) -> Optional[str]:
        decision = parent_payload.get('trinity_decision') if isinstance(parent_payload, dict) else {}
        decision = decision or {}
        spacetime = decision.get('spacetime') or {}
        macd = parent_payload.get('macd') or {}
        return spacetime.get('status') or macd.get('status')

    def _spacetime_parent_bias(self, status: Optional[str]) -> str:
        if status in ('极强', '强', '中偏强'):
            return 'bullish'
        if status in ('极弱', '弱', '中偏弱'):
            return 'bearish'
        return 'neutral'

    def _normalize_level_nesting_direction(self, value: Optional[str]) -> str:
        if value in ('up', '上涨', 'long', 'bullish'):
            return 'up'
        if value in ('down', '下跌', 'short', 'bearish'):
            return 'down'
        return 'neutral'
```

- [ ] **Step 3: 增加结构 profile helper**

继续在 `_build_trinity_level_nesting_decision()` 前增加：

```python
    def _resolve_level_nesting_structure_profile(
        self,
        child_payload: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        decision = child_payload.get('trinity_decision') or {}
        structure_decision = decision.get('structure') or {}
        period_structure = child_payload.get('structure') or {}
        interpretation = period_structure.get('interpretation') or {}
        focus_structure = interpretation.get('focus_structure') or {}

        structure_type = (
            structure_decision.get('type')
            or period_structure.get('structure_type')
            or focus_structure.get('archetype_label')
        )
        standard_candidate = structure_decision.get('standard_candidate')
        focus_family = focus_structure.get('archetype_family')
        candidate_for_family = standard_candidate or structure_type

        family, _, resolved_qualification = self._resolve_structure_profile(candidate_for_family)
        if family not in {'A', 'B', 'C', 'D'} and focus_family in {'A', 'B', 'C', 'D'}:
            family = focus_family

        structure_group = structure_decision.get('family')
        qualification = (
            structure_decision.get('qualification')
            or focus_structure.get('standard_qualification')
            or resolved_qualification
            or 'unknown'
        )
        if structure_group in {'range', 'channel'}:
            qualification = structure_group
        elif qualification == 'over_limit' and structure_group in {'range', 'channel'}:
            qualification = structure_group
        elif qualification == 'failed' and family == 'complex':
            qualification = 'complex'

        direction = self._normalize_level_nesting_direction(
            structure_decision.get('direction')
            or focus_structure.get('directional_bias')
            or period_structure.get('trend_direction')
        )

        return {
            'type': structure_type or '未知结构',
            'family': family if family in {'A', 'B', 'C', 'D'} else 'unknown',
            'qualification': qualification,
            'direction': direction,
        }
```

注意：不要修改 `TrinityStructureDecision.family` 的含义；A/B/C/D 只写入 `level_nesting.child_structure_family`。

- [ ] **Step 4: 增加条件去重和模板 helper**

继续增加：

```python
    def _compact_condition_list(self, items: List[Optional[str]], fallback: str) -> List[str]:
        result: List[str] = []
        for item in items:
            if not isinstance(item, str):
                continue
            value = item.strip()
            if value and value not in result:
                result.append(value)
        if result:
            return result[:3]
        return [fallback]

    def _family_condition_templates(self, level_label: str, family: str) -> Dict[str, List[str]]:
        templates = {
            'A': {
                'wait': [f'等待{level_label}有效突破结构上沿', f'等待{level_label}站上MA55后回踩不破'],
                'confirm': [f'{level_label}放量突破确认', f'{level_label}回踩MA55不破'],
                'invalid': [f'{level_label}跌回结构内按假突破处理', f'{level_label}跌破MA55且反抽不过失效'],
            },
            'B': {
                'wait': [f'等待{level_label}B类结构 b1/b3/b5/b7 操作点确认', f'等待{level_label}平台边界回踩不破'],
                'confirm': [f'{level_label}边界放量突破确认', f'{level_label}回踩平台上沿不破'],
                'invalid': [f'{level_label}跌回平台下沿失效', f'{level_label}突破后量能失败并回落结构内，按假突破处理'],
            },
            'C': {
                'wait': [f'等待{level_label}突破平台上沿', f'等待{level_label}回踩平台边界不破'],
                'confirm': [f'{level_label}放量突破平台上沿', f'{level_label}突破后回踩不破'],
                'invalid': [f'{level_label}跌破中枢下沿失效', f'{level_label}跌破MA55且反抽不过失效'],
            },
            'D': {
                'wait': [f'关注{level_label}D类结构 d1/d2/d3/d4 节奏', f'等待{level_label}d3或d4确认'],
                'confirm': [f'{level_label}d3反向修正完成', f'{level_label}d4结构完成并出现确认信号'],
                'invalid': [f'{level_label}跌破原建仓级别止损位立即退出', f'{level_label}反抽不过关键均线，按失败处理'],
            },
        }
        return templates.get(family, {
            'wait': [f'等待{level_label}结构确认'],
            'confirm': [f'{level_label}确认信号形成'],
            'invalid': [f'{level_label}结构失效'],
        })
```

- [ ] **Step 5: 增加条件生成 helper**

继续增加：

```python
    def _build_level_nesting_conditions(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        level_label: str,
        family: str,
        qualification: str,
    ) -> Dict[str, List[str]]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        decision = child_payload.get('trinity_decision') or {}
        execution_plan = decision.get('execution_plan') or {}
        wait_state = decision.get('wait_state') or {}
        execution = decision.get('execution') or {}
        templates = self._family_condition_templates(level_label, family)

        wait_items = [
            execution_plan.get('probe_entry'),
            wait_state.get('next_confirmation_action'),
            *(templates['wait']),
        ]
        confirm_items = [
            execution_plan.get('confirm_entry'),
            *((execution.get('confirmation') or []) if isinstance(execution.get('confirmation'), list) else []),
            *(templates['confirm']),
        ]
        invalid_items = [
            execution_plan.get('invalidation'),
            *((execution.get('invalidation') or []) if isinstance(execution.get('invalidation'), list) else []),
            *(templates['invalid']),
        ]

        if qualification == 'extended':
            wait_items.insert(0, f'{level_label}延伸结构沿用{family}类框架，等待边界确认')
        elif qualification == 'unfinished':
            wait_items.insert(0, f'{level_label}结构未完成，先观察不执行')
        elif qualification == 'complex':
            wait_items.insert(0, f'{level_label}复杂结构只看边界，不套标准节点')
        elif qualification in {'range', 'channel'}:
            wait_items.insert(0, f'{level_label}按上下沿边界等待突破/跌破确认')

        return {
            'wait_conditions': self._compact_condition_list(wait_items, f'等待{level_label}结构确认'),
            'confirm_conditions': self._compact_condition_list(confirm_items, f'{level_label}确认信号形成'),
            'invalidation_conditions': self._compact_condition_list(invalid_items, f'{level_label}结构失效'),
        }
```

- [ ] **Step 6: 增加 operation frame 与 execution strength helper**

继续增加：

```python
    def _operation_frame_for_family(self, family: str, qualification: str) -> str:
        if qualification in {'range', 'channel'}:
            return 'range_boundary'
        return {
            'A': 'trend_continuation',
            'B': 'swing_platform',
            'C': 'platform_boundary',
            'D': 'three_leg_reversal',
        }.get(family, 'wait_structure')

    def _downgrade_execution_strength(
        self,
        *,
        resonance: str,
        family: str,
        qualification: str,
        parent_status: Optional[str],
    ) -> Tuple[str, Optional[str]]:
        if qualification == 'standard' and resonance == 'aligned':
            if family == 'D' or parent_status in {'弱', '强'} and family == 'D':
                return 'light_probe', 'D类结构按三段节奏处理，执行需谨慎'
            return 'normal', None
        if qualification == 'extended':
            return 'light_probe', f'延伸{family}沿用{family}类框架，但拐点偏多，需等待确认'
        if qualification == 'unfinished':
            return 'observe_only', '结构未完成，只观察不执行'
        if qualification == 'complex':
            return 'wait_confirmation', '复杂结构只看边界，不套标准节点'
        if qualification in {'range', 'channel'}:
            return 'wait_confirmation', '区间/通道结构按上下沿边界等待确认'
        if resonance in {'boundary_probe', 'structure_mismatch', 'parent_unclear'}:
            return 'wait_confirmation', None
        if resonance == 'child_countertrend':
            return 'light_probe', '子级逆父级，只允许轻仓试探或做T'
        return 'wait_confirmation', None
```

- [ ] **Step 7: 替换 `_build_trinity_level_nesting_decision()` 主体**

保留函数签名，替换内部逻辑为以下结构：

```python
        parent_map = {
            'daily': 'weekly',
            'hour60': 'daily',
            'hour30': 'daily',
            'hour15': 'hour60',
        }
        parent_level = parent_map.get(level)
        parent_label = self._level_label(parent_level)
        child_label = self._level_label(level)
        parent_payload = normalized_results.get(parent_level or '') if parent_level else None
        child_payload = normalized_results.get(level)

        if not parent_level or not isinstance(parent_payload, dict):
            conditions = self._build_level_nesting_conditions(
                child_payload=child_payload,
                level_label=child_label,
                family='unknown',
                qualification='unknown',
            )
            return {
                'parent_level': parent_level,
                'child_level': level,
                'parent_spacetime_status': None,
                'child_structure_type': '未知结构',
                'child_structure_family': 'unknown',
                'child_structure_qualification': 'unknown',
                'child_structure_direction': 'neutral',
                'structure_match': False,
                'parent_bias': 'neutral',
                'child_signal': 'wait',
                'resonance': 'parent_unclear',
                'operation_bias': 'wait',
                'operation_frame': 'wait_structure',
                'execution_strength': 'wait_confirmation',
                'downgrade_reason': f'{parent_label}缺失或尚未归一化',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': level in ('hour30', 'hour15'),
                    'allow_only_light_probe': True,
                    'reason': f'{parent_label}缺失，{child_label}只能等待确认',
                },
                **conditions,
            }
```

然后补齐有父级时的逻辑：

```python
        parent_status = self._resolve_level_nesting_parent_status(parent_payload)
        profile = self._resolve_level_nesting_structure_profile(child_payload)
        parent_bias = self._spacetime_parent_bias(parent_status)
        family = profile['family']
        qualification = profile['qualification']
        direction = profile['direction']
        child_signal = 'long' if direction == 'up' else 'short' if direction == 'down' else 'wait'
        operation_bias = child_signal
        table_config = self.SPACETIME_STRUCTURE_TABLE.get(parent_status or '')

        if not table_config:
            resonance = 'parent_unclear'
            structure_match = False
            expected_structures: List[str] = []
        else:
            if direction == 'up':
                expected_structures = table_config.get('上涨结构') or []
            elif direction == 'down':
                expected_structures = table_config.get('下跌结构') or []
            else:
                expected_structures = list(dict.fromkeys((table_config.get('上涨结构') or []) + (table_config.get('下跌结构') or [])))
            structure_match = family in expected_structures

            if direction == 'up' and not table_config.get('上涨结构'):
                resonance = 'blocked'
            elif direction == 'down' and not table_config.get('下跌结构'):
                resonance = 'blocked'
            elif family == 'C' and parent_status in ('中偏强', '中偏弱') and structure_match:
                resonance = 'boundary_probe'
            elif parent_bias == 'bearish' and child_signal == 'long':
                resonance = 'child_countertrend'
            elif parent_bias == 'bullish' and child_signal == 'short':
                resonance = 'child_countertrend'
            elif structure_match and direction in {'up', 'down'}:
                resonance = 'aligned'
            elif not structure_match:
                resonance = 'structure_mismatch'
            else:
                resonance = 'parent_unclear'

        operation_frame = self._operation_frame_for_family(family, qualification)
        execution_strength, downgrade_reason = self._downgrade_execution_strength(
            resonance=resonance,
            family=family,
            qualification=qualification,
            parent_status=parent_status,
        )
        if resonance == 'boundary_probe':
            execution_strength = 'light_probe'
        if resonance in {'blocked', 'structure_mismatch', 'parent_unclear'} and execution_strength == 'normal':
            execution_strength = 'wait_confirmation'

        conditions = self._build_level_nesting_conditions(
            child_payload=child_payload,
            level_label=child_label,
            family=family,
            qualification=qualification,
        )
        allow_position_increase = resonance == 'aligned' and execution_strength == 'normal'
        allow_only_light_probe = execution_strength in {'light_probe', 'wait_confirmation'} and resonance != 'blocked'
        reason = self._build_level_nesting_permission_reason(
            parent_label=parent_label,
            child_label=child_label,
            parent_status=parent_status,
            family=family,
            qualification=qualification,
            resonance=resonance,
            execution_strength=execution_strength,
        )
        return {
            'parent_level': parent_level,
            'child_level': level,
            'parent_spacetime_status': parent_status,
            'child_structure_type': profile['type'],
            'child_structure_family': family,
            'child_structure_qualification': qualification,
            'child_structure_direction': direction,
            'structure_match': structure_match,
            'parent_bias': parent_bias,
            'child_signal': child_signal,
            'resonance': resonance,
            'operation_bias': operation_bias,
            'operation_frame': operation_frame,
            'execution_strength': execution_strength,
            'downgrade_reason': downgrade_reason,
            'permission': {
                'allow_position_increase': allow_position_increase,
                'allow_t_trade': level in ('hour30', 'hour15') and resonance != 'blocked',
                'allow_only_light_probe': allow_only_light_probe,
                'reason': reason,
            },
            **conditions,
        }
```

- [ ] **Step 8: 增加 permission reason helper**

若 Step 7 引用了 helper，则在函数前增加：

```python
    def _build_level_nesting_permission_reason(
        self,
        *,
        parent_label: str,
        child_label: str,
        parent_status: Optional[str],
        family: str,
        qualification: str,
        resonance: str,
        execution_strength: str,
    ) -> str:
        status_text = parent_status or '状态未知'
        family_text = f'{family}类' if family in {'A', 'B', 'C', 'D'} else '结构'
        qualification_text = {
            'standard': '标准结构',
            'extended': '延伸结构',
            'unfinished': '未完成结构',
            'complex': '复杂结构',
            'range': '区间结构',
            'channel': '通道结构',
            'failed': '结构未通过',
            'unknown': '结构未知',
        }.get(qualification, qualification)
        if resonance == 'aligned':
            return f'{parent_label}{status_text}，{child_label}{qualification_text}{family_text}命中三位一体表，按{child_label}条件执行'
        if resonance == 'boundary_probe':
            return f'{parent_label}{status_text}，{child_label}{qualification_text}{family_text}命中平台边界逻辑，只允许轻仓等待确认'
        if resonance == 'child_countertrend':
            return f'{parent_label}{status_text}，{child_label}{qualification_text}{family_text}逆父级，只允许轻仓试探或做T'
        if resonance == 'structure_mismatch':
            return f'{parent_label}{status_text}与{child_label}{qualification_text}{family_text}不匹配，先等待结构重新确认'
        if resonance == 'blocked':
            return f'{parent_label}{status_text}不支持{child_label}当前方向，先等待父级放行'
        return f'{parent_label}{status_text}无法明确放行，{child_label}先等待确认'
```

- [ ] **Step 9: 更新 `_build_trinity_trade_qualification()` 的硬闸门优先级**

在 `_build_trinity_trade_qualification()` 中，`is_child_countertrend_long` 变量之后、`if action == 'wait':` 之前增加：

```python
        nesting_resonance = level_nesting_decision.get('resonance')
        nesting_reason = nesting_permission.get('reason') or '级别嵌套未放行'
        if nesting_resonance in {'blocked', 'structure_mismatch', 'parent_unclear'}:
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': apply_confidence('low'),
                'reason': [nesting_reason, *reasons],
            }
        if nesting_resonance == 'boundary_probe':
            if action in {'buy', 'sell'} and can_trade_by_boundaries and direction_gate_passed and volume_gate_passed:
                return {
                    'trade_mode': 'conditional_boundary_trade',
                    'position_permission': 'light_probe',
                    'confidence': apply_confidence('medium'),
                    'reason': [nesting_reason, *reasons],
                }
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': apply_confidence('low'),
                'reason': [nesting_reason, *reasons],
            }
```

注意：这段必须放在标准结构节点交易判断之前。目标是让级别嵌套先决定“是否有交易权限”，再让结构节点、均线、量能决定“是否满足执行细节”。

- [ ] **Step 10: 更新 `_build_trinity_resonance_state()` 的硬约束语义**

在 `_build_trinity_resonance_state()` 中，保留 `aligned` 分支，并把冲突分支替换为：

```python
        if resonance in {'blocked', 'structure_mismatch', 'parent_unclear'}:
            return {
                'status': 'conflicting',
                'reason': permission.get('reason') or '父级级别嵌套未放行，当前级别先等待确认',
                'impact_on_judgment': 'suppress',
                'is_hard_constraint': True,
            }
        if resonance == 'boundary_probe':
            return {
                'status': 'neutral',
                'reason': permission.get('reason') or '父级仅允许边界轻仓试探，不能升级标准交易',
                'impact_on_judgment': 'suppress',
                'is_hard_constraint': False,
            }
        if resonance in {'child_countertrend', 'conflict'}:
            return {
                'status': 'conflicting',
                'reason': permission.get('reason') or '父级强冲突，子级逆父级',
                'impact_on_judgment': 'suppress',
                'is_hard_constraint': True,
            }
```

Expected: `blocked`、`structure_mismatch`、`parent_unclear` 会把 `judgment.level` 压到严格等待；`boundary_probe` 不作为硬阻断，但会抑制升级，最终只允许轻仓边界试探。

- [ ] **Step 11: 运行 Python 测试**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py
python3 -m unittest tests/test_trinity_decision_trade_qualification.py
```

Expected: PASS。

## Task 3: 扩展 TypeScript 类型与 signal tag 文案

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/trinity-signal-tags.ts`
- Modify: `src/lib/trinity-judgment-display.ts`
- Test: `tests/trinity-decision-types.test.ts`
- Test: `tests/trinity-judgment-display.test.ts`

- [ ] **Step 1: 扩展 `TrinityLevelNestingDecision` 类型**

在 `src/lib/stock-structure-types.ts` 中替换 `TrinityLevelNestingDecision`：

```ts
export interface TrinityLevelNestingDecision {
  parent_level?: string | null;
  child_level?: string | null;
  parent_spacetime_status?: string | null;
  child_structure_type?: string | null;
  child_structure_family?: 'A' | 'B' | 'C' | 'D' | 'unknown' | string;
  child_structure_qualification?:
    | 'standard'
    | 'extended'
    | 'unfinished'
    | 'complex'
    | 'range'
    | 'channel'
    | 'failed'
    | 'unknown'
    | string;
  child_structure_direction?: 'up' | 'down' | 'neutral' | string;
  structure_match?: boolean;
  parent_bias: 'bullish' | 'bearish' | 'neutral';
  child_signal: 'long' | 'short' | 'wait';
  resonance:
    | 'aligned'
    | 'conflict'
    | 'child_countertrend'
    | 'parent_unclear'
    | 'boundary_probe'
    | 'structure_mismatch'
    | 'blocked';
  operation_bias?: 'long' | 'short' | 'wait' | string;
  operation_frame?:
    | 'trend_continuation'
    | 'swing_platform'
    | 'platform_boundary'
    | 'three_leg_reversal'
    | 'range_boundary'
    | 'wait_structure'
    | string;
  execution_strength?:
    | 'normal'
    | 'light_probe'
    | 'wait_confirmation'
    | 'observe_only'
    | 'risk_control_first'
    | string;
  downgrade_reason?: string | null;
  wait_conditions?: string[];
  confirm_conditions?: string[];
  invalidation_conditions?: string[];
  permission: {
    allow_position_increase: boolean;
    allow_t_trade: boolean;
    allow_only_light_probe: boolean;
    reason: string;
  };
}
```

- [ ] **Step 2: 更新 level nesting label**

在 `src/lib/trinity-signal-tags.ts` 中更新 `levelNestingLabel()`：

```ts
function levelNestingLabel(resonance?: TrinityLevelNestingDecision['resonance']): string {
  switch (resonance) {
    case 'aligned':
      return '父子级支持';
    case 'boundary_probe':
      return '边界试探';
    case 'child_countertrend':
      return '子级逆势';
    case 'structure_mismatch':
      return '结构错配';
    case 'blocked':
      return '父级未放行';
    case 'conflict':
      return '级别冲突';
    case 'parent_unclear':
      return '父级不明';
    default:
      return '';
  }
}
```

- [ ] **Step 3: 更新 level nesting tone**

在同文件更新 `levelNestingTone()`：

```ts
function levelNestingTone(
  resonance?: TrinityLevelNestingDecision['resonance'],
  parentBias?: TrinityLevelNestingDecision['parent_bias']
): SignalTagTone {
  switch (resonance) {
    case 'aligned':
      if (parentBias === 'bullish') {
        return 'bullish';
      }
      if (parentBias === 'bearish') {
        return 'bearish';
      }
      return 'neutral';
    case 'boundary_probe':
      return 'warning';
    case 'child_countertrend':
    case 'conflict':
    case 'structure_mismatch':
      return 'warning';
    case 'blocked':
      return 'bearish';
    case 'parent_unclear':
      return 'neutral';
    default:
      return 'neutral';
  }
}
```

- [ ] **Step 4: 更新 level nesting hover**

替换 `buildLevelNestingHoverItems()`：

```ts
function buildLevelNestingHoverItems(
  decision: TrinityDecision
): Array<{ label: string; value?: string | null }> {
  const levelNesting = decision.level_nesting;
  return [
    { label: '父级偏向', value: parentBiasLabel(levelNesting?.parent_bias) },
    { label: '关系状态', value: levelNestingLabel(levelNesting?.resonance) },
    { label: '结构原型', value: levelNesting?.child_structure_family },
    { label: '结构资格', value: qualificationLabel(levelNesting?.child_structure_qualification) },
    { label: '等待条件', value: levelNesting?.wait_conditions?.join('、') },
    { label: '确认条件', value: levelNesting?.confirm_conditions?.join('、') },
    { label: '失效条件', value: levelNesting?.invalidation_conditions?.join('、') },
    { label: '说明', value: levelNesting?.permission.reason ?? decision.conclusion.wait_reason },
  ];
}
```

并在该函数前增加：

```ts
function qualificationLabel(value?: string | null): string {
  switch (value) {
    case 'standard':
      return '标准结构';
    case 'extended':
      return '延伸结构';
    case 'unfinished':
      return '未完成结构';
    case 'complex':
      return '复杂结构';
    case 'range':
      return '区间结构';
    case 'channel':
      return '通道结构';
    case 'failed':
      return '结构未通过';
    case 'unknown':
      return '结构未知';
    default:
      return value ?? '';
  }
}
```

- [ ] **Step 5: 更新判断关系短句**

在 `tests/trinity-judgment-display.test.ts` 的 `resolveRelationLabel compresses parent-child resonance into fixed short copy` 测试中追加：

```ts
  assert.equal(
    judgmentDisplay.resolveRelationLabel(createLevelNesting({ resonance: 'boundary_probe' })),
    '父级只允许边界试探'
  );
  assert.equal(
    judgmentDisplay.resolveRelationLabel(createLevelNesting({ resonance: 'structure_mismatch' })),
    '父级未放行，结构先重配'
  );
  assert.equal(
    judgmentDisplay.resolveRelationLabel(createLevelNesting({ resonance: 'blocked' })),
    '父级未放行，当前先等待'
  );
```

然后在 `src/lib/trinity-judgment-display.ts` 中更新 `resolveRelationLabel()`：

```ts
export function resolveRelationLabel(levelNesting?: TrinityLevelNestingDecision): string {
  if (!levelNesting) {
    return '父级未明，子级先看确认';
  }

  if (levelNesting.resonance === 'aligned') {
    return '父级支持，子级顺父级';
  }

  if (levelNesting.resonance === 'boundary_probe') {
    return '父级只允许边界试探';
  }

  if (levelNesting.resonance === 'structure_mismatch') {
    return '父级未放行，结构先重配';
  }

  if (levelNesting.resonance === 'blocked') {
    return '父级未放行，当前先等待';
  }

  if (
    levelNesting.resonance === 'child_countertrend' ||
    levelNesting.resonance === 'conflict'
  ) {
    return '父级强冲突，子级逆父级';
  }

  return '父级未明，子级先看确认';
}
```

- [ ] **Step 6: 运行类型相关测试**

Run:

```bash
node --test tests/trinity-decision-types.test.ts tests/trinity-signal-tags.test.ts tests/trinity-judgment-display.test.ts
```

Expected: PASS。

## Task 4: view model 优先消费可执行条件

**Files:**
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Test: `tests/trinity-analysis-page-view-model.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/trinity-analysis-page-view-model.test.ts` 增加测试：

```ts
test('trading bus uses executable level nesting conditions before legacy trigger text', () => {
  const result = createResult();
  const decision = result.periods.hour30.trinity_decision;
  if (!decision?.level_nesting) {
    throw new Error('missing hour30 level nesting');
  }

  decision.level_nesting = {
    ...decision.level_nesting,
    resonance: 'boundary_probe',
    child_structure_family: 'C',
    child_structure_qualification: 'extended',
    operation_frame: 'platform_boundary',
    execution_strength: 'light_probe',
    wait_conditions: ['30分钟延伸C等待平台上沿突破', '30分钟回踩平台边界不破'],
    confirm_conditions: ['30分钟放量突破平台上沿'],
    invalidation_conditions: ['30分钟跌破中枢下沿失效'],
    permission: {
      allow_position_increase: false,
      allow_t_trade: true,
      allow_only_light_probe: true,
      reason: '日线中偏强，30分钟延伸C只允许边界轻仓试探',
    },
  };

  const vm = buildAnalysisPageViewModel({
    result,
    integrity: createIntegrity(),
    aiState: { status: 'idle' },
  });
  const shortline = vm.tradingCombinations.find((item) => item.key === 'shortline');

  assert.ok(shortline);
  assert.equal(shortline.recommendation, '先等30分钟延伸C等待平台上沿突破');
  assert.match(shortline.triggerLevel.value, /30分钟：延伸C等待平台上沿突破/);
  assert.ok(
    shortline.actionStateTags.some((tag) => tag.label === '级别｜30分钟边界试探')
  );
  assert.ok(
    shortline.actionStateTags.some((tag) => tag.label === '执行｜30分钟等待边界确认')
  );
  assert.ok(shortline.triggerLevel.hoverItems.every((item) => !item.value.includes('boundary_probe')));
  assert.ok(shortline.triggerLevel.hoverItems.every((item) => !item.value.includes('extended')));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts
```

Expected: FAIL，失败原因是 relation/action/recommendation 仍未优先使用新条件或类型不支持新 resonance。

- [ ] **Step 3: 增加 level nesting 中文 helper**

在 `src/lib/trinity-analysis-page-view-model.ts` 的 `RESONANCE_LABELS` 附近增加：

```ts
const COMBINATION_RESONANCE_LABELS: Record<NonNullable<TrinityDecision['level_nesting']>['resonance'], string> = {
  aligned: '支持',
  conflict: '级别冲突',
  child_countertrend: '逆父级',
  parent_unclear: '父级不明',
  boundary_probe: '边界试探',
  structure_mismatch: '结构错配',
  blocked: '父级未放行',
};

const EXECUTION_STRENGTH_LABELS: Record<string, string> = {
  normal: '按确认执行',
  light_probe: '等待边界确认',
  wait_confirmation: '等待确认',
  observe_only: '只观察',
  risk_control_first: '风控优先',
};
```

- [ ] **Step 4: 增加条件读取 helper**

在 `resolveCombinationTriggerText()` 附近增加：

```ts
function normalizeLevelCondition(value: string | undefined, levelLabel: string): string {
  if (!value) {
    return '';
  }
  const cleaned = replaceAbstractLevelText(normalizeRuleChainText(value), levelLabel);
  return cleaned.startsWith(levelLabel) ? cleaned : `${levelLabel}${cleaned}`;
}

function firstLevelNestingCondition(
  nesting: TrinityDecision['level_nesting'] | undefined,
  key: 'wait_conditions' | 'confirm_conditions' | 'invalidation_conditions',
  levelLabel: string
): string {
  const value = nesting?.[key]?.find((item) => Boolean(item?.trim()));
  return normalizeLevelCondition(value, levelLabel);
}

function scopedLevelCondition(
  value: string,
  levelLabel: string
): string {
  return value.startsWith(levelLabel) ? value.slice(levelLabel.length).trim() : value;
}
```

- [ ] **Step 5: 更新 `buildCombinationRecommendation()`**

在函数内优先读取 child level nesting condition：

```ts
  const triggerDecision = minor ?? major;
  const triggerLevelLabel = minor ? LEVEL_LABELS[minor.level] : LEVEL_LABELS[major.level];
  const levelCondition = firstLevelNestingCondition(triggerDecision.level_nesting, 'wait_conditions', triggerLevelLabel);
  const primaryTrigger = levelCondition || resolveCombinationTriggerText(triggerDecision, triggerLevelLabel);
  return `先等${primaryTrigger}`;
```

- [ ] **Step 6: 更新 `buildCombinationActionStateTags()`**

把 level result 和 execution result 改为优先使用新 resonance：

```ts
  const nesting = minor?.level_nesting ?? major?.level_nesting;
  const levelResult = majorBlocked
    ? `${majorLabel}未放行`
    : nesting?.resonance === 'boundary_probe'
      ? `${minorLabel}边界试探`
      : nesting?.resonance === 'structure_mismatch'
        ? `${minorLabel}结构错配`
        : nesting?.resonance === 'blocked'
          ? `${majorLabel}未放行`
          : nesting?.resonance === 'aligned'
            ? `${majorLabel}支持${minorLabel}`
            : nesting?.resonance === 'child_countertrend' || nesting?.resonance === 'conflict'
              ? `${minorLabel}逆${majorLabel}`
              : `${majorLabel}未放行`;
  const waitCondition = firstLevelNestingCondition(minor?.level_nesting, 'wait_conditions', minorLabel);
  const trigger = waitCondition || (minor ? resolveCombinationTriggerText(minor, minorLabel) : '');
  const executionResult = `${minorLabel}${EXECUTION_STRENGTH_LABELS[nesting?.execution_strength ?? ''] ?? '等待触发'}`;
```

同时把执行 tag hover 的等待条件 value 改为 `trigger || ...`。

- [ ] **Step 7: 更新 `triggerValue` 和 hover**

在 `buildCombination()` 中把 `triggerValue` 和 `triggerHoverValue` 改为：

```ts
  const minorNestingWait = minor ? firstLevelNestingCondition(minor.level_nesting, 'wait_conditions', minorLabel) : '';
  const majorNestingWait = major ? firstLevelNestingCondition(major.level_nesting, 'wait_conditions', majorLabel) : '';
  const triggerValue =
    (minorNestingWait ? scopedLevelCondition(minorNestingWait, minorLabel) : '') ||
    (majorNestingWait ? scopedLevelCondition(majorNestingWait, majorLabel) : '') ||
    (minor ? resolveScopedCombinationTriggerText(minor, minorLabel) : '') ||
    (major ? resolveScopedCombinationTriggerText(major, majorLabel) : '') ||
    `${minorLabel}等待触发`;
  const triggerHoverValue =
    minorNestingWait ||
    majorNestingWait ||
    (minor ? resolveCombinationTriggerText(minor, minorLabel) : '') ||
    (major ? resolveCombinationTriggerText(major, majorLabel) : '') ||
    `${minorLabel}等待触发`;
```

- [ ] **Step 8: 更新 `suitableAction` 下一步条件**

把 `suitableAction.hoverItems` 的“下一步条件”改为优先展示 `confirm_conditions`：

```ts
          formatList(
            [
              minor ? firstLevelNestingCondition(minor.level_nesting, 'confirm_conditions', minorLabel) : '',
              major ? firstLevelNestingCondition(major.level_nesting, 'confirm_conditions', majorLabel) : '',
              ...(resolveDecisionTriggerLabels(minor).length > 0
                ? resolveDecisionTriggerLabels(minor)
                : resolveDecisionTriggerLabels(major)),
            ],
            '等待进一步确认'
          )
```

- [ ] **Step 9: 更新 `majorRisk` 风险来源**

把 `majorRiskValue` 优先读取 `invalidation_conditions`：

```ts
  const nestingRisk =
    (minor ? firstLevelNestingCondition(minor.level_nesting, 'invalidation_conditions', minorLabel) : '') ||
    (major ? firstLevelNestingCondition(major.level_nesting, 'invalidation_conditions', majorLabel) : '');
  const majorRiskValue =
    nestingRisk ||
    resolveDecisionRiskLabels(minor).at(0) ||
    resolveDecisionRiskLabels(major).at(0) ||
    '暂无明确风险';
```

- [ ] **Step 10: 运行 view model 测试**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts
```

Expected: PASS。

## Task 5: 组件测试锁定总线展示新条件

**Files:**
- Modify: `tests/analysis-page-sections.test.ts`
- Test: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 扩展组件测试 fixture**

在 `TradingCycleBus groups signal tags into three layered sections` 的组合 fixture 中，将 `actionStateTags` 改成包含新关系：

```ts
          actionStateTags: [
            createSignalTag('级别｜30分钟边界试探', 'warning'),
            createSignalTag('执行｜30分钟等待边界确认', 'neutral'),
          ],
```

- [ ] **Step 2: 更新断言**

把动作状态断言改为：

```ts
  assert.match(html, /级别｜30分钟边界试探/);
  assert.match(html, /执行｜30分钟等待边界确认/);
  assert.doesNotMatch(html, /boundary_probe/);
  assert.doesNotMatch(html, /extended/);
  assert.doesNotMatch(html, /次级别结构继续共振/);
```

- [ ] **Step 3: 运行组件测试**

Run:

```bash
node --test tests/analysis-page-sections.test.ts
```

Expected: PASS。

## Task 6: 全量相关测试与类型检查

**Files:**
- No additional source files.

- [ ] **Step 1: 运行 Python 相关测试**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_level_nesting.py
python3 -m unittest tests/test_trinity_decision_trade_qualification.py
python3 -m unittest tests/test_structure_phase_execution.py
```

Expected: PASS。若后两组因既有环境依赖失败，记录失败输出，不要掩盖。

- [ ] **Step 2: 运行 TypeScript / node 相关测试**

Run:

```bash
node --test tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts tests/trinity-signal-tags.test.ts tests/trinity-decision-types.test.ts tests/trinity-judgment-display.test.ts
```

Expected: PASS。

- [ ] **Step 3: 运行类型检查**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: exit 0。

- [ ] **Step 4: 检查 diff 空白**

Run:

```bash
git diff --check
```

Expected: exit 0。

## Task 7: HTTP 回归验证

**Files:**
- No additional source files.

- [ ] **Step 1: 确认 5001 服务是否可用**

Run:

```bash
curl -s -o /tmp/analyze-stock-health.txt -w "%{http_code}" "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly"
```

Expected: prints `200` if server is already running. If it does not print `200`, start server in Step 2。

- [ ] **Step 2: 如服务未启动，启动 dev server**

Run only if Step 1 is not `200`:

```bash
PORT=5001 pnpm exec next dev --webpack --port 5001 > /tmp/nextjs-dev.log 2>&1
```

Expected: command stays running. In an agent session, keep the session id open until verification finishes. If port is occupied, inspect existing process and use the already-running server when it responds on 5001。

- [ ] **Step 3: 运行 CLAUDE.md 标准 HTTP 回归**

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

Expected includes:

```text
聚焦结构: C单平台式
原始结构: 延伸C类
聚焦起点来源: peak_extreme
顶分型包含209.88: True
```

- [ ] **Step 4: 验证新 level_nesting 合同通过 HTTP 出现**

Run:

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15" | python3 -c "
import json,sys
r=json.load(sys.stdin)
periods=r['data']['periods']
for level in ['daily','hour30','hour15']:
    n=((periods.get(level) or {}).get('trinity_decision') or {}).get('level_nesting') or {}
    print(level, {
        'parent_spacetime_status': n.get('parent_spacetime_status'),
        'child_structure_family': n.get('child_structure_family'),
        'child_structure_qualification': n.get('child_structure_qualification'),
        'resonance': n.get('resonance'),
        'execution_strength': n.get('execution_strength'),
        'wait_conditions': n.get('wait_conditions'),
    })
"
```

Expected: each printed nesting object has `resonance`, `execution_strength`, and a non-empty `wait_conditions` list when that period has a parent decision.

## Task 8: 最终 diff 与提交

**Files:**
- `scripts/stock_analyzer.py`
- `src/lib/stock-structure-types.ts`
- `src/lib/trinity-signal-tags.ts`
- `src/lib/trinity-judgment-display.ts`
- `src/lib/trinity-analysis-page-view-model.ts`
- `tests/test_trinity_decision_level_nesting.py`
- `tests/test_trinity_decision_trade_qualification.py`
- `tests/trinity-judgment-display.test.ts`
- `tests/trinity-analysis-page-view-model.test.ts`
- `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 检查目标 diff**

Run:

```bash
git diff -- scripts/stock_analyzer.py \
  src/lib/stock-structure-types.ts \
  src/lib/trinity-signal-tags.ts \
  src/lib/trinity-judgment-display.ts \
  src/lib/trinity-analysis-page-view-model.ts \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_trinity_decision_trade_qualification.py \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-page-sections.test.ts
```

Expected: diff 只包含级别嵌套合同、条件生成、中文展示和测试更新。

- [ ] **Step 2: 检查整体状态**

Run:

```bash
git status --short
```

Expected: 只包含本计划相关改动和用户明确保留的既有 WIP。不要 stage 未确认归属的文件。

- [ ] **Step 3: 提交本阶段改动**

如果前置 WIP 已经独立提交，提交本阶段文件：

```bash
git add scripts/stock_analyzer.py \
  src/lib/stock-structure-types.ts \
  src/lib/trinity-signal-tags.ts \
  src/lib/trinity-judgment-display.ts \
  src/lib/trinity-analysis-page-view-model.ts \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_trinity_decision_trade_qualification.py \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-page-sections.test.ts
git commit -m "实现：接入三位一体级别嵌套可执行条件"
```

Expected: commit succeeds.

If existing WIP remains uncommitted and overlaps these files, stop and ask user how to split commits.
