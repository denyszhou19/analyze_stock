# 三位一体判定内核 v2 第一阶段实施计划

> **给代理执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项执行本计划。步骤使用复选框语法（`- [ ]`）跟踪。

**目标：** 在不重写现有结构识别算法的前提下，为每个分析周期稳定产出 `trinity_decision`，并把它接到后端输出、TypeScript 类型、AI payload 和页面摘要消费链路上。

**架构：** 保留 `scripts/stock_analyzer.py` 现有的结构、时空、均线、突破、执行和级别嵌套计算逻辑，只新增一层“归一化决策包装器”，把分散字段映射成统一的 `TrinityDecision`。前端第一阶段不重做整页布局，只新增严格类型、紧凑 view-model 和一个小型摘要面板，让页面和 AI 都开始消费同一份确定性对象；标准/非标准结构重判、交易资格重构和整页迁移留给后续阶段。

**技术栈：** Python 3 + `pytest`/`unittest`、Next.js 16、React 19、TypeScript、Node `node:test`、`pnpm`、现有 `scripts/stock_analyzer.py` 分析链路

---

## 范围边界

本计划只实现设计文档中的 **Phase 1：统一输出 `trinity_decision`**，目标是先把统一契约打通并可测试。

**本计划包含：**
- Python 端生成 `trinity_decision`
- 级别字段、三类起点、基础门控、交易结论的第一版归一化
- TypeScript 类型定义与 AI payload 透传
- 页面读取 `trinity_decision` 的轻量摘要展示
- 针对五级别、三类起点、聚合 payload 的第一轮回归测试

**本计划不包含：**
- 标准/非标准结构资格算法重写
- `A/B/C/D` 规则重判与通道/大平台正式识别
- 完整交易资格内核替换
- 整页 UI 重新布局

后续应为 Phase 2/3/4 分别再写计划。

## 文件结构

**后端主线**
- 修改：`scripts/stock_analyzer.py`
  - 新增 `TrinityDecision` 构建辅助函数，并把归一化对象接入单周期与多周期输出。
- 新建：`tests/test_trinity_decision_levels.py`
  - 锁定各级别 `trinity_decision.level` 与基础契约字段。
- 新建：`tests/test_trinity_decision_level_nesting.py`
  - 锁定归一化后的父子级别权限映射。
- 新建：`tests/test_trinity_decision_origins.py`
  - 锁定 `background_origin` / `focus_origin` / `execution_origin` 映射与回退行为。
- 修改：`tests/test_structure_phase_execution.py`
  - 验证接入 `trinity_decision` 后，`analyze_single_period()` 和顶层交易决策仍然正常工作。

**类型契约 / Payload**
- 修改：`src/lib/stock-structure-types.ts`
  - 新增 `TrinityDecision` 接口和周期响应类型。
- 修改：`src/lib/ai-analysis-payload.ts`
  - 保留 `trinity_decision` 作为 `deterministic_decision`，停止在 payload 层重新推导这些字段。
- 新建：`tests/trinity-decision-types.test.ts`
  - 锁定 TS 契约结构和五个 `level` 枚举值。
- 修改：`tests/ai-analysis-payload.test.ts`
  - 锁定 payload 对确定性决策、起点字段和级别权限的保真。

**页面消费层**
- 新建：`src/lib/trinity-decision-view-model.ts`
  - 把原始 `trinity_decision` 转成紧凑的页面展示行，不做重复推导。
- 新建：`tests/trinity-decision-view-model.test.ts`
  - 锁定摘要标签、起点展示和门控提示。
- 新建：`src/components/stock/TrinityDecisionPanel.tsx`
  - 渲染紧凑版“结论 / 结构 / 时空 / 均线 / 量能 / 级别 / 执行”摘要面板。
- 修改：`src/app/stock/[code]/analysis/page.tsx`
  - 当 `period.trinity_decision` 存在时渲染新面板。

---

### 任务 1：新增后端 `trinity_decision` 契约构建层

**文件：**
- 新建：`tests/test_trinity_decision_levels.py`
- 修改：`scripts/stock_analyzer.py`

- [ ] **步骤 1：先写失败的 Python 契约测试**

```python
import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionLevelsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_trinity_decision_wraps_daily_contract(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '趋势中继',
                'trend_direction': '上涨',
                'description': 'A五段式，趋势 + 中继平台 + 趋势',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'summary': 'A五段式原型，等待 a5 确认',
                        'start_anchor': {
                            'point_id': 'a1',
                            'price': 10.5,
                            'date': '2026-02-10 00:00:00',
                            'semantic': 'focus_origin',
                        },
                        'reference_origin': {
                            'price': 9.8,
                            'date': '2026-02-10 00:00:00',
                            'semantic': 'background_origin',
                        },
                        'start_anchor_source': 'peak_extreme',
                        'qualification_reason': 'A原型成立',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏强',
                        'child_structure_match': False,
                        'resonance_enabled': False,
                        'structure_readiness': 'candidate',
                        'wait_reason': '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作',
                        'required_confirmation': '等待 C 结构边界确认',
                    },
                },
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'peak_extreme',
                        'selected_point_index': 3,
                        'explainability_status': 'passed',
                        'explainability_reason': '检测到主峰切片，优先从峰值极点开始解释右侧结构',
                    },
                    'focus_classification': {
                        'type': 'A五段式',
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'qualification_reason': 'A原型成立',
                    },
                    'explainability': {
                        'structure_start_point_id': 'a1',
                        'current_point_id': 'a4',
                        'display_reason': '标准结构编号从当前结构起点重新计数',
                    },
                },
            },
            macd_payload={
                'status': '中偏强',
                'top_divergence': False,
                'bottom_divergence': False,
            },
            moving_averages={
                'MA55': 159.99,
                'MA233': 123.60,
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={
                'pattern_type': '回抽突破',
                'direction': 'up',
                'is_valid': True,
                'confidence': '高',
            },
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'pullback',
                'trigger': ['重新站上平台上沿'],
                'invalidation': ['跌回平台下沿'],
                'confirmation': ['回踩 MA55 不破'],
                'position_sizing': {'initial': '10%-15%'},
                'risk_flags': ['等待确认'],
                'wait_reason': '等待 C 结构边界确认',
                'rationale': '结构原型存在，但时空门控未放行',
            },
            level_nesting_payload=None,
        )

        self.assertEqual(decision['version'], 'v2')
        self.assertEqual(decision['level'], 'daily')
        self.assertEqual(decision['conclusion']['action'], 'wait')
        self.assertEqual(decision['structure']['type'], 'A五段式')
        self.assertEqual(decision['structure']['standard_candidate'], 'A五段式')
        self.assertEqual(decision['structure']['focus_origin']['source'], 'peak_extreme')
        self.assertEqual(decision['structure']['background_origin']['semantic'], 'background_origin')
        self.assertFalse(decision['spacetime']['structure_match'])
        self.assertFalse(decision['moving_average']['ma_gate']['allow_short'])
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['execution']['entry_style'], 'pullback')

    def test_build_trinity_decision_keeps_hour30_level_value(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台震荡区间',
                'trend_direction': '震荡',
                'description': 'C单平台式，5笔震荡整理',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'summary': '单平台等待突破',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏弱',
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'structure_readiness': 'developing',
                        'wait_reason': None,
                        'required_confirmation': '等待平台边界突破',
                    },
                },
                'structure_details': {},
            },
            macd_payload={'status': '中偏弱'},
            moving_averages={'price_vs_ma55': 'below', 'price_vs_ma233': 'above', 'ma_status': '缠绕'},
            breakthrough_payload={},
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'neutral',
                'entry_style': 'boundary',
                'trigger': ['突破平台上沿'],
                'invalidation': ['跌破平台下沿'],
                'confirmation': ['量能确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
                'wait_reason': '等待平台边界突破',
                'rationale': '30分钟只输出边界候选',
            },
            level_nesting_payload=None,
        )

        self.assertEqual(decision['level'], 'hour30')
        self.assertEqual(decision['structure']['type'], 'C单平台式')
        self.assertEqual(decision['execution']['entry_style'], 'boundary')
```

