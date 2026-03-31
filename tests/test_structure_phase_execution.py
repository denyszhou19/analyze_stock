import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class StructurePhaseExecutionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_structure_archetype_keeps_abcd_as_explanatory_label(self) -> None:
        archetype = self.analyzer._build_structure_archetype(
            structure_type='A五段式',
            structure_stage='趋势启动阶段',
            trend_direction='上涨',
            macro_components=[
                {'type': 'Directional', 'stroke_count': 1},
                {'type': 'Platform', 'stroke_count': 5},
            ],
            inflection_count=5,
            segment_count=4,
            peak_analysis=None,
        )

        self.assertEqual(archetype['primary'], 'A五段式')
        self.assertEqual(archetype['maturity'], 'late')
        self.assertEqual(archetype['confidence'], 'medium')
        self.assertIn('Directional -> Platform', archetype['reason'])
        self.assertIn('alternatives', archetype)

    def test_detect_execution_phase_prefers_pullback_confirm_when_breakthrough_and_support_align(self) -> None:
        phase = self.analyzer._detect_execution_phase(
            macd_status='强',
            trend_direction='上涨',
            moving_averages={'price_vs_ma55': 'above', 'ma_status': '多头排列'},
            ma_physics={
                'support_pressure': {'status': 'MA55支撑有效', 'ma55_role': '支撑'},
                'traction': {'pullback_expected': True, 'traction_force': '中'},
                'resonance': {'convergence_strength': '中'},
            },
            breakthrough={
                'pattern_type': '回抽突破',
                'direction': 'up',
                'is_valid': True,
                'confidence': '高',
            },
            prediction={'current_stage': 'a4拐点', 'confidence': 'medium'},
            divergence_note='',
        )

        self.assertEqual(phase['code'], 'pullback_confirm')
        self.assertEqual(phase['bias'], 'bullish')
        self.assertTrue(phase['tradable'])

    def test_build_period_execution_encodes_timeframe_cap_and_same_timeframe_stop_rules(self) -> None:
        execution = self.analyzer._build_period_execution(
            level='hour30',
            latest_price=163.35,
            macd_status='强',
            moving_averages={'ma_status': '多头排列', 'price_vs_ma55': 'above'},
            ma_physics={
                'support_pressure': {'status': 'MA55支撑有效'},
                'traction': {'pullback_expected': True},
                'resonance': {'convergence_strength': '中'},
            },
            breakthrough={
                'pattern_type': '回抽突破',
                'direction': 'up',
                'is_valid': True,
                'confidence': '高',
            },
            phase={
                'code': 'pullback_confirm',
                'label': '回抽确认',
                'bias': 'bullish',
                'tradable': True,
                'maturity': 'mid',
                'reason': '回抽后支撑有效',
            },
            archetype={'primary': 'A五段式', 'confidence': 'medium', 'reason': 'Directional -> Platform'},
            prediction={
                'key_price_levels': [{'price': 156.9, 'type': 'stop', 'note': '最近确认底分型'}],
            },
            latest_confirmed_levels=[{'price': 156.9, 'type': 'stop', 'note': '最近确认底分型'}],
        )

        self.assertTrue(execution['can_trade'])
        self.assertEqual(execution['action'], 'buy')
        self.assertEqual(execution['timing_timeframe'], 'hour30')
        self.assertAlmostEqual(execution['timeframe_cap_ratio'], 1 / 3, places=3)
        self.assertEqual(execution['t_trade_rule']['mode'], 'positive_only')
        self.assertEqual(execution['risk_rules']['stop_loss_basis'], 'same_timeframe')
        self.assertTrue(execution['risk_rules']['no_left_side_averaging_down'])


if __name__ == '__main__':
    unittest.main()
