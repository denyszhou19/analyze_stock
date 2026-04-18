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

    def test_build_trinity_structure_decision_uses_standard_node_map_only_for_standard_family(self) -> None:
        line_geometry = {
            'points': [
                {'price': 10.0, 'date': '2024-01-01 00:00'},
                {'price': 12.0, 'date': '2024-01-02 00:00'},
                {'price': 11.0, 'date': '2024-01-03 00:00'},
                {'price': 10.8, 'date': '2024-01-04 00:00'},
                {'price': 11.6, 'date': '2024-01-05 00:00', 'is_current': True},
            ],
            'segments': [
                {'from_point': 0, 'to_point': 1},
                {'from_point': 1, 'to_point': 2},
                {'from_point': 2, 'to_point': 3},
                {'from_point': 3, 'to_point': 4},
            ],
        }
        _, standard_explainability = self.analyzer._build_structure_explainability(
            structure_type='A五段式',
            line_geometry=line_geometry,
            prediction={'current_stage': 'a4拐点', 'next_stage': 'a5拐点'},
            peak_analysis=None,
            structure_start_point_index=0,
            focus_origin_source='recent_component',
            explainability_status='passed',
            downgrade_reason=None,
        )
        _, extended_explainability = self.analyzer._build_structure_explainability(
            structure_type='延伸C',
            line_geometry=line_geometry,
            prediction={'current_stage': '延伸C进行中', 'next_stage': '等待平台边界确认'},
            peak_analysis=None,
            structure_start_point_index=0,
            focus_origin_source='recent_component',
            explainability_status='extended',
            downgrade_reason='超出标准点数',
        )
        standard = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': 'A五段式',
                'trend_direction': '上涨',
                'description': '标准 A 结构',
                'interpretation': {'focus_structure': {}},
                'structure_details': {
                    'focus_classification': {
                        'type': 'A五段式',
                        'standard_qualification': 'standard',
                    },
                    'explainability': standard_explainability,
                },
            }
        )
        extended = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': '延伸C',
                'trend_direction': '上涨',
                'description': '延伸 C 结构',
                'interpretation': {'focus_structure': {}},
                'structure_details': {
                    'focus_classification': {
                        'type': '延伸C',
                        'standard_qualification': 'extended',
                    },
                    'explainability': extended_explainability,
                },
            }
        )

        self.assertEqual(
            standard['node_map'],
            {'a4': 10.8, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': 10.8},
        )
        self.assertTrue(standard['can_trade_by_structure_nodes'])
        self.assertEqual(
            extended['node_map'],
            {'a4': None, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': None},
        )
        self.assertFalse(extended['can_trade_by_structure_nodes'])

    def test_detect_structure_syncs_focus_classification_after_explainability_downgrade(self) -> None:
        df = pd.DataFrame([{'date': pd.Timestamp('2024-01-01'), 'open': 1, 'high': 1, 'low': 1, 'close': 1}])
        recent = pd.DataFrame([{'date': pd.Timestamp('2024-01-01'), 'open': 1, 'high': 1, 'low': 1, 'close': 1}])

        self.analyzer._run_structure_pipeline = lambda _df, _lookback: {
            'actual_lookback': 1,
            'recent': recent,
            'trend_direction': '上涨',
            'valid_range_info': None,
            'processed_df': recent,
            'top_fractals': [],
            'bottom_fractals': [],
            'validated_fractals': [],
            'final_fractals': [],
            'strokes': [{'direction': '上涨', 'from_price': 10.0, 'to_price': 12.0}],
            'valid_fractals': [{'type': 'bottom', 'high': 12.0, 'low': 10.0}],
            'stroke_list': [{'direction': '上涨', 'from_price': 10.0, 'to_price': 12.0}],
        }
        self.analyzer._serialize_fractals = lambda fractals, _field: fractals
        self.analyzer._build_line_geometry = lambda _stroke_list: {
            'points': [
                {'price': 10.0, 'date': '2024-01-01 00:00'},
                {'price': 12.0, 'date': '2024-01-02 00:00'},
            ],
            'segments': [{'from_point': 0, 'to_point': 1}],
        }
        self.analyzer._build_structure_pipeline_metadata = lambda **_kwargs: {}
        self.analyzer._consolidate_boxes = lambda *_args, **_kwargs: []
        self.analyzer._summarize_macro_components = lambda _components: []
        self.analyzer._classify_structure_by_counts = lambda *_args: ('A五段式', '趋势启动', 'A五段式', [])
        self.analyzer._analyze_peak_structure = lambda *_args: {'is_peak_structure': False}
        self.analyzer._build_focus_origin_analysis = lambda **_kwargs: {
            'selected_origin_kind': 'macro_origin',
            'selected_point_index': None,
            'explainability_status': 'downgraded',
            'explainability_reason': '宏观原点在窗口外，无法诚实解释标准起点',
            'macro_origin': {'outside_window': True},
        }
        self.analyzer._build_structure_focus_context = lambda **_kwargs: {
            'stroke_count': 1,
            'inflection_count': 4,
            'strokes': [{'direction': '上涨', 'from_price': 10.0, 'to_price': 12.0}],
            'valid_fractals': [{'type': 'bottom', 'high': 12.0, 'low': 10.0}],
            'render_structure_start_point_index': 0,
        }
        self.analyzer._determine_stroke_trend = lambda _strokes: '上涨'
        self.analyzer._build_focus_structure_classification = lambda **_kwargs: {
            'type': 'A五段式',
            'stage': '趋势启动',
            'description': 'A五段式',
            'archetype_family': 'A',
            'standard_qualification': 'standard',
            'qualification_reason': 'A 原型成立',
            'trend_direction': '上涨',
            'component_summary': [],
            'criteria': [],
        }
        self.analyzer._validate_focus_structure_explainability = lambda *_args: {
            'passed': False,
            'status': 'downgraded',
            'reason': '宏观原点在窗口外，无法诚实解释标准起点',
        }
        self.analyzer._analyze_structure_prediction = lambda *args, **kwargs: {
            'current_stage': '第4个拐点',
            'next_stage': '等待确认',
            'prediction_alert': '等待确认',
            'key_price_levels': [],
        }
        self.analyzer._build_render_payload = lambda _geometry: {}
        self.analyzer._build_structure_interpretation = lambda **kwargs: {'focus_structure': {'archetype_family': 'complex'}}
        self.analyzer.analyze_ma_position = lambda _latest: {}

        result = self.analyzer.detect_structure(df)

        self.assertEqual(result['structure_type'], '复杂结构')
        self.assertEqual(result['structure_stage'], '等待确认')
        self.assertEqual(result['structure_details']['focus_classification']['type'], '复杂结构')
        self.assertEqual(result['structure_details']['focus_classification']['stage'], '等待确认')
        self.assertEqual(result['structure_details']['focus_classification']['standard_qualification'], 'failed')
        self.assertIn('无法诚实解释标准起点', result['structure_details']['focus_classification']['qualification_reason'])

    def test_build_trinity_structure_decision_reads_boundary_levels_from_structure_details(self) -> None:
        structure = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': 'C单平台式',
                'trend_direction': '震荡',
                'description': '平台边界测试',
                'interpretation': {'focus_structure': {}},
                'structure_details': {
                    'focus_classification': {
                        'type': 'C单平台式',
                        'standard_qualification': 'standard',
                    },
                    'boundary_levels': {
                        'upper': 18.8,
                        'lower': 16.2,
                        'mid': 17.5,
                        'breakout_trigger': 18.9,
                        'breakdown_trigger': 16.1,
                        'stop_loss': 15.9,
                    },
                },
            }
        )

        self.assertEqual(
            structure['boundaries'],
            {
                'upper': 18.8,
                'lower': 16.2,
                'mid': 17.5,
                'breakout_trigger': 18.9,
                'breakdown_trigger': 16.1,
                'stop_loss': 15.9,
            },
        )
        self.assertTrue(structure['can_trade_by_boundaries'])

    def test_build_period_execution_uses_spacetime_gate_wait_reason_before_generic_wait(self) -> None:
        execution = self.analyzer._build_period_execution(
            level='hour30',
            latest_price=163.35,
            macd_status='中偏强',
            moving_averages={'ma_status': '多头排列', 'price_vs_ma55': 'above'},
            ma_physics={
                'support_pressure': {},
                'traction': {},
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
                'reason': '等待平台确认',
            },
            archetype={'primary': 'A五段式', 'confidence': 'medium', 'reason': 'Directional -> Platform'},
            prediction={'key_price_levels': []},
            latest_confirmed_levels=[],
            spacetime_gate={
                'resonance_enabled': False,
                'wait_reason': '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作',
            },
        )

        self.assertEqual(execution['action'], 'wait')
        self.assertEqual(execution['wait_reason'], '日线中偏强仅接受 C 结构试仓，当前 A 原型暂不操作')

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

    def test_analyze_trading_decision_exposes_orders_caps_and_stop_rules(self) -> None:
        results = {
            'daily': {
                'macd': {'status': '强'},
                'moving_averages': {'price_vs_ma55': 'above'},
                'structure': {
                    'execution': {
                        'can_trade': True,
                        'action': 'buy',
                        'direction': 'long',
                        'setup_quality': 'A',
                        'rationale': '日线回抽确认，执行条件满足',
                        'timing_timeframe': 'daily',
                        'timeframe_cap_ratio': 0.5,
                        'trigger': ['MA55支撑有效后重新转强'],
                        'invalidation': ['跌破同级别止损位 99.2 立即退出'],
                        'confirmation': ['突破形态有效'],
                        'position_sizing': {'initial': '20%-30%'},
                        't_trade_rule': {'mode': 'positive_only'},
                        'risk_rules': {
                            'stop_loss_basis': 'same_timeframe',
                        },
                        'take_profit_plan': {
                            'model': 'inverted_pyramid',
                        },
                        'key_levels': [{'price': 99.2, 'type': 'stop'}],
                        'risk_flags': [],
                        'wait_reason': None,
                    },
                },
            },
            'weekly': {'macd': {'status': '强'}},
            'hour60': {'moving_averages': {'price_vs_ma55': 'above'}},
            'hour30': {'macd': {'top_divergence': False}},
            'hour15': {'macd': {'top_divergence': False}},
            'nesting_analysis': {},
        }
        spacetime_confirmation = {
            'spacetime_resonance': True,
            'analysis': '时空共振确认',
        }

        decision = self.analyzer.analyze_trading_decision(
            results,
            spacetime_confirmation=spacetime_confirmation,
        )

        self.assertTrue(decision['can_trade'])
        self.assertEqual(decision['analysis_order'], 'top_down')
        self.assertEqual(decision['execution_order'], 'bottom_up')
        self.assertEqual(decision['timing_timeframe'], 'daily')
        self.assertAlmostEqual(decision['timeframe_cap_ratio'], 0.5, places=3)
        self.assertEqual(decision['risk_rules']['stop_loss_basis'], 'same_timeframe')
        self.assertEqual(decision['take_profit_plan']['model'], 'inverted_pyramid')
        self.assertIn('时空共振', ' '.join(decision['confirmation']))

    def test_analyze_trading_decision_keeps_wait_action_as_stable_observe_decision(self) -> None:
        results = {
            'daily': {
                'macd': {'status': '强'},
                'moving_averages': {'price_vs_ma55': 'above'},
                'structure': {
                    'execution': {
                        'can_trade': False,
                        'action': 'wait',
                        'direction': 'neutral',
                        'setup_quality': 'avoid',
                        'rationale': '等待日线级别触发条件完成',
                        'timing_timeframe': 'daily',
                        'timeframe_cap_ratio': 0.5,
                        'trigger': ['等待确认性触发'],
                        'invalidation': ['原建仓级别失效立即退出'],
                        'confirmation': ['次级别结构继续共振'],
                        'position_sizing': {'initial': '0%'},
                        't_trade_rule': {'mode': 'positive_only'},
                        'risk_rules': {'stop_loss_basis': 'same_timeframe'},
                        'take_profit_plan': {'model': 'none'},
                        'key_levels': [],
                        'risk_flags': ['当前仅满足观察，不满足执行'],
                        'wait_reason': '等待回抽确认后再执行',
                    },
                },
            },
            'weekly': {'macd': {'status': '强'}},
            'hour60': {'moving_averages': {'price_vs_ma55': 'above'}},
            'hour30': {'macd': {'top_divergence': False}},
            'hour15': {'macd': {'top_divergence': False}},
            'nesting_analysis': {},
        }

        decision = self.analyzer.analyze_trading_decision(
            results,
            spacetime_confirmation={'spacetime_resonance': False},
        )

        self.assertEqual(decision['action'], 'wait')
        self.assertEqual(decision['decision_type'], '观望')
        self.assertEqual(decision['action_hint'], '等待执行总线触发信号后再行动')
        self.assertNotEqual(decision['decision_type'], '做T')
        self.assertNotIn('适合正T', decision['analysis'])

    def test_analyze_with_local_data_backfills_trinity_level_nesting(self) -> None:
        self.analyzer.analyze_single_period = lambda _df, level: {
            'period': level,
            'macd': {'status': '强' if level == 'weekly' else '中偏强'},
            'moving_averages': {},
            'breakthrough': {},
            'structure': {
                'structure_type': 'A五段式',
                'structure_stage': '趋势启动阶段',
                'trend_direction': '上涨',
                'description': 'mock',
                'execution': {
                    'can_trade': True,
                    'action': 'buy',
                    'direction': 'long',
                    'entry_style': 'pullback_confirm',
                    'trigger': [],
                    'invalidation': [],
                    'confirmation': [],
                    'position_sizing': {},
                    'risk_flags': [],
                },
            },
            'trinity_decision': {
                'version': 'v2',
                'level': level,
                'conclusion': {'bias': 'bullish'},
                'structure': {'type': 'A五段式'},
            },
        }
        self.analyzer.convert_to_dataframe = lambda rows: pd.DataFrame(rows)
        self.analyzer._apply_spacetime_gate_to_results = lambda results: None
        self.analyzer.analyze_level_nesting = lambda results: {'summary': '周线强 / 日线强'}
        self.analyzer.analyze_level_operation = lambda results: {}

        result = self.analyzer.analyze_with_local_data(
            '300274',
            {
                'stock_name': '阳光电源',
                'periods': {
                    'weekly': [{'date': '2026-01-01', 'open': 1, 'high': 1, 'low': 1, 'close': 1, 'volume': 1}],
                    'daily': [{'date': '2026-01-01', 'open': 1, 'high': 1, 'low': 1, 'close': 1, 'volume': 1}],
                },
            },
        )

        daily_nesting = result['periods']['daily']['trinity_decision']['level_nesting']
        self.assertEqual(daily_nesting['parent_level'], 'weekly')
        self.assertEqual(daily_nesting['resonance'], 'aligned')
        self.assertEqual(daily_nesting['child_signal'], 'long')

    def test_analyze_backfills_trinity_level_nesting(self) -> None:
        self.analyzer.login = lambda: True
        self.analyzer.logout = lambda: None
        self.analyzer.get_stock_data = lambda *_args, **_kwargs: pd.DataFrame(
            [{'date': pd.Timestamp('2026-01-01'), 'open': 1, 'high': 1, 'low': 1, 'close': 1, 'volume': 1}]
        )
        self.analyzer.analyze_single_period = lambda _df, level: {
            'period': level,
            'macd': {'status': '强' if level == 'weekly' else '中偏强'},
            'moving_averages': {},
            'breakthrough': {},
            'structure': {
                'structure_type': 'A五段式',
                'structure_stage': '趋势启动阶段',
                'trend_direction': '上涨',
                'description': 'mock',
                'execution': {
                    'can_trade': True,
                    'action': 'buy',
                    'direction': 'long',
                    'entry_style': 'pullback_confirm',
                    'trigger': [],
                    'invalidation': [],
                    'confirmation': [],
                    'position_sizing': {},
                    'risk_flags': [],
                },
            },
            'trinity_decision': {
                'version': 'v2',
                'level': level,
                'conclusion': {'bias': 'bullish'},
                'structure': {'type': 'A五段式'},
            },
        }
        self.analyzer._apply_spacetime_gate_to_results = lambda results: None
        self.analyzer.analyze_level_nesting = lambda results: {'summary': '周线强 / 日线强'}

        result = self.analyzer.analyze('300274', levels=['weekly', 'daily'])

        daily_nesting = result['periods']['daily']['trinity_decision']['level_nesting']
        self.assertEqual(daily_nesting['parent_level'], 'weekly')
        self.assertEqual(daily_nesting['resonance'], 'aligned')
        self.assertEqual(daily_nesting['child_signal'], 'long')

    def test_analyze_trading_decision_maps_add_action_without_falling_back_to_heuristics(self) -> None:
        results = {
            'daily': {
                'macd': {'status': '强'},
                'moving_averages': {'price_vs_ma55': 'above'},
                'structure': {
                    'execution': {
                        'can_trade': True,
                        'action': 'add',
                        'direction': 'long',
                        'setup_quality': 'A',
                        'rationale': '日线执行总线允许右侧加仓',
                        'timing_timeframe': 'daily',
                        'timeframe_cap_ratio': 0.5,
                        'trigger': ['回抽确认后二次进攻'],
                        'invalidation': ['跌破同级别止损位 99.2 立即退出'],
                        'confirmation': ['突破形态有效'],
                        'position_sizing': {'initial': '20%-30%'},
                        't_trade_rule': {'mode': 'positive_only'},
                        'risk_rules': {'stop_loss_basis': 'same_timeframe'},
                        'take_profit_plan': {'model': 'inverted_pyramid'},
                        'key_levels': [{'price': 99.2, 'type': 'stop'}],
                        'risk_flags': [],
                        'wait_reason': None,
                    },
                },
            },
            'weekly': {'macd': {'status': '强'}},
            'hour60': {'moving_averages': {'price_vs_ma55': 'above'}},
            'hour30': {'macd': {'top_divergence': False}},
            'hour15': {'macd': {'top_divergence': False}},
            'nesting_analysis': {},
        }

        decision = self.analyzer.analyze_trading_decision(
            results,
            spacetime_confirmation={'spacetime_resonance': False},
        )

        self.assertEqual(decision['action'], 'add')
        self.assertEqual(decision['decision_type'], '加仓')
        self.assertEqual(decision['action_hint'], '按 bottom_up 执行，等待次级别触发后分批加仓')
        self.assertNotIn('适合正T', decision['analysis'])

    def test_analyze_trading_decision_degrades_unknown_action_to_observe_when_execution_bus_exists(self) -> None:
        results = {
            'daily': {
                'macd': {'status': '强'},
                'moving_averages': {'price_vs_ma55': 'above'},
                'structure': {
                    'execution': {
                        'can_trade': False,
                        'action': 'unknown',
                        'direction': 'neutral',
                        'setup_quality': 'avoid',
                        'rationale': '执行总线动作暂不可识别，等待人工复核',
                        'timing_timeframe': 'daily',
                        'timeframe_cap_ratio': 0.5,
                        'trigger': ['等待确认性触发'],
                        'invalidation': ['原建仓级别失效立即退出'],
                        'confirmation': ['次级别结构继续共振'],
                        'position_sizing': {'initial': '0%'},
                        't_trade_rule': {'mode': 'positive_only'},
                        'risk_rules': {'stop_loss_basis': 'same_timeframe'},
                        'take_profit_plan': {'model': 'none'},
                        'key_levels': [],
                        'risk_flags': ['当前仅满足观察，不满足执行'],
                        'wait_reason': '等待执行总线输出明确动作',
                    },
                },
            },
            'weekly': {'macd': {'status': '强'}},
            'hour60': {'moving_averages': {'price_vs_ma55': 'above'}},
            'hour30': {'macd': {'top_divergence': False}},
            'hour15': {'macd': {'top_divergence': False}},
            'nesting_analysis': {},
        }

        decision = self.analyzer.analyze_trading_decision(
            results,
            spacetime_confirmation={'spacetime_resonance': False},
        )

        self.assertEqual(decision['action'], 'unknown')
        self.assertEqual(decision['decision_type'], '观望')
        self.assertEqual(decision['action_hint'], '等待执行总线触发信号后再行动')
        self.assertNotEqual(decision['decision_type'], '做T')
        self.assertNotIn('适合正T', decision['analysis'])

    def test_analyze_trading_decision_treats_empty_execution_bus_as_existing_and_waits(self) -> None:
        results = {
            'daily': {
                'macd': {'status': '强'},
                'moving_averages': {'price_vs_ma55': 'above'},
                'structure': {
                    'execution': {},
                },
            },
            'weekly': {'macd': {'status': '强'}},
            'hour60': {'moving_averages': {'price_vs_ma55': 'above'}},
            'hour30': {'macd': {'top_divergence': False}},
            'hour15': {'macd': {'top_divergence': False}},
            'nesting_analysis': {},
        }

        decision = self.analyzer.analyze_trading_decision(
            results,
            spacetime_confirmation={'spacetime_resonance': False},
        )

        self.assertEqual(decision['action'], 'wait')
        self.assertEqual(decision['decision_type'], '观望')
        self.assertEqual(decision['action_hint'], '等待执行总线触发信号后再行动')
        self.assertNotEqual(decision['decision_type'], '做T')
        self.assertNotIn('适合正T', decision['analysis'])


if __name__ == '__main__':
    unittest.main()