- [ ] **步骤 2：运行新的后端测试并确认它们先失败**

运行：

```bash
python3 -m pytest tests/test_trinity_decision_levels.py -q
```

预期：

```text
FAILED tests/test_trinity_decision_levels.py::TrinityDecisionLevelsTest::test_build_trinity_decision_wraps_daily_contract
E   AttributeError: 'TrinityStockAnalyzer' object has no attribute '_build_trinity_decision'
```

- [ ] **步骤 3：在 `scripts/stock_analyzer.py` 中实现归一化构建辅助函数**

把这些辅助函数放在现有结构 / render payload 辅助函数附近，并保持纯函数特性，方便测试直接调用：

```python
    def _normalize_trinity_anchor(
        self,
        anchor: Optional[Dict[str, Any]],
        *,
        source: Optional[str] = None,
        semantic: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(anchor, dict):
            return None
        price = anchor.get('price')
        date = anchor.get('date')
        point_id = anchor.get('point_id')
        if price is None and date is None and point_id is None:
            return None
        return {
            'point_id': point_id,
            'price': price,
            'date': date,
            'source': source or anchor.get('source'),
            'semantic': semantic or anchor.get('semantic'),
        }

    def _build_trinity_structure_decision(
        self,
        structure_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        interpretation = structure_payload.get('interpretation') or {}
        focus_structure = interpretation.get('focus_structure') or {}
        spacetime_gate = interpretation.get('spacetime_gate') or {}
        details = structure_payload.get('structure_details') or {}
        focus_origin_analysis = details.get('focus_origin_analysis') or {}
        focus_classification = details.get('focus_classification') or {}
        explainability = details.get('explainability') or {}

        focus_anchor = self._normalize_trinity_anchor(
            focus_structure.get('start_anchor'),
            source=focus_structure.get('start_anchor_source') or focus_origin_analysis.get('selected_origin_kind'),
            semantic='focus_origin',
        )
        background_anchor = self._normalize_trinity_anchor(
            focus_structure.get('reference_origin'),
            source='macro_origin',
            semantic='background_origin',
        )
        execution_anchor = self._normalize_trinity_anchor(
            {
                'point_id': explainability.get('current_point_id'),
                'price': None,
                'date': None,
            },
            source='current_structure',
            semantic='execution_origin',
        )

        structure_type = structure_payload.get('structure_type')
        qualification = focus_classification.get('standard_qualification') or focus_structure.get('standard_qualification') or 'failed'
        family = {
            'standard': 'standard',
            'extended': 'extended',
        }.get(qualification, 'complex')
        if structure_type in ('上升通道', '下降通道'):
            family = 'channel'
        elif structure_type == '大平台震荡':
            family = 'range'
        elif structure_type == '未完成结构':
            family = 'unfinished'

        return {
            'background_origin': background_anchor,
            'focus_origin': focus_anchor,
            'execution_origin': execution_anchor,
            'family': family,
            'type': structure_type,
            'standard_candidate': focus_classification.get('type') if qualification == 'standard' else focus_classification.get('type'),
            'qualification': qualification,
            'direction': {
                '上涨': 'up',
                '下跌': 'down',
                '震荡': 'neutral',
            }.get(structure_payload.get('trend_direction'), 'neutral'),
            'boundaries': {
                'upper': None,
                'lower': None,
                'mid': None,
                'breakout_trigger': None,
                'breakdown_trigger': None,
                'stop_loss': None,
            },
            'node_map': {
                'last_confirmed': explainability.get('current_point_id'),
            },
            'can_trade_by_structure_nodes': qualification == 'standard' and family == 'standard',
            'can_trade_by_boundaries': True,
            'explainability': {
                'status': focus_origin_analysis.get('explainability_status') or 'passed',
                'reason': focus_origin_analysis.get('explainability_reason') or focus_structure.get('qualification_reason') or structure_payload.get('description') or '',
                'evidence': [
                    structure_payload.get('description') or '',
                    focus_structure.get('summary') or '',
                    spacetime_gate.get('required_confirmation') or '',
                ],
            },
        }

    def _build_trinity_spacetime_decision(
        self,
        structure_payload: Dict[str, Any],
        macd_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        gate = (structure_payload.get('interpretation') or {}).get('spacetime_gate') or {}
        status = macd_payload.get('status') or '未知'
        return {
            'status': status,
            'direction_bias': 'bullish' if status in ('极强', '强', '中偏强') else 'bearish' if status in ('极弱', '弱', '中偏弱') else 'neutral',
            'expected_structures': {
                'up': ['A五段式', 'B双平台式', 'C单平台式'],
                'down': ['D三段式', 'B双平台式', 'C单平台式'],
            },
            'structure_match': bool(gate.get('child_structure_match')),
            'mismatch_reason': gate.get('wait_reason'),
            'divergence_policy': {
                'top_divergence_valid': bool(macd_payload.get('top_divergence')),
                'bottom_divergence_valid': bool(macd_payload.get('bottom_divergence')),
                'reason': macd_payload.get('divergence_note') or '沿用现有 MACD 背离字段',
            },
        }

    def _build_trinity_moving_average_decision(
        self,
        moving_averages: Dict[str, Any],
        breakthrough_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        above_ma55 = moving_averages.get('price_vs_ma55') == 'above'
        above_ma233 = moving_averages.get('price_vs_ma233') == 'above'
        ma_status = moving_averages.get('ma_status') or ''
        allow_long = above_ma55
        allow_short = not above_ma55 and '空头' in ma_status
        breakthrough_state = 'none'
        if breakthrough_payload.get('pattern_type'):
            if breakthrough_payload.get('direction') == 'up' and breakthrough_payload.get('is_valid'):
                breakthrough_state = 'valid_breakout'
            elif breakthrough_payload.get('direction') == 'down' and breakthrough_payload.get('is_valid'):
                breakthrough_state = 'valid_breakdown'

        return {
            'ma55_role': 'support' if above_ma55 else 'resistance' if not above_ma55 else 'neutral',
            'ma233_role': 'support' if above_ma233 else 'resistance' if not above_ma233 else 'neutral',
            'price_position': {
                'above_ma55': above_ma55,
                'above_ma233': above_ma233,
                'deviation_ma55_pct': None,
                'deviation_ma233_pct': None,
            },
            'breakthrough_state': breakthrough_state,
            'ma_gate': {
                'allow_long': allow_long,
                'allow_short': allow_short,
                'reason': '沿用现有 MA55 / MA233 相对位置与突破字段',
            },
        }

    def _build_trinity_volume_confirmation_decision(
        self,
        period_payload: Dict[str, Any],
        breakthrough_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            'volume_ratio_5': None,
            'volume_ratio_20': None,
            'amount_ratio_20': None,
            'turnover_rate': None,
            'volume_state': 'unknown',
            'breakout_volume': 'not_applicable' if breakthrough_payload.get('direction') != 'up' else 'weak',
            'breakdown_volume': 'not_applicable' if breakthrough_payload.get('direction') != 'down' else 'weak',
            'pullback_volume': 'not_applicable',
            'volume_gate': {
                'supports_breakout': False,
                'supports_breakdown': False,
                'supports_pullback_confirmation': False,
                'confidence_adjustment': 'neutral',
                'reason': 'Phase 1 先保留字段，后续阶段接入均量比和成交额比',
            },
        }

    def _build_trinity_trade_qualification(
        self,
        structure_decision: Dict[str, Any],
        spacetime_decision: Dict[str, Any],
        moving_average_decision: Dict[str, Any],
        execution_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        if execution_payload.get('action') == 'wait':
            trade_mode = 'wait_confirmation'
            position_permission = 'no_position'
        elif structure_decision.get('can_trade_by_structure_nodes') and moving_average_decision['ma_gate']['allow_long']:
            trade_mode = 'standard_node_trade'
            position_permission = 'half_position'
        else:
            trade_mode = 'conditional_boundary_trade'
            position_permission = 'light_probe'
        return {
            'trade_mode': trade_mode,
            'position_permission': position_permission,
            'confidence': 'medium',
            'reason': [
                structure_decision['explainability']['reason'],
                spacetime_decision.get('mismatch_reason') or '时空未额外否决',
                moving_average_decision['ma_gate']['reason'],
            ],
        }

    def _build_trinity_execution_decision(
        self,
        execution_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            'entry_style': execution_payload.get('entry_style') or 'none',
            'triggers': execution_payload.get('trigger') or [],
            'invalidation': execution_payload.get('invalidation') or [],
            'confirmation': execution_payload.get('confirmation') or [],
            'position_sizing': {
                'max_ratio': execution_payload.get('timeframe_cap_ratio'),
                'reason': execution_payload.get('rationale') or execution_payload.get('wait_reason') or '沿用现有执行摘要',
                'upgrade_condition': None,
                'downgrade_condition': execution_payload.get('wait_reason'),
            },
            'risk_flags': execution_payload.get('risk_flags') or [],
        }

    def _build_trinity_decision(
        self,
        *,
        level: str,
        structure_payload: Dict[str, Any],
        macd_payload: Dict[str, Any],
        moving_averages: Dict[str, Any],
        breakthrough_payload: Dict[str, Any],
        execution_payload: Dict[str, Any],
        level_nesting_payload: Optional[Dict[str, Any]],
        period_payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        structure_decision = self._build_trinity_structure_decision(structure_payload)
        spacetime_decision = self._build_trinity_spacetime_decision(structure_payload, macd_payload)
        moving_average_decision = self._build_trinity_moving_average_decision(moving_averages, breakthrough_payload)
        volume_decision = self._build_trinity_volume_confirmation_decision(period_payload or {}, breakthrough_payload)
        trade_qualification = self._build_trinity_trade_qualification(
            structure_decision,
            spacetime_decision,
            moving_average_decision,
            execution_payload,
        )
        execution_decision = self._build_trinity_execution_decision(execution_payload)

        action = execution_payload.get('action') or 'wait'
        return {
            'version': 'v2',
            'level': level,
            'conclusion': {
                'action': action,
                'action_label': action,
                'bias': 'bullish' if execution_payload.get('direction') == 'long' else 'bearish' if execution_payload.get('direction') == 'short' else 'neutral',
                'confidence': trade_qualification['confidence'],
                'can_trade': bool(execution_payload.get('can_trade')),
                'wait_reason': execution_payload.get('wait_reason'),
            },
            'structure': structure_decision,
            'spacetime': spacetime_decision,
            'moving_average': moving_average_decision,
            'volume_confirmation': volume_decision,
            'level_nesting': level_nesting_payload,
            'trade_qualification': trade_qualification,
            'execution': execution_decision,
            'judgment_criteria': [],
            'ai_summary_facts': [
                structure_payload.get('description') or '',
                execution_payload.get('rationale') or execution_payload.get('wait_reason') or '',
            ],
        }
```

