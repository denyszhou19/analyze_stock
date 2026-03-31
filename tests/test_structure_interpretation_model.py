import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class StructureInterpretationModelTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_structure_interpretation_marks_peak_slice_platform_as_developing(self) -> None:
        interpretation = self.analyzer._build_structure_interpretation(
            structure_type='C单平台式',
            trend_direction='上涨',
            explanation={'structure_start_point_id': 'c1'},
            prediction={'current_stage': 'c3拐点', 'next_stage': 'c4拐点'},
            moving_averages={
                'MA55': 118.57,
                'MA233': 85.61,
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            peak_analysis={
                'is_peak_structure': True,
                'peak_type': 'mountain_peak',
                'peak_price': 209.88,
            },
            labeled_points=[
                {'point_id': 'c1', 'price': 209.88, 'date': '2025-11-14 00:00'},
                {'point_id': 'c2', 'price': 141.10, 'date': '2026-02-06 00:00'},
                {'point_id': 'c3', 'price': 181.99, 'date': '2026-03-20 00:00'},
                {'point_id': 'live', 'price': 163.35, 'date': '2026-03-27 00:00', 'is_current': True},
            ],
            valid_range={
                'start_date': '2022-05-06',
                'start_price': 42.52,
            },
        )

        self.assertEqual(interpretation['macro_background']['label'], '偏多')
        self.assertEqual(interpretation['focus_structure']['focus_mode'], 'peak_slice_right')
        self.assertEqual(interpretation['focus_structure']['maturity'], 'developing')
        self.assertEqual(interpretation['current_leg']['label'], 'c3→live 下行形成中')
        self.assertEqual(interpretation['next_confirmation']['type'], 'pivot')
        self.assertEqual(interpretation['scenario_paths'][0]['code'], 'up_break')

    def test_build_structure_interpretation_uses_mixed_background_when_ma_and_swings_conflict(self) -> None:
        interpretation = self.analyzer._build_structure_interpretation(
            structure_type='A五段式',
            trend_direction='下跌',
            explanation={'structure_start_point_id': 'a1'},
            prediction={'current_stage': 'a3拐点', 'next_stage': 'a4拐点'},
            moving_averages={
                'MA55': 100.0,
                'MA233': 98.0,
                'price_vs_ma55': 'below',
                'price_vs_ma233': 'above',
                'ma_status': '缠绕',
            },
            peak_analysis=None,
            labeled_points=[
                {'point_id': 'a1', 'price': 10.0, 'date': '2024-01-01 00:00'},
                {'point_id': 'a2', 'price': 14.0, 'date': '2024-01-08 00:00'},
                {'point_id': 'a3', 'price': 11.5, 'date': '2024-01-15 00:00'},
                {'point_id': 'live', 'price': 13.2, 'date': '2024-01-22 00:00', 'is_current': True},
            ],
            valid_range=None,
        )

        self.assertEqual(interpretation['macro_background']['direction'], 'mixed')
        self.assertEqual(interpretation['focus_structure']['archetype_family'], 'A')
