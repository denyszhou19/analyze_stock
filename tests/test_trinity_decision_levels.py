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

    def test_build_trinity_decision_supports_standard_short_node_trade(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour60',
            structure_payload={
                'structure_type': 'D三段式',
                'structure_stage': '下跌延续',
                'trend_direction': '下跌',
                'description': 'D三段式，空头延续后的确认回抽',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'D',
                        'standard_qualification': 'standard',
                        'summary': '标准空头结构，等待回抽确认后执行',
                        'qualification_reason': 'D 原型成立',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏弱',
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'structure_readiness': 'ready',
                        'wait_reason': None,
                        'required_confirmation': '等待回抽确认',
                    },
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'D三段式',
                        'standard_qualification': 'standard',
                        'qualification_reason': 'D 原型成立',
                    },
                    'explainability': {
                        'current_point_id': 'd3',
                    },
                },
            },
            macd_payload={'status': '中偏弱'},
            moving_averages={
                'price_vs_ma55': 'below',
                'price_vs_ma233': 'below',
                'ma_status': '空头排列',
            },
            breakthrough_payload={
                'pattern_type': '回抽确认',
                'direction': 'down',
                'is_valid': True,
            },
            execution_payload={
                'can_trade': True,
                'action': 'sell',
                'direction': 'short',
                'entry_style': 'pullback_confirm',
                'trigger': ['反抽 MA55 失败后继续走弱'],
                'invalidation': ['重新站上 MA55'],
                'confirmation': ['60 分钟级别空头继续共振'],
                'position_sizing': {
                    'starter': '轻仓试空',
                    'initial': '20%-30%',
                    'add_on': '跌破前低后再加仓',
                    'max': '不超过级别上限',
                    'pyramid_rule': {
                        'model': 'positive_pyramid',
                        'add_step_rules': ['首次加仓不超过起始仓位'],
                    },
                },
                'risk_flags': ['关注反抽失败确认'],
                'timeframe_cap_ratio': 0.35,
                'rationale': '空头标准节点已确认，可按回抽确认执行',
            },
            level_nesting_payload=None,
        )

        self.assertEqual(decision['conclusion']['bias'], 'bearish')
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'standard_node_trade')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'half_position')
        self.assertEqual(decision['execution']['entry_style'], 'pullback_confirm')

    def test_build_trinity_decision_keeps_position_sizing_details_and_boundary_consistency(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour15',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台震荡区间',
                'trend_direction': '震荡',
                'description': '等待边界确认的 15 分钟平台',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'summary': '单平台等待边界突破',
                    },
                    'spacetime_gate': {
                        'parent_status': '中性',
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'structure_readiness': 'developing',
                        'wait_reason': '边界尚未给出',
                        'required_confirmation': '等待边界和触发价',
                    },
                },
                'structure_details': {},
            },
            macd_payload={'status': '中性'},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'pullback_confirm',
                'trigger': ['回踩确认后转强'],
                'invalidation': ['跌破平台下沿'],
                'confirmation': ['量能放大'],
                'position_sizing': {
                    'starter': '轻仓试探',
                    'initial': '10%-15%',
                    'add_on': '突破后再加仓',
                    'max': '不超过 30%',
                    'pyramid_rule': {
                        'model': 'positive_pyramid',
                        'add_step_rules': ['第二次加仓不超过第一次'],
                    },
                },
                'risk_flags': ['等待边界'],
                'timeframe_cap_ratio': 0.2,
                'wait_reason': '边界尚未给出',
                'rationale': '沿用上游执行细则',
            },
            level_nesting_payload=None,
        )

        self.assertFalse(decision['structure']['can_trade_by_boundaries'])
        self.assertEqual(decision['execution']['position_sizing']['starter'], '轻仓试探')
        self.assertEqual(decision['execution']['position_sizing']['initial'], '10%-15%')
        self.assertEqual(decision['execution']['position_sizing']['add_on'], '突破后再加仓')
        self.assertEqual(decision['execution']['position_sizing']['max'], '不超过 30%')
        self.assertEqual(
            decision['execution']['position_sizing']['pyramid_rule']['add_step_rules'],
            ['第二次加仓不超过第一次'],
        )
        self.assertEqual(decision['execution']['position_sizing']['max_ratio'], 0.2)
        self.assertEqual(decision['execution']['position_sizing']['reason'], '沿用上游执行细则')
        self.assertIsNone(decision['execution']['position_sizing']['upgrade_condition'])
        self.assertEqual(decision['execution']['position_sizing']['downgrade_condition'], '边界尚未给出')

    def test_build_trinity_decision_extracts_prediction_boundaries(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台震荡区间',
                'trend_direction': '震荡',
                'description': 'C单平台式，平台边界已给出',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'extended',
                        'summary': '平台延伸，按边界等待突破',
                    },
                    'spacetime_gate': {
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'required_confirmation': '等待平台边界突破',
                    },
                },
                'structure_details': {
                    'prediction': {
                        'key_price_levels': [
                            {'price': 18.8, 'type': '上沿参考', 'note': '延伸平台上沿'},
                            {'price': 16.2, 'type': '下沿参考', 'note': '延伸平台下沿'},
                            {'price': 15.9, 'type': 'stop', 'note': '止损位'},
                        ],
                    },
                },
            },
            macd_payload={'status': '中性'},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['突破平台上沿'],
                'invalidation': ['跌破平台下沿'],
                'confirmation': ['量能确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
                'rationale': '边界交易候选',
            },
            level_nesting_payload=None,
        )

        self.assertTrue(decision['structure']['can_trade_by_boundaries'])
        self.assertEqual(decision['structure']['boundaries']['upper'], 18.8)
        self.assertEqual(decision['structure']['boundaries']['lower'], 16.2)
        self.assertEqual(decision['structure']['boundaries']['breakout_trigger'], 18.8)
        self.assertEqual(decision['structure']['boundaries']['breakdown_trigger'], 16.2)
        self.assertEqual(decision['structure']['boundaries']['stop_loss'], 15.9)
        self.assertEqual(decision['structure']['boundaries']['mid'], 17.5)
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'conditional_boundary_trade')

    def test_build_trinity_decision_extracts_lower_when_stop_comes_first(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台震荡区间',
                'trend_direction': '震荡',
                'description': 'stop 在前时也要保留下沿',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'extended',
                        'summary': '边界顺序不应影响解释',
                    },
                    'spacetime_gate': {
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'required_confirmation': '等待平台边界突破',
                    },
                },
                'structure_details': {
                    'prediction': {
                        'key_price_levels': [
                            {'price': 15.9, 'type': 'stop', 'note': '止损位'},
                            {'price': 18.8, 'type': '上沿参考', 'note': '延伸平台上沿'},
                            {'price': 16.2, 'type': '下沿参考', 'note': '延伸平台下沿'},
                        ],
                    },
                },
            },
            macd_payload={'status': '中性'},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['突破平台上沿'],
                'invalidation': ['跌破平台下沿'],
                'confirmation': ['量能确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
                'rationale': '边界交易候选',
            },
            level_nesting_payload=None,
        )

        self.assertEqual(decision['structure']['boundaries']['lower'], 16.2)
        self.assertEqual(decision['structure']['boundaries']['breakdown_trigger'], 16.2)
        self.assertEqual(decision['structure']['boundaries']['stop_loss'], 15.9)
        self.assertEqual(decision['structure']['boundaries']['mid'], 17.5)

    def test_build_trinity_decision_does_not_use_boundary_trade_without_boundaries(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': '大平台震荡',
                'structure_stage': '平台震荡区间',
                'trend_direction': '震荡',
                'description': '边界尚未给出的大平台',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'failed',
                        'summary': '边界不足，不能按边界交易',
                    },
                    'spacetime_gate': {
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'required_confirmation': '等待边界数据',
                    },
                },
                'structure_details': {},
            },
            macd_payload={'status': '中性'},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['等待边界触发'],
                'invalidation': ['边界失效'],
                'confirmation': ['等待确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
                'rationale': '没有实际边界数据',
            },
            level_nesting_payload=None,
        )

        self.assertFalse(decision['structure']['can_trade_by_boundaries'])
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'no_trade')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')
        self.assertFalse(decision['conclusion']['can_trade'])

    def test_build_trinity_decision_does_not_use_boundary_trade_with_single_sided_support_only(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour30',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台震荡区间',
                'trend_direction': '震荡',
                'description': '只有单侧支撑不能放行边界交易',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'extended',
                        'summary': '只有下侧参考位',
                    },
                    'spacetime_gate': {
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'required_confirmation': '边界不足',
                    },
                },
                'structure_details': {
                    'prediction': {
                        'key_price_levels': [
                            {'price': 16.2, 'type': '近期支撑', 'note': '仅有下侧支撑参考'},
                        ],
                    },
                },
            },
            macd_payload={'status': '中性'},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'boundary',
                'trigger': ['等待边界触发'],
                'invalidation': ['边界失效'],
                'confirmation': ['等待确认'],
                'position_sizing': {'initial': 'light_probe'},
                'risk_flags': [],
                'rationale': '只有单侧边界',
            },
            level_nesting_payload=None,
        )

        self.assertFalse(decision['structure']['can_trade_by_boundaries'])
        self.assertEqual(decision['trade_qualification']['trade_mode'], 'no_trade')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')
        self.assertFalse(decision['conclusion']['can_trade'])

    def test_build_trinity_decision_reduce_uses_direction_not_action_for_ma_gate(self) -> None:
        long_reduce_decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '上涨衰竭风险',
                'trend_direction': '上涨',
                'description': '多头结构进入减仓风险区',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'summary': '标准多头结构',
                    },
                    'spacetime_gate': {'child_structure_match': True, 'resonance_enabled': True},
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'A五段式',
                        'standard_qualification': 'standard',
                    },
                },
            },
            macd_payload={'status': '中偏强'},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': True,
                'action': 'reduce',
                'direction': 'long',
                'entry_style': 'trend_hold',
                'trigger': ['顶背离减仓'],
                'invalidation': ['重新转强'],
                'confirmation': ['上涨衰竭'],
                'position_sizing': {'initial': '20%-30%'},
                'risk_flags': ['exhaustion'],
                'rationale': '多头结构减仓，不是空头开仓',
            },
            level_nesting_payload=None,
        )
        short_reduce_decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': 'D三段式',
                'structure_stage': '下跌衰竭风险',
                'trend_direction': '下跌',
                'description': '空头结构进入减仓风险区',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'D',
                        'standard_qualification': 'standard',
                        'summary': '标准空头结构',
                    },
                    'spacetime_gate': {'child_structure_match': True, 'resonance_enabled': True},
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'D三段式',
                        'standard_qualification': 'standard',
                    },
                },
            },
            macd_payload={'status': '中偏弱'},
            moving_averages={
                'price_vs_ma55': 'below',
                'price_vs_ma233': 'below',
                'ma_status': '空头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': True,
                'action': 'reduce',
                'direction': 'short',
                'entry_style': 'trend_hold',
                'trigger': ['底背离减仓'],
                'invalidation': ['继续走弱'],
                'confirmation': ['下跌衰竭'],
                'position_sizing': {'initial': '20%-30%'},
                'risk_flags': ['exhaustion'],
                'rationale': '空头结构减仓，按空头门控处理',
            },
            level_nesting_payload=None,
        )

        self.assertEqual(long_reduce_decision['trade_qualification']['trade_mode'], 'standard_node_trade')
        self.assertEqual(short_reduce_decision['trade_qualification']['trade_mode'], 'standard_node_trade')

    def test_build_trinity_decision_reduce_long_does_not_fall_through_short_gate(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '上涨衰竭风险',
                'trend_direction': '上涨',
                'description': '多头减仓场景不应被当成空头开仓',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'standard_qualification': 'standard',
                        'summary': '标准多头结构',
                    },
                    'spacetime_gate': {'child_structure_match': True, 'resonance_enabled': True},
                },
                'structure_details': {
                    'focus_classification': {
                        'type': 'A五段式',
                        'standard_qualification': 'standard',
                    },
                },
            },
            macd_payload={'status': '中偏强'},
            moving_averages={
                'price_vs_ma55': 'below',
                'price_vs_ma233': 'below',
                'ma_status': '空头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': True,
                'action': 'reduce',
                'direction': 'long',
                'entry_style': 'trend_hold',
                'trigger': ['顶背离减仓'],
                'invalidation': ['重新站上 MA55'],
                'confirmation': ['上涨衰竭'],
                'position_sizing': {'initial': '20%-30%'},
                'risk_flags': ['exhaustion'],
                'rationale': '仅表达多头减仓，不允许按空头门控放行',
            },
            level_nesting_payload=None,
        )

        self.assertEqual(decision['trade_qualification']['trade_mode'], 'no_trade')
        self.assertEqual(decision['trade_qualification']['position_permission'], 'no_position')

    def test_build_trinity_decision_keeps_existing_position_sizing_contract_fields(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour60',
            structure_payload={
                'structure_type': 'C单平台式',
                'structure_stage': '平台震荡区间',
                'trend_direction': '震荡',
                'description': '上游已经给出仓位字段说明',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'summary': '平台等待确认',
                    },
                    'spacetime_gate': {'child_structure_match': True, 'resonance_enabled': True},
                },
                'structure_details': {},
            },
            macd_payload={'status': '中性'},
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={},
            execution_payload={
                'can_trade': False,
                'action': 'wait',
                'direction': 'long',
                'entry_style': 'pullback_confirm',
                'trigger': ['等待确认'],
                'invalidation': ['跌破确认位'],
                'confirmation': ['放量确认'],
                'position_sizing': {
                    'initial': '10%-15%',
                    'reason': '上游仓位原因',
                    'upgrade_condition': '上游升级条件',
                    'downgrade_condition': '上游降级条件',
                },
                'risk_flags': [],
                'timeframe_cap_ratio': 0.5,
                'wait_reason': '等待确认',
                'rationale': '下游兜底原因',
            },
            level_nesting_payload=None,
        )

        position_sizing = decision['execution']['position_sizing']
        self.assertEqual(position_sizing['reason'], '上游仓位原因')
        self.assertEqual(position_sizing['upgrade_condition'], '上游升级条件')
        self.assertEqual(position_sizing['downgrade_condition'], '上游降级条件')
        self.assertEqual(position_sizing['max_ratio'], 0.5)