- [ ] **步骤 4：再次运行后端测试并确认通过**

运行：

```bash
python3 -m pytest tests/test_trinity_decision_levels.py -q
```

预期：

```text
2 passed in <time>
```

- [ ] **步骤 5：提交后端契约层改动**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_levels.py
git commit -m "feat: add trinity decision backend contract"
```

### 任务 2：接通单周期输出、级别嵌套与起点归一化

**文件：**
- 新建：`tests/test_trinity_decision_level_nesting.py`
- 新建：`tests/test_trinity_decision_origins.py`
- 修改：`tests/test_structure_phase_execution.py`
- 修改：`scripts/stock_analyzer.py`

- [ ] **步骤 1：先写级别嵌套和起点分层的失败测试**

```python
import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionLevelNestingTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_trinity_level_nesting_allows_upgrade_when_weekly_daily_align(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': {'macd': {'status': '强'}, 'trinity_decision': {'conclusion': {'bias': 'bullish'}}},
                'daily': {'macd': {'status': '强'}, 'trinity_decision': {'structure': {'type': 'A五段式'}}},
            },
            raw_level_nesting={'summary': '周线强 / 日线强'},
        )

        self.assertEqual(decision['parent_level'], 'weekly')
        self.assertEqual(decision['child_level'], 'daily')
        self.assertEqual(decision['resonance'], 'aligned')
        self.assertTrue(decision['permission']['allow_position_increase'])

    def test_build_trinity_level_nesting_marks_parent_unclear_when_weekly_missing(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'daily': {'macd': {'status': '中偏弱'}, 'trinity_decision': {'structure': {'type': 'C单平台式'}}},
            },
            raw_level_nesting=None,
        )

        self.assertEqual(decision['resonance'], 'parent_unclear')
        self.assertTrue(decision['permission']['allow_only_light_probe'])
        self.assertIn('父级别缺失', decision['permission']['reason'])
