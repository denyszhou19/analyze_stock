import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionOriginsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_focus_origin_prefers_peak_extreme_then_recent_component_then_macro_origin(self) -> None:
        structure = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': 'C单平台式',
                'trend_direction': '震荡',
                'description': '峰值切片后的右侧聚焦结构',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'start_anchor': {'point_id': 'p7', 'price': 209.88, 'date': '2025-11-14'},
                        'start_anchor_source': 'peak_extreme',
                    },
                },
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'peak_extreme',
                        'selected_point_index': 7,
                        'explainability_status': 'passed',
                        'explainability_reason': '主峰切片优先',
                    },
                    'raw_classification': {
                        'type': '延伸C类',
                        'macro_origin': {
                            'price': 168.7,
                            'date': '2025-09-29',
                            'point_index': 0,
                            'outside_window': False,
                        },
                    },
                    'focus_classification': {'type': 'C单平台式', 'standard_qualification': 'standard'},
                    'explainability': {
                        'structure_start_point_id': 'p7',
                        'current_point_id': 'p12',
                        'display_reason': '标准结构从聚焦起点重新编号',
                    },
                },
            }
        )

        self.assertEqual(structure['focus_origin']['source'], 'peak_extreme')
        self.assertEqual(structure['focus_origin']['price'], 209.88)
        self.assertEqual(structure['background_origin']['semantic'], 'background_origin')
        self.assertEqual(structure['execution_origin']['semantic'], 'execution_origin')
        self.assertEqual(structure['type'], 'C单平台式')
        self.assertEqual(structure['explainability']['status'], 'passed')

    def test_background_origin_outside_window_does_not_fall_back_to_first_visible_point(self) -> None:
        payload = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': '延伸C',
                'description': '窗口截断后的聚焦结构',
                'interpretation': {'focus_structure': {}},
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'macro_origin',
                        'selected_point_index': None,
                        'explainability_status': 'downgraded',
                        'explainability_reason': '宏观原点在窗口外，仅保留来源说明',
                    },
                    'raw_classification': {'type': '延伸C类', 'macro_origin': {'outside_window': True}},
                    'focus_classification': {'type': '延伸C', 'standard_qualification': 'extended'},
                },
            }
        )

        self.assertIsNone(payload['background_origin'])
        self.assertIn('窗口外', payload['explainability']['reason'])

    def test_execution_origin_uses_current_point_as_child_anchor(self) -> None:
        structure = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': '延伸C类',
                'trend_direction': '下跌',
                'description': '延伸C类，等待边界确认',
                'interpretation': {
                    'focus_structure': {
                        'start_anchor': {
                            'point_id': 'p1',
                            'price': 209.9,
                            'date': '2024-03-04 00:00:00',
                        },
                        'start_anchor_source': 'peak_extreme',
                    },
                },
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'peak_extreme',
                        'selected_point_index': 3,
                        'explainability_reason': '检测到主峰切片',
                    },
                    'explainability': {
                        'current_point_id': 'p16',
                    },
                },
            }
        )

        self.assertEqual(structure['focus_origin']['point_id'], 'p1')
        self.assertEqual(structure['execution_origin']['point_id'], 'p16')
        self.assertEqual(structure['execution_origin']['semantic'], 'execution_origin')
