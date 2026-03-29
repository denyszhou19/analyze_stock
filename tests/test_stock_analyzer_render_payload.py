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


if __name__ == "__main__":
    unittest.main()
