import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionPhase2ContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_trinity_decision_exposes_candidate_wait_and_execution_plan_contract(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour60',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '趋势延续',
                'trend_direction': '上涨',
                'description': 'A 延续候选，等待 30 分钟回抽确认',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'summary': 'A 延续候选',
                        'qualification_reason': 'A 原型延续成立',
                    },
                    'current_leg': {
                        'label': 'a3→live 上行形成中',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏强',
                        'child_structure_match': True,
                        'resonance_enabled': False,
                        'structure_readiness': 'candidate',
                        'wait_reason': '等待回抽确认',
                        'required_confirmation': '观察30分钟回抽不破 MA55',
                    },
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'A五段式',
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'qualification_reason': 'A 原型延续成立',
                    },
                    'explainability': {
                        'structure_start_point_id': 'a1',
                        'current_point_id': 'live',
                        'display_reason': '当前 live 段继续向上',
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
                'pattern_type': '回抽确认',
                'direction': 'up',
                'is_valid': True,
                'confidence': '高',
            },
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'pullback',
                'trigger': ['15分钟止跌后轻仓试'],
                'invalidation': ['跌破15分钟确认低点'],
                'confirmation': ['30分钟回抽确认后加仓'],
                'position_sizing': {'initial': '10%-15%'},
                'risk_flags': ['等待回抽确认'],
                'wait_reason': '等待回抽确认',
                'rationale': '候选结构存在，但需等回抽确认',
            },
            level_nesting_payload=None,
            period_payload={'volume_ratio_5': 1.2, 'volume_ratio_20': 1.1, 'amount_ratio_20': 1.05},
        )

        self.assertEqual(decision['candidate_structure']['candidate_label'], 'A延续候选')
        self.assertEqual(decision['candidate_structure']['candidate_type'], 'A延续')
        self.assertEqual(decision['candidate_structure']['current_leg'], 'a3→live 上行形成中')
        self.assertEqual(decision['wait_state']['wait_type'], '等待回抽确认')
        self.assertEqual(decision['wait_state']['next_confirmation_action'], '观察30分钟回抽不破 MA55')
        self.assertEqual(decision['execution_plan']['probe_entry'], '15分钟止跌后轻仓试')
        self.assertEqual(decision['execution_plan']['confirm_entry'], '30分钟回抽确认后加仓')

    def test_build_trinity_decision_exposes_zero_axis_resonance_divergence_and_judgment_contract(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '趋势中继',
                'trend_direction': '上涨',
                'description': '日线零轴金叉，但父级强冲突，子级逆父级',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'summary': '日线多头结构待确认',
                        'qualification_reason': 'A 原型成立',
                    },
                    'spacetime_gate': {
                        'parent_status': '强',
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'structure_readiness': 'matched',
                        'wait_reason': None,
                        'required_confirmation': None,
                    },
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'A五段式',
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'qualification_reason': 'A 原型成立',
                    },
                    'explainability': {
                        'structure_start_point_id': 'a1',
                        'current_point_id': 'a4',
                        'display_reason': '标准结构编号从当前结构起点重新计数',
                    },
                },
            },
            macd_payload={
                'status': '强',
                'top_divergence': True,
                'bottom_divergence': False,
                'zero_axis_signal': {
                    'formed': True,
                    'signal_type': 'zero_axis_golden_cross',
                    'reason': '零轴附近快速金叉',
                },
            },
            moving_averages={
                'MA55': 159.99,
                'MA233': 123.60,
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={
                'pattern_type': '回抽确认',
                'direction': 'up',
                'is_valid': True,
                'confidence': '高',
            },
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'pullback',
                'trigger': ['等待父级冲突解除'],
                'invalidation': ['跌破日线确认低点'],
                'confirmation': ['等待父级转向支持'],
                'position_sizing': {'initial': '10%-15%'},
                'risk_flags': ['父级强冲突，子级逆父级'],
                'wait_reason': '父级强冲突，子级逆父级',
                'rationale': '父级强冲突，子级逆父级',
            },
            level_nesting_payload={
                'parent_level': 'weekly',
                'child_level': 'daily',
                'parent_bias': 'bearish',
                'child_signal': 'long',
                'resonance': 'child_countertrend',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': False,
                    'allow_only_light_probe': True,
                    'reason': '父级强冲突，子级逆父级',
                },
            },
            period_payload={'volume_ratio_5': 1.4, 'volume_ratio_20': 1.2, 'amount_ratio_20': 1.1},
        )

        self.assertTrue(decision['zero_axis_signal']['formed'])
        self.assertEqual(decision['zero_axis_signal']['signal_label'], '零轴金叉')
        self.assertEqual(decision['resonance_state']['status'], 'conflicting')
        self.assertTrue(decision['resonance_state']['is_hard_constraint'])
        self.assertEqual(decision['divergence_weight']['status'], 'hard_block')
        self.assertEqual(decision['judgment']['label'], '严格等待')
        self.assertEqual(decision['judgment']['critical_reason'], '父级强冲突，子级逆父级')

    def test_build_trinity_decision_forces_conclusion_to_wait_when_divergence_hard_block_overrides_trade_intent(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '趋势中继',
                'trend_direction': '上涨',
                'description': '顶背离压制，但执行层仍给买入意图',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'summary': '多头结构存在，但硬阻断未解除',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏强',
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'structure_readiness': 'matched',
                    },
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'A五段式',
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                    },
                    'explainability': {
                        'a4_price': 21.6,
                    },
                },
            },
            macd_payload={
                'status': '中偏强',
                'top_divergence': True,
                'bottom_divergence': False,
            },
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={
                'pattern_type': '突破确认',
                'direction': 'up',
                'is_valid': True,
            },
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'pullback_confirm',
                'trigger': ['回踩后买入'],
                'invalidation': ['跌破确认低点'],
                'confirmation': ['放量继续上攻'],
                'position_sizing': {'initial': '20%-30%'},
                'risk_flags': ['顶背离压制'],
                'rationale': '结构节点存在，原始执行意图为买入',
            },
            level_nesting_payload=None,
            period_payload={'volume_ratio_5': 1.4, 'volume_ratio_20': 1.2, 'amount_ratio_20': 1.1},
        )

        self.assertEqual(decision['judgment']['label'], '严格等待')
        self.assertEqual(decision['conclusion']['action'], 'wait')
        self.assertFalse(decision['conclusion']['can_trade'])

    def test_modifier_layers_flow_into_wait_state_and_judgment_copy(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台边界试探',
                'trend_direction': '上涨',
                'description': '边界试探阶段，仍受顶背离、MA233压制与量能未确认约束',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'summary': 'C 类平台上沿待确认',
                        'qualification_reason': '边界结构存在，但修饰层仍未放行',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏强',
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'structure_readiness': 'matched',
                    },
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'C单平台式',
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'qualification_reason': '边界结构存在，但修饰层仍未放行',
                    },
                    'boundary_levels': {
                        'upper': 11.2,
                        'lower': 10.4,
                        'mid': 10.8,
                    },
                    'explainability': {
                        'current_point_id': 'c3',
                        'display_reason': '30分钟平台上沿附近试探',
                    },
                },
            },
            macd_payload={
                'status': '中偏强',
                'top_divergence': True,
                'bottom_divergence': False,
                'divergence_note': '顶背离仍在压制，等待回落风险释放',
            },
            moving_averages={
                'MA55': 11.0,
                'MA233': 11.6,
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'below',
                'ma_status': 'MA233压制下的弱修复',
            },
            breakthrough_payload={
                'pattern_type': '突破确认',
                'direction': 'up',
                'is_valid': True,
                'confidence': '中',
            },
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'boundary_probe',
                'trigger': ['30分钟突破平台上沿后再看'],
                'invalidation': ['跌回平台下沿'],
                'confirmation': ['二次放量后再确认'],
                'position_sizing': {'initial': '10%-15%'},
                'risk_flags': ['顶背离压制', 'MA233压制', '量能未确认'],
                'rationale': '边界试探信号存在，但修饰层未完成放行',
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
                    'reason': '日线中偏强支持30分钟C类中枢边界，但仍需按边界确认节奏执行',
                },
            },
            period_payload={'volume_ratio_5': 1.02, 'volume_ratio_20': 0.98, 'amount_ratio_20': 1.01},
        )

        self.assertEqual(decision['judgment']['label'], '严格等待')
        self.assertIn('顶背离', decision['judgment']['critical_reason'])
