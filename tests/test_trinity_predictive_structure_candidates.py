import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityPredictiveStructureCandidatesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def _period_payload(
        self,
        *,
        spacetime_status='强',
        structure_type='B双平台式',
        standard_candidate=None,
        focus_family=None,
        raw_type=None,
        direction='up',
        qualification='standard',
        macd_status='中偏强',
        current_leg='b5→live 下行形成中',
        current_leg_direction=None,
        ma55=132.59,
        ma233=145.92,
        close=129.10,
    ):
        standard_candidate = standard_candidate or structure_type
        raw_type = raw_type or structure_type
        if focus_family is None:
            family_hint = (standard_candidate or '')[:1]
            focus_family = family_hint if family_hint in {'A', 'B', 'C', 'D'} else None
        if current_leg_direction is None:
            if '下行' in current_leg or '急跌' in current_leg:
                current_leg_direction = 'down'
            elif '上行' in current_leg or '反抽' in current_leg or '拉升' in current_leg:
                current_leg_direction = 'up'
            else:
                current_leg_direction = direction if direction in {'up', 'down'} else 'neutral'
        return {
            'macd': {'status': macd_status},
            'ma55': ma55,
            'ma233': ma233,
            'close': close,
            'trinity_decision': {
                'spacetime': {'status': spacetime_status},
                'structure': {
                    'type': structure_type,
                    'standard_candidate': standard_candidate,
                    'qualification': qualification,
                    'direction': direction,
                    'current_leg': current_leg,
                },
            },
            'structure': {
                'structure_type': structure_type,
                'trend_direction': '上涨' if direction == 'up' else '下跌' if direction == 'down' else '震荡',
                'structure_details': {
                    'raw_classification': {'type': raw_type},
                },
                'interpretation': {
                    'current_leg': {
                        'from_point_id': None,
                        'to_point_id': 'live',
                        'direction': current_leg_direction,
                        'label': current_leg,
                    },
                    'focus_structure': {
                        'archetype_family': focus_family,
                        'standard_qualification': qualification,
                        'directional_bias': direction,
                    }
                },
            },
        }

    def _assert_scope_layers(
        self,
        prediction,
        *,
        allowed,
        degraded,
        blocked,
    ) -> None:
        scope = prediction['spacetime_scope']
        self.assertCountEqual(scope['allowed_candidates'], allowed)
        self.assertCountEqual(scope['degraded_candidates'], degraded)
        self.assertCountEqual(scope['blocked_candidates'], blocked)

    def test_progressive_narrative_promotes_a_candidate_when_scope_allows(self) -> None:
        # Current normalized fixture still uses current_leg label to carry
        # "推进主导 / 防抖分歧" narrative hints; once a structured trigger_signals
        # contract exists, these tests should migrate to that input instead.
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour30',
            normalized_results={
                'daily': self._period_payload(spacetime_status='极强', structure_type='B双平台式', direction='up'),
                'hour30': self._period_payload(
                    spacetime_status='中偏强',
                    structure_type='B双平台式',
                    direction='up',
                    current_leg='a4→live 上行推进中',
                    current_leg_direction='up',
                    close=151.8,
                    ma55=149.1,
                    ma233=129.8,
                ),
            },
            raw_level_nesting={'summary': '测试推进主语切换'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self._assert_scope_layers(
            prediction,
            allowed=['A', 'B'],
            degraded=['C'],
            blocked=['D'],
        )
        self.assertEqual(prediction['dominant_narrative'], '推进主导')
        self.assertEqual(prediction['narrative_switch']['from_family'], 'B')
        self.assertEqual(prediction['narrative_switch']['to_family'], 'A')
        self.assertEqual(prediction['narrative_switch']['state'], 'strengthening')
        self.assertTrue(isinstance(prediction['narrative_switch']['hard_triggers'], list))
        self.assertTrue(isinstance(prediction['narrative_switch']['soft_triggers'], list))
        self.assertTrue(isinstance(prediction['narrative_switch']['blocking_signals'], list))
        self.assertEqual(prediction['primary_candidate']['family'], 'A')
        self.assertEqual(prediction['primary_candidate']['stage'], 'strengthening')
        self.assertEqual(prediction['secondary_candidate']['family'], 'B')
        self.assertEqual(prediction['secondary_candidate']['stage'], 'candidate')
        self.assertTrue(prediction['fallback_candidate']['enabled'])
        self.assertEqual(prediction['observed_context']['global_structure_type'], 'B双平台式')
        self.assertEqual(prediction['observed_context']['focus_structure_type'], 'B双平台式')
        self.assertEqual(prediction['observed_context']['current_leg'], 'a4→live 上行推进中')

    def test_single_spike_keeps_a_candidate_in_debouncing_state(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour30',
            normalized_results={
                'daily': self._period_payload(spacetime_status='极强', structure_type='B双平台式', direction='up'),
                'hour30': self._period_payload(
                    spacetime_status='中偏强',
                    structure_type='B双平台式',
                    direction='up',
                    current_leg='b5→live 单根拉升尝试',
                    current_leg_direction='up',
                    close=150.2,
                    ma55=150.0,
                    ma233=129.8,
                ),
            },
            raw_level_nesting={'summary': '测试防抖'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self._assert_scope_layers(
            prediction,
            allowed=['A', 'B'],
            degraded=['C'],
            blocked=['D'],
        )
        self.assertEqual(prediction['dominant_narrative'], '分歧混合')
        self.assertEqual(prediction['primary_candidate']['family'], 'A')
        self.assertEqual(prediction['primary_candidate']['stage'], 'debouncing')
        self.assertEqual(prediction['narrative_switch']['state'], 'debouncing')
        self.assertFalse(prediction['narrative_switch']['passed'])

    def test_d_candidate_is_only_used_as_fallback_when_abc_fail(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour15',
            normalized_results={
                'hour60': self._period_payload(
                    spacetime_status='中偏弱',
                    structure_type='复杂结构',
                    standard_candidate='D三段式',
                    focus_family='D',
                    raw_type='D三段式',
                    direction='down',
                    current_leg='d4→live 下行延续中',
                    current_leg_direction='down',
                ),
                'hour15': self._period_payload(
                    spacetime_status='中偏弱',
                    structure_type='复杂结构',
                    standard_candidate='D三段式',
                    focus_family='D',
                    raw_type='D三段式',
                    direction='down',
                    current_leg='d4→live 下行急跌推进中',
                    current_leg_direction='down',
                    close=118.6,
                    ma55=126.1,
                    ma233=134.4,
                ),
            },
            raw_level_nesting={'summary': '测试 D 降级'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self._assert_scope_layers(
            prediction,
            allowed=['C'],
            degraded=['A', 'B'],
            blocked=['D'],
        )
        self.assertNotIn('D', prediction['spacetime_scope']['allowed_candidates'])
        self.assertIn('D', prediction['spacetime_scope']['blocked_candidates'])
        self.assertEqual(prediction['primary_candidate']['family'], 'C')
        self.assertEqual(prediction['primary_candidate']['stage'], 'candidate')
        self.assertEqual(prediction['fallback_candidate']['family'], 'D')
        self.assertTrue(prediction['fallback_candidate']['enabled'])
        self.assertFalse(prediction['exception_interrupt']['enabled'])

    def test_extreme_v_reversal_turns_into_exception_interrupt(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour15',
            normalized_results={
                'hour60': self._period_payload(
                    spacetime_status='极弱',
                    structure_type='复杂结构',
                    standard_candidate='D三段式',
                    focus_family='D',
                    raw_type='D三段式',
                    direction='down',
                    current_leg='d4→live 下行延续中',
                    current_leg_direction='down',
                ),
                'hour15': self._period_payload(
                    spacetime_status='极弱',
                    structure_type='复杂结构',
                    standard_candidate='D三段式',
                    focus_family='D',
                    raw_type='D三段式',
                    direction='up',
                    current_leg='d3→live 上行V反抽中',
                    current_leg_direction='up',
                    close=137.5,
                    ma55=126.1,
                    ma233=134.4,
                ),
            },
            raw_level_nesting={'summary': '测试 D 异常'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self._assert_scope_layers(
            prediction,
            allowed=[],
            degraded=['A', 'B', 'C'],
            blocked=['D'],
        )
        self.assertEqual(prediction['dominant_narrative'], '反抽主导')
        self.assertTrue(prediction['exception_interrupt']['enabled'])
        self.assertIsNotNone(prediction['exception_interrupt']['type'])
        self.assertEqual(prediction['primary_candidate']['family'], 'D')
        self.assertEqual(prediction['primary_candidate']['stage'], 'exception')

    def test_refresh_level_nesting_writes_structure_prediction_to_top_level_trinity_decision(self) -> None:
        normalized_results = self.analyzer._refresh_trinity_decisions_with_level_nesting(
            {
                'daily': self._period_payload(
                    spacetime_status='极强',
                    structure_type='B双平台式',
                    direction='up',
                    current_leg='b5→live 下行形成中',
                    current_leg_direction='down',
                ),
                'hour30': self._period_payload(
                    spacetime_status='中偏强',
                    structure_type='B双平台式',
                    direction='up',
                    current_leg='a4→live 上行推进中',
                    current_leg_direction='up',
                    close=151.8,
                    ma55=149.1,
                    ma233=129.8,
                ),
            },
            raw_level_nesting={'summary': '测试顶层透传'},
        )

        decision = normalized_results['hour30']['trinity_decision']
        self.assertIn('structure_prediction', decision)
        self.assertEqual(
            decision['structure_prediction'],
            decision['level_nesting']['structure_prediction'],
        )
