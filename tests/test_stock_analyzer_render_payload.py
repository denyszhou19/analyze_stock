import math
import unittest
from unittest.mock import patch

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


def build_focus_origin_recent_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "date": pd.Timestamp("2024-04-30"),
                "open": 176.2,
                "high": 177.4,
                "low": 175.1,
                "close": 176.0,
                "volume": 3200,
                "MA55": 168.5,
                "MA233": 142.3,
                "DIF": -0.2,
                "DEA": -0.1,
            }
        ]
    )


def build_focus_origin_peak_regression_fixture() -> tuple[pd.DataFrame, list[dict], list[dict], list[dict], dict]:
    prices = [
        168.7,
        184.0,
        172.5,
        209.9,
        191.0,
        203.0,
        188.0,
        200.0,
        186.0,
        198.0,
        183.0,
        195.0,
        181.0,
        193.0,
        178.0,
        190.0,
        176.0,
    ]
    valid_fractals = []
    full_strokes = []
    for index, price in enumerate(prices):
        valid_fractals.append(
            {
                "index": index,
                "type": "bottom" if index % 2 == 0 else "top",
                "high": round(price + 1.8, 2),
                "low": round(price - 1.8, 2),
                "date": f"2024-03-{index + 1:02d}",
            }
        )

    for index, (from_price, to_price) in enumerate(zip(prices, prices[1:])):
        from_fractal = valid_fractals[index]
        to_fractal = valid_fractals[index + 1]
        direction = "上涨" if to_price > from_price else "下跌"
        full_strokes.append(
            {
                "from_date": f"2024-03-{index + 1:02d}",
                "to_date": f"2024-03-{index + 2:02d}",
                "from_price": from_price,
                "to_price": to_price,
                "direction": direction,
                "length": 1,
                "from_type": from_fractal["type"],
                "to_type": to_fractal["type"],
            }
        )

    peak_analysis = {
        "is_peak_structure": True,
        "peak_type": "mountain_peak",
        "peak_price": 209.9,
        "peak_index": 2,
        "left_structure": "上涨结构",
        "right_structure": "A五段式",
        "left_components": [{"type": "上涨结构", "strokes": [{}, {}, {}]}],
        "right_components": [{"type": "延伸下跌", "strokes": [{} for _ in range(13)]}],
    }

    return (
        build_focus_origin_recent_dataframe(),
        full_strokes,
        valid_fractals,
        [dict(stroke) for stroke in full_strokes],
        peak_analysis,
    )


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
            focus_origin_source="macro_origin",
        )

        self.assertEqual(explainability["structure_family"], "complex")
        self.assertIsNone(explainability["structure_start_point_id"])
        self.assertEqual(explainability["current_point_id"], "p3")
        self.assertIsNone(explainability["next_segment_preview"])
        self.assertTrue(explainability["display_reason"])
        self.assertEqual(labeled_geometry["segments"][0]["segment_id"], "p1-p2")
        point_roles = {item["point_id"]: item["role"] for item in explainability["point_labels"]}
        self.assertNotIn("start", point_roles.values())

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
        allowed_point_roles = {"start", "current", "normal", "projected"}
        allowed_segment_roles = {"current", "projected", "normal"}
        self.assertTrue(all(item["role"] in allowed_point_roles for item in explainability["point_labels"]))
        self.assertTrue(all(item["role"] in allowed_segment_roles for item in explainability["segment_labels"]))

    def test_build_structure_explainability_uses_live_for_unconfirmed_tail(self) -> None:
        line_geometry = {
            "price_range": {"min": 10.0, "max": 14.0, "range": 4.0},
            "points": [
                {"sequence": 0, "price": 10.0, "date": "2024-01-01", "type": "bottom", "role": "from"},
                {"sequence": 1, "price": 13.0, "date": "2024-01-02", "type": "top", "role": "to"},
                {"sequence": 2, "price": 11.0, "date": "2024-01-03", "type": "bottom", "role": "to"},
                {
                    "sequence": 3,
                    "price": 12.4,
                    "date": "2024-01-04",
                    "type": "current",
                    "role": "to",
                    "is_current": True,
                },
            ],
            "segments": [
                {"sequence": 0, "from_point": 0, "to_point": 1, "direction": "上涨", "length": 1},
                {"sequence": 1, "from_point": 1, "to_point": 2, "direction": "下跌", "length": 1},
                {
                    "sequence": 2,
                    "from_point": 2,
                    "to_point": 3,
                    "direction": "上涨",
                    "length": 1,
                    "is_current": True,
                },
            ],
            "point_count": 4,
            "segment_count": 3,
        }

        labeled_geometry, explainability = self.analyzer._build_structure_explainability(
            "D三段式",
            line_geometry,
            {"current_stage": "d3拐点", "next_stage": "d4拐点"},
            peak_analysis={},
        )

        self.assertEqual(labeled_geometry["points"][-1]["point_id"], "live")
        self.assertEqual(explainability["current_point_id"], "d3")
        self.assertEqual(explainability["current_segment"]["label"], "d3→live")
        self.assertEqual(explainability["next_segment_preview"]["to_point_id"], "d4")

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
        self.assertEqual(point_labels["p1"], "")
        self.assertEqual(point_labels["p3"], "")
        self.assertEqual(point_labels["p2"], "")

        non_empty_segment_labels = [item for item in explainability["segment_labels"] if item["label"]]
        self.assertEqual(len(non_empty_segment_labels), 1)
        self.assertEqual(non_empty_segment_labels[0]["label"], "p2→p3")

    def test_validate_focus_structure_explainability_keeps_limit_check_out_of_origin_validation(self) -> None:
        verdict = self.analyzer._validate_focus_structure_explainability(
            "A五段式",
            14,
            {
                "explainability_status": "passed",
                "explainability_reason": "检测到主峰切片，优先从峰值极点开始解释右侧结构",
            },
        )

        self.assertTrue(verdict["passed"])
        self.assertEqual(verdict["status"], "passed")
        self.assertEqual(verdict["reason"], "检测到主峰切片，优先从峰值极点开始解释右侧结构")

    def test_build_structure_explainability_carries_focus_origin_metadata(self) -> None:
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

        _, explainability = self.analyzer._build_structure_explainability(
            "复杂结构",
            line_geometry,
            {"current_stage": "第3个拐点", "next_stage": "等待确认"},
            peak_analysis={"is_peak_structure": True},
            focus_origin_source="peak_extreme",
            explainability_status="downgraded",
            downgrade_reason="超出标准点数上限，降级为复杂结构等待确认",
        )

        self.assertEqual(explainability["focus_origin_source"], "peak_extreme")
        self.assertEqual(explainability["explainability_status"], "downgraded")
        self.assertIn("标准点数上限", explainability["downgrade_reason"])

    def test_build_focus_origin_analysis_does_not_map_macro_origin_to_window_first_point(self) -> None:
        line_geometry = {
            "points": [
                {"sequence": 0, "price": 168.7, "date": "2025-09-29 00:00:00"},
                {"sequence": 1, "price": 135.2, "date": "2025-10-17 00:00:00"},
                {"sequence": 2, "price": 209.9, "date": "2025-11-14 00:00:00"},
            ]
        }

        focus_origin_analysis = self.analyzer._build_focus_origin_analysis(
            valid_range={
                "start_date": "2025-07-14",
                "start_price": 76.66,
                "origin_type": "low",
            },
            line_geometry=line_geometry,
            peak_analysis=None,
        )

        self.assertEqual(focus_origin_analysis["selected_origin_kind"], "macro_origin")
        self.assertIsNone(focus_origin_analysis["selected_point_index"])
        self.assertIn("当前窗口未包含该原点", focus_origin_analysis["explainability_reason"])

    def test_build_focus_origin_analysis_prefers_recent_component_boundary_when_no_peak(self) -> None:
        line_geometry = {
            "points": [
                {"sequence": 0, "price": 90.0, "date": "2025-09-01 00:00:00"},
                {"sequence": 1, "price": 110.0, "date": "2025-09-10 00:00:00"},
                {"sequence": 2, "price": 102.0, "date": "2025-09-18 00:00:00"},
                {"sequence": 3, "price": 108.0, "date": "2025-09-25 00:00:00"},
            ]
        }

        focus_origin_analysis = self.analyzer._build_focus_origin_analysis(
            valid_range={
                "start_date": "2025-07-14",
                "start_price": 76.66,
                "origin_type": "low",
            },
            line_geometry=line_geometry,
            peak_analysis=None,
            macro_components=[
                {
                    "type": "Directional",
                    "strokes": [
                        {"from_date": "2025-09-01 00:00:00", "from_price": 90.0},
                    ],
                },
                {
                    "type": "Platform",
                    "strokes": [
                        {"from_date": "2025-09-10 00:00:00", "from_price": 110.0},
                    ],
                },
                {
                    "type": "Directional",
                    "strokes": [
                        {"from_date": "2025-09-18 00:00:00", "from_price": 102.0},
                    ],
                },
            ],
        )

        self.assertEqual(focus_origin_analysis["selected_origin_kind"], "recent_component")
        self.assertEqual(focus_origin_analysis["selected_point_index"], 1)
        self.assertIn("最近平台起点", focus_origin_analysis["explainability_reason"])

    def test_build_numbering_explainability_restarts_numbering_for_standard_focus_structure(self) -> None:
        explainability = self.analyzer._build_numbering_explainability(
            {
                "type": "C单平台式",
                "standard_qualification": "standard",
            },
            {
                "display_reason": "标准结构从聚焦起点重新编号",
            },
        )

        self.assertEqual(explainability["status"], "passed")
        self.assertEqual(explainability["reason"], "标准结构从聚焦起点重新编号")
        self.assertIn("结构编号从当前结构起点重新开始", explainability["evidence"])

    def test_build_numbering_explainability_stops_standard_labels_for_extended_structure(self) -> None:
        explainability = self.analyzer._build_numbering_explainability(
            {
                "type": "延伸C",
                "standard_qualification": "extended",
            },
            {},
        )

        self.assertEqual(explainability["status"], "downgraded")
        self.assertIn("停止标准 A/B/C/D 编号", explainability["evidence"])
        self.assertIn("非标准结构停止标准编号", explainability["reason"])

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

    def test_detect_structure_uses_peak_focus_context_for_prediction_and_explainability(self) -> None:
        recent = pd.DataFrame(
            [
                {
                    "date": pd.Timestamp("2024-03-01"),
                    "close": 11.0,
                    "high": 11.3,
                    "low": 10.7,
                    "open": 10.9,
                }
            ]
        )
        full_strokes = [
            {"from_date": "2024-01-01", "to_date": "2024-01-02", "from_price": 10.0, "to_price": 12.0, "direction": "上涨", "length": 1, "from_type": "bottom", "to_type": "top"},
            {"from_date": "2024-01-02", "to_date": "2024-01-03", "from_price": 12.0, "to_price": 11.0, "direction": "下跌", "length": 1, "from_type": "top", "to_type": "bottom"},
            {"from_date": "2024-01-03", "to_date": "2024-01-04", "from_price": 11.0, "to_price": 14.0, "direction": "上涨", "length": 1, "from_type": "bottom", "to_type": "top"},
            {"from_date": "2024-01-04", "to_date": "2024-01-05", "from_price": 14.0, "to_price": 12.0, "direction": "下跌", "length": 1, "from_type": "top", "to_type": "bottom"},
            {"from_date": "2024-01-05", "to_date": "2024-01-06", "from_price": 12.0, "to_price": 13.0, "direction": "上涨", "length": 1, "from_type": "bottom", "to_type": "top"},
            {"from_date": "2024-01-06", "to_date": "2024-01-07", "from_price": 13.0, "to_price": 11.0, "direction": "下跌", "length": 1, "from_type": "top", "to_type": "bottom"},
        ]
        valid_fractals = [
            {"index": 0, "type": "bottom", "high": 10.4, "low": 9.8, "date": "2024-01-01"},
            {"index": 1, "type": "top", "high": 12.0, "low": 11.1, "date": "2024-01-02"},
            {"index": 2, "type": "bottom", "high": 11.2, "low": 10.8, "date": "2024-01-03"},
            {"index": 3, "type": "top", "high": 14.0, "low": 13.1, "date": "2024-01-04"},
            {"index": 4, "type": "bottom", "high": 12.2, "low": 11.7, "date": "2024-01-05"},
            {"index": 5, "type": "top", "high": 13.0, "low": 12.4, "date": "2024-01-06"},
            {"index": 6, "type": "bottom", "high": 11.3, "low": 10.9, "date": "2024-01-07"},
        ]

        class StubMacroComponent:
            def __init__(self, component_type: str, strokes_count: int) -> None:
                self.component_type = component_type
                self.strokes_count = strokes_count

            def to_dict(self) -> dict:
                return {
                    "type": self.component_type,
                    "strokes": [{} for _ in range(self.strokes_count)],
                }

        pipeline = {
            "actual_lookback": len(recent),
            "recent": recent,
            "trend_direction": "上涨",
            "valid_range_info": None,
            "processed_df": recent,
            "top_fractals": [],
            "bottom_fractals": [],
            "validated_fractals": valid_fractals,
            "final_fractals": valid_fractals,
            "strokes": full_strokes,
            "valid_fractals": valid_fractals,
            "stroke_list": full_strokes,
        }
        macro_components = [
            StubMacroComponent("上涨结构", 3),
            StubMacroComponent("单平台", 3),
        ]
        peak_analysis = {
            "is_peak_structure": True,
            "peak_type": "mountain_peak",
            "peak_price": 14.0,
            "peak_index": 2,
            "left_structure": "上涨结构",
            "right_structure": "C单平台式",
            "left_components": [{"type": "上涨结构", "strokes": [{}, {}, {}]}],
            "right_components": [{"type": "单平台", "strokes": [{}, {}, {}]}],
        }

        with patch.object(self.analyzer, "_run_structure_pipeline", return_value=pipeline), \
             patch.object(self.analyzer, "_consolidate_boxes", return_value=macro_components), \
             patch.object(
                 self.analyzer,
                 "_classify_structure_by_macro_components",
                 return_value=("A五段式", "a1-a6拐点区间", "左侧原始结构", ["mocked classification"]),
             ), \
             patch.object(self.analyzer, "_analyze_peak_structure", return_value=peak_analysis):
            result = self.analyzer.detect_structure(self.df, macd_status="中偏强")

        self.assertEqual(result["structure_type"], "C单平台式")
        self.assertEqual(result["inflection_points"], 4)
        self.assertEqual(result["segment_count"], 3)
        self.assertEqual(result["structure_details"]["prediction"]["current_stage"], "c4拐点")
        self.assertEqual(result["structure_details"]["prediction"]["next_stage"], "c5拐点")
        self.assertEqual(
            result["structure_details"]["explainability"]["structure_start_point_id"],
            "c1",
        )
        self.assertEqual(
            result["structure_details"]["explainability"]["current_point_id"],
            "c4",
        )
        self.assertEqual(
            result["structure_details"]["explainability"]["next_segment_preview"]["label"],
            "c4→c5",
        )

    def test_detect_structure_aligns_peak_focus_between_confirmed_and_render_spaces(self) -> None:
        recent = pd.DataFrame(
            [
                {
                    "date": pd.Timestamp("2024-04-01"),
                    "close": 18.0,
                    "high": 18.4,
                    "low": 17.6,
                    "open": 17.9,
                }
            ]
        )

        full_strokes = []
        valid_fractals = []
        for i in range(19):
            valid_fractals.append(
                {
                    "index": i,
                    "type": "bottom" if i % 2 == 0 else "top",
                    "high": 20.0 + i,
                    "low": 19.0 + i,
                    "date": f"2024-02-{i + 1:02d}",
                }
            )
        for i in range(18):
            full_strokes.append(
                {
                    "from_date": f"2024-02-{i + 1:02d}",
                    "to_date": f"2024-02-{i + 2:02d}",
                    "from_price": round(20.0 + i, 2),
                    "to_price": round(20.6 + i, 2),
                    "direction": "上涨" if i % 2 == 0 else "下跌",
                    "length": 1,
                    "from_type": "bottom" if i % 2 == 0 else "top",
                    "to_type": "top" if i % 2 == 0 else "bottom",
                }
            )

        render_confirmed = [dict(stroke) for stroke in full_strokes[-15:]]
        current_stroke = {
            "from_date": "2024-02-18",
            "to_date": "2024-04-01",
            "from_price": 37.0,
            "to_price": 38.0,
            "direction": "上涨",
            "length": 1,
            "from_type": "bottom",
            "to_type": "current",
            "is_current": True,
        }
        stroke_list = render_confirmed + [current_stroke]

        class StubMacroComponent:
            def __init__(self, component_type: str, strokes_count: int) -> None:
                self.component_type = component_type
                self.strokes_count = strokes_count

            def to_dict(self) -> dict:
                return {
                    "type": self.component_type,
                    "strokes": [{} for _ in range(self.strokes_count)],
                }

        pipeline = {
            "actual_lookback": len(recent),
            "recent": recent,
            "trend_direction": "上涨",
            "valid_range_info": None,
            "processed_df": recent,
            "top_fractals": [],
            "bottom_fractals": [],
            "validated_fractals": valid_fractals,
            "final_fractals": valid_fractals,
            "strokes": full_strokes,
            "valid_fractals": valid_fractals,
            "stroke_list": stroke_list,
        }
        macro_components = [
            StubMacroComponent("上涨结构", 8),
            StubMacroComponent("单平台", 10),
        ]
        peak_analysis = {
            "is_peak_structure": True,
            "peak_type": "mountain_peak",
            "peak_price": render_confirmed[11]["to_price"],
            "peak_index": 11,
            "left_structure": "上涨结构",
            "right_structure": "C单平台式",
            "left_components": [{"type": "上涨结构", "strokes": [{} for _ in range(8)]}],
            "right_components": [{"type": "单平台", "strokes": [{}, {}, {}]}],
        }

        with patch.object(self.analyzer, "_run_structure_pipeline", return_value=pipeline), \
             patch.object(self.analyzer, "_consolidate_boxes", return_value=macro_components), \
             patch.object(
                 self.analyzer,
                 "_classify_structure_by_macro_components",
                 return_value=("A五段式", "a1-a6拐点区间", "左侧原始结构", ["mocked classification"]),
             ), \
             patch.object(self.analyzer, "_analyze_peak_structure", return_value=peak_analysis):
            result = self.analyzer.detect_structure(self.df, macd_status="中偏强")

        self.assertEqual(result["structure_type"], "C单平台式")
        self.assertEqual(result["segment_count"], 3)
        self.assertEqual(result["inflection_points"], 4)
        self.assertEqual(result["structure_details"]["prediction"]["current_stage"], "c4拐点")
        self.assertEqual(result["structure_details"]["prediction"]["next_stage"], "c5拐点")
        self.assertEqual(
            result["structure_details"]["explainability"]["structure_start_point_id"],
            "c1",
        )
        self.assertEqual(
            result["structure_details"]["explainability"]["current_point_id"],
            "c4",
        )
        self.assertEqual(
            result["structure_details"]["explainability"]["next_segment_preview"]["label"],
            "c4→c5",
        )

    def test_detect_structure_marks_over_limit_peak_slice_as_extended_family_and_preserves_raw_classification(self) -> None:
        recent, full_strokes, valid_fractals, stroke_list, peak_analysis = (
            build_focus_origin_peak_regression_fixture()
        )

        class StubMacroComponent:
            def __init__(self, component_type: str, strokes_count: int) -> None:
                self.component_type = component_type
                self.strokes_count = strokes_count

            def to_dict(self) -> dict:
                return {
                    "type": self.component_type,
                    "strokes": [{} for _ in range(self.strokes_count)],
                }

        pipeline = {
            "actual_lookback": len(recent),
            "recent": recent,
            "trend_direction": "下跌",
            "valid_range_info": {
                "start_date": "2024-03-01",
                "end_date": "2024-04-30",
                "start_price": 168.7,
                "origin_type": "high",
            },
            "processed_df": recent,
            "top_fractals": [],
            "bottom_fractals": [],
            "validated_fractals": valid_fractals,
            "final_fractals": valid_fractals,
            "strokes": full_strokes,
            "valid_fractals": valid_fractals,
            "stroke_list": stroke_list,
        }
        macro_components = [
            StubMacroComponent("上涨结构", 3),
            StubMacroComponent("延伸下跌", 13),
        ]

        with patch.object(self.analyzer, "_run_structure_pipeline", return_value=pipeline), \
             patch.object(self.analyzer, "_consolidate_boxes", return_value=macro_components), \
             patch.object(
                 self.analyzer,
                 "_classify_structure_by_macro_components",
                 return_value=("A五段式", "a1-a6拐点区间", "旧的标准结构结果", ["mocked classification"]),
             ), \
             patch.object(self.analyzer, "_analyze_peak_structure", return_value=peak_analysis):
            result = self.analyzer.detect_structure(self.df, macd_status="中偏强")

        self.assertEqual(result["structure_type"], "延伸A类")
        self.assertEqual(result["interpretation"]["focus_structure"]["archetype_family"], "A")
        self.assertEqual(
            result["interpretation"]["focus_structure"]["standard_qualification"],
            "extended",
        )
        self.assertIn(
            "超出标准点数",
            result["interpretation"]["focus_structure"]["qualification_reason"],
        )
        self.assertIn("raw_classification", result["structure_details"])
        raw_classification = result["structure_details"]["raw_classification"]
        self.assertEqual(raw_classification["type"], "A五段式")
        self.assertEqual(raw_classification["stage"], "a1-a6拐点区间")
        self.assertEqual(raw_classification["description"], "旧的标准结构结果")
        self.assertEqual(raw_classification["component_summary"], ["上涨结构(3笔)", "延伸下跌(13笔)"])
        self.assertIn("focus_classification", result["structure_details"])

    def test_detect_structure_reports_peak_extreme_focus_origin_selection(self) -> None:
        recent, full_strokes, valid_fractals, stroke_list, peak_analysis = (
            build_focus_origin_peak_regression_fixture()
        )

        class StubMacroComponent:
            def __init__(self, component_type: str, strokes_count: int) -> None:
                self.component_type = component_type
                self.strokes_count = strokes_count

            def to_dict(self) -> dict:
                return {
                    "type": self.component_type,
                    "strokes": [{} for _ in range(self.strokes_count)],
                }

        pipeline = {
            "actual_lookback": len(recent),
            "recent": recent,
            "trend_direction": "下跌",
            "valid_range_info": {
                "start_date": "2024-03-01",
                "end_date": "2024-04-30",
                "start_price": 168.7,
                "origin_type": "high",
            },
            "processed_df": recent,
            "top_fractals": [],
            "bottom_fractals": [],
            "validated_fractals": valid_fractals,
            "final_fractals": valid_fractals,
            "strokes": full_strokes,
            "valid_fractals": valid_fractals,
            "stroke_list": stroke_list,
        }
        macro_components = [
            StubMacroComponent("上涨结构", 3),
            StubMacroComponent("延伸下跌", 13),
        ]

        with patch.object(self.analyzer, "_run_structure_pipeline", return_value=pipeline), \
             patch.object(self.analyzer, "_consolidate_boxes", return_value=macro_components), \
             patch.object(
                 self.analyzer,
                 "_classify_structure_by_macro_components",
                 return_value=("A五段式", "a1-a6拐点区间", "旧的标准结构结果", ["mocked classification"]),
             ), \
             patch.object(self.analyzer, "_analyze_peak_structure", return_value=peak_analysis):
            result = self.analyzer.detect_structure(self.df, macd_status="中偏强")

        self.assertIn("focus_origin_analysis", result["structure_details"])
        focus_origin_analysis = result["structure_details"]["focus_origin_analysis"]
        self.assertEqual(
            focus_origin_analysis["selected_origin_kind"],
            "peak_extreme",
        )
        self.assertEqual(
            focus_origin_analysis["selected_point_index"],
            3,
        )
        self.assertIn(
            "start_anchor_source",
            result["interpretation"]["focus_structure"],
        )
        self.assertEqual(
            result["interpretation"]["focus_structure"]["start_anchor_source"],
            "peak_extreme",
        )


if __name__ == "__main__":
    unittest.main()
