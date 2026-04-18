import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionLevelNestingTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_trinity_level_nesting_allows_upgrade_when_weekly_daily_align(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='daily',
            normalized_results={
                'weekly': {
                    'macd': {'status': '强'},
                    'trinity_decision': {'conclusion': {'bias': 'bullish'}},
                },
                'daily': {
                    'macd': {'status': '强'},
                    'trinity_decision': {'structure': {'type': 'A五段式'}},
                },
            },
            raw_level_nesting={'summary': '周线强 / 日线强'},
        )

        self.assertEqual(decision['parent_level'], 'weekly')
        self.assertEqual(decision['child_level'], 'daily')
        self.assertEqual(decision['resonance'], 'aligned')
        self.assertTrue(decision['permission']['allow_position_increase'])

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
        self.assertIn('父级别缺失', decision['permission']['reason'])
