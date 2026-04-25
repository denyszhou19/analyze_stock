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

    def test_child_countertrend_level_nesting_downgrades_standard_long_node(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '反弹结构',
                'trend_direction': '上涨',
                'description': '父级偏空下的子级别多头节点',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                    },
                    'spacetime_gate': {'child_structure_match': True, 'resonance_enabled': True},
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'A五段式',
                        'standard_qualification': 'standard',
                    },
                    'explainability': {'a4_price': 21.6},
                },
            },
            macd_payload={'status': '中偏强'},
            moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'above', 'ma_status': '多头排列'},
            breakthrough_payload={'direction': 'up', 'is_valid': True, 'pattern_type': 'breakout'},
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'pullback_confirm',
                'trigger': ['子级别 a4 买点'],
                'invalidation': ['跌破 a4'],
                'confirmation': ['放量突破'],
                'position_sizing': {'initial': '20%-30%'},
                'risk_flags': [],
                'rationale': '子级别节点成立，但父级偏空',
            },
            level_nesting_payload={
                'parent_level': 'daily',
                'child_level': 'hour30',
                'parent_bias': 'bearish',
                'child_signal': 'long',
                'resonance': 'child_countertrend',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '子级别逆父级别，只允许轻仓试探或做T',
                },
            },
            period_payload={'volume_ratio_5': 1.4, 'volume_ratio_20': 1.3, 'amount_ratio_20': 1.25},
        )

        self.assertEqual(decision['trade_qualification']['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')
        self.assertFalse(decision['conclusion']['can_trade'])
        self.assertEqual(decision['conclusion']['action'], 'wait')

    def test_parent_unclear_blocks_standard_node_trade_even_when_child_conditions_pass(self) -> None:
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
            volume_decision={'volume_gate': {'reason': '量能支持'}},
            execution_payload={'action': 'buy', 'direction': 'long'},
            level_nesting_decision={
                'parent_level': 'weekly',
                'child_level': 'daily',
                'parent_bias': 'neutral',
                'child_signal': 'long',
                'resonance': 'parent_unclear',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': False,
                    'allow_only_light_probe': True,
                    'reason': '父级别缺失或尚未归一化，降级为轻仓/等待',
                },
            },
        )

        self.assertEqual(decision['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['position_permission'], 'no_position')
        self.assertEqual(decision['confidence'], 'low')
        self.assertTrue(any('父级' in reason for reason in decision['reason']))

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

    def test_aligned_unstable_d3_still_stays_conditional_boundary_trade(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': True,
                'node_map': {'a4': None, 'b8': None, 'd3': 21.6, 'd4': None},
                'explainability': {'reason': '30分钟D类d3不稳定阶段'},
            },
            spacetime_decision={'mismatch_reason': None},
            moving_average_decision={'ma_gate': {'allow_long': True, 'allow_short': False, 'reason': '站上MA55'}},
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
                'parent_bias': 'bearish',
                'child_signal': 'long',
                'resonance': 'aligned',
                'execution_strength': 'light_probe',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': True,
                    'allow_only_light_probe': True,
                    'reason': '日线弱支持30分钟D类d3反向修正完成，但仍需按节点确认节奏执行',
                },
                'node_semantic': {
                    'family': 'D',
                    'actionable_node': 'd3',
                    'label': 'D类d3反向修正完成',
                    'reason': 'd3是不稳定买入点，后续仍需等d4完成',
                },
            },
        )

        self.assertEqual(decision['trade_mode'], 'conditional_boundary_trade')
        self.assertEqual(decision['position_permission'], 'light_probe')
        self.assertNotEqual(decision['trade_mode'], 'standard_node_trade')

    def test_refresh_trinity_decisions_applies_parent_unclear_light_probe_permission(self) -> None:
        results = {
            'daily': {
                'structure': {
                    'structure_type': 'A五段式',
                    'structure_stage': '趋势中继',
                    'trend_direction': '上涨',
                    'description': '父级缺失下的日线多头节点',
                    'interpretation': {
                        'focus_structure': {
                            'archetype_family': 'A',
                            'standard_qualification': 'standard',
                        },
                        'spacetime_gate': {'child_structure_match': True, 'resonance_enabled': True},
                    },
                    'structure_details': {
                        'focus_classification': {
                            'type': 'A五段式',
                            'standard_qualification': 'standard',
                        },
                        'explainability': {'a4_price': 21.6},
                    },
                    'execution': {
                        'can_trade': True,
                        'action': 'buy',
                        'direction': 'long',
                        'entry_style': 'pullback_confirm',
                        'trigger': ['日线 a4 买点'],
                        'invalidation': ['跌破 a4'],
                        'confirmation': ['放量突破'],
                        'position_sizing': {'initial': '20%-30%'},
                        'risk_flags': [],
                        'rationale': '父级缺失时应降级为轻仓试探',
                    },
                },
                'macd': {'status': '中偏强'},
                'moving_averages': {
                    'price_vs_ma55': 'above',
                    'price_vs_ma233': 'above',
                    'ma_status': '多头排列',
                },
                'breakthrough': {'direction': 'up', 'is_valid': True, 'pattern_type': 'breakout'},
                'volume_ratio_5': 1.2,
                'volume_ratio_20': 1.1,
                'amount_ratio_20': 1.15,
            }
        }

        normalized_results = self.analyzer._refresh_trinity_decisions_with_level_nesting(results, raw_level_nesting=None)
        decision = normalized_results['daily']['trinity_decision']

        self.assertEqual(decision['level_nesting']['resonance'], 'parent_unclear')
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'wait_confirmation')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')
        self.assertFalse(decision['conclusion']['can_trade'])
        self.assertEqual(decision['conclusion']['action'], 'wait')
        self.assertEqual(decision['judgment']['level'], 'strict_wait')
        self.assertEqual(decision['judgment']['current_best_action'], '继续等待')

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
        self.assertFalse(decision['conclusion']['can_trade'])
        self.assertEqual(decision['conclusion']['action'], 'wait')

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
        self.assertFalse(decision['conclusion']['can_trade'])
        self.assertEqual(decision['conclusion']['action'], 'wait')

    def test_no_trade_qualification_also_forces_conclusion_to_wait(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': '大平台震荡',
                'trend_direction': '震荡',
                'description': '没有边界的大平台',
                'interpretation': {'focus_structure': {'archetype_family': 'C', 'standard_qualification': 'failed'}},
                'structure_details': {},
            },
            macd_payload={'status': '中性'},
            moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'above', 'ma_status': '多头排列'},
            breakthrough_payload={},
            execution_payload={
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['等待边界触发'],
                'invalidation': ['边界失效'],
                'confirmation': ['等待确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
            },
            level_nesting_payload=None,
        )

        self.assertEqual(decision['trade_qualification']['trade_mode'], 'no_trade')
        self.assertFalse(decision['conclusion']['can_trade'])
        self.assertEqual(decision['conclusion']['action'], 'wait')

    def test_boundary_probe_with_b3_node_semantic_still_cannot_upgrade_to_standard_trade(self) -> None:
        qualification = self.analyzer._build_trinity_trade_qualification(
            structure_decision={
                'family': 'standard',
                'qualification': 'standard',
                'direction': 'up',
                'can_trade_by_structure_nodes': True,
                'can_trade_by_boundaries': True,
                'explainability': {'reason': 'B类结构成立'},
            },
            spacetime_decision={'mismatch_reason': ''},
            moving_average_decision={
                'ma_gate': {
                    'allow_long': True,
                    'allow_short': False,
                    'passed': True,
                    'reason': 'MA55 支撑有效',
                }
            },
            volume_decision={
                'volume_gate': {
                    'supports_breakout': True,
                    'supports_pullback_confirmation': True,
                    'passed': True,
                    'reason': '放量确认',
                }
            },
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
