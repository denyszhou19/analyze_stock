import math
import unittest

import pandas as pd

from scripts.stock_analyzer import TrinityStockAnalyzer


def build_wave_dataframe() -> pd.DataFrame:
    rows = []
    for i in range(80):
        close = 100 + i * 0.1 + math.sin(i / 3) * 8
        high = close + 1.5 + (0.5 if i % 2 == 0 else 0)
        low = close - 1.5 - (0.5 if i % 2 else 0)
        rows.append(
            {
                "date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=i),
                "open": close - 0.3,
                "high": high,
                "low": low,
                "close": close,
                "volume": 1000 + i,
                "MA55": 100,
                "DIF": 0.1 if i < 40 else -0.1,
                "DEA": -0.1 if i < 40 else 0.1,
            }
        )
    return pd.DataFrame(rows)


class TestStockAnalyzerRenderPayload(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()
        self.df = build_wave_dataframe()

    def test_detect_structure_exposes_svg_ready_render_payload(self) -> None:
        result = self.analyzer.detect_structure(self.df)

        details = result["structure_details"]
        self.assertIn("render_payload", details)

        payload = details["render_payload"]
        self.assertEqual(payload["viewport"]["width"], 400)
        self.assertEqual(payload["viewport"]["height"], 200)
        self.assertEqual(len(payload["points"]), details["line_geometry"]["point_count"])
        self.assertEqual(len(payload["segments"]), details["line_geometry"]["segment_count"])

        self.assertTrue(payload["points"][0]["show_date_label"])
        self.assertTrue(payload["points"][-1]["show_date_label"])
        self.assertEqual(payload["points"][-1]["type"], "current")

    def test_render_payload_marks_current_segment_and_marker_styles(self) -> None:
        result = self.analyzer.detect_structure(self.df)

        details = result["structure_details"]
        self.assertIn("render_payload", details)

        payload = details["render_payload"]
        current_segments = [segment for segment in payload["segments"] if segment["is_current"]]
        self.assertEqual(len(current_segments), 1)
        self.assertEqual(current_segments[0]["stroke_dasharray"], "4,2")

        top_points = [point for point in payload["points"] if point["type"] == "top"]
        bottom_points = [point for point in payload["points"] if point["type"] == "bottom"]
        self.assertTrue(all(point["marker_fill"] == "#ef4444" for point in top_points))
        self.assertTrue(all(point["marker_fill"] == "#22c55e" for point in bottom_points))

    def test_render_payload_current_point_uses_latest_close_price(self) -> None:
        result = self.analyzer.detect_structure(self.df)

        payload = result["structure_details"]["render_payload"]
        latest_close = round(float(self.df.iloc[-1]["close"]), 2)

        self.assertEqual(payload["points"][-1]["type"], "current")
        self.assertEqual(payload["points"][-1]["price"], latest_close)

    def test_append_current_render_stroke_uses_latest_close_after_top(self) -> None:
        stroke_list = []
        render_fractals = [
            {"index": 0, "type": "top", "high": 12.5, "low": 11.6, "date": "2024-01-07 00:00:00"},
        ]
        processed_df = pd.DataFrame(
            [
                {"date": pd.Timestamp("2024-01-07"), "high": 12.5, "low": 11.6, "close": 12.1},
                {"date": pd.Timestamp("2024-01-08"), "high": 12.9, "low": 11.2, "close": 11.8},
            ]
        )

        self.analyzer._append_current_render_stroke(stroke_list, render_fractals, processed_df)

        self.assertEqual(len(stroke_list), 1)
        self.assertEqual(stroke_list[0]["direction"], "下跌")
        self.assertEqual(stroke_list[0]["to_price"], 11.8)

    def test_append_current_render_stroke_uses_latest_close_after_bottom(self) -> None:
        stroke_list = []
        render_fractals = [
            {"index": 0, "type": "bottom", "high": 9.6, "low": 8.4, "date": "2024-01-07 00:00:00"},
        ]
        processed_df = pd.DataFrame(
            [
                {"date": pd.Timestamp("2024-01-07"), "high": 9.6, "low": 8.4, "close": 8.9},
                {"date": pd.Timestamp("2024-01-08"), "high": 10.5, "low": 8.8, "close": 10.1},
            ]
        )

        self.analyzer._append_current_render_stroke(stroke_list, render_fractals, processed_df)

        self.assertEqual(len(stroke_list), 1)
        self.assertEqual(stroke_list[0]["direction"], "上涨")
        self.assertEqual(stroke_list[0]["to_price"], 10.1)


if __name__ == "__main__":
    unittest.main()