```

```python
import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionOriginsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_background_origin_outside_window_does_not_map_to_first_visible_point(self) -> None:
        structure = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': '复杂结构',
                'trend_direction': '下跌',
                'description': '复杂结构等待确认',
                'interpretation': {
                    'focus_structure': {
                        'reference_origin': {
                            'price': 76.66,
                            'date': '2025-07-14 00:00:00',
                        },
                        'start_anchor_source': 'macro_origin',
                    },
                },
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'macro_origin',
                        'selected_point_index': None,
                        'explainability_reason': '当前窗口未包含该原点',
                    },
                },
            }
        )

        self.assertEqual(structure['background_origin']['date'], '2025-07-14 00:00:00')
        self.assertEqual(structure['background_origin']['source'], 'macro_origin')
        self.assertIsNone(structure['focus_origin'])

    def test_execution_origin_uses_current_point_as_child_anchor(self) -> None:
        structure = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': '延伸C类',
                'trend_direction': '下跌',
                'description': '延伸C类，等待边界确认',
                'interpretation': {
                    'focus_structure': {
                        'start_anchor': {'point_id': 'p1', 'price': 209.9, 'date': '2024-03-04 00:00:00'},
                        'start_anchor_source': 'peak_extreme',
                    },
                },
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'peak_extreme',
                        'selected_point_index': 3,
                        'explainability_reason': '检测到主峰切片',
                    },
                    'explainability': {
                        'current_point_id': 'p16',
                    },
                },
            }
        )

        self.assertEqual(structure['focus_origin']['point_id'], 'p1')
        self.assertEqual(structure['execution_origin']['point_id'], 'p16')
        self.assertEqual(structure['execution_origin']['semantic'], 'execution_origin')
```

再给 `tests/test_structure_phase_execution.py` 增加一条集成回归测试：

```python
    def test_analyze_single_period_exposes_trinity_decision(self) -> None:
        df = pd.DataFrame(
            {
                'date': pd.date_range('2026-01-01', periods=120, freq='D'),
                'open': [10 + i * 0.1 for i in range(120)],
                'high': [10.2 + i * 0.1 for i in range(120)],
                'low': [9.8 + i * 0.1 for i in range(120)],
                'close': [10.1 + i * 0.1 for i in range(120)],
                'volume': [1000000 for _ in range(120)],
            }
        )

        result = self.analyzer.analyze_single_period(df, 'daily')

        self.assertIn('trinity_decision', result)
        self.assertEqual(result['trinity_decision']['version'], 'v2')
        self.assertEqual(result['trinity_decision']['level'], 'daily')
        self.assertIn('structure', result['trinity_decision'])
        self.assertIn('trade_qualification', result['trinity_decision'])
```

- [ ] **步骤 2：运行新的 Python 测试并确认它们先失败**

运行：

```bash
python3 -m pytest tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_origins.py tests/test_structure_phase_execution.py -q
```

预期：

```text
FAILED ... _build_trinity_level_nesting_decision
FAILED ... analyze_single_period_exposes_trinity_decision
```

- [ ] **步骤 3：实现级别嵌套归一化和输出接线**

新增一个级别嵌套映射器，并把 `trinity_decision` 接入 `analyze_single_period()` 和多周期响应路径：

```python
    def _build_trinity_level_nesting_decision(
        self,
        *,
        level: str,
        normalized_results: Dict[str, Any],
        raw_level_nesting: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        parent_map = {
            'daily': 'weekly',
            'hour60': 'daily',
            'hour30': 'daily',
            'hour15': 'hour60',
        }
        parent_level = parent_map.get(level)
        parent_payload = normalized_results.get(parent_level or '') if parent_level else None
        child_payload = normalized_results.get(level)

        if not parent_level or not isinstance(parent_payload, dict):
            return {
                'parent_level': parent_level,
                'child_level': level,
                'parent_bias': 'neutral',
                'child_signal': 'wait',
                'resonance': 'parent_unclear',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': level in ('hour30', 'hour15'),
                    'allow_only_light_probe': True,
                    'reason': '父级别缺失或尚未归一化，降级为轻仓/等待',
                },
            }

        parent_status = ((parent_payload.get('macd') or {}).get('status'))
        child_structure = (((child_payload or {}).get('trinity_decision') or {}).get('structure') or {}).get('type')
        aligned = parent_status in ('极强', '强', '中偏强') and child_structure in ('A五段式', 'B双平台式', 'C单平台式')
        conflict = parent_status in ('极弱', '弱', '中偏弱') and child_structure in ('A五段式', 'B双平台式')

        return {
            'parent_level': parent_level,
            'child_level': level,
            'parent_bias': 'bullish' if parent_status in ('极强', '强', '中偏强') else 'bearish' if parent_status in ('极弱', '弱', '中偏弱') else 'neutral',
            'child_signal': 'long' if child_structure in ('A五段式', 'B双平台式') else 'wait',
            'resonance': 'aligned' if aligned else 'conflict' if conflict else 'child_countertrend',
            'permission': {
                'allow_position_increase': aligned,
                'allow_t_trade': level in ('hour30', 'hour15'),
                'allow_only_light_probe': not aligned,
                'reason': raw_level_nesting.get('summary') if isinstance(raw_level_nesting, dict) and raw_level_nesting.get('summary') else ('父子级别共振' if aligned else '父子级别冲突，降级执行'),
            },
        }
```

在 `analyze_single_period()` 中，等现有字段都准备好之后追加归一化对象：

```python
        result['trinity_decision'] = self._build_trinity_decision(
            level=level,
            structure_payload=result.get('structure') or {},
            macd_payload=result.get('macd') or {},
            moving_averages=result.get('moving_averages') or {},
            breakthrough_payload=result.get('breakthrough') or {},
            execution_payload=((result.get('structure') or {}).get('execution') or {}),
            level_nesting_payload=None,
            period_payload=result,
        )
```

在多周期聚合器里，`nesting = self.analyze_level_nesting(results)` 之后、返回之前，对所有可用周期做归一化，并把 `level_nesting` 回填到各自的 `trinity_decision`：

```python
            normalized_results = {
                level_name: payload
                for level_name, payload in results.items()
                if isinstance(payload, dict) and 'error' not in payload and payload.get('trinity_decision')
            }

            for level_name, payload in normalized_results.items():
                payload['trinity_decision']['level_nesting'] = self._build_trinity_level_nesting_decision(
                    level=level_name,
                    normalized_results=normalized_results,
                    raw_level_nesting=nesting,
                )
```

- [ ] **步骤 4：再次运行 Python 集成测试**

运行：

```bash
python3 -m pytest tests/test_trinity_decision_levels.py tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_origins.py tests/test_structure_phase_execution.py -q
```

预期：

```text
all selected tests passed
```

- [ ] **步骤 5：提交集成接线改动**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_origins.py tests/test_structure_phase_execution.py
git commit -m "feat: wire trinity decision through period outputs"
```

### 任务 3：新增 TypeScript 契约并保留 AI payload 的确定性决策

**文件：**
- 修改：`src/lib/stock-structure-types.ts`
- 修改：`src/lib/ai-analysis-payload.ts`
- 新建：`tests/trinity-decision-types.test.ts`
- 修改：`tests/ai-analysis-payload.test.ts`

