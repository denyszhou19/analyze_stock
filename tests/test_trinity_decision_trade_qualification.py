import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionTradeQualificationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

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
