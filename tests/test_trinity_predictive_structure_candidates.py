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
        direction='up',
        qualification='standard',
        macd_status='中偏强',
        current_leg='b5→live 下行形成中',
        ma55=132.59,
        ma233=145.92,
        close=129.10,
    ):
        return {
            'macd': {'status': macd_status},
            'ma55': ma55,
            'ma233': ma233,
            'close': close,
            'trinity_decision': {
                'spacetime': {'status': spacetime_status},
                'structure': {
                    'type': structure_type,
                    'standard_candidate': structure_type,
                    'qualification': qualification,
                    'direction': direction,
                    'current_leg': current_leg,
                },
            },
            'structure': {
                'structure_type': structure_type,
                'trend_direction': '上涨' if direction == 'up' else '下跌',
                'structure_details': {
                    'raw_classification': {'type': '延伸C类'},
                },
                'interpretation': {
                    'current_leg': {
                        'from_point_id': None,
                        'to_point_id': 'live',
                        'direction': 'down' if '下行' in current_leg else 'up',
                        'label': current_leg,
                    },
                    'focus_structure': {
                        'archetype_family': structure_type[:1],
                        'standard_qualification': qualification,
                        'directional_bias': direction,
                    }
                },
            },
        }

    def test_progressive_narrative_promotes_a_candidate_when_scope_allows(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour30',
            normalized_results={
                'daily': self._period_payload(spacetime_status='极强', structure_type='B双平台式', direction='up'),
                'hour30': self._period_payload(
                    spacetime_status='中偏强',
                    structure_type='B双平台式',
                    direction='up',
                    current_leg='a4→live 上行推进中',
                    close=151.8,
                    ma55=149.1,
                    ma233=129.8,
                ),
            },
            raw_level_nesting={'summary': '测试推进主语切换'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self.assertEqual(prediction['spacetime_scope']['allowed_candidates'], ['A', 'B'])
        self.assertEqual(prediction['dominant_narrative'], '推进主导')
        self.assertEqual(prediction['primary_candidate']['family'], 'A')
        self.assertEqual(prediction['secondary_candidate']['family'], 'B')

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
                    close=150.2,
                    ma55=150.0,
                    ma233=129.8,
                ),
            },
            raw_level_nesting={'summary': '测试防抖'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self.assertEqual(prediction['primary_candidate']['family'], 'A')
        self.assertEqual(prediction['primary_candidate']['stage'], 'debouncing')
        self.assertFalse(prediction['narrative_switch']['passed'])

    def test_d_candidate_is_only_used_as_fallback_when_abc_fail(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour15',
            normalized_results={
                'hour60': self._period_payload(spacetime_status='中偏弱', structure_type='复杂结构', direction='down'),
                'hour15': self._period_payload(
                    spacetime_status='中偏弱',
                    structure_type='复杂结构',
                    direction='down',
                    current_leg='live 急跌单边推进',
                    close=118.6,
                    ma55=126.1,
                    ma233=134.4,
                ),
            },
            raw_level_nesting={'summary': '测试 D 降级'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self.assertEqual(prediction['fallback_candidate']['family'], 'D')
        self.assertFalse(prediction['exception_interrupt']['enabled'])

    def test_extreme_v_reversal_turns_into_exception_interrupt(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour15',
            normalized_results={
                'hour60': self._period_payload(spacetime_status='极弱', structure_type='复杂结构', direction='down'),
                'hour15': self._period_payload(
                    spacetime_status='极弱',
                    structure_type='复杂结构',
                    direction='up',
                    current_leg='live V反极速反抽',
                    close=137.5,
                    ma55=126.1,
                    ma233=134.4,
                ),
            },
            raw_level_nesting={'summary': '测试 D 异常'},
        )

        self.assertIn('structure_prediction', decision)
        prediction = decision['structure_prediction']
        self.assertTrue(prediction['exception_interrupt']['enabled'])
        self.assertEqual(prediction['primary_candidate']['stage'], 'exception')
