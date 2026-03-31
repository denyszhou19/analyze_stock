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

    def test_build_structure_explainability_maps_standard_d_stages(self) -> None:
        line_geometry = {
            "price_range": {"min": 10.0, "max": 14.0, "range": 4.0},
            "points": [
                {"sequence": 0, "price": 10.0, "date": "2024-01-01", "type": "bottom", "role": "from"},
                {"sequence": 1, "price": 13.0, "date": "2024-01-02", "type": "top", "role": "to"},
                {"sequence": 2, "price": 11.0, "date": "2024-01-03", "type": "bottom", "role": "to"},
                {"sequence": 3, "price": 14.0, "date": "2024-01-04", "type": "top", "role": "to"},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "上涨", "length": 1},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "下跌", "length": 1},
                {"sequence": 2, "from_point": 2, "to_point": 3, "direction": "上涨", "length": 1},
            ],
            "point_count": 4,
            "segment_count": 3,
        }
        prediction = {
            "current_stage": "d3拐点",
            "next_stage": "d4拐点（结构完成）",
        }

        labeled_geometry, explainability = self.analyzer._build_structure_explainability(
            "D三段式",
            line_geometry,
            prediction,
            peak_analysis={},
        )

        self.assertEqual(explainability["structure_family"], "D")
        self.assertEqual(explainability["structure_start_point_id"], "d1")
        self.assertEqual(explainability["current_point_id"], "d3")
        self.assertEqual(explainability["current_segment"]["label"], "d2→d3")
        self.assertEqual(explainability["next_segment_preview"]["label"], "d3→d4")
        self.assertEqual(labeled_geometry["points"][0]["point_id"], "d1")
        self.assertEqual(labeled_geometry["segments"][2]["segment_id"], "d3-d4")

    def test_build_structure_explainability_falls_back_for_complex_structure(self) -> None:
        line_geometry = {
            "price_range": {"min": 8.0, "max": 12.0, "range": 4.0},
            "points": [
                {"sequence": 0, "price": 12.0, "date": "2024-01-01", "type": "top", "role": "from"},
                {"sequence": 1, "price": 9.0, "date": "2024-01-02", "type": "bottom", "role": "to"},
                {"sequence": 2, "price": 11.0, "date": "2024-01-03", "type": "top", "role": "to"},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "下跌", "length": 1},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "上涨", "length": 1},
            ],
            "point_count": 3,
            "segment_count": 2,
        }
        prediction = {
            "current_stage": "第3个拐点",
            "next_stage": "结构完成，等待方向选择",
        }

        labeled_geometry, explainability = self.analyzer._build_structure_explainability(
            "复杂结构",
            line_geometry,
            prediction,
            peak_analysis={},
        )

        self.assertEqual(explainability["structure_family"], "complex")
        self.assertEqual(explainability["structure_start_point_id"], "p1")
        self.assertEqual(explainability["current_point_id"], "p3")
        self.assertIsNone(explainability["next_segment_preview"])
        self.assertTrue(explainability["display_reason"])
        self.assertEqual(labeled_geometry["segments"][0]["segment_id"], "p1-p2")

    def test_build_structure_explainability_projects_standard_next_point_not_in_geometry(self) -> None:
        line_geometry = {
            "price_range": {"min": 10.0, "max": 14.0, "range": 4.0},
            "points": [
                {"sequence": 0, "price": 10.0, "date": "2024-01-01", "type": "bottom", "role": "from"},
                {"sequence": 1, "price": 13.0, "date": "2024-01-02", "type": "top", "role": "to"},
                {"sequence": 2, "price": 11.0, "date": "2024-01-03", "type": "bottom", "role": "to"},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "上涨", "length": 1},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "下跌", "length": 1},
            ],
            "point_count": 3,
            "segment_count": 2,
        }
        prediction = {
            "current_stage": "d3拐点",
            "next_stage": "d4拐点（结构完成）",
        }

        _, explainability = self.analyzer._build_structure_explainability(
            "D三段式",
            line_geometry,
            prediction,
            peak_analysis={},
        )

        self.assertEqual(explainability["current_point_id"], "d3")
        self.assertIsNotNone(explainability["next_segment_preview"])
        self.assertEqual(explainability["next_segment_preview"]["label"], "d3→d4")

    def test_build_structure_explainability_uses_override_start_anchor_for_peak_slice(self) -> None:
        line_geometry = {
            "price_range": {"min": 9.0, "max": 15.0, "range": 6.0},
            "points": [
                {"sequence": 0, "price": 9.0, "date": "2024-01-01", "type": "bottom", "role": "from"},
                {"sequence": 1, "price": 13.0, "date": "2024-01-02", "type": "top", "role": "to"},
                {"sequence": 2, "price": 11.0, "date": "2024-01-03", "type": "bottom", "role": "to"},
                {"sequence": 3, "price": 15.0, "date": "2024-01-04", "type": "top", "role": "to"},
                {"sequence": 4, "price": 10.0, "date": "2024-01-05", "type": "bottom", "role": "to"},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "上涨", "length": 1},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "下跌", "length": 1},
                {"sequence": 2, "from_point": 2, "to_point": 3, "direction": "上涨", "length": 1},
                {"sequence": 3, "from_point": 3, "to_point": 4, "direction": "下跌", "length": 1},
            ],
            "point_count": 5,
            "segment_count": 4,
        }
        prediction = {
            "current_stage": "d2拐点",
            "next_stage": "d3拐点",
        }

        labeled_geometry, explainability = self.analyzer._build_structure_explainability(
            "D三段式",
            line_geometry,
            prediction,
            peak_analysis={"is_peak_structure": True},
            structure_start_point_index=2,
        )

        self.assertEqual(explainability["structure_start_point_id"], "d1")
        self.assertEqual(explainability["current_point_id"], "d2")
        self.assertEqual(explainability["current_segment"]["label"], "d1→d2")
        self.assertEqual(explainability["next_segment_preview"]["label"], "d2→d3")
        self.assertFalse(labeled_geometry["points"][0]["point_id"].startswith("d"))
        self.assertFalse(labeled_geometry["points"][1]["point_id"].startswith("d"))
        point_label_map = {item["point_id"]: item for item in explainability["point_labels"]}
        self.assertEqual(point_label_map[labeled_geometry["points"][0]["point_id"]]["label"], "")
        self.assertEqual(point_label_map[labeled_geometry["points"][1]["point_id"]]["label"], "")

    def test_build_structure_explainability_limits_visible_labels_for_complex_structure(self) -> None:
        line_geometry = {
            "price_range": {"min": 8.0, "max": 12.0, "range": 4.0},
            "points": [
                {"sequence": 0, "price": 12.0, "date": "2024-01-01", "type": "top", "role": "from"},
                {"sequence": 1, "price": 9.0, "date": "2024-01-02", "type": "bottom", "role": "to"},
                {"sequence": 2, "price": 11.0, "date": "2024-01-03", "type": "top", "role": "to"},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "下跌", "length": 1},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "上涨", "length": 1},
            ],
            "point_count": 3,
            "segment_count": 2,
        }
        prediction = {
            "current_stage": "第3个拐点",
            "next_stage": "结构完成，等待方向选择",
        }

        _, explainability = self.analyzer._build_structure_explainability(
            "复杂结构",
            line_geometry,
            prediction,
            peak_analysis={},
        )

        point_labels = {item["point_id"]: item["label"] for item in explainability["point_labels"]}
        self.assertEqual(point_labels["p1"], "p1")
        self.assertEqual(point_labels["p3"], "p3")
        self.assertEqual(point_labels["p2"], "")

        non_empty_segment_labels = [item for item in explainability["segment_labels"] if item["label"]]
        self.assertEqual(len(non_empty_segment_labels), 1)
        self.assertEqual(non_empty_segment_labels[0]["label"], "p2→p3")

    def test_analyze_structure_prediction_uses_completion_stage_for_d_with_four_inflections(self) -> None:
        recent = pd.DataFrame(
            [{"close": 10.0, "high": 10.5, "low": 9.5}]
        )
        prediction = self.analyzer._analyze_structure_prediction(
            structure_type="D三段式",
            stroke_count=3,
            inflection_count=4,
            strokes=[
                {"direction": "上涨", "from_price": 9.0, "to_price": 12.0},
                {"direction": "下跌", "from_price": 12.0, "to_price": 10.0},
                {"direction": "上涨", "from_price": 10.0, "to_price": 13.0},
            ],
            valid_fractals=[
                {"type": "bottom", "high": 10.2, "low": 9.0},
                {"type": "top", "high": 12.0, "low": 10.8},
                {"type": "bottom", "high": 11.1, "low": 9.7},
                {"type": "top", "high": 12.4, "low": 10.9},
            ],
            trend_direction="上涨",
            recent=recent,
            macd_status="中偏强",
        )

        self.assertEqual(prediction["current_stage"], "d4拐点")
        self.assertEqual(prediction["next_stage"], "结构完成，等待方向选择")

    def test_build_structure_explainability_suppresses_next_preview_when_d_completion_state(self) -> None:
        recent = pd.DataFrame(
            [{"close": 10.0, "high": 10.5, "low": 9.5}]
        )
        prediction = self.analyzer._analyze_structure_prediction(
            structure_type="D三段式",
            stroke_count=3,
            inflection_count=4,
            strokes=[
                {"direction": "上涨", "from_price": 9.0, "to_price": 12.0},
                {"direction": "下跌", "from_price": 12.0, "to_price": 10.0},
                {"direction": "上涨", "from_price": 10.0, "to_price": 13.0},
            ],
            valid_fractals=[
                {"type": "bottom", "high": 10.2, "low": 9.0},
                {"type": "top", "high": 12.0, "low": 10.8},
                {"type": "bottom", "high": 11.1, "low": 9.7},
                {"type": "top", "high": 12.4, "low": 10.9},
            ],
            trend_direction="上涨",
            recent=recent,
            macd_status="中偏强",
        )
        line_geometry = {
            "price_range": {"min": 9.0, "max": 13.0, "range": 4.0},
            "points": [
                {"sequence": 0, "price": 9.0, "date": "2024-01-01", "type": "bottom", "role": "from"},
                {"sequence": 1, "price": 12.0, "date": "2024-01-02", "type": "top", "role": "to"},
                {"sequence": 2, "price": 10.0, "date": "2024-01-03", "type": "bottom", "role": "to"},
                {"sequence": 3, "price": 13.0, "date": "2024-01-04", "type": "top", "role": "to"},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "上涨", "length": 1},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "下跌", "length": 1},
                {"sequence": 2, "from_point": 2, "to_point": 3, "direction": "上涨", "length": 1},
            ],
            "point_count": 4,
            "segment_count": 3,
        }

        _, explainability = self.analyzer._build_structure_explainability(
            "D三段式",
            line_geometry,
            prediction,
            peak_analysis={},
        )

        self.assertEqual(prediction["next_stage"], "结构完成，等待方向选择")
        self.assertIsNone(explainability["next_segment_preview"])

    def test_resolve_peak_structure_start_point_index_maps_to_segment_to_point_when_peak_at_to_endpoint(self) -> None:
        line_geometry = {
            "points": [
                {"sequence": 0, "price": 9.0},
                {"sequence": 1, "price": 12.0},
                {"sequence": 2, "price": 10.0},
                {"sequence": 3, "price": 15.0},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "from_price": 9.0, "to_price": 12.0},
                {"sequence": 1, "from_point": 1, "to_point": 2, "from_price": 12.0, "to_price": 10.0},
                {"sequence": 2, "from_point": 2, "to_point": 3, "from_price": 10.0, "to_price": 15.0},
            ],
        }
        peak_analysis = {"is_peak_structure": True, "peak_index": 2, "peak_price": 15.0}

        start_index = self.analyzer._resolve_peak_structure_start_point_index(
            line_geometry,
            peak_analysis,
        )

        self.assertEqual(start_index, 3)

    def test_resolve_peak_structure_start_point_index_maps_to_segment_from_point_when_peak_at_from_endpoint(self) -> None:
        line_geometry = {
            "points": [
                {"sequence": 0, "price": 9.0},
                {"sequence": 1, "price": 14.0},
                {"sequence": 2, "price": 11.0},
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "from_price": 9.0, "to_price": 14.0},
                {"sequence": 1, "from_point": 1, "to_point": 2, "from_price": 14.0, "to_price": 11.0},
            ],
        }
        peak_analysis = {"is_peak_structure": True, "peak_index": 1, "peak_price": 14.0}

        start_index = self.analyzer._resolve_peak_structure_start_point_index(
            line_geometry,
            peak_analysis,
        )

        self.assertEqual(start_index, 1)


if __name__ == "__main__":
    unittest.main()