- [ ] **步骤 1：先写失败的 TypeScript 测试**

新建 `tests/trinity-decision-types.test.ts`：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrinityDecision } from '../src/lib/stock-structure-types.ts';

const sampleDecision: TrinityDecision = {
  version: 'v2',
  level: 'daily',
  conclusion: {
    action: 'wait',
    action_label: '等待',
    bias: 'neutral',
    confidence: 'medium',
    can_trade: false,
    wait_reason: '等待 C 结构边界确认',
  },
  structure: {
    background_origin: { price: 9.8, date: '2026-02-10 00:00:00', source: 'macro_origin', semantic: 'background_origin' },
    focus_origin: { point_id: 'a1', price: 10.5, date: '2026-02-10 00:00:00', source: 'peak_extreme', semantic: 'focus_origin' },
    execution_origin: { point_id: 'a4', price: null, date: null, source: 'current_structure', semantic: 'execution_origin' },
    family: 'standard',
    type: 'A五段式',
    standard_candidate: 'A五段式',
    qualification: 'standard',
    direction: 'up',
    boundaries: { upper: null, lower: null, mid: null, breakout_trigger: null, breakdown_trigger: null, stop_loss: null },
    node_map: { a4: 10.8, last_confirmed: 'a4' as any },
    can_trade_by_structure_nodes: true,
    can_trade_by_boundaries: true,
    explainability: {
      status: 'passed',
      reason: 'A原型成立',
      evidence: ['A五段式，趋势 + 中继平台 + 趋势'],
    },
  },
  spacetime: {
    status: '中偏强',
    direction_bias: 'bullish',
    expected_structures: { up: ['A五段式'], down: ['D三段式'] },
    structure_match: false,
    mismatch_reason: '等待 C 结构边界确认',
    divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: '沿用现有 MACD 背离字段' },
  },
  moving_average: {
    ma55_role: 'support',
    ma233_role: 'support',
    price_position: { above_ma55: true, above_ma233: true, deviation_ma55_pct: null, deviation_ma233_pct: null },
    breakthrough_state: 'valid_breakout',
    ma_gate: { allow_long: true, allow_short: false, reason: '沿用现有 MA55 / MA233 相对位置与突破字段' },
  },
  volume_confirmation: {
    volume_ratio_5: null,
    volume_ratio_20: null,
    amount_ratio_20: null,
    turnover_rate: null,
    volume_state: 'unknown',
    breakout_volume: 'weak',
    breakdown_volume: 'not_applicable',
    pullback_volume: 'not_applicable',
    volume_gate: {
      supports_breakout: false,
      supports_breakdown: false,
      supports_pullback_confirmation: false,
      confidence_adjustment: 'neutral',
      reason: 'Phase 1 先保留字段，后续阶段接入均量比和成交额比',
    },
  },
  level_nesting: {
    parent_level: 'weekly',
    child_level: 'daily',
    parent_bias: 'bullish',
    child_signal: 'wait',
    resonance: 'child_countertrend',
    permission: { allow_position_increase: false, allow_t_trade: false, allow_only_light_probe: true, reason: '父子级别冲突，降级执行' },
  },
  trade_qualification: {
    trade_mode: 'wait_confirmation',
    position_permission: 'no_position',
    confidence: 'medium',
    reason: ['A原型成立', '等待 C 结构边界确认'],
  },
  execution: {
    entry_style: 'pullback',
    triggers: ['重新站上平台上沿'],
    invalidation: ['跌回平台下沿'],
    confirmation: ['回踩 MA55 不破'],
    position_sizing: { max_ratio: null, reason: '等待 C 结构边界确认', upgrade_condition: null, downgrade_condition: '等待 C 结构边界确认' },
    risk_flags: ['等待确认'],
  },
  judgment_criteria: [],
  ai_summary_facts: ['A五段式，趋势 + 中继平台 + 趋势'],
};

test('TrinityDecision accepts all five levels', () => {
  const levels: TrinityDecision['level'][] = ['weekly', 'daily', 'hour60', 'hour30', 'hour15'];
  assert.equal(levels.length, 5);
  assert.equal(sampleDecision.level, 'daily');
});
```

再给 `tests/ai-analysis-payload.test.ts` 增加一条失败断言：

```ts
test('buildAiDecisionPayload preserves deterministic_decision for daily period', () => {
  const payload = buildAiDecisionPayload({
    stock_code: '300274',
    periods: {
      daily: {
        trinity_decision: {
          version: 'v2',
          level: 'daily',
          conclusion: { action: 'wait', action_label: '等待', bias: 'neutral', confidence: 'medium', can_trade: false, wait_reason: '等待 C 结构边界确认' },
          structure: {
            background_origin: null,
            focus_origin: { point_id: 'a1', price: 10.5, date: '2026-02-10 00:00:00', source: 'peak_extreme', semantic: 'focus_origin' },
            execution_origin: null,
            family: 'standard',
            type: 'A五段式',
            standard_candidate: 'A五段式',
            qualification: 'standard',
            direction: 'up',
            boundaries: {},
            node_map: {},
            can_trade_by_structure_nodes: true,
            can_trade_by_boundaries: true,
            explainability: { status: 'passed', reason: 'A原型成立', evidence: ['A五段式'] },
          },
          spacetime: { status: '中偏强', direction_bias: 'bullish', expected_structures: { up: ['A五段式'], down: ['D三段式'] }, structure_match: false, mismatch_reason: '等待 C 结构边界确认', divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: 'none' } },
          moving_average: { ma55_role: 'support', ma233_role: 'support', price_position: { above_ma55: true, above_ma233: true }, breakthrough_state: 'valid_breakout', ma_gate: { allow_long: true, allow_short: false, reason: 'ok' } },
          volume_confirmation: { volume_state: 'unknown', breakout_volume: 'weak', breakdown_volume: 'not_applicable', pullback_volume: 'not_applicable', volume_gate: { supports_breakout: false, supports_breakdown: false, supports_pullback_confirmation: false, confidence_adjustment: 'neutral', reason: 'phase1' } },
          trade_qualification: { trade_mode: 'wait_confirmation', position_permission: 'no_position', confidence: 'medium', reason: ['A原型成立'] },
          execution: { entry_style: 'pullback', triggers: ['重新站上平台上沿'], invalidation: ['跌回平台下沿'], confirmation: ['回踩 MA55 不破'], position_sizing: { reason: '等待' }, risk_flags: [] },
          judgment_criteria: [],
          ai_summary_facts: ['A五段式'],
        },
      },
    },
  } as any);

  assert.equal((payload.periods.daily as any).deterministic_decision.level, 'daily');
  assert.equal((payload.periods.daily as any).deterministic_decision.structure.focus_origin.source, 'peak_extreme');
});
```

- [ ] **步骤 2：运行 TS 测试并确认它们先失败**

运行：

```bash
node --test tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts && pnpm ts-check
```

预期：

```text
TypeScript compile errors for missing TrinityDecision export
or
AssertionError: deterministic_decision is undefined
```

- [ ] **步骤 3：实现 TS 接口和 payload 保真**

把归一化接口追加到 `src/lib/stock-structure-types.ts` 现有结构相关导出之后：

```ts
export interface TrinityAnchor {
  point_id?: string | null;
  price?: number | null;
  date?: string | null;
  source?: string | null;
  semantic?: string | null;
}

