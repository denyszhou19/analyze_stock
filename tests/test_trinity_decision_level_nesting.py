import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionLevelNestingTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def _payload(
        self,
        *,
        status='强',
        structure_type='B双平台式',
        qualification='standard',
        direction='up',
        standard_candidate=None,
        node_map=None,
        current_leg=None,
        prediction=None,
        current_point_id=None,
        current_segment=None,
        probe_entry=None,
        confirm_entry=None,
        invalidation=None,
        next_confirmation_action=None,
    ):
        standard_candidate = standard_candidate or structure_type
        return {
            'macd': {'status': status},
            'trinity_decision': {
                'spacetime': {'status': status},
                'conclusion': {'bias': 'bullish' if direction == 'up' else 'bearish' if direction == 'down' else 'neutral'},
                'structure': {
                    'type': structure_type,
                    'standard_candidate': standard_candidate,
                    'qualification': qualification,
                    'direction': direction,
                    'boundaries': {'upper': 11.2, 'lower': 10.4, 'mid': 10.8},
                    'node_map': node_map or {'a4': None, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': None},
                },
                'execution_plan': {
                    'probe_entry': probe_entry,
                    'confirm_entry': confirm_entry,
                    'invalidation': invalidation,
                },
                'wait_state': {
                    'next_confirmation_action': next_confirmation_action,
                },
            },
            'structure': {
                'trend_direction': '上涨' if direction == 'up' else '下跌' if direction == 'down' else '震荡',
                'structure_type': structure_type,
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': standard_candidate[0] if standard_candidate else None,
                        'standard_qualification': qualification,
                        'directional_bias': direction,
                    },
                    'current_leg': current_leg or {
                        'from_point_id': None,
                        'to_point_id': None,
                        'direction': direction,
                        'label': '待确认',
                    },
                },
                'structure_details': {
                    'prediction': prediction or {},
                    'explainability': {
                        'current_point_id': current_point_id,
                        'current_segment': current_segment,
                    },
                },
            },
        }

    def _decision(self, *, parent_status='强', child_payload=None, level='hour30'):
        child_payload = child_payload or self._payload(status='强', structure_type='B双平台式', direction='up')
        return self.analyzer._build_trinity_level_nesting_decision(
            level=level,
            normalized_results={
                'daily': self._payload(status=parent_status, structure_type='B双平台式', direction='up'),
                level: child_payload,
            },
            raw_level_nesting={'summary': '测试级别嵌套'},
        )

    def test_build_trinity_level_nesting_allows_upgrade_when_strong_parent_matches_b_family(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': self._payload(status='强', structure_type='B双平台式', direction='up'),
                'daily': self._payload(status='强', structure_type='B双平台式', direction='up'),
            },
            raw_level_nesting={'summary': '周线强 / 日线B双平台式'},
        )

        self.assertEqual(decision['parent_level'], 'weekly')
        self.assertEqual(decision['child_level'], 'daily')
        self.assertEqual(decision['parent_spacetime_status'], '强')
        self.assertEqual(decision['child_structure_family'], 'B')
        self.assertEqual(decision['child_structure_qualification'], 'standard')
        self.assertEqual(decision['resonance'], 'aligned')
        self.assertEqual(decision['child_signal'], 'long')
        self.assertTrue(decision['permission']['allow_position_increase'])
        self.assertIn('日线', decision['permission']['reason'])

    def test_build_trinity_level_nesting_marks_parent_unclear_when_weekly_missing(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'daily': {
                    'macd': {'status': '中偏弱'},
                    'trinity_decision': {'structure': {'type': 'C单平台式'}},
                },
            },
            raw_level_nesting=None,
        )

        self.assertEqual(decision['resonance'], 'parent_unclear')
        self.assertTrue(decision['permission']['allow_only_light_probe'])
        self.assertIn('周线缺失', decision['permission']['reason'])

    def test_build_trinity_level_nesting_maps_aligned_c_structure_to_long_signal(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': self._payload(status='中偏强', structure_type='C单平台式', direction='up'),
                'daily': self._payload(status='中偏强', structure_type='C单平台式', direction='up'),
            },
            raw_level_nesting={'summary': '周线中偏强 / 日线C单平台式'},
        )

        self.assertEqual(decision['resonance'], 'boundary_probe')
        self.assertEqual(decision['operation_frame'], 'platform_boundary')
        self.assertEqual(decision['execution_strength'], 'light_probe')
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertTrue(decision['permission']['allow_only_light_probe'])
        self.assertTrue(any('平台' in item or '边界' in item for item in decision['wait_conditions']))

    def test_strong_parent_rejects_a_family_when_table_expects_b_for_uptrend(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': self._payload(status='强', structure_type='B双平台式', direction='up'),
                'daily': self._payload(status='强', structure_type='A五段式', direction='up', standard_candidate='A五段式'),
            },
            raw_level_nesting={'summary': '周线强 / 日线A五段式'},
        )

        self.assertEqual(decision['resonance'], 'structure_mismatch')
        self.assertEqual(decision['child_structure_family'], 'A')
        self.assertFalse(decision['structure_match'])
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertIn('周线强', decision['permission']['reason'])
        self.assertTrue(decision['wait_conditions'])

    def test_extended_c_matches_family_but_downgrades_execution_strength(self) -> None:
        decision = self._decision(
            parent_status='中偏强',
            child_payload=self._payload(
                status='中偏强',
                structure_type='延伸C类',
                qualification='extended',
                direction='up',
                standard_candidate='C单平台式',
                probe_entry='30分钟延伸C等待平台边界突破',
                confirm_entry='30分钟回踩平台上沿不破',
                invalidation='30分钟跌破平台下沿失效',
            ),
        )

        self.assertEqual(decision['resonance'], 'boundary_probe')
        self.assertEqual(decision['child_structure_family'], 'C')
        self.assertEqual(decision['child_structure_qualification'], 'extended')
        self.assertEqual(decision['execution_strength'], 'light_probe')
        self.assertIn('延伸C', decision['downgrade_reason'])
        self.assertIn('30分钟延伸C等待平台边界突破', decision['wait_conditions'])
        self.assertIn('30分钟回踩平台上沿不破', decision['confirm_conditions'])
        self.assertIn('30分钟跌破平台下沿失效', decision['invalidation_conditions'])

    def test_weak_parent_matches_uptrend_d_family_with_cautious_execution(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='D三段式',
                qualification='standard',
                direction='up',
                standard_candidate='D三段式',
            ),
        )

        self.assertEqual(decision['resonance'], 'aligned')
        self.assertEqual(decision['child_structure_family'], 'D')
        self.assertEqual(decision['operation_frame'], 'three_leg_reversal')
        self.assertIn(decision['execution_strength'], {'light_probe', 'risk_control_first'})
        self.assertTrue(any('d1/d2/d3/d4' in item or 'd3' in item or 'd4' in item for item in decision['wait_conditions']))

    def test_unfinished_structure_observe_only(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='未完成结构',
                qualification='unfinished',
                direction='neutral',
                standard_candidate=None,
            ),
        )

        self.assertEqual(decision['child_structure_qualification'], 'unfinished')
        self.assertEqual(decision['execution_strength'], 'observe_only')
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertFalse(decision['permission']['allow_only_light_probe'])
        self.assertTrue(any('观察' in item or '等待' in item for item in decision['wait_conditions']))

    def test_parent_conflict_forces_child_to_wait_or_light_probe(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour30',
            normalized_results={
                'daily': {
                    'macd': {'status': '弱'},
                    'trinity_decision': {'conclusion': {'bias': 'bearish'}},
                },
                'hour30': {
                    'macd': {'status': '中偏强'},
                    'trinity_decision': {'structure': {'type': 'A五段式'}},
                },
            },
            raw_level_nesting={'summary': '日线偏弱，30分钟反弹'},
        )

        self.assertEqual(decision['resonance'], 'child_countertrend')
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertTrue(decision['permission']['allow_only_light_probe'])
        self.assertTrue(decision['permission']['allow_t_trade'])

    def test_neutral_parent_and_long_child_does_not_become_child_countertrend(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour30',
            normalized_results={
                'daily': {
                    'macd': {'status': '中性'},
                    'trinity_decision': {'conclusion': {'bias': 'neutral'}},
                },
                'hour30': {
                    'macd': {'status': '中偏强'},
                    'trinity_decision': {'structure': {'type': 'A五段式'}},
                },
            },
            raw_level_nesting={'summary': '日线中性，30分钟偏强反弹'},
        )

        self.assertEqual(decision['parent_bias'], 'neutral')
        self.assertEqual(decision['child_signal'], 'long')
        self.assertEqual(decision['resonance'], 'parent_unclear')

    def test_daily_child_countertrend_does_not_open_t_trade(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': {
                    'macd': {'status': '弱'},
                    'trinity_decision': {'conclusion': {'bias': 'bearish'}},
                },
                'daily': {
                    'macd': {'status': '中偏强'},
                    'trinity_decision': {'structure': {'type': 'A五段式'}},
                },
            },
            raw_level_nesting={'summary': '周线偏空，日线反弹'},
        )

        self.assertEqual(decision['resonance'], 'child_countertrend')
        self.assertFalse(decision['permission']['allow_position_increase'])
        self.assertFalse(decision['permission']['allow_t_trade'])

    def test_standard_b_maps_b2_progress_to_b3_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='B双平台式',
                qualification='standard',
                direction='up',
                standard_candidate='B双平台式',
                current_leg={
                    'from_point_id': 'b2',
                    'to_point_id': 'live',
                    'direction': 'down',
                    'label': 'b2→live 下行形成中',
                },
                prediction={
                    'current_stage': 'b2拐点',
                    'next_stage': 'b3拐点',
                    'prediction_alert': '📍 B双平台式正在等待 b3 回踩确认',
                    'action_hint': '等待 b3 回踩完成后重新转强',
                },
            ),
        )

        self.assertEqual(decision['node_semantic']['family'], 'B')
        self.assertEqual(decision['node_semantic']['actionable_node'], 'b3')
        self.assertEqual(decision['node_semantic']['label'], 'B类b3回踩确认')
        self.assertIn('b2→live 下行形成中', decision['node_semantic']['reason'])
        self.assertTrue(any(item == '等待30分钟B类b3回踩确认' for item in decision['wait_conditions']))
        self.assertTrue(any('回踩平台上沿不破' in item or '平台边界' in item for item in decision['confirm_conditions']))

    def test_standard_b_maps_b4_progress_to_b5_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='B双平台式',
                qualification='standard',
                direction='up',
                standard_candidate='B双平台式',
                current_leg={
                    'from_point_id': 'b4',
                    'to_point_id': 'live',
                    'direction': 'down',
                    'label': 'b4→live 下行形成中',
                },
                prediction={'current_stage': 'b4拐点', 'next_stage': 'b5拐点'},
            ),
        )

        self.assertEqual(decision['node_semantic']['actionable_node'], 'b5')
        self.assertEqual(decision['node_semantic']['label'], 'B类b5中继确认')
        self.assertTrue(any(item == '等待30分钟B类b5中继确认' for item in decision['wait_conditions']))

    def test_standard_d_maps_d2_progress_to_d3_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='D三段式',
                qualification='standard',
                direction='up',
                standard_candidate='D三段式',
                current_leg={
                    'from_point_id': 'd2',
                    'to_point_id': 'live',
                    'direction': 'down',
                    'label': 'd2→live 下行形成中',
                },
                prediction={
                    'current_stage': 'd2拐点',
                    'next_stage': 'd3拐点',
                    'prediction_alert': '📍 D三段式进行中，等待 d3 拐点形成',
                    'action_hint': '等待底分型确认，d3 拐点是潜在买点',
                },
            ),
        )

        self.assertEqual(decision['node_semantic']['family'], 'D')
        self.assertEqual(decision['node_semantic']['actionable_node'], 'd3')
        self.assertEqual(decision['node_semantic']['label'], 'D类d3反向修正完成')
        self.assertTrue(any(item == '等待30分钟D类d3反向修正完成' for item in decision['wait_conditions']))
        self.assertTrue(any('d4' in item for item in decision['confirm_conditions']))

    def test_standard_d_keeps_unstable_d3_reason_when_prediction_marks_unstable_point(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='D三段式',
                qualification='standard',
                direction='up',
                standard_candidate='D三段式',
                prediction={
                    'current_stage': 'd3拐点',
                    'next_stage': 'd4拐点（结构完成）',
                    'prediction_alert': '⚠️ D三段式d3拐点（买入不稳定点）',
                    'action_hint': 'd3是不稳定买入点，可考虑轻仓尝试',
                    'unstable_point': {
                        'is_unstable': True,
                        'type': '买入不稳定点',
                        'description': '在"弱"状态上涨中，d3是买入不稳定点，后续可能继续上涨',
                    },
                },
                current_leg={
                    'from_point_id': 'd3',
                    'to_point_id': 'live',
                    'direction': 'up',
                    'label': 'd3→live 上行形成中',
                },
            ),
        )

        self.assertEqual(decision['node_semantic']['actionable_node'], 'd3')
        self.assertIn('买入不稳定点', decision['node_semantic']['reason'])
        self.assertIn('d4结构完成', ''.join(decision['confirm_conditions']))

    def test_extended_d_does_not_fake_exact_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='弱',
            child_payload=self._payload(
                status='弱',
                structure_type='延伸D类',
                qualification='extended',
                direction='up',
                standard_candidate='D三段式',
                current_leg={
                    'from_point_id': 'd2',
                    'to_point_id': 'live',
                    'direction': 'down',
                    'label': 'd2→live 下行形成中',
                },
                prediction={'current_stage': '延伸D进行中'},
            ),
        )

        self.assertIsNone(decision.get('node_semantic'))
        self.assertTrue(any('延伸结构' in item for item in decision['wait_conditions']))
        self.assertTrue(all('d3' not in item and 'd4' not in item for item in decision['wait_conditions']))

    def test_extended_b_does_not_fake_exact_actionable_node(self) -> None:
        decision = self._decision(
            parent_status='强',
            child_payload=self._payload(
                status='强',
                structure_type='延伸B类',
                qualification='extended',
                direction='up',
                standard_candidate='B双平台式',
                prediction={'current_stage': '延伸B进行中'},
            ),
        )

        self.assertIsNone(decision.get('node_semantic'))
        self.assertTrue(any('延伸结构' in item for item in decision['wait_conditions']))
        self.assertTrue(all('b3' not in item and 'b5' not in item for item in decision['wait_conditions']))
