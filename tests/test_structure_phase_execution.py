import unittest

import pandas as pd

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
        self.assertEqual(archetype['reason'], 'Directional -> Platform')
        self.assertNotIn('family', archetype)
        self.assertIsInstance(archetype['alternatives'], list)
        self.assertTrue(archetype['alternatives'])
        self.assertEqual(
            set(archetype['alternatives'][0].keys()),
            {'type', 'confidence', 'reason'},
        )

    def test_build_structure_archetype_degrades_peak_confidence_and_uses_unknown_reason_without_components(self) -> None:
        archetype = self.analyzer._build_structure_archetype(
            structure_type='C单平台式',
            structure_stage='平台整理',
            trend_direction='震荡',
            macro_components=[],
            inflection_count=4,
            segment_count=3,
            peak_analysis={'is_peak_structure': True},
        )

        self.assertEqual(archetype['confidence'], 'low')
        self.assertEqual(archetype['reason'], 'Unknown')
        self.assertEqual(archetype['alternatives'][0]['type'], 'A五段式')

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

    def test_detect_execution_phase_uses_platform_building_for_range_bound_context(self) -> None:
        phase = self.analyzer._detect_execution_phase(
            macd_status='中偏弱',
            trend_direction='震荡',
            moving_averages={'price_vs_ma55': 'mixed', 'ma_status': '缠绕'},
            ma_physics={
                'support_pressure': {'status': 'MA55压制'},
                'traction': {'pullback_expected': False, 'traction_force': '弱'},
                'resonance': {'convergence_strength': '中'},
            },
            breakthrough={
                'pattern_type': '无突破',
                'direction': None,
                'is_valid': None,
                'confidence': '低',
            },
            prediction={'current_stage': 'c3拐点', 'confidence': 'medium'},
            divergence_note='',
        )

        self.assertEqual(phase['code'], 'platform_building')
        self.assertEqual(phase['bias'], 'neutral')
        self.assertFalse(phase['tradable'])

    def test_build_period_execution_encodes_full_contract_and_same_timeframe_risk_rules(self) -> None:
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
        self.assertEqual(execution['direction'], 'long')
        self.assertEqual(execution['setup_quality'], 'A')
        self.assertEqual(execution['rationale'], '回抽后支撑有效')
        self.assertEqual(execution['timing_timeframe'], 'hour30')
        self.assertAlmostEqual(execution['timeframe_cap_ratio'], 1 / 3, places=3)
        self.assertEqual(execution['entry_style'], 'pullback_confirm')
        self.assertEqual(execution['position_sizing']['pyramid_rule']['model'], 'positive_pyramid')
        self.assertEqual(execution['t_trade_rule']['mode'], 'positive_only')
        self.assertEqual(execution['t_trade_rule']['max_quick_take_profit_points'], 3)
        self.assertEqual(execution['risk_rules']['stop_loss_basis'], 'same_timeframe')
        self.assertTrue(execution['risk_rules']['no_timeframe_upcast_after_break'])
        self.assertTrue(execution['risk_rules']['no_left_side_averaging_down'])
        self.assertTrue(execution['risk_rules']['right_side_add_only'])
        self.assertTrue(execution['risk_rules']['right_side_add_conditions'])
        self.assertEqual(execution['take_profit_plan']['model'], 'inverted_pyramid')
        self.assertEqual(execution['key_levels'][0]['type'], 'stop')
        self.assertIsNone(execution['wait_reason'])

    def test_build_period_execution_derives_t_trade_mode_and_wait_reason_from_ma_status(self) -> None:
        execution = self.analyzer._build_period_execution(
            level='hour15',
            latest_price=98.5,
            macd_status='中偏弱',
            moving_averages={'ma_status': '缠绕', 'price_vs_ma55': 'below'},
            ma_physics={
                'support_pressure': {'status': 'MA55压制'},
                'traction': {'pullback_expected': False},
                'resonance': {'convergence_strength': '弱'},
            },
            breakthrough={
                'pattern_type': '无突破',
                'direction': None,
                'is_valid': False,
                'confidence': '低',
            },
            phase={
                'code': 'platform_building',
                'label': '平台整理',
                'bias': 'neutral',
                'tradable': False,
                'maturity': 'mid',
                'reason': '当前仍在平台边界内',
            },
            archetype={'primary': '复杂结构', 'confidence': 'low', 'reason': 'Unknown'},
            prediction={'key_price_levels': []},
            latest_confirmed_levels=[],
        )

        self.assertFalse(execution['can_trade'])
        self.assertEqual(execution['action'], 'wait')
        self.assertEqual(execution['t_trade_rule']['mode'], 'disabled')
        self.assertAlmostEqual(execution['timeframe_cap_ratio'], 0.25, places=3)
        self.assertIsNotNone(execution['wait_reason'])

    def test_analyze_single_period_writes_new_structure_field_names(self) -> None:
        df = pd.DataFrame(
            [
                {
                    'date': pd.Timestamp('2024-01-01 10:00:00'),
                    'open': 100.0,
                    'high': 101.0,
                    'low': 99.0,
                    'close': 100.5,
                    'volume': 1000,
                    'pctChg': 1.2,
                    'MA55': 99.5,
                    'MA233': 98.0,
                    'DIF': 0.3,
                    'DEA': 0.1,
                    'MACD': 0.4,
                }
            ]
        )

        self.analyzer.calculate_ma = lambda source_df, periods=None: source_df
        self.analyzer.calculate_macd = lambda source_df: source_df
        self.analyzer.analyze_ma_position = lambda latest: {
            'price_vs_ma55': 'above',
            'price_vs_ma233': 'above',
            'distance_ma55': 1.0,
            'distance_ma233': 2.0,
            'ma_status': '多头排列',
        }
        self.analyzer.determine_macd_status = lambda source_df: {
            'status': '强',
            'description': '强势',
            'DIF': 0.3,
            'DEA': 0.1,
            'MACD': 0.4,
        }
        self.analyzer.detect_divergence = lambda source_df, macd_status=None: {
            'top_divergence': False,
            'bottom_divergence': False,
            'divergence_note': '',
        }
        self.analyzer.detect_structure = lambda source_df, macd_status=None: {
            'structure_type': 'A五段式',
            'structure_stage': '趋势启动阶段',
            'trend_direction': '上涨',
            'inflection_points': 5,
            'segment_count': 4,
            'description': '识别为A五段式，上涨趋势',
            'structure_details': {
                'macro_components': [
                    {'type': 'Directional', 'stroke_count': 1},
                    {'type': 'Platform', 'stroke_count': 5},
                ],
                'prediction': {
                    'current_stage': 'a4拐点',
                    'confidence': 'medium',
                    'key_price_levels': [
                        {'price': 99.2, 'type': 'stop', 'note': '最近确认底分型'},
                    ],
                },
            },
        }
        self.analyzer.calculate_key_levels = lambda source_df: {'support_levels': [], 'resistance_levels': []}
        self.analyzer.analyze_ma_physics = lambda source_df: {
            'support_pressure': {'status': 'MA55支撑有效', 'ma55_role': '支撑'},
            'traction': {'pullback_expected': True, 'traction_force': '中'},
            'resonance': {'convergence_strength': '中'},
            'alerts': [],
        }
        self.analyzer.detect_breakthrough_pattern = lambda source_df: {
            'pattern_type': '回抽突破',
            'direction': 'up',
            'is_valid': True,
            'confidence': '高',
        }

        result = self.analyzer.analyze_single_period(df, 'hour30')

        structure = result['structure']
        self.assertIn('archetype', structure)
        self.assertIn('execution_phase', structure)
        self.assertIn('execution', structure)
        self.assertNotIn('structure_archetype', structure)
        self.assertNotIn('period_execution', structure)
        self.assertEqual(structure['execution']['timing_timeframe'], 'hour30')
        self.assertAlmostEqual(structure['execution']['timeframe_cap_ratio'], 1 / 3, places=3)


if __name__ == '__main__':
    unittest.main()