export interface TrinityConclusion {
  action: 'buy' | 'add' | 'hold' | 'reduce' | 'sell' | 't_trade' | 'wait' | 'avoid';
  action_label: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  can_trade: boolean;
  wait_reason?: string | null;
}

export interface TrinityStructureDecision {
  background_origin?: TrinityAnchor | null;
  focus_origin?: TrinityAnchor | null;
  execution_origin?: TrinityAnchor | null;
  family: 'standard' | 'extended' | 'channel' | 'range' | 'unfinished' | 'complex';
  type:
    | 'A五段式'
    | 'B双平台式'
    | 'C单平台式'
    | 'D三段式'
    | '延伸A'
    | '延伸B'
    | '延伸C'
    | '延伸D'
    | '上升通道'
    | '下降通道'
    | '大平台震荡'
    | '未完成结构'
    | '复杂结构';
  standard_candidate?: 'A五段式' | 'B双平台式' | 'C单平台式' | 'D三段式' | null;
  qualification: 'standard' | 'extended' | 'over_limit' | 'unfinished' | 'failed';
  direction: 'up' | 'down' | 'neutral';
  boundaries: {
    upper?: number | null;
    lower?: number | null;
    mid?: number | null;
    breakout_trigger?: number | null;
    breakdown_trigger?: number | null;
    stop_loss?: number | null;
  };
  node_map: Record<string, unknown>;
  can_trade_by_structure_nodes: boolean;
  can_trade_by_boundaries: boolean;
  explainability: {
    status: 'passed' | 'downgraded' | 'failed';
    reason: string;
    evidence: string[];
  };
}

export interface TrinitySpacetimeDecision {
  status: string;
  direction_bias: 'bullish' | 'bearish' | 'neutral';
  expected_structures: { up: string[]; down: string[] };
  structure_match: boolean;
  mismatch_reason?: string | null;
  divergence_policy: {
    top_divergence_valid: boolean;
    bottom_divergence_valid: boolean;
    reason: string;
  };
}

export interface TrinityMovingAverageDecision {
  ma55_role: 'support' | 'resistance' | 'neutral';
  ma233_role: 'support' | 'resistance' | 'neutral';
  price_position: {
    above_ma55: boolean;
    above_ma233: boolean;
    deviation_ma55_pct?: number | null;
    deviation_ma233_pct?: number | null;
  };
  breakthrough_state:
    | 'none'
    | 'breakout_pending'
    | 'valid_breakout'
    | 'pullback_confirmed'
    | 'false_breakout'
    | 'breakdown_pending'
    | 'valid_breakdown'
    | 'pullback_breakdown_confirmed'
    | 'false_breakdown';
  ma_gate: {
    allow_long: boolean;
    allow_short: boolean;
    reason: string;
  };
}

export interface TrinityVolumeConfirmationDecision {
  volume_ratio_5?: number | null;
  volume_ratio_20?: number | null;
  amount_ratio_20?: number | null;
  turnover_rate?: number | null;
  volume_state: 'shrinking' | 'normal' | 'expanding' | 'climax' | 'unknown';
  breakout_volume: 'confirmed' | 'weak' | 'climax_risk' | 'not_applicable';
  breakdown_volume: 'confirmed' | 'weak' | 'climax_risk' | 'not_applicable';
  pullback_volume: 'healthy_shrink' | 'danger_expand' | 'normal' | 'not_applicable';
  volume_gate: {
    supports_breakout: boolean;
    supports_breakdown: boolean;
    supports_pullback_confirmation: boolean;
    confidence_adjustment: 'upgrade' | 'neutral' | 'downgrade';
    reason: string;
  };
}

export interface TrinityLevelNestingDecision {
  parent_level?: string | null;
  child_level?: string | null;
  parent_bias: 'bullish' | 'bearish' | 'neutral';
  child_signal: 'long' | 'short' | 'wait';
  resonance: 'aligned' | 'conflict' | 'child_countertrend' | 'parent_unclear';
  permission: {
    allow_position_increase: boolean;
    allow_t_trade: boolean;
    allow_only_light_probe: boolean;
    reason: string;
  };
}

export interface TrinityTradeQualification {
  trade_mode: 'standard_node_trade' | 'conditional_boundary_trade' | 'wait_confirmation' | 'risk_control' | 'no_trade';
  position_permission: 'full_signal' | 'half_position' | 'light_probe' | 't_trade_only' | 'reduce_only' | 'no_position';
  confidence: 'high' | 'medium' | 'low';
  reason: string[];
}

export interface TrinityExecutionDecision {
  entry_style: 'node' | 'boundary' | 'pullback' | 'breakout' | 't_trade' | 'none';
  triggers: string[];
  invalidation: string[];
  confirmation: string[];
  position_sizing: {
    max_ratio?: number | null;
    reason: string;
    upgrade_condition?: string | null;
    downgrade_condition?: string | null;
  };
  risk_flags: string[];
}

export interface TrinityJudgmentCriterion {
  category: 'structure' | 'spacetime' | 'moving_average' | 'volume' | 'level_nesting' | 'execution';
  label: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  detail: string;
}

export interface TrinityDecision {
  version: 'v2';
  level: 'weekly' | 'daily' | 'hour60' | 'hour30' | 'hour15';
  conclusion: TrinityConclusion;
  structure: TrinityStructureDecision;
  spacetime: TrinitySpacetimeDecision;
  moving_average: TrinityMovingAverageDecision;
  volume_confirmation: TrinityVolumeConfirmationDecision;
  level_nesting?: TrinityLevelNestingDecision;
  trade_qualification: TrinityTradeQualification;
  execution: TrinityExecutionDecision;
  judgment_criteria: TrinityJudgmentCriterion[];
  ai_summary_facts: string[];
}
```

更新 `src/lib/ai-analysis-payload.ts`，让 `summarizePeriod()` 保留归一化后的决策对象，而不是把它丢弃：

```ts
    structure: compactRecord({
      type: periodData.structure?.structure_type,
      stage: periodData.structure?.structure_stage,
      trend: periodData.structure?.trend_direction,
      description: periodData.structure?.description,
      // existing structure fields stay here
    }),
    deterministic_decision: periodData.trinity_decision
      ? compactRecord({
          version: periodData.trinity_decision.version,
          level: periodData.trinity_decision.level,
          conclusion: periodData.trinity_decision.conclusion,
          structure: periodData.trinity_decision.structure,
          spacetime: periodData.trinity_decision.spacetime,
          moving_average: periodData.trinity_decision.moving_average,
          volume_confirmation: periodData.trinity_decision.volume_confirmation,
          level_nesting: periodData.trinity_decision.level_nesting,
          trade_qualification: periodData.trinity_decision.trade_qualification,
          execution: periodData.trinity_decision.execution,
          judgment_criteria: periodData.trinity_decision.judgment_criteria,
          ai_summary_facts: periodData.trinity_decision.ai_summary_facts,
        })
      : undefined,
