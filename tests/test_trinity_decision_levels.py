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
