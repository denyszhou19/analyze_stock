import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionOriginsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_background_origin_outside_window_does_not_map_to_first_visible_point(self) -> None:
        structure = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': '复杂结构',
                'trend_direction': '下跌',
                'description': '复杂结构等待确认',
                'interpretation': {
                    'focus_structure': {
                        'reference_origin': {
                            'price': 76.66,
                            'date': '2025-07-14 00:00:00',
                        },
                        'start_anchor_source': 'macro_origin',
                    },
                },
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'macro_origin',
                        'selected_point_index': None,
                        'explainability_reason': '当前窗口未包含该原点',
                    },
                },
            }
        )

        self.assertEqual(structure['background_origin']['date'], '2025-07-14 00:00:00')
        self.assertEqual(structure['background_origin']['source'], 'macro_origin')
        self.assertIsNone(structure['focus_origin'])

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