```

- [ ] **步骤 4：运行 TS 测试并确认通过**

运行：

```bash
node --test tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts && pnpm ts-check
```

预期：

```text
all tests passed
Found 0 TypeScript errors
```

- [ ] **步骤 5：提交 TS 契约和 payload 改动**

```bash
git add src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts
git commit -m "feat: expose trinity decision to TS contracts and AI payload"
```

### 任务 4：新增紧凑版页面 view-model 和摘要面板

**文件：**
- 新建：`src/lib/trinity-decision-view-model.ts`
- 新建：`tests/trinity-decision-view-model.test.ts`
- 新建：`src/components/stock/TrinityDecisionPanel.tsx`
- 修改：`src/app/stock/[code]/analysis/page.tsx`

- [ ] **步骤 1：先写失败的 view-model 测试**

新建 `tests/trinity-decision-view-model.test.ts`：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTrinityDecisionViewModel } = await import(
  new URL('../src/lib/trinity-decision-view-model.ts', import.meta.url).href
);

test('buildTrinityDecisionViewModel renders summary rows from deterministic decision', () => {
  const vm = buildTrinityDecisionViewModel({
    version: 'v2',
    level: 'daily',
    conclusion: {
      action: 'wait',
      action_label: '等待',
      bias: 'neutral',
      confidence: 'medium',
      can_trade: false,
      wait_reason: '等待 C 结构边界确认',
    },
    structure: {
      background_origin: { price: 9.8, date: '2026-02-10 00:00:00', source: 'macro_origin', semantic: 'background_origin' },
      focus_origin: { point_id: 'a1', price: 10.5, date: '2026-02-10 00:00:00', source: 'peak_extreme', semantic: 'focus_origin' },
      execution_origin: { point_id: 'a4', price: null, date: null, source: 'current_structure', semantic: 'execution_origin' },
      family: 'standard',
      type: 'A五段式',
      standard_candidate: 'A五段式',
      qualification: 'standard',
      direction: 'up',
      boundaries: {},
      node_map: {},
      can_trade_by_structure_nodes: true,
      can_trade_by_boundaries: true,
      explainability: { status: 'passed', reason: 'A原型成立', evidence: ['A五段式'] },
    },
    spacetime: {
      status: '中偏强',
      direction_bias: 'bullish',
      expected_structures: { up: ['A五段式'], down: ['D三段式'] },
      structure_match: false,
      mismatch_reason: '等待 C 结构边界确认',
      divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: 'none' },
    },
    moving_average: {
      ma55_role: 'support',
      ma233_role: 'support',
      price_position: { above_ma55: true, above_ma233: true },
      breakthrough_state: 'valid_breakout',
      ma_gate: { allow_long: true, allow_short: false, reason: 'MA55 上方' },
    },
    volume_confirmation: {
      volume_state: 'unknown',
      breakout_volume: 'weak',
      breakdown_volume: 'not_applicable',
      pullback_volume: 'not_applicable',
      volume_gate: { supports_breakout: false, supports_breakdown: false, supports_pullback_confirmation: false, confidence_adjustment: 'neutral', reason: 'phase1' },
    },
    level_nesting: {
      parent_level: 'weekly',
      child_level: 'daily',
      parent_bias: 'bullish',
      child_signal: 'wait',
      resonance: 'child_countertrend',
      permission: { allow_position_increase: false, allow_t_trade: false, allow_only_light_probe: true, reason: '父子级别冲突，降级执行' },
    },
    trade_qualification: {
      trade_mode: 'wait_confirmation',
      position_permission: 'no_position',
      confidence: 'medium',
      reason: ['A原型成立', '等待 C 结构边界确认'],
    },
    execution: {
      entry_style: 'pullback',
      triggers: ['重新站上平台上沿'],
      invalidation: ['跌回平台下沿'],
      confirmation: ['回踩 MA55 不破'],
      position_sizing: { reason: '等待 C 结构边界确认' },
      risk_flags: ['等待确认'],
    },
    judgment_criteria: [],
    ai_summary_facts: ['A五段式原型'],
  });

  assert.equal(vm.title, '三位一体判定')
  assert.equal(vm.levelLabel, '日线')
  assert.equal(vm.actionLabel, '等待')
  assert.equal(vm.structureLabel, 'A五段式 / standard')
  assert.equal(vm.focusOriginLabel, 'a1 @ 10.50')
  assert.equal(vm.backgroundOriginLabel, '2026-02-10 @ 9.80')
  assert.equal(vm.executionOriginLabel, 'a4')
  assert.equal(vm.waitReason, '等待 C 结构边界确认')
  assert.match(vm.gateReason ?? '', /父子级别冲突/)
});
```

- [ ] **步骤 2：运行新的 view-model 测试并确认它先失败**

运行：

```bash
node --test tests/trinity-decision-view-model.test.ts
```

预期：

```text
ERR_MODULE_NOT_FOUND for ../src/lib/trinity-decision-view-model.ts
```

- [ ] **步骤 3：实现 view-model 和摘要面板**

新建 `src/lib/trinity-decision-view-model.ts`：

```ts
import type { TrinityDecision, TrinityAnchor } from '@/lib/stock-structure-types';

export interface TrinityDecisionViewModel {
  title: string;
  levelLabel: string | null;
  actionLabel: string | null;
  structureLabel: string | null;
  spacetimeLabel: string | null;
  maLabel: string | null;
  volumeLabel: string | null;
  gateReason: string | null;
  waitReason: string | null;
  backgroundOriginLabel: string | null;
  focusOriginLabel: string | null;
  executionOriginLabel: string | null;
  triggerLabels: string[];
  invalidationLabels: string[];
}

const LEVEL_LABELS: Record<TrinityDecision['level'], string> = {
  weekly: '周线',
  daily: '日线',
  hour60: '60分钟',
  hour30: '30分钟',
  hour15: '15分钟',
};

function formatPrice(price?: number | null): string | null {
  return typeof price === 'number' && Number.isFinite(price) ? price.toFixed(2) : null;
}

function formatAnchor(anchor?: TrinityAnchor | null): string | null {
  if (!anchor) return null;
  const priceLabel = formatPrice(anchor.price);
  if (anchor.point_id && priceLabel) return `${anchor.point_id} @ ${priceLabel}`;
  if (anchor.point_id) return anchor.point_id;
  if (anchor.date && priceLabel) return `${anchor.date.slice(0, 10)} @ ${priceLabel}`;
  return anchor.date?.slice(0, 10) ?? priceLabel;
}

export function buildTrinityDecisionViewModel(decision?: TrinityDecision | null): TrinityDecisionViewModel {
  if (!decision) {
    return {
      title: '三位一体判定',
      levelLabel: null,
      actionLabel: null,
      structureLabel: null,
      spacetimeLabel: null,
      maLabel: null,
      volumeLabel: null,
      gateReason: null,
      waitReason: null,
      backgroundOriginLabel: null,
      focusOriginLabel: null,
      executionOriginLabel: null,
      triggerLabels: [],
      invalidationLabels: [],
    };
  }

  return {
    title: '三位一体判定',
    levelLabel: LEVEL_LABELS[decision.level],
    actionLabel: decision.conclusion.action_label,
    structureLabel: `${decision.structure.type} / ${decision.structure.family}`,
    spacetimeLabel: `${decision.spacetime.status} / ${decision.spacetime.direction_bias}`,
    maLabel: `${decision.moving_average.ma55_role} / ${decision.moving_average.breakthrough_state}`,
    volumeLabel: `${decision.volume_confirmation.volume_state} / ${decision.volume_confirmation.volume_gate.reason}`,
    gateReason: decision.level_nesting?.permission.reason ?? null,
    waitReason: decision.conclusion.wait_reason ?? null,
    backgroundOriginLabel: formatAnchor(decision.structure.background_origin),
    focusOriginLabel: formatAnchor(decision.structure.focus_origin),
    executionOriginLabel: formatAnchor(decision.structure.execution_origin),
    triggerLabels: decision.execution.triggers,
    invalidationLabels: decision.execution.invalidation,
  };
}
```

