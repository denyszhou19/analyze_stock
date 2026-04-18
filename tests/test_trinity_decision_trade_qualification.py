import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionTradeQualificationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_unfinished_structure_only_waits_for_confirmation(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'unfinished',
                'direction': 'neutral',
                'can_trade_by_structure_nodes': False,
                'can_trade_by_boundaries': False,
                'explainability': {'reason': '未完成结构'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': '均线中性'}},
            volume_decision={'volume_gate': {'reason': '量能中性'}},
            execution_payload={'action': 'buy', 'direction': 'long'},
        )

        self.assertEqual(decision['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['position_permission'], 'no_position')

    def test_standard_structure_with_valid_long_node_uses_standard_node_trade(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': False,
                'node_map': {'a4': 21.6, 'b8': None, 'd3': None, 'd4': None},
                'explainability': {'reason': '标准多头节点已确认'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': 'MA55 之上'}},
            volume_decision={'volume_gate': {'reason': '量能支持'}},
            execution_payload={'action': 'buy', 'direction': 'long'},
        )

        self.assertEqual(decision['trade_mode'], 'standard_node_trade')
        self.assertEqual(decision['position_permission'], 'half_position')

    def test_standard_node_trade_requires_volume_gate_support(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': False,
                'node_map': {'a4': 21.6, 'b8': None, 'd3': None, 'd4': None},
                'explainability': {'reason': '标准多头节点已确认'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': 'MA55 之上'}},
            volume_decision={
                'volume_gate': {
                    'supports_breakout': False,
                    'supports_breakdown': False,
                    'supports_pullback_confirmation': False,
                    'confidence_adjustment': 'downgrade',
                    'reason': '量能未确认',
                }
            },
            execution_payload={'action': 'buy', 'direction': 'long'},
        )

        self.assertEqual(decision['trade_mode'], 'no_trade')
        self.assertEqual(decision['position_permission'], 'no_position')
        self.assertEqual(decision['confidence'], 'low')

    def test_volume_gate_upgrades_trade_confidence_when_standard_node_is_supported(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'direction': 'down',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': False,
                'node_map': {'a4': None, 'b8': None, 'd3': 15.8, 'd4': None},
                'explainability': {'reason': '标准空头 d3 已确认'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': False, 'allow_short': True, 'reason': '空头门控通过'}},
            volume_decision={
                'volume_gate': {
                    'supports_breakout': False,
                    'supports_breakdown': True,
                    'supports_pullback_confirmation': False,
                    'confidence_adjustment': 'upgrade',
                    'reason': '放量下破确认',
                }
            },
            execution_payload={'action': 'sell', 'direction': 'short'},
        )

        self.assertEqual(decision['trade_mode'], 'standard_node_trade')
        self.assertEqual(decision['confidence'], 'high')

    def test_trade_qualification_uses_real_sell_reduce_avoid_routing(self) -> None:
        sell_decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'direction': 'down',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': False,
                'node_map': {'a4': None, 'b8': None, 'd3': 15.8, 'd4': None},
                'explainability': {'reason': '标准空头 d3 已确认'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': False, 'allow_short': True, 'reason': '空头门控通过'}},
            volume_decision={'volume_gate': {'reason': '量能支持'}},
            execution_payload={'action': 'sell', 'direction': 'short'},
        )
        reduce_decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': False,
                'node_map': {'a4': 21.6, 'b8': None, 'd3': None, 'd4': None},
                'explainability': {'reason': '标准多头 a4 已确认'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': '多头门控通过'}},
            volume_decision={'volume_gate': {'reason': '量能中性'}},
            execution_payload={'action': 'reduce', 'direction': 'long'},
        )
        avoid_decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': False,
                'node_map': {'a4': 21.6, 'b8': None, 'd3': None, 'd4': None},
                'explainability': {'reason': '有节点但当前选择规避'},
            },
            spacetime_decision={'mismatch_reason': '时空冲突'},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': '多头门控通过'}},
            volume_decision={'volume_gate': {'reason': '量能未确认'}},
            execution_payload={'action': 'avoid', 'direction': 'long'},
        )

        self.assertEqual(sell_decision['trade_mode'], 'standard_node_trade')
        self.assertEqual(reduce_decision['trade_mode'], 'standard_node_trade')
        self.assertEqual(avoid_decision['trade_mode'], 'risk_control')

    def test_extended_c_with_breakout_and_ma55_support_becomes_conditional_boundary_trade(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': '延伸C',
                'trend_direction': '震荡',
                'description': '延伸C 放量突破',
                'interpretation': {'focus_structure': {'archetype_family': 'C'}},
                'structure_details': {
                    'focus_classification': {
                        'type': '延伸C',
                        'standard_qualification': 'extended',
                    },
                    'prediction': {
                        'key_price_levels': [
                            {'price': 18.8, 'type': '上沿参考', 'note': '延伸平台上沿'},
                            {'price': 16.2, 'type': '下沿参考', 'note': '延伸平台下沿'},
                            {'price': 15.9, 'type': 'stop', 'note': '止损位'},
                        ],
                    },
                },
            },
            macd_payload={'status': '中偏强', 'top_divergence': False, 'bottom_divergence': False},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={'direction': 'up', 'is_valid': True, 'pattern_type': 'breakout'},
            execution_payload={
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['放量突破平台上沿'],
                'invalidation': ['跌回平台下沿'],
                'confirmation': ['回踩不破'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
                'rationale': '延伸结构只允许条件化边界交易',
            },
            level_nesting_payload=None,
            period_payload={'volume_ratio_5': 1.65, 'volume_ratio_20': 1.42, 'amount_ratio_20': 1.30},
        )

        self.assertEqual(decision['trade_qualification']['trade_mode'], 'conditional_boundary_trade')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'light_probe')
        self.assertTrue(decision['volume_confirmation']['volume_gate']['supports_breakout'])

    def test_wait_action_stays_wait_confirmation_even_with_valid_extended_boundaries(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': '延伸C',
                'trend_direction': '震荡',
                'description': '延伸C 边界有效但仍等待',
                'interpretation': {'focus_structure': {'archetype_family': 'C', 'standard_qualification': 'extended'}},
                'structure_details': {
                    'focus_classification': {
                        'type': '延伸C',
                        'standard_qualification': 'extended',
                    },
                    'prediction': {
                        'key_price_levels': [
                            {'price': 18.8, 'type': '上沿参考', 'note': '延伸平台上沿'},
                            {'price': 16.2, 'type': '下沿参考', 'note': '延伸平台下沿'},
                        ],
                    },
                },
            },
            macd_payload={'status': '中偏强'},
            moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'above', 'ma_status': '多头排列'},
            breakthrough_payload={'direction': 'up', 'is_valid': False, 'pattern_type': 'breakout'},
            execution_payload={
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['等待突破'],
                'invalidation': ['跌回平台下沿'],
                'confirmation': ['量能确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
                'wait_reason': '尚未触发',
            },
            level_nesting_payload=None,
            period_payload={'volume_ratio_5': 1.3, 'volume_ratio_20': 1.2, 'amount_ratio_20': 1.2},
        )

        self.assertTrue(decision['structure']['can_trade_by_boundaries'])
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')

    def test_extended_boundary_trade_requires_volume_support(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': '延伸C',
                'trend_direction': '震荡',
                'description': '延伸C 边界有效但量能不支持',
                'interpretation': {'focus_structure': {'archetype_family': 'C', 'standard_qualification': 'extended'}},
                'structure_details': {
                    'focus_classification': {
                        'type': '延伸C',
                        'standard_qualification': 'extended',
                    },
                    'prediction': {
                        'key_price_levels': [
                            {'price': 18.8, 'type': '上沿参考', 'note': '延伸平台上沿'},
                            {'price': 16.2, 'type': '下沿参考', 'note': '延伸平台下沿'},
                        ],
                    },
                },
            },
            macd_payload={'status': '中偏强'},
            moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'above', 'ma_status': '多头排列'},
            breakthrough_payload={'direction': 'up', 'is_valid': True, 'pattern_type': 'breakout'},
            execution_payload={
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['放量突破平台上沿'],
                'invalidation': ['跌回平台下沿'],
                'confirmation': ['回踩不破'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
            },
            level_nesting_payload=None,
            period_payload={'volume_ratio_5': 0.95, 'volume_ratio_20': 0.98, 'amount_ratio_20': 0.97},
        )

        self.assertTrue(decision['structure']['can_trade_by_boundaries'])
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')

    def test_extended_boundary_trade_requires_ma_and_direction_gate(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': '延伸C',
                'trend_direction': '震荡',
                'description': '延伸C 边界有效但方向与均线门控不支持',
                'interpretation': {'focus_structure': {'archetype_family': 'C', 'standard_qualification': 'extended'}},
                'structure_details': {
                    'focus_classification': {
                        'type': '延伸C',
                        'standard_qualification': 'extended',
                    },
                    'prediction': {
                        'key_price_levels': [
                            {'price': 18.8, 'type': '上沿参考', 'note': '延伸平台上沿'},
                            {'price': 16.2, 'type': '下沿参考', 'note': '延伸平台下沿'},
                        ],
                    },
                },
            },
            macd_payload={'status': '中偏强'},
            moving_averages={'price_vs_ma55': 'below', 'price_vs_ma233': 'below', 'ma_status': '空头排列'},
            breakthrough_payload={'direction': 'up', 'is_valid': True, 'pattern_type': 'breakout'},
            execution_payload={
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['突破平台上沿'],
                'invalidation': ['跌回平台下沿'],
                'confirmation': ['量能确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
            },
            level_nesting_payload=None,
            period_payload={'volume_ratio_5': 1.3, 'volume_ratio_20': 1.2, 'amount_ratio_20': 1.2},
        )

        self.assertTrue(decision['structure']['can_trade_by_boundaries'])
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')