新建 `src/components/stock/TrinityDecisionPanel.tsx`：

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TrinityDecision } from '@/lib/stock-structure-types';
import { buildTrinityDecisionViewModel } from '@/lib/trinity-decision-view-model';

export function TrinityDecisionPanel({ decision }: { decision?: TrinityDecision | null }) {
  const vm = buildTrinityDecisionViewModel(decision);
  if (!decision) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{vm.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge>{vm.levelLabel}</Badge>
          <Badge variant="secondary">{vm.actionLabel}</Badge>
          <Badge variant="outline">{vm.structureLabel}</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>时空：{vm.spacetimeLabel}</div>
          <div>均线：{vm.maLabel}</div>
          <div>量能：{vm.volumeLabel}</div>
          <div>级别权限：{vm.gateReason ?? '未提供'}</div>
          <div>宏观原点：{vm.backgroundOriginLabel ?? '未提供'}</div>
          <div>聚焦起点：{vm.focusOriginLabel ?? '未提供'}</div>
          <div>执行起点：{vm.executionOriginLabel ?? '未提供'}</div>
          <div>等待原因：{vm.waitReason ?? '无'}</div>
        </div>
      </CardContent>
    </Card>
  );
}
```

修改 `src/app/stock/[code]/analysis/page.tsx`，在每个周期现有结构详情区上方渲染该面板：

```tsx
import { TrinityDecisionPanel } from '@/components/stock/TrinityDecisionPanel';
```

```tsx
{periodData?.trinity_decision ? (
  <TrinityDecisionPanel decision={periodData.trinity_decision} />
) : null}
```

- [ ] **步骤 4：运行 TS 测试并执行类型检查**

运行：

```bash
node --test tests/trinity-decision-view-model.test.ts && pnpm ts-check
```

预期：

```text
all tests passed
Found 0 TypeScript errors
```

- [ ] **步骤 5：提交页面消费层改动**

```bash
git add src/lib/trinity-decision-view-model.ts src/components/stock/TrinityDecisionPanel.tsx src/app/stock/[code]/analysis/page.tsx tests/trinity-decision-view-model.test.ts
git commit -m "feat: render trinity decision summary on analysis page"
```

### 任务 5：运行端到端验证和 HTTP 回归

**文件：**
- 修改：无
- 测试：`tests/test_trinity_decision_levels.py`
- 测试：`tests/test_trinity_decision_level_nesting.py`
- 测试：`tests/test_trinity_decision_origins.py`
- 测试：`tests/test_structure_phase_execution.py`
- 测试：`tests/trinity-decision-types.test.ts`
- 测试：`tests/ai-analysis-payload.test.ts`
- 测试：`tests/trinity-decision-view-model.test.ts`

- [ ] **步骤 1：运行定向 Python 测试集**

运行：

```bash
python3 -m pytest \
  tests/test_trinity_decision_levels.py \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_trinity_decision_origins.py \
  tests/test_structure_phase_execution.py -q
```

预期：

```text
all selected python tests passed
```

- [ ] **步骤 2：运行定向 TypeScript 测试集**

运行：

```bash
node --test \
  tests/trinity-decision-types.test.ts \
  tests/ai-analysis-payload.test.ts \
  tests/trinity-decision-view-model.test.ts
```

预期：

```text
all selected node tests passed
```

- [ ] **步骤 3：运行 TypeScript 类型检查**

运行：

```bash
pnpm ts-check
```

预期：

```text
Found 0 errors
```

- [ ] **步骤 4：运行 `stock_analyzer.py` 的强制 HTTP 回归**

运行：

```bash
curl -s "http://localhost:5000/api/stock/analysis?code=300274&levels=weekly" | python3 -c "
import json,sys
r=json.load(sys.stdin)
w=r['data']['periods'].get('weekly',{})
s=w.get('structure',{})
d=s.get('structure_details',{})
t=w.get('trinity_decision',{})
print('结构类型:', s.get('structure_type'))
print('笔数:', s.get('segment_count'))
print('顶分型:', [f['high'] for f in d.get('top_fractals',[])[-3:]])
print('trinity_level:', t.get('level'))
print('trinity_action:', (t.get('conclusion') or {}).get('action'))
"
```

预期：

```text
结构类型: <非 A五段式>
笔数: >= 12
顶分型: [..., 209.88]
trinity_level: weekly
```

- [ ] **步骤 5：运行全级别回归并检查聚合字段**

运行：

```bash
curl -s "http://localhost:5000/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15" | python3 -c "
import json,sys
r=json.load(sys.stdin)
periods=r['data']['periods']
for level in ['weekly','daily','hour60','hour30','hour15']:
    td=(periods.get(level,{}) or {}).get('trinity_decision',{})
    structure=td.get('structure',{})
    print(level, td.get('level'), structure.get('focus_origin'), bool(td.get('level_nesting')))
"
```

预期：

```text
weekly weekly ... True/False
...
hour15 hour15 ... True
```

- [ ] **步骤 6：提交第一阶段最终通过验证的切片**

```bash
git add scripts/stock_analyzer.py src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts src/lib/trinity-decision-view-model.ts src/components/stock/TrinityDecisionPanel.tsx src/app/stock/[code]/analysis/page.tsx tests/test_trinity_decision_levels.py tests/test_trinity_decision_level_nesting.py tests/test_trinity_decision_origins.py tests/test_structure_phase_execution.py tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts tests/trinity-decision-view-model.test.ts
git commit -m "feat: ship trinity decision phase1 contract"
```

## 后续跟进

- 为 Phase 2 单独写计划：结构资格系统重判（标准/延伸/通道/大平台/未完成）。
- 为 Phase 3 单独写计划：交易资格内核、量能门控、仓位权限。
- 为 Phase 4 单独写计划：整页 UI 迁移与 AI 契约切换。
