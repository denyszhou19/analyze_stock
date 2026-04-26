#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
三位一体操作策略 - 股票分析脚本（增强版）

功能：
1. 支持从 stdin 接收数据库数据进行分析（推荐，无需 baostock）
2. 支持直接从 baostock 获取数据（备用）
3. 计算MA55、MA233均线
4. 计算MACD指标及六种时空状态
5. 识别价格与均线的关系
6. 识别结构类型（A五段式/B双平台式/C单平台式/D三段式）
7. 级别嵌套分析
8. 输出JSON格式分析结果

使用方法：
# 从 stdin 接收数据（推荐，数据来自数据库）
python stock_analyzer.py --stdin < data.json

# 直接从 baostock 获取数据（备用）
python stock_analyzer.py --code sh.600000 --days 300
python stock_analyzer.py --code sh.600000 --days 300 --levels weekly,daily,hour60
"""

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

# baostock 仅在需要远程获取数据时导入
_bs_available = False
try:
    import baostock as bs
    _bs_available = True
except ImportError:
    pass


STRUCTURE_FAMILY_MAP = {
    'A五段式': ('standard', 'standard', 'A五段式'),
    'B双平台式': ('standard', 'standard', 'B双平台式'),
    'C单平台式': ('standard', 'standard', 'C单平台式'),
    'D三段式': ('standard', 'standard', 'D三段式'),
    '延伸A': ('extended', 'extended', 'A五段式'),
    '延伸A类': ('extended', 'extended', 'A五段式'),
    '延伸B': ('extended', 'extended', 'B双平台式'),
    '延伸B类': ('extended', 'extended', 'B双平台式'),
    '延伸C': ('extended', 'extended', 'C单平台式'),
    '延伸C类': ('extended', 'extended', 'C单平台式'),
    '延伸D': ('extended', 'extended', 'D三段式'),
    '延伸D类': ('extended', 'extended', 'D三段式'),
    '上升通道': ('channel', 'over_limit', None),
    '下降通道': ('channel', 'over_limit', None),
    '大平台震荡': ('range', 'over_limit', None),
    '延伸结构': ('extended', 'extended', None),
    '结构未完成': ('unfinished', 'unfinished', None),
    '未完成结构': ('unfinished', 'unfinished', None),
    '复杂结构': ('complex', 'failed', None),
}


class TrinityStockAnalyzer:
    """三位一体股票分析器"""
    
    # 周期映射
    FREQUENCY_MAP = {
        'weekly': 'w',      # 周线
        'daily': 'd',       # 日线
        'hour60': '60',     # 60分钟
        'hour30': '30',     # 30分钟
        'hour15': '15',     # 15分钟
    }

    LEVEL_LABELS = {
        'weekly': '周线',
        'daily': '日线',
        'hour60': '60分钟',
        'hour30': '30分钟',
        'hour15': '15分钟',
    }

    # 结构分析窗口配置
    STRUCTURE_MIN_KLINES = 60
    STRUCTURE_FRACTAL_DISPLAY_LIMIT = 10
    STRUCTURE_STROKE_WINDOW = 15
    STRUCTURE_RENDER_WIDTH = 400
    STRUCTURE_RENDER_HEIGHT = 200
    STRUCTURE_RENDER_PADDING = 30
    STRUCTURE_RENDER_DATE_LABEL_HEIGHT = 20
    
    # 时空要素和结构要素应用表
    # 核心逻辑：大级别（日线）时空状态 + 小级别（30分钟/15分钟）结构 = 操作建议
    # 
    # 使用方法：
    # 1. 先判断日线级别的MACD时空状态（极强/强/中偏强/中偏弱/弱/极弱）
    # 2. 再看30分钟或15分钟级别的结构类型（A/B/C/D）
    # 3. 根据"大级别状态 + 小级别结构"的组合，匹配对应的操作要点
    #
    # 例如：日线"极强" + 小级别"A类上涨结构" = 忽略顶部背离，逢MA55买入
    #       日线"弱" + 小级别"B类下跌结构" = b1,b3,b5,b7波段卖出
    SPACETIME_STRUCTURE_TABLE = {
        '极强': {
            '下跌结构': [],  # 小级别无对应下跌结构
            '下跌操作': '无对应结构，小心被洗走',
            '上涨结构': ['A', 'B'],  # 小级别A类或B类上涨结构
            '上涨操作': '忽略顶部背离，逢回抽MA55线买入机会'
        },
        '强': {
            '下跌结构': ['D'],  # 小级别D类下跌结构
            '下跌操作': '1、卖出需谨慎；2、如在d1卖出后，注意d2接回的机会；3、d3卖出不稳定；4、d4买入机会',
            '上涨结构': ['B'],  # 小级别B类上涨结构
            '上涨操作': '1、忽略小级别波动；2、b1、b3、b5、b7波段买入机会'
        },
        '中偏强': {
            '下跌结构': ['C'],  # 小级别C类下跌结构
            '下跌操作': '中枢底部可试仓，但要注意严格止损',
            '上涨结构': ['C'],  # 小级别C类上涨结构
            '上涨操作': '中枢底部可试仓，但要注意严格止损'
        },
        '中偏弱': {
            '下跌结构': ['C'],  # 小级别C类下跌结构
            '下跌操作': '中枢底部可试仓，但要注意严格止损',
            '上涨结构': ['C'],  # 小级别C类上涨结构
            '上涨操作': '中枢底部可试仓，但要注意严格止损'
        },
        '弱': {
            '下跌结构': ['B'],  # 小级别B类下跌结构
            '下跌操作': '1、忽略小级别波动；2、b1、b3、b5、b7波段卖出机会',
            '上涨结构': ['D'],  # 小级别D类上涨结构
            '上涨操作': '1、买入需谨慎；2、如在d1买入后，注意d2卖出的机会；3、d3买入不稳定；4、d4卖出机会'
        },
        '极弱': {
            '下跌结构': ['A', 'B'],  # 小级别A类或B类下跌结构
            '下跌操作': '忽略底部背离，逢回抽MA55线卖出机会',
            '上涨结构': [],  # 小级别无对应上涨结构
            '上涨操作': '无对应结构，小心被骗线'
        }
    }
    
    # ============ 箱体聚类合并算法（Price Clustering）============
    # 将机械的多笔结构聚类成宏观组件（平台/连接段）
    # 解决量化系统"死板"问题：让走势从"机械的13笔"蜕变成"宏观的3大段"
    
    class MacroComponent:
        """
        宏观组件类：表示聚类后的平台或连接段
        
        类型：
        - Platform（平台）：包含 >= 3 笔的价格震荡区间
        - Directional（单边）：包含 < 3 笔的单边走势（连接段）
        """
        def __init__(self):
            self.strokes = []      # 包含的原始笔列表
            self.box_high = 0.0    # 箱体上轨
            self.box_low = 0.0     # 箱体下轨
            self.type = ""         # "Platform" 或 "Directional"
            self.start_date = None # 起始日期
            self.end_date = None   # 结束日期
        
        def update_bounds(self):
            """动态更新箱体边界：使用核心密集区而非极值"""
            if not self.strokes:
                return
            
            # 获取所有笔的高低点
            highs = [s.get('to_price', s.get('high', 0)) for s in self.strokes]
            highs += [s.get('from_price', s.get('high', 0)) for s in self.strokes]
            lows = [s.get('to_price', s.get('low', float('inf'))) for s in self.strokes]
            lows += [s.get('from_price', s.get('low', float('inf'))) for s in self.strokes]
            
            # 稳健算法：对于平台，使用核心密集区（去掉极端值）
            # 目的是让平台边界代表"价格震荡的核心区域"
            if len(highs) >= 4:
                # 去掉一个最高和一个最低，避免被极端影线拉偏
                sorted_highs = sorted(highs)
                sorted_lows = sorted(lows)
                self.box_high = sorted_highs[-2]  # 次高值
                self.box_low = sorted_lows[1]       # 次低值
            else:
                # 数据较少时，使用极值
                self.box_high = max(highs)
                self.box_low = min(lows)
            
            # 更新日期范围
            if self.strokes:
                self.start_date = self.strokes[0].get('from_date')
                self.end_date = self.strokes[-1].get('to_date')
        
        def to_dict(self) -> Dict:
            """转换为字典格式"""
            return {
                'type': self.type,
                'stroke_count': len(self.strokes),
                'box_high': round(self.box_high, 2),
                'box_low': round(self.box_low, 2),
                'start_date': self.start_date,
                'end_date': self.end_date,
                'strokes': self.strokes
            }
    
    def _calculate_overlap_ratio(self, macro_comp: 'TrinityStockAnalyzer.MacroComponent', 
                                  stroke: Dict) -> float:
        """
        计算新的一笔与当前箱体的重叠率
        
        参数：
        - macro_comp: 当前宏观组件
        - stroke: 新的一笔
        
        返回：
        - 重叠率（0.0 ~ 1.0）
        """
        # 获取笔的高低点
        stroke_high = max(stroke.get('to_price', 0), stroke.get('from_price', 0))
        stroke_low = min(stroke.get('to_price', float('inf')), stroke.get('from_price', float('inf')))
        
        # 计算交叉区域的上下界
        overlap_top = min(macro_comp.box_high, stroke_high)
        overlap_bottom = max(macro_comp.box_low, stroke_low)
        
        # 如果没有交集（完全突破/跌破）
        if overlap_top <= overlap_bottom:
            return 0.0
        
        overlap_height = overlap_top - overlap_bottom
        stroke_height = stroke_high - stroke_low
        
        # 防止分母为0
        if stroke_height == 0:
            return 1.0
        
        return overlap_height / stroke_height
    
    def _analyze_peak_structure(self, strokes: List[Dict], macro_components: List['TrinityStockAnalyzer.MacroComponent']) -> Dict:
        """
        极值切片（Peak Slicing）分析
        
        当走势跨度较长（超过3个组件），检测是否存在"山峰/山谷"形态：
        - 山峰形态：先上涨到高点，后下跌（左侧上涨结构 + 右侧下跌结构）
        - 山谷形态：先下跌到低点，后上涨（左侧下跌结构 + 右侧上涨结构）
        
        核心逻辑：
        1. 找到所有笔中的全局最高价/最低价
        2. 以极值点为界，将走势劈成两半
        3. 分别对左侧和右侧重新聚类
        4. 返回"山峰/山谷形态"的综合结论
        
        参数：
        - strokes: 所有笔的列表
        - macro_components: 初步聚类的宏观组件
        
        返回：
        - peak_analysis: 峰值分析结果
        """
        result = {
            'is_peak_structure': False,       # 是否是山峰/山谷形态
            'peak_type': None,                # 'mountain_peak' 或 'valley_bottom'
            'peak_price': None,               # 极值点价格
            'peak_index': None,               # 极值点所在的笔索引
            'left_structure': None,           # 左侧结构类型
            'right_structure': None,          # 右侧结构类型
            'left_components': [],            # 左侧组件
            'right_components': [],           # 右侧组件
            'description': ''                 # 综合描述
        }
        
        # 仅当组件数 >= 4 时才进行峰值切片分析
        if len(macro_components) < 4:
            return result
        
        # 仅当笔数 >= 10 时才进行峰值切片分析（确保有足够的数据）
        if len(strokes) < 10:
            return result
        
        # ============ Step 1: 找到全局极值点 ============
        all_highs = []
        all_lows = []
        
        for i, stroke in enumerate(strokes):
            stroke_high = max(stroke.get('to_price', 0), stroke.get('from_price', 0))
            stroke_low = min(stroke.get('to_price', float('inf')), stroke.get('from_price', float('inf')))
            all_highs.append((i, stroke_high, stroke.get('to_date', ''), stroke.get('to_type', '')))
            all_lows.append((i, stroke_low, stroke.get('to_date', ''), stroke.get('to_type', '')))
        
        # 找到全局最高点和最低点
        global_max = max(all_highs, key=lambda x: x[1])  # (index, price, date, type)
        global_min = min(all_lows, key=lambda x: x[1])
        
        # ============ Step 2: 判断是山峰还是山谷 ============
        # 山峰：最高点在中间位置（不在首尾）
        # 山谷：最低点在中间位置（不在首尾）
        
        n_strokes = len(strokes)
        max_idx = global_max[0]
        min_idx = global_min[0]
        
        # 判断是否在中间位置（不在首尾20%范围内）
        is_max_in_middle = 0.2 * n_strokes < max_idx < 0.8 * n_strokes
        is_min_in_middle = 0.2 * n_strokes < min_idx < 0.8 * n_strokes
        
        # 确定峰值类型
        peak_type = None
        peak_price = None
        peak_index = None
        
        if is_max_in_middle and (not is_min_in_middle or global_max[1] > global_min[1] * 1.2):
            # 最高点在中间，且显著高于最低点 → 山峰形态
            peak_type = 'mountain_peak'
            peak_price = global_max[1]
            peak_index = max_idx
        elif is_min_in_middle and (not is_max_in_middle or global_min[1] < global_max[1] * 0.8):
            # 最低点在中间，且显著低于最高点 → 山谷形态
            peak_type = 'valley_bottom'
            peak_price = global_min[1]
            peak_index = min_idx
        
        if peak_type is None:
            return result
        
        result['is_peak_structure'] = True
        result['peak_type'] = peak_type
        result['peak_price'] = peak_price
        result['peak_index'] = peak_index
        
        # ============ Step 3: 切片并分别聚类 ============
        # 以极值点为界，将走势劈成两半
        left_strokes = strokes[:peak_index + 1]
        right_strokes = strokes[peak_index:]
        
        # 分别聚类
        left_components = self._consolidate_boxes(left_strokes) if len(left_strokes) >= 2 else []
        right_components = self._consolidate_boxes(right_strokes) if len(right_strokes) >= 2 else []
        
        result['left_components'] = [mc.to_dict() for mc in left_components]
        result['right_components'] = [mc.to_dict() for mc in right_components]
        
        # ============ Step 4: 分别识别结构类型 ============
        # 左侧结构
        if left_components:
            left_trend = 'up' if peak_type == 'mountain_peak' else 'down'
            left_type, _, left_desc, _ = self._classify_structure_by_macro_components(left_components, left_trend)
            result['left_structure'] = left_type
        else:
            result['left_structure'] = '结构未完成'
        
        # 右侧结构
        if right_components:
            right_trend = 'down' if peak_type == 'mountain_peak' else 'up'
            right_type, _, right_desc, _ = self._classify_structure_by_macro_components(right_components, right_trend)
            result['right_structure'] = right_type
        else:
            result['right_structure'] = '结构未完成'
        
        # ============ Step 5: 生成综合描述 ============
        if peak_type == 'mountain_peak':
            result['description'] = f"山峰形态：左侧为{result['left_structure']}上涨结构，峰值{peak_price:.2f}，右侧为{result['right_structure']}下跌结构"
        else:
            result['description'] = f"山谷形态：左侧为{result['left_structure']}下跌结构，谷底{peak_price:.2f}，右侧为{result['right_structure']}上涨结构"
        
        return result
    
    def _consolidate_boxes(self, strokes: List[Dict], threshold: float = 0.55) -> List['TrinityStockAnalyzer.MacroComponent']:
        """
        箱体聚类核心算法
        
        将原始的多笔聚类成宏观组件（平台/连接段）
        
        参数：
        - strokes: 经过过滤后的有效笔列表
        - threshold: 重叠率阈值，默认55%
        
        返回：
        - 宏观组件列表
        """
        macro_components = []
        
        if not strokes:
            return macro_components
        
        # 开启第一个宏观组件
        current_comp = self.MacroComponent()
        current_comp.strokes.append(strokes[0])
        current_comp.update_bounds()
        
        # 记录当前箱体的初始跨度
        initial_span = current_comp.box_high - current_comp.box_low
        
        for i in range(1, len(strokes)):
            new_stroke = strokes[i]
            
            # 获取新笔的高低点
            stroke_high = max(new_stroke.get('to_price', 0), new_stroke.get('from_price', 0))
            stroke_low = min(new_stroke.get('to_price', float('inf')), new_stroke.get('from_price', float('inf')))
            
            # 1. 计算重叠率
            overlap_ratio = self._calculate_overlap_ratio(current_comp, new_stroke)
            
            # 2. 计算新笔加入后的潜在箱体跨度
            potential_high = max(current_comp.box_high, stroke_high)
            potential_low = min(current_comp.box_low, stroke_low)
            potential_span = potential_high - potential_low
            
            # 3. 箱体跨度检查：如果新笔导致箱体跨度急剧增大（超过原来的2倍），判定为突破
            # 这可以防止单根极端笔把整个平台区间拉偏
            span_expansion = potential_span / initial_span if initial_span > 0 else 1
            max_allowed_expansion = 2.0  # 最多允许扩展到初始跨度的2倍
            
            # 4. 核心判定逻辑
            if overlap_ratio >= threshold and span_expansion <= max_allowed_expansion:
                # 【情形A：还在洗盘】重叠度高且跨度未剧增，装进当前箱体
                current_comp.strokes.append(new_stroke)
                current_comp.update_bounds()
                # 更新初始跨度（使用较小值保持平台紧凑性）
                current_span = current_comp.box_high - current_comp.box_low
                if current_span < initial_span:
                    initial_span = current_span
            else:
                # 【情形B：发生突破】重叠度低或跨度剧增，旧箱体结算
                # 给旧箱体定性
                if len(current_comp.strokes) >= 3:
                    current_comp.type = "Platform"
                else:
                    current_comp.type = "Directional"
                
                macro_components.append(current_comp)
                
                # 开启新的箱体/段落
                current_comp = self.MacroComponent()
                current_comp.strokes.append(new_stroke)
                current_comp.update_bounds()
                initial_span = current_comp.box_high - current_comp.box_low
        
        # 结算最后一个组件
        if len(current_comp.strokes) >= 3:
            current_comp.type = "Platform"
        else:
            current_comp.type = "Directional"
        macro_components.append(current_comp)
        
        return macro_components
    
    def _classify_structure_by_macro_components(self, macro_components: List['TrinityStockAnalyzer.MacroComponent'], 
                                                  trend_direction: str) -> Tuple[str, str, str, List[str]]:
        """
        基于宏观组件分类结构类型
        
        参数：
        - macro_components: 宏观组件列表
        - trend_direction: 趋势方向
        
        返回：
        - (structure_type, structure_stage, description, judgment_criteria)
        """
        judgment_criteria = []
        
        if not macro_components:
            return ('结构未完成', '未识别', '结构未完成', ['无法聚类宏观组件'])
        
        # 输出聚类结果
        component_summary = []
        for i, comp in enumerate(macro_components):
            component_summary.append(f"组件{i+1}: {comp.type}({len(comp.strokes)}笔, [{comp.box_low:.2f}, {comp.box_high:.2f}])")
        judgment_criteria.append(f"聚类结果: {' → '.join(component_summary)}")
        
        num_components = len(macro_components)
        
        # ===== 基于宏观组件数量分类 =====
        
        if num_components == 1:
            # 只有一个组件
            comp = macro_components[0]
            if comp.type == "Platform":
                # 单平台震荡 = C类
                return ('C单平台式', '平台震荡区间', 
                        f"C单平台式，{len(comp.strokes)}笔震荡整理",
                        judgment_criteria + ["✅ C类结构：单平台震荡"])
            else:
                # 单边走势 = D类
                return ('D三段式', '单边走势',
                        f"D三段式，{len(comp.strokes)}笔单边走势",
                        judgment_criteria + ["✅ D类结构：单边走势"])
        
        elif num_components == 2:
            # 两个组件
            comp1, comp2 = macro_components
            
            if comp1.type == "Platform" and comp2.type == "Platform":
                # 双平台 = B类（需要检查是否不重叠）
                has_overlap = not (comp1.box_high < comp2.box_low or comp2.box_high < comp1.box_low)
                
                if not has_overlap:
                    return ('B双平台式', '平台一→平台二',
                            f"B双平台式，平台一({len(comp1.strokes)}笔) + 平台二({len(comp2.strokes)}笔)",
                            judgment_criteria + [
                                "✅ B类结构：双平台不重叠",
                                f"平台一: [{comp1.box_low:.2f}, {comp1.box_high:.2f}]",
                                f"平台二: [{comp2.box_low:.2f}, {comp2.box_high:.2f}]"
                            ])
                else:
                    return ('延伸C类', '双平台重叠',
                            f"延伸C类，双平台重叠",
                            judgment_criteria + [
                                "⚠️ 双平台有重叠，归类为延伸C类",
                                f"平台一: [{comp1.box_low:.2f}, {comp1.box_high:.2f}]",
                                f"平台二: [{comp2.box_low:.2f}, {comp2.box_high:.2f}]"
                            ])
            
            elif comp1.type == "Directional" and comp2.type == "Platform":
                # 单边 + 平台 = A类趋势（前半段）
                return ('A五段式', '趋势启动阶段',
                        f"A五段式，趋势启动 + 平台整理",
                        judgment_criteria + ["✅ A类结构：趋势启动后平台整理"])
            
            elif comp1.type == "Platform" and comp2.type == "Directional":
                # 平台 + 单边：区分正常中继平台 vs 超大中枢
                # 缠论标准：中枢延伸到9段以上升级为高级别中枢（盘整）
                # 三位一体映射：Platform笔数≤5为正常中继→A五段式；≥6为超大中枢→超大C类
                platform_strokes = len(comp1.strokes)
                if platform_strokes <= 5:
                    return ('A五段式', '趋势突破阶段',
                            f"A五段式，平台整理({platform_strokes}笔)后突破",
                            judgment_criteria + ["✅ A类结构：平台整理后趋势突破"])
                else:
                    return ('C单平台式', '大中枢突破启动',
                            f"超大C类（{platform_strokes}笔大中枢整理）+ 新上涨第一推动段",
                            judgment_criteria + [
                                f"⚠️ Platform含{platform_strokes}笔（≥6），缠论中枢延伸/升级，认定为超大C类盘整",
                                "✅ 大中枢突破，等待回踩MA55确认，新A类a1段完成",
                                "💡 操作建议：大概率进入新一轮上涨，回踩MA55为最佳介入点"
                            ])
            
            else:
                # 两个单边 = D类延伸
                return ('延伸结构', '双单边走势',
                        f"延伸结构，双单边走势",
                        judgment_criteria + ["⚠️ 两个单边组件，建议升维分析"])
        
        elif num_components == 3:
            # 三个组件 - 最关键的判断！
            comp1, comp2, comp3 = macro_components
            
            # 判断是否是 B类双平台：平台 + 连接段 + 平台
            if comp1.type == "Platform" and comp2.type == "Directional" and comp3.type == "Platform":
                # 检查两个平台是否不重叠
                has_overlap = not (comp1.box_high < comp3.box_low or comp3.box_high < comp1.box_low)
                
                if not has_overlap:
                    return ('B双平台式', '平台一→连接段→平台二',
                            f"B双平台式，平台一({len(comp1.strokes)}笔) + 连接段({len(comp2.strokes)}笔) + 平台二({len(comp3.strokes)}笔)",
                            judgment_criteria + [
                                "✅ B类结构：双平台不重叠（聚类算法识别）",
                                f"平台一: [{comp1.box_low:.2f}, {comp1.box_high:.2f}] ({len(comp1.strokes)}笔)",
                                f"连接段: [{comp2.box_low:.2f}, {comp2.box_high:.2f}] ({len(comp2.strokes)}笔)",
                                f"平台二: [{comp3.box_low:.2f}, {comp3.box_high:.2f}] ({len(comp3.strokes)}笔)"
                            ])
                else:
                    return ('延伸C类', '双平台重叠（有连接段）',
                            f"延伸C类，双平台重叠（中间有连接段）",
                            judgment_criteria + [
                                "⚠️ 三个组件，但双平台有重叠",
                                f"平台一: [{comp1.box_low:.2f}, {comp1.box_high:.2f}]",
                                f"连接段: [{comp2.box_low:.2f}, {comp2.box_high:.2f}]",
                                f"平台二: [{comp3.box_low:.2f}, {comp3.box_high:.2f}]"
                            ])
            
            # 判断是否是 A类趋势：单边 + 平台 + 单边
            elif comp1.type == "Directional" and comp2.type == "Platform" and comp3.type == "Directional":
                return ('A五段式', '趋势中继',
                        f"A五段式，趋势 + 中继平台 + 趋势",
                        judgment_criteria + [
                            "✅ A类结构：趋势中继形态",
                            f"启动段: {len(comp1.strokes)}笔",
                            f"中继平台: [{comp2.box_low:.2f}, {comp2.box_high:.2f}] ({len(comp2.strokes)}笔)",
                            f"延续段: {len(comp3.strokes)}笔"
                        ])
            
            # 其他三组件组合
            else:
                types = [comp.type for comp in macro_components]
                return ('复杂结构', '三组件组合',
                        f"复杂结构，组件类型: {' → '.join(types)}",
                        judgment_criteria + [f"⚠️ 三组件组合: {' → '.join(types)}，需人工确认"])
        
        elif num_components == 4:
            # 四个组件 - 可能是延伸B类
            comp1, comp2, comp3, comp4 = macro_components
            
            # 检查是否是 平台 + 单边 + 平台 + 单边 或 单边 + 平台 + 单边 + 平台
            if comp1.type == "Platform" and comp2.type == "Directional" and \
               comp3.type == "Platform" and comp4.type == "Directional":
                return ('延伸B类', '双平台+延伸',
                        f"延伸B类，双平台后继续延伸",
                        judgment_criteria + ["⚠️ 延伸B类结构，建议关注趋势衰竭信号"])
            
            return ('复杂结构', '四组件组合',
                    f"复杂结构，4个组件",
                    judgment_criteria + ["⚠️ 四组件组合，结构复杂，需人工确认"])
        
        else:
            # 组件数 > 4：智能识别双平台模式
            # 统计平台数量
            platforms = [comp for comp in macro_components if comp.type == "Platform"]
            directionals = [comp for comp in macro_components if comp.type == "Directional"]
            
            if len(platforms) >= 2:
                # 找到前两个主要平台
                platform1 = platforms[0]
                platform2 = platforms[1]
                
                # 检查是否不重叠
                has_overlap = not (platform1.box_high < platform2.box_low or platform2.box_high < platform1.box_low)
                
                if not has_overlap:
                    # 双平台不重叠，识别为 B类
                    return ('B双平台式', '多段双平台结构',
                            f"B双平台式，{len(platforms)}个平台不重叠（中间有{len(directionals)}个连接段）",
                            judgment_criteria + [
                                "✅ B类结构：双平台不重叠（多段模式）",
                                f"平台一: [{platform1.box_low:.2f}, {platform1.box_high:.2f}]",
                                f"平台二: [{platform2.box_low:.2f}, {platform2.box_high:.2f}]",
                                f"中间连接段: {len(directionals)}个"
                            ])
                else:
                    # 双平台有重叠，识别为延伸C类
                    return ('延伸C类', '多段平台重叠',
                            f"延伸C类，{len(platforms)}个平台有重叠",
                            judgment_criteria + [
                                "⚠️ 多段结构，平台有重叠",
                                f"平台一: [{platform1.box_low:.2f}, {platform1.box_high:.2f}]",
                                f"平台二: [{platform2.box_low:.2f}, {platform2.box_high:.2f}]"
                            ])
            
            elif len(platforms) == 1:
                # 只有一个平台
                return ('延伸A类', '多段单平台',
                        f"延伸A类，单平台趋势延伸",
                        judgment_criteria + [f"⚠️ 多段结构，单平台延伸"])
            
            else:
                # 没有平台，全是单边
                return ('延伸D类', '多段单边',
                        f"延伸D类，多段单边走势",
                        judgment_criteria + [f"⚠️ 多段单边走势，建议升维分析"])
    
    def __init__(self):
        self.lg = None
        
    def login(self, max_retries: int = 3) -> bool:
        """登录baostock（抑制输出，带重试机制）"""
        if not _bs_available:
            return False
            
        import io
        import time
        
        for attempt in range(max_retries):
            try:
                old_stdout = sys.stdout
                old_stderr = sys.stderr
                sys.stdout = io.StringIO()
                sys.stderr = io.StringIO()
                self.lg = bs.login()
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                
                if self.lg.error_code == '0':
                    return True
                else:
                    # 登录失败，等待后重试
                    if attempt < max_retries - 1:
                        time.sleep(1)
            except Exception as e:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                if attempt < max_retries - 1:
                    time.sleep(1)
        
        return False
    
    def logout(self):
        """登出baostock（抑制输出）"""
        if self.lg:
            import io
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
            bs.logout()
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            sys.stdout = old_stdout
    
    def get_stock_data(self, code: str, start_date: str, end_date: str, 
                       frequency: str = 'd') -> Optional[pd.DataFrame]:
        """
        获取股票历史数据
        
        参数：
        - code: 股票代码（格式：sh.600000 或 sz.000001）
        - start_date: 开始日期（格式：YYYY-MM-DD）
        - end_date: 结束日期（格式：YYYY-MM-DD）
        - frequency: 周期 d=日线 w=周线 60=60分钟 30=30分钟 15=15分钟
        
        返回：
        - DataFrame包含开盘价、最高价、最低价、收盘价、成交量等
        """
        try:
            # 根据周期类型选择不同的字段
            # 分钟级别不支持turn和pctChg字段
            if frequency in ['60', '30', '15']:
                # 分钟级别需要更长的日期范围，且字段受限
                # baostock分钟数据通常只能获取近一年的数据
                start_dt = datetime.strptime(start_date, '%Y-%m-%d')
                # 分钟数据从当前时间往前推，最多获取约1年数据
                min_data_start = datetime.now() - timedelta(days=365)
                if start_dt < min_data_start:
                    start_date = min_data_start.strftime('%Y-%m-%d')
                else:
                    start_date = start_dt.strftime('%Y-%m-%d')
                fields = "date,time,code,open,high,low,close,volume,amount"
            else:
                # 日线和周线支持完整字段
                fields = "date,code,open,high,low,close,volume,amount,turn,pctChg"
            
            # 抑制 baostock 的输出
            import io
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            
            try:
                sys.stdout = io.StringIO()
                sys.stderr = io.StringIO()
                
                rs = bs.query_history_k_data_plus(
                    code,
                    fields,
                    start_date=start_date,
                    end_date=end_date,
                    frequency=frequency,
                    adjustflag="2"  # 2=前复权
                )
                
                # 恢复输出
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                
                if rs.error_code != '0':
                    return None
                
                data_list = []
                while (rs.error_code == '0') & rs.next():
                    data_list.append(rs.get_row_data())
                
                if not data_list:
                    return None
                
                df = pd.DataFrame(data_list, columns=rs.fields)
            except Exception as e:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                return None
            
            # 转换数据类型
            numeric_cols = ['open', 'high', 'low', 'close', 'volume', 'amount']
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # 日线和周线额外转换
            if 'turn' in df.columns:
                df['turn'] = pd.to_numeric(df['turn'], errors='coerce')
            if 'pctChg' in df.columns:
                df['pctChg'] = pd.to_numeric(df['pctChg'], errors='coerce')
            
            # 处理日期
            if 'time' in df.columns:
                # 分钟级别有time字段，格式如 20220829103000000
                # date字段格式如 2022-08-29，time字段是时间戳
                # 直接使用time字段解析时间
                df['date'] = pd.to_datetime(df['time'], format='%Y%m%d%H%M%S%f')
                df = df.drop(columns=['time'])
            else:
                df['date'] = pd.to_datetime(df['date'])
            
            df = df.sort_values('date').reset_index(drop=True)
            
            return df
            
        except Exception as e:
            print(f"获取数据异常: {e}")
            return None
    
    def calculate_ma(self, df: pd.DataFrame, periods: List[int] = [55, 233]) -> pd.DataFrame:
        """
        计算移动平均线
        
        优先使用数据中已有的MA值（从数据库获取时已计算），
        只有没有MA值时才重新计算
        """
        df = df.copy()
        for period in periods:
            col_name = f'MA{period}'
            # 检查数据中是否已有该MA值
            if col_name in df.columns and df[col_name].notna().any():
                # 已有MA值，保留不变
                # 但可能部分是NaN，需要补充计算
                if df[col_name].isna().any():
                    # 有部分NaN，补充计算
                    calculated = df['close'].rolling(window=period, min_periods=period).mean()
                    df[col_name] = df[col_name].fillna(calculated)
            else:
                # 没有MA值，需要计算
                df[col_name] = df['close'].rolling(window=period, min_periods=period).mean()
        return df
    
    def calculate_macd(self, df: pd.DataFrame, 
                       fast_period: int = 12, 
                       slow_period: int = 26, 
                       signal_period: int = 9) -> pd.DataFrame:
        """
        计算MACD指标
        
        优先使用数据中已有的MACD值（从数据库获取时已计算），
        只有没有时才重新计算
        """
        df = df.copy()
        
        # 检查是否已有MACD数据
        has_macd = 'macd' in df.columns and df['macd'].notna().any()
        has_dif = 'DIF' in df.columns and df['DIF'].notna().any()
        has_dea = 'DEA' in df.columns and df['DEA'].notna().any()
        
        if has_macd and has_dif and has_dea:
            # 已有完整的MACD数据，保留不变
            # 重命名列以保持一致性
            if 'macd_hist' in df.columns:
                df['MACD'] = df['macd_hist']
            return df
        
        # 没有MACD数据，需要计算
        ema_fast = df['close'].ewm(span=fast_period, adjust=False).mean()
        ema_slow = df['close'].ewm(span=slow_period, adjust=False).mean()
        
        df['DIF'] = ema_fast - ema_slow
        df['DEA'] = df['DIF'].ewm(span=signal_period, adjust=False).mean()
        df['MACD'] = (df['DIF'] - df['DEA']) * 2
        
        return df
    
    def determine_macd_status(self, df: pd.DataFrame) -> Dict:
        """
        精确判定MACD六种时空状态
        
        六种状态定义（按时间顺序）：
        1. 弱：DEA下穿零轴后，到低位金叉
        2. 中偏强：低位金叉后，DIF第一次上穿零轴
        3. 极强：DIF第一次上穿零轴后，到DEA第一次上穿零轴
        4. 强：DEA第一次上穿零轴后，高位死叉
        5. 中偏弱：高位死叉到DIF第一次下穿零轴
        6. 极弱：DIF第一次下穿零轴，到DEA第一次下穿零轴
        
        关键事件追踪：
        - 低位金叉：DIF上穿DEA，两者都在零轴下方
        - 高位死叉：DIF下穿DEA，两者都在零轴上方
        - DIF上穿零轴
        - DIF下穿零轴
        - DEA上穿零轴
        - DEA下穿零轴
        
        返回：
        - 状态信息字典
        """
        if len(df) < 50:
            return {'status': '数据不足', 'description': '数据不足以判断状态'}
        
        result = {
            'status': '未知',
            'description': '',
            'dif_above_zero': False,
            'dea_above_zero': False,
            'dif_cross_dea': 'none',
        }
        
        latest = df.iloc[-1]
        dif = latest['DIF']
        dea = latest['DEA']
        
        result['DIF'] = round(dif, 4) if pd.notna(dif) else None
        result['DEA'] = round(dea, 4) if pd.notna(dea) else None
        result['MACD'] = round((dif - dea) * 2, 4) if pd.notna(dif) and pd.notna(dea) else None
        result['dif_above_zero'] = dif > 0
        result['dea_above_zero'] = dea > 0
        result['dif_cross_dea'] = 'above' if dif > dea else 'below'
        
        # ============ 追踪历史关键事件 ============
        # 计算DIF和DEA与零轴的关系
        df_copy = df.copy()
        df_copy['DIF_sign'] = np.sign(df_copy['DIF'])
        df_copy['DEA_sign'] = np.sign(df_copy['DEA'])
        df_copy['DIF_above_DEA'] = df_copy['DIF'] > df_copy['DEA']
        
        # 零轴穿越
        df_copy['DIF_cross_zero_up'] = (df_copy['DIF_sign'].diff() > 0).astype(bool)
        df_copy['DIF_cross_zero_down'] = (df_copy['DIF_sign'].diff() < 0).astype(bool)
        df_copy['DEA_cross_zero_up'] = (df_copy['DEA_sign'].diff() > 0).astype(bool)
        df_copy['DEA_cross_zero_down'] = (df_copy['DEA_sign'].diff() < 0).astype(bool)
        
        # 金叉死叉
        df_copy['cross_type'] = df_copy['DIF_above_DEA'].diff()
        df_copy['golden_cross'] = (df_copy['cross_type'] == True).astype(bool)   # DIF上穿DEA
        df_copy['death_cross'] = (df_copy['cross_type'] == False).astype(bool)   # DIF下穿DEA
        
        # 区分低位金叉和高位金叉
        df_copy['low_golden_cross'] = df_copy['golden_cross'] & (df_copy['DIF'] < 0) & (df_copy['DEA'] < 0)
        df_copy['high_golden_cross'] = df_copy['golden_cross'] & (df_copy['DIF'] > 0) & (df_copy['DEA'] > 0)
        df_copy['high_death_cross'] = df_copy['death_cross'] & (df_copy['DIF'] > 0) & (df_copy['DEA'] > 0)
        df_copy['low_death_cross'] = df_copy['death_cross'] & (df_copy['DIF'] < 0) & (df_copy['DEA'] < 0)
        
        # ============ 构建事件时间线 ============
        events = []
        
        for i in range(len(df_copy)):
            idx = df_copy.index[i]
            if df_copy.loc[idx, 'DIF_cross_zero_up']:
                events.append({'idx': i, 'type': 'DIF_up_zero', 'date': df_copy.iloc[i]['date'] if 'date' in df_copy.columns else i})
            if df_copy.loc[idx, 'DIF_cross_zero_down']:
                events.append({'idx': i, 'type': 'DIF_down_zero', 'date': df_copy.iloc[i]['date'] if 'date' in df_copy.columns else i})
            if df_copy.loc[idx, 'DEA_cross_zero_up']:
                events.append({'idx': i, 'type': 'DEA_up_zero', 'date': df_copy.iloc[i]['date'] if 'date' in df_copy.columns else i})
            if df_copy.loc[idx, 'DEA_cross_zero_down']:
                events.append({'idx': i, 'type': 'DEA_down_zero', 'date': df_copy.iloc[i]['date'] if 'date' in df_copy.columns else i})
            if df_copy.loc[idx, 'low_golden_cross']:
                events.append({'idx': i, 'type': 'low_golden_cross', 'date': df_copy.iloc[i]['date'] if 'date' in df_copy.columns else i})
            if df_copy.loc[idx, 'high_death_cross']:
                events.append({'idx': i, 'type': 'high_death_cross', 'date': df_copy.iloc[i]['date'] if 'date' in df_copy.columns else i})
        
        # 按时间排序
        events.sort(key=lambda x: x['idx'])
        
        # 存储事件历史用于调试
        result['events'] = events[-10:] if events else []  # 最近10个事件
        
        # ============ 根据当前状态和历史事件判断阶段 ============
        # 当前状态
        dif_above = dif > 0
        dea_above = dea > 0
        is_golden = dif > dea  # 当前是否金叉状态
        
        # 根据当前DIF、DEA位置和金叉/死叉状态，结合历史事件判断
        if dif_above and dea_above:
            # 都在零轴上方
            if is_golden:
                # 金叉状态（DIF > DEA）
                # 检查是否刚发生高位金叉（从死叉转金叉）
                recent_death = any(e['type'] == 'high_death_cross' for e in events[-5:])
                if recent_death:
                    result['status'] = '强'
                    result['description'] = 'DEA已在零轴上方，DIF>DEA，持有阶段'
                else:
                    result['status'] = '强'
                    result['description'] = 'DEA已在零轴上方，DIF>DEA，持有阶段'
            else:
                # 死叉状态（DIF < DEA）
                # 这是高位死叉后的状态
                result['status'] = '中偏弱'
                result['description'] = '高位死叉，上涨动能减弱，注意背离'
                
        elif dif_above and not dea_above:
            # DIF在零轴上方，DEA在零轴下方
            # 这是DIF上穿零轴后，DEA还没上穿
            result['status'] = '极强'
            result['description'] = 'DIF首次上穿零轴，等待DEA上穿确认，强势上涨段'
            
        elif not dif_above and dea_above:
            # DIF在零轴下方，DEA在零轴上方
            # 这是DIF下穿零轴后，DEA还没下穿，下跌动能最充沛
            result['status'] = '极弱'
            result['description'] = 'DIF下穿零轴，DEA还在零轴上方，主跌段，下跌动能充沛'
            
        else:
            # 都在零轴下方 (not dif_above and not dea_above)
            if is_golden:
                # 金叉状态（DIF > DEA）
                # 需要判断是"刚金叉"还是"金叉后准备上穿零轴"
                # 检查最近是否有低位金叉事件
                recent_low_golden = None
                for e in reversed(events):
                    if e['type'] == 'low_golden_cross':
                        recent_low_golden = e
                        break
                
                if recent_low_golden:
                    # 有低位金叉，现在DIF还没上穿零轴，是中偏强
                    result['status'] = '中偏强'
                    result['description'] = '低位金叉后，等待DIF上穿零轴，转强阶段'
                else:
                    # 没有明确的低位金叉记录，但当前是金叉状态
                    # 可能是DEA下穿零轴后的自然金叉
                    # 检查是否 DEA 刚下穿零轴
                    recent_dea_down = None
                    for e in reversed(events):
                        if e['type'] == 'DEA_down_zero':
                            recent_dea_down = e
                            break
                    
                    if recent_dea_down:
                        # DEA已下穿零轴，现在是金叉状态
                        result['status'] = '中偏强'
                        result['description'] = 'DEA下穿零轴后金叉，等待DIF上穿零轴确认'
                    else:
                        result['status'] = '中偏强'
                        result['description'] = '低位金叉后，等待DIF上穿零轴，转强阶段'
            else:
                # 死叉状态（DIF < DEA）
                # 需要判断是"刚进入极弱"还是"极弱转弱"
                # 检查 DEA 是否已经下穿零轴
                recent_dea_down = None
                recent_dif_down = None
                
                for e in reversed(events):
                    if e['type'] == 'DEA_down_zero' and recent_dea_down is None:
                        recent_dea_down = e
                    if e['type'] == 'DIF_down_zero' and recent_dif_down is None:
                        recent_dif_down = e
                
                if recent_dif_down and not recent_dea_down:
                    # DIF已下穿零轴，DEA还没下穿
                    result['status'] = '极弱'
                    result['description'] = 'DIF下穿零轴后，等待DEA下穿，主跌段'
                elif recent_dea_down:
                    # DEA已下穿零轴
                    result['status'] = '弱'
                    result['description'] = 'DEA已在零轴下方，DIF<DEA，等待低位金叉'
                else:
                    # 没有明确的零轴穿越记录
                    result['status'] = '弱'
                    result['description'] = 'DEA已在零轴下方，DIF<DEA，等待低位金叉'
        
        return result

    def analyze_ma_position(self, row: pd.Series) -> Dict:
        """
        分析价格与均线位置关系
        """
        result = {
            'price_vs_ma55': None,
            'price_vs_ma233': None,
            'ma_status': None,
            'distance_ma55': None,
            'distance_ma233': None
        }
        
        close = row['close']
        ma55 = row.get('MA55')
        ma233 = row.get('MA233')
        
        if pd.notna(ma55):
            distance_55 = ((close - ma55) / ma55) * 100
            result['distance_ma55'] = round(distance_55, 2)
            result['price_vs_ma55'] = 'above' if close > ma55 else 'below'
        
        if pd.notna(ma233):
            distance_233 = ((close - ma233) / ma233) * 100
            result['distance_ma233'] = round(distance_233, 2)
            result['price_vs_ma233'] = 'above' if close > ma233 else 'below'
        
        # 判断均线排列状态
        if pd.notna(ma55) and pd.notna(ma233):
            if close > ma55 > ma233:
                result['ma_status'] = '多头排列'
            elif close < ma55 < ma233:
                result['ma_status'] = '空头排列'
            elif ma55 > ma233 and close < ma55:
                result['ma_status'] = '均线纠缠-偏多'
            elif ma55 < ma233 and close > ma55:
                result['ma_status'] = '均线纠缠-偏空'
            elif ma55 > ma233:
                result['ma_status'] = '均线金叉'
            else:
                result['ma_status'] = '均线死叉'
        elif pd.notna(ma55):
            result['ma_status'] = '站上MA55' if close > ma55 else '跌破MA55'
        
        return result
    
    def analyze_ma_physics(self, df: pd.DataFrame, lookback: int = 20) -> Dict:
        """
        分析均线系统的四大物理性质（根据三位一体策略文档）
        
        四大性质：
        1. 支撑与压制 (Support & Pressure)：均线的根本任务是维护趋势现状
        2. 牵引性 (Traction)：股价过度偏离时产生回归引力
        3. 共振性 (Resonance)：不同级别均线在同一价格区间的效力放大
        4. 同一性 (Identity)：均线系统在不同标的、不同级别的有效性一致
        
        返回：
        - ma_physics: 均线物理性质分析结果
        """
        result = {
            'support_pressure': None,  # 支撑与压制
            'traction': None,          # 牵引性
            'resonance': None,         # 共振性
            'identity': True,          # 同一性（默认有效）
            'key_signals': [],         # 关键信号列表
            'alerts': []               # 重点提醒
        }
        
        if len(df) < lookback:
            return result
        
        recent = df.tail(lookback).copy()
        latest = df.iloc[-1]
        
        close = latest['close']
        ma55 = latest.get('MA55')
        ma233 = latest.get('MA233')
        
        # ============ 1. 支撑与压制分析 ============
        if pd.notna(ma55):
            # 判断MA55的支撑/压制状态
            # 核心规则：任何未伴随结构破坏的触线，均应优先判定为支撑或压制有效
            
            # 检查最近是否触及MA55
            recent_touch_ma55 = False
            touch_type = None
            
            for i in range(len(recent) - 1, max(0, len(recent) - 5), -1):
                low = recent.iloc[i]['low']
                high = recent.iloc[i]['high']
                
                # 触及MA55：K线区间包含MA55
                if low <= ma55 <= high:
                    recent_touch_ma55 = True
                    # 判断是支撑还是压制
                    if i < len(recent) - 1:
                        next_close = recent.iloc[i + 1]['close'] if i + 1 < len(recent) else close
                        if next_close > ma55:
                            touch_type = '支撑有效'
                        else:
                            touch_type = '压制有效'
                    break
            
            # 当前价格与MA55的关系
            if close > ma55:
                ma55_role = '支撑'
                distance_to_ma55 = ((close - ma55) / ma55) * 100
            else:
                ma55_role = '压制'
                distance_to_ma55 = ((ma55 - close) / ma55) * 100
            
            result['support_pressure'] = {
                'ma55_role': ma55_role,
                'ma55_value': round(ma55, 2),
                'distance_pct': round(distance_to_ma55, 2),
                'recent_touch': recent_touch_ma55,
                'touch_type': touch_type,
                'status': 'MA55' + ('支撑有效' if ma55_role == '支撑' and recent_touch_ma55 else 
                                    '压制有效' if ma55_role == '压制' and recent_touch_ma55 else
                                    '支撑' if ma55_role == '支撑' else '压制')
            }
            
            # 添加关键信号
            if recent_touch_ma55 and touch_type:
                result['key_signals'].append(f"近期触及MA55，{touch_type}")
        
        if pd.notna(ma233):
            # MA233的支撑/压制状态
            if close > ma233:
                ma233_role = '支撑'
                distance_to_ma233 = ((close - ma233) / ma233) * 100
            else:
                ma233_role = '压制'
                distance_to_ma233 = ((ma233 - close) / ma233) * 100
            
            if result['support_pressure']:
                result['support_pressure']['ma233_role'] = ma233_role
                result['support_pressure']['ma233_value'] = round(ma233, 2)
                result['support_pressure']['ma233_distance_pct'] = round(distance_to_ma233, 2)
            else:
                result['support_pressure'] = {
                    'ma233_role': ma233_role,
                    'ma233_value': round(ma233, 2),
                    'ma233_distance_pct': round(distance_to_ma233, 2)
                }
        
        # ============ 2. 牵引性分析 ============
        # 核心规则：当股价过度偏离MA55/MA233时，均线产生回归引力
        # 首次突破或跌破MA55/MA233，必定伴随回抽确认动作
        
        if pd.notna(ma55):
            deviation_55 = abs((close - ma55) / ma55) * 100
            
            # 判断是否过度偏离（超过5%视为过度偏离）
            is_over_deviation = deviation_55 > 5
            
            # 检查是否刚突破/跌破MA55（最近5根K线内）
            recent_break_ma55 = False
            break_type = None
            
            for i in range(len(recent) - 1, max(0, len(recent) - 5), -1):
                prev_close = recent.iloc[i - 1]['close'] if i > 0 else recent.iloc[i]['open']
                curr_close = recent.iloc[i]['close']
                
                # 突破MA55（从下往上）
                if prev_close < ma55 and curr_close > ma55:
                    recent_break_ma55 = True
                    break_type = '突破'
                    break
                # 跌破MA55（从上往下）
                elif prev_close > ma55 and curr_close < ma55:
                    recent_break_ma55 = True
                    break_type = '跌破'
                    break
            
            # 关键修正：检查突破/跌破后是否仍保持方向
            # 如果是"突破"（从下往上），当前股价应该在MA55上方才有效
            # 如果是"跌破"（从上往下），当前股价应该在MA55下方才有效
            # 如果已被拉回，则不提示"预期回抽确认"（由 detect_breakthrough_pattern 识别为假突破/假跌破）
            if recent_break_ma55:
                is_still_valid = (break_type == '突破' and close > ma55) or (break_type == '跌破' and close < ma55)
                if not is_still_valid:
                    # 突破/跌破后被拉回，不提示回抽确认
                    recent_break_ma55 = False
                    break_type = None
            
            result['traction'] = {
                'deviation_ma55_pct': round(deviation_55, 2),
                'is_over_deviation': is_over_deviation,
                'recent_break': recent_break_ma55,
                'break_type': break_type,
                'pullback_expected': recent_break_ma55,  # 突破/跌破后预期回抽
                'traction_force': '强' if is_over_deviation else ('中' if deviation_55 > 3 else '弱')
            }
            
            # 添加关键信号（仅当突破/跌破仍有效时）
            if recent_break_ma55:
                result['key_signals'].append(f"近期{break_type}MA55，预期回抽确认")
            
            if is_over_deviation:
                result['key_signals'].append(f"偏离MA55达{deviation_55:.1f}%，存在回归引力")
        
        # ============ 3. 共振性分析 ============
        # 核心规则：不同级别均线在同一价格区间重合时，效力指数级放大
        
        if pd.notna(ma55) and pd.notna(ma233):
            # MA55与MA233的距离
            ma_distance = abs(ma55 - ma233) / ma233 * 100
            
            # 均线粘合：距离小于3%
            is_ma_converging = ma_distance < 3
            
            result['resonance'] = {
                'ma55_ma233_distance_pct': round(ma_distance, 2),
                'is_converging': is_ma_converging,
                'convergence_strength': '强' if ma_distance < 1 else ('中' if ma_distance < 3 else '弱'),
                'resonance_zone': None  # 共振区间（如果存在）
            }
            
            if is_ma_converging:
                resonance_zone = [min(ma55, ma233) * 0.99, max(ma55, ma233) * 1.01]
                result['resonance']['resonance_zone'] = [round(x, 2) for x in resonance_zone]
                result['key_signals'].append(f"MA55与MA233粘合（距离{ma_distance:.1f}%），共振效应增强")
                # 注意：不添加到 alerts，前端已有专门提示框显示
        
        return result
    
    def detect_breakthrough_pattern(self, df: pd.DataFrame, lookback: int = 30) -> Dict:
        """
        识别突破/跌破形态的有效性（根据三位一体策略文档 - 优化版）
        
        核心概念：
        - T0（突破K线）：满足 前一日收盘价 < MA 且 今日收盘价 > MA 的那根K线
        - 观察窗口：T0 之前的 3-5 根K线（前置动作）+ T0 之后的 3-5 根K线（确认动作）
        
        6种形态的量化特征：
        1. 假突破/假跌破：穿越均线后被迅速拉回（T+1 到 T+3 内收盘价回到MA原侧）
        2. 有效突破/有效跌破：实体幅度大（>3%），形成凌厉单边排列，不跌破T0开盘价
        3. 慢速突破/慢速跌破：小实体碎阳碎阴，K线区间高度重叠（>70%），均线走平
        4. 回抽突破/回抽跌破：Cross -> Extend -> Pullback -> Bounce（N字型轨迹）
        5. 反向突破/反向跌破：先测试被拒，随后以更大动能反向打穿（骗线后反杀）
        6. 普通突破/普通跌破：兜底逻辑，特征不显著的普通穿越
        
        返回：
        - breakthrough: 突破/跌破形态分析结果
        """
        result = {
            'pattern_type': None,          # 突破/跌破形态类型
            'pattern_name': None,          # 突破/跌破形态名称
            'direction': None,             # 方向：'up'（突破）或 'down'（跌破）
            'target_ma': None,             # 目标均线
            'is_valid': None,              # 是否有效突破/跌破
            'confidence': None,            # 置信度
            'description': '',             # 详细描述
            'key_signals': [],             # 关键信号
            'alerts': [],                  # 重点提醒
            't0_index': None,              # T0 索引位置
            't0_date': None                # T0 日期
        }
        
        if len(df) < lookback:
            return result
        
        recent = df.tail(lookback).copy()
        recent = recent.reset_index(drop=True)
        latest = recent.iloc[-1]
        
        close = latest['close']
        ma55 = latest.get('MA55')
        ma233 = latest.get('MA233')
        
        if pd.isna(ma55) and pd.isna(ma233):
            return result
        
        # 选择主要关注均线（优先MA55）
        target_ma = ma55 if pd.notna(ma55) else ma233
        target_ma_name = 'MA55' if pd.notna(ma55) else 'MA233'
        
        result['target_ma'] = target_ma_name
        
        # ============ Step 1: 寻找事件基准点 T0 ============
        # T0：满足 前一日收盘价在MA一侧，今日收盘价在MA另一侧 的那根K线
        
        t0_idx = None
        t0_type = None  # 'up' 或 'down'
        
        # 从最新往前找最近的突破事件（最多回溯10根）
        for i in range(len(recent) - 1, 0, -1):
            prev_close = recent.iloc[i - 1]['close']
            curr_close = recent.iloc[i]['close']
            curr_ma = recent.iloc[i].get('MA55') if pd.notna(recent.iloc[i].get('MA55')) else recent.iloc[i].get('MA233')
            
            if pd.isna(curr_ma):
                continue
            
            # 突破（从下往上穿越MA）
            if prev_close < curr_ma and curr_close > curr_ma:
                t0_idx = i
                t0_type = 'up'
                break
            # 跌破（从上往下穿越MA）
            elif prev_close > curr_ma and curr_close < curr_ma:
                t0_idx = i
                t0_type = 'down'
                break
        
        if t0_idx is None:
            result['pattern_type'] = '无突破'
            result['pattern_name'] = '无突破'
            result['description'] = '近期无突破/跌破事件'
            return result
        
        result['direction'] = t0_type
        result['t0_index'] = int(t0_idx)
        result['t0_date'] = str(recent.iloc[t0_idx].get('date', t0_idx))
        
        # ============ 定义方向相关术语 ============
        DIRECTION_TERMS = {
            'up': {
                'action': '突破',
                'action_desc': '向上穿越',
                'pre_action': '压制',
                'post_action': '支撑',
                'reverse_action': '跌破',
                'color': '上涨'
            },
            'down': {
                'action': '跌破',
                'action_desc': '向下穿越',
                'pre_action': '支撑',
                'post_action': '压制',
                'reverse_action': '突破',
                'color': '下跌'
            }
        }
        
        terms = DIRECTION_TERMS[t0_type]
        action = terms['action']
        
        # ============ 提取观察窗口数据 ============
        t0 = recent.iloc[t0_idx]
        t0_open = t0['open']
        t0_close = t0['close']
        t0_high = t0['high']
        t0_low = t0['low']
        t0_body = abs(t0_close - t0_open)
        t0_body_pct = t0_body / t0_open * 100 if t0_open > 0 else 0
        
        # 前置窗口（T0 前 5 根）
        pre_window = recent.iloc[max(0, t0_idx - 5):t0_idx]
        # 确认窗口（T0 后 5 根，到最新）
        post_window = recent.iloc[t0_idx + 1:] if t0_idx + 1 < len(recent) else pd.DataFrame()
        
        # 当前收盘价
        current_close = recent.iloc[-1]['close']
        
        # 计算平均振幅（排除T0及之后）
        if len(pre_window) > 0:
            avg_range = (pre_window['high'] - pre_window['low']).mean()
        else:
            avg_range = t0_high - t0_low
        
        # ============ 分类规则引擎 ============
        # 按优先级顺序检测：假突破 -> 回抽突破 -> 反向突破 -> 有效突破 -> 慢速突破 -> 普通突破
        
        # ============ 1. 假突破/假跌破检测 ============
        # 规则：T+1 到 T+3 内，收盘价重新回到MA原侧
        
        if len(post_window) >= 1 and t0_idx >= len(recent) - 4:
            # 检查 T+1 到 T+3 是否回到MA原侧
            check_range = min(3, len(post_window))
            pulled_back = False
            
            for j in range(check_range):
                post_close = post_window.iloc[j]['close']
                # 突破后被拉回均线下方，或跌破后被拉回均线上方
                if (t0_type == 'up' and post_close < target_ma) or (t0_type == 'down' and post_close > target_ma):
                    pulled_back = True
                    break
            
            if pulled_back:
                trap_type = '诱多' if t0_type == 'up' else '诱空'
                result['pattern_type'] = f'假{action}'
                result['pattern_name'] = f'假{action}（{trap_type}）'
                result['is_valid'] = False
                result['confidence'] = '高'
                result['description'] = f'{action}MA后迅速被拉回均线{"下方" if t0_type == "up" else "上方"}，典型的{trap_type}形态'
                result['key_signals'].append(f'穿越均线后在T+{check_range}内被拉回')
                return result
        
        # ============ 2. 回抽突破/回抽跌破检测 ============
        # 规则：Cross -> Extend -> Pullback -> Bounce（N字型轨迹）
        # 动作A：T0 突破后，价格离开MA一段距离（最高点距离MA > 3%）
        # 动作B：价格回调，最低价触碰或逼近MA（距离 < 0.5%），但收盘价不跌破MA
        # 动作C：回抽后，下一根K线立刻收阳反身向上
        
        if len(post_window) >= 3:
            # 检查是否有 "远离 -> 回抽 -> 反弹" 的N字型
            has_extend = False
            has_pullback = False
            has_bounce = False
            pullback_idx = -1
            
            # 动作A：检查是否远离MA（距离 > 3%）
            for j, (_, k) in enumerate(post_window.iterrows()):
                distance_from_ma = abs(k['high'] - target_ma) / target_ma * 100 if t0_type == 'up' else abs(k['low'] - target_ma) / target_ma * 100
                if distance_from_ma > 3:
                    has_extend = True
                    break
            
            # 动作B：检查是否有回抽触碰MA（距离 < 0.5%），但收盘价保持在MA正确侧
            for j, (_, k) in enumerate(post_window.iterrows()):
                dist_to_ma = abs(k['low'] - target_ma) / target_ma * 100 if t0_type == 'up' else abs(k['high'] - target_ma) / target_ma * 100
                
                if dist_to_ma < 0.5:
                    # 检查收盘价是否仍保持在MA正确侧
                    if (t0_type == 'up' and k['close'] > target_ma) or (t0_type == 'down' and k['close'] < target_ma):
                        has_pullback = True
                        pullback_idx = j
                        break
            
            # 动作C：回抽后下一根K线反身向上/向下
            if has_pullback and pullback_idx + 1 < len(post_window):
                next_k = post_window.iloc[pullback_idx + 1]
                if t0_type == 'up' and next_k['close'] > post_window.iloc[pullback_idx]['close']:
                    has_bounce = True
                elif t0_type == 'down' and next_k['close'] < post_window.iloc[pullback_idx]['close']:
                    has_bounce = True
            
            # 判定回抽突破（即使没有明显的远离，只要有回抽+反弹也认可）
            if has_pullback and has_bounce:
                result['pattern_type'] = f'回抽{action}'
                result['pattern_name'] = f'回抽{action}（最确定）'
                result['is_valid'] = True
                result['confidence'] = '极高'
                result['description'] = f'击穿后回抽确认，触碰均线后无力反转并继续原方向，这是最确定的{action}形态'
                ma_role_change = f'均线由{terms["pre_action"]}转化为{terms["post_action"]}已确认'
                result['key_signals'].append('Cross(穿越) -> Pullback(回抽) -> Bounce(反弹)')
                return result
        
        # ============ 3. 反向突破/反向跌破检测 ============
        # 规则：先测试被拒，随后以更大动能反向打穿
        # 前置动作：T-5 到 T-2 内，价格曾接近MA但未能穿透，反而发生了背离均线的反弹
        # T0：反弹后迅速拐头，以极强动能反向击穿MA
        
        if len(pre_window) >= 3:
            # 检查前置窗口是否有"测试均线被拒绝"的动作
            test_rejected = False
            for j, (_, k) in enumerate(pre_window.iloc[-3:].iterrows()):
                # 突破：寻找压制反弹（触及均线后反弹向下，即被压制）
                # 跌破：寻找支撑反弹（触及均线后反弹向上，即获支撑）
                if t0_type == 'up':
                    # 向上突破前，价格曾触及MA但被压制（高点接近MA，收盘在下方）
                    if k['high'] >= target_ma * 0.99 and k['close'] < target_ma:
                        test_rejected = True
                        break
                else:
                    # 向下跌破前，价格曾触及MA但获支撑（低点接近MA，收盘在上方）
                    if k['low'] <= target_ma * 1.01 and k['close'] > target_ma:
                        test_rejected = True
                        break
            
            if test_rejected and t0_body_pct > 2:
                effect_desc = '爆发力' if t0_type == 'up' else '杀伤力'
                result['pattern_type'] = f'反向{action}'
                result['pattern_name'] = f'反向{action}（{effect_desc}最强）'
                result['is_valid'] = True
                result['confidence'] = '高'
                result['description'] = f'{terms["pre_action"]}反弹后反向{action}均线，实操中{effect_desc}最强'
                result['key_signals'].append('先测试被拒 -> 以更大动能反向击穿')
                return result
        
        # ============ 4. 有效突破/有效跌破检测 ============
        # 规则：
        # - 动能条件：T0 实体幅度 > 3%
        # - 排列条件：T+1 到 T+3 收盘价依次走高/走低，重叠度极低
        # - 背离条件：绝对不能跌破 T0 的开盘价（启动点）
        
        if t0_body_pct > 3:
            # 检查是否形成凌厉单边排列
            is_single_direction = True
            is_staircase = True  # 阶梯式上涨/下跌
            
            if len(post_window) >= 1:
                prev_close = t0_close
                for j, (_, k) in enumerate(post_window.iterrows()):
                    # 单边：同方向K线
                    if t0_type == 'up' and k['close'] < k['open']:
                        is_single_direction = False
                    elif t0_type == 'down' and k['close'] > k['open']:
                        is_single_direction = False
                    
                    # 阶梯：收盘价依次走高/走低
                    if t0_type == 'up' and k['close'] < prev_close:
                        is_staircase = False
                    elif t0_type == 'down' and k['close'] > prev_close:
                        is_staircase = False
                    
                    # 背离条件：不能跌破T0开盘价
                    if t0_type == 'up' and k['low'] < t0_open * 0.99:
                        is_single_direction = False
                        break
                    elif t0_type == 'down' and k['high'] > t0_open * 1.01:
                        is_single_direction = False
                        break
                    
                    prev_close = k['close']
            
            if is_single_direction:
                direction_desc = '上涨' if t0_type == 'up' else '下跌'
                result['pattern_type'] = f'有效{action}'
                result['pattern_name'] = f'有效{action}（典型）'
                result['is_valid'] = True
                result['confidence'] = '高'
                result['description'] = f"实体幅度{t0_body_pct:.1f}%，形成凌厉单边{direction_desc}"
                result['key_signals'].append(f'T0实体幅度{t0_body_pct:.1f}%，凌厉单边排列')
                return result
        
        # ============ 5. 慢速突破/慢速跌破检测 ============
        # 规则：
        # - 动能条件：穿越均线时的K线实体非常小（碎阳碎阴）
        # - 重叠度条件：T0 前后 5 根K线，价格区间高度重叠（>70%）
        # - 缠绕特征：均线趋于走平，价格在MA上下1%极小区间内反复摩擦
        
        if t0_body_pct < 2:  # 小实体
            # 检查前后K线的重叠度
            all_klines = pd.concat([pre_window.iloc[-3:] if len(pre_window) >= 3 else pre_window, 
                                    pd.DataFrame([t0]).T.reset_index(drop=True).T, 
                                    post_window.iloc[:3] if len(post_window) >= 3 else post_window])
            
            if len(all_klines) >= 3:
                # 计算价格区间重叠度
                all_highs = all_klines['high'].values
                all_lows = all_klines['low'].values
                
                overall_high = max(all_highs)
                overall_low = min(all_lows)
                overall_range = overall_high - overall_low
                
                if overall_range > 0:
                    # 计算重叠比例
                    overlap_count = 0
                    for j in range(len(all_klines)):
                        k = all_klines.iloc[j]
                        k_range = k['high'] - k['low']
                        if k_range > 0:
                            overlap_ratio = 1 - abs((k['high'] - k['low']) - overall_range) / overall_range
                            if overlap_ratio > 0.3:
                                overlap_count += 1
                    
                    if overlap_count >= len(all_klines) * 0.6:
                        result['pattern_type'] = f'慢速{action}'
                        result['pattern_name'] = f'慢速{action}（不可靠）'
                        result['is_valid'] = False
                        result['confidence'] = '中'
                        result['description'] = f'以盘整形态缓慢穿越均线，此类{action}最不可靠'
                        result['key_signals'].append('小实体碎阳碎阴，价格区间高度重叠')
                        return result
        
        # ============ 6. 普通突破/普通跌破（兜底逻辑） ============
        result['pattern_type'] = f'普通{action}'
        result['pattern_name'] = f'普通{action}'
        result['is_valid'] = None
        result['confidence'] = '低'
        result['description'] = f'特征不显著的普通穿越，需进一步观察'
        result['key_signals'].append('已穿越均线但特征不显著')
        
        return result

    def detect_divergence(self, df: pd.DataFrame, lookback: int = 60, macd_status: str = None) -> Dict:
        """
        检测MACD背离
        
        底背离定义：价格创新低，但MACD（或DIF）没有创新低
        顶背离定义：价格创新高，但MACD（或DIF）没有创新高
        
        背离四大特征（来自维度四文档）：
        1. 极强/极弱状态豁免：极强状态无视顶背离，极弱状态无视底背离
        2. 新高/新低前置条件：没有创新高/新低，禁止研判背离
        3. 零轴牵引确认：背离调整到位需要MACD拉回零轴
        4. 背离的级别传导：大级别拐点由次级别背离传导
        
        参数：
        - df: K线数据
        - lookback: 回溯K线数
        - macd_status: 当前MACD时空状态（用于豁免判断）
        
        返回：
        - top_divergence: 是否顶背离（或被豁免）
        - bottom_divergence: 是否底背离（或被豁免）
        - divergence_note: 背离说明
        - divergence_exemption: 是否被豁免
        - zero_axis_pull: 零轴牵引状态
        """
        result = {
            'top_divergence': False,
            'bottom_divergence': False,
            'divergence_note': '',
            'divergence_exemption': None,  # 豁免信息
            'zero_axis_pull': None,  # 零轴牵引状态
            'raw_top_divergence': False,  # 原始顶背离（未豁免）
            'raw_bottom_divergence': False  # 原始底背离（未豁免）
        }
        
        # ============ 特征1：极强/极弱状态豁免 ============
        # 极强状态：所有小级别的顶部背离全部失效
        # 极弱状态：所有小级别的底部背离全部失效
        exemption_info = None
        if macd_status == '极强':
            exemption_info = {
                'type': '极强豁免',
                'description': '极强状态下，所有小级别顶部背离失效（市场会用时间换空间消解）',
                'affects': 'top_divergence'
            }
        elif macd_status == '极弱':
            exemption_info = {
                'type': '极弱豁免',
                'description': '极弱状态下，所有小级别底部背离失效（市场会用时间换空间消解）',
                'affects': 'bottom_divergence'
            }
        
        if len(df) < lookback + 10:
            return result
        
        recent = df.tail(lookback).copy()
        
        # 找到最近的局部低点和高点
        from scipy.signal import argrelextrema
        
        try:
            # 使用较大的order来找到显著的拐点
            low_indices = argrelextrema(recent['low'].values, np.less, order=5)[0]
            high_indices = argrelextrema(recent['high'].values, np.greater, order=5)[0]
            
            # ============ 底背离检测 ============
            # 需要至少2个低点来比较
            if len(low_indices) >= 2:
                # 获取最近的两个低点
                recent_lows = low_indices[-2:]
                low1_idx = recent_lows[0]
                low2_idx = recent_lows[1]  # 更近的低点
                
                price1 = recent.iloc[low1_idx]['low']
                price2 = recent.iloc[low2_idx]['low']
                
                # 对应的MACD值
                macd1 = recent.iloc[low1_idx]['MACD']
                macd2 = recent.iloc[low2_idx]['MACD']
                
                # 对应的DIF值（用DIF判断更准确）
                dif1 = recent.iloc[low1_idx]['DIF']
                dif2 = recent.iloc[low2_idx]['DIF']
                
                # 底背离条件：
                # 1. 价格创新低（price2 < price1）
                # 2. MACD或DIF没有创新低（macd2 > macd1 或 dif2 > dif1）
                # 3. 两个低点间隔足够（至少5根K线）
                # 4. 都在零轴下方（底背离通常发生在零轴下方）
                
                if (price2 < price1 * 0.99 and  # 价格创新低，至少跌1%
                    low2_idx - low1_idx >= 5 and  # 间隔至少5根K线
                    macd2 > macd1 and  # MACD没创新低
                    macd2 < 0 and macd1 < 0):  # 都在零轴下方
                    
                    result['raw_bottom_divergence'] = True  # 记录原始背离
                    date1 = recent.iloc[low1_idx]['date'] if 'date' in recent.columns else f'第{low1_idx}根'
                    date2 = recent.iloc[low2_idx]['date'] if 'date' in recent.columns else f'第{low2_idx}根'
                    result['divergence_note'] = f'底背离：价格在{date2}创新低{price2:.2f}，但MACD({macd2:.4f})高于前低点{date1}的{macd1:.4f}'
                    
            # ============ 顶背离检测 ============
            if len(high_indices) >= 2:
                recent_highs = high_indices[-2:]
                high1_idx = recent_highs[0]
                high2_idx = recent_highs[1]
                
                price1 = recent.iloc[high1_idx]['high']
                price2 = recent.iloc[high2_idx]['high']
                
                macd1 = recent.iloc[high1_idx]['MACD']
                macd2 = recent.iloc[high2_idx]['MACD']
                
                dif1 = recent.iloc[high1_idx]['DIF']
                dif2 = recent.iloc[high2_idx]['DIF']
                
                # 顶背离条件：
                # 1. 价格创新高
                # 2. MACD或DIF没有创新高
                # 3. 都在零轴上方
                if (price2 > price1 * 1.01 and  # 价格创新高，至少涨1%
                    high2_idx - high1_idx >= 5 and
                    macd2 < macd1 and  # MACD没创新高
                    macd2 > 0 and macd1 > 0):  # 都在零轴上方
                    
                    result['raw_top_divergence'] = True  # 记录原始背离
                    date1 = recent.iloc[high1_idx]['date'] if 'date' in recent.columns else f'第{high1_idx}根'
                    date2 = recent.iloc[high2_idx]['date'] if 'date' in recent.columns else f'第{high2_idx}根'
                    note = f'顶背离：价格在{date2}创新高{price2:.2f}，但MACD({macd2:.4f})低于前高点{date1}的{macd1:.4f}'
                    if result['divergence_note']:
                        result['divergence_note'] += '；' + note
                    else:
                        result['divergence_note'] = note
                        
        except Exception as e:
            # 如果scipy失败，使用简化逻辑
            pass
        
        # ============ 应用豁免规则 ============
        # 极强状态豁免顶背离
        if result['raw_top_divergence'] and exemption_info and exemption_info['affects'] == 'top_divergence':
            result['top_divergence'] = False  # 豁免，不报告顶背离
            result['divergence_exemption'] = exemption_info
            result['divergence_note'] = f"[豁免]{result['divergence_note']}（极强状态下顶背离失效）"
        else:
            result['top_divergence'] = result['raw_top_divergence']
        
        # 极弱状态豁免底背离
        if result['raw_bottom_divergence'] and exemption_info and exemption_info['affects'] == 'bottom_divergence':
            result['bottom_divergence'] = False  # 豁免，不报告底背离
            result['divergence_exemption'] = exemption_info
            result['divergence_note'] = f"[豁免]{result['divergence_note']}（极弱状态下底背离失效）"
        else:
            result['bottom_divergence'] = result['raw_bottom_divergence']
        
        # ============ 特征3：零轴牵引确认 ============
        # 背离引发的调整是否到位，一个重要标志是MACD的快慢线必须至少被拉回至零轴附近
        if result['top_divergence'] or result['bottom_divergence']:
            latest_dif = df.iloc[-1]['DIF']
            latest_dea = df.iloc[-1]['DEA']
            
            # 检查是否已拉回零轴（DIF和DEA都在-0.1到0.1之间视为接近零轴）
            near_zero_threshold = 0.1
            dif_near_zero = abs(latest_dif) < near_zero_threshold
            dea_near_zero = abs(latest_dea) < near_zero_threshold
            
            result['zero_axis_pull'] = {
                'dif_near_zero': dif_near_zero,
                'dea_near_zero': dea_near_zero,
                'adjustment_complete': dif_near_zero and dea_near_zero,
                'description': '背离调整已到位（MACD拉回零轴）' if (dif_near_zero and dea_near_zero) else '背离调整未到位（等待MACD拉回零轴）'
            }
        
        return result
    
    def _find_valid_range(self, df: pd.DataFrame) -> Optional[Dict]:
        """
        确定有效区间（左边界 + 右边界）
        
        左边界（起点/原点）：
        - 判定条件：MACD 状态切换处（金叉/死叉，或 DIF 穿越零轴）
        - 价格特征：该时期内的绝对最高价或绝对最低价
        
        右边界（终点/破位点）：
        - 判定条件：趋势被破坏（MACD 背离，或价格有效跌破/突破 MA55 且反抽不破）
        - 价格特征：价格有效突破 MA55
        
        参数：
        - df: K线数据（需包含 DIF, DEA, MA55）
        
        返回：
        - {
            'start_idx': 起点索引,
            'end_idx': 终点索引,
            'start_date': 起点日期,
            'end_date': 终点日期,
            'start_price': 起点价格（原点价格）,
            'end_price': 终点价格,
            'origin_type': 'high' 或 'low'（原点是高点还是低点）,
            'break_type': 'MA55_up' 或 'MA55_down' 或 'MACD'
          }
        """
        if len(df) < 30:
            return None
        
        # 确保 DIF, DEA, MA55 存在
        if 'DIF' not in df.columns or 'DEA' not in df.columns:
            # 尝试小写字段
            if 'dif' in df.columns:
                df['DIF'] = df['dif']
            if 'dea' in df.columns:
                df['DEA'] = df['dea']
        
        if 'MA55' not in df.columns:
            return None
        
        # 检查 DIF, DEA 是否有效
        has_dif = 'DIF' in df.columns and not df['DIF'].isna().all()
        has_dea = 'DEA' in df.columns and not df['DEA'].isna().all()
        
        if not has_dif or not has_dea:
            return None  # 没有 MACD 数据，无法确定有效区间
        
        # ============ 寻找左边界（起点/原点）============
        # 策略：找到所有 MACD 状态切换点，选择最早的一个（但不要太早）
        # 确保区间足够长，能形成完整的结构
        
        left_boundary = None
        origin_type = None  # 'high' 或 'low'
        
        # 找到所有 MACD 状态切换点
        switch_points = []
        for i in range(5, len(df) - 2):
            curr_dif = df.iloc[i]['DIF']
            curr_dea = df.iloc[i]['DEA']
            prev_dif = df.iloc[i - 1]['DIF']
            prev_dea = df.iloc[i - 1]['DEA']
            
            # 检查金叉/死叉
            is_golden_cross = prev_dif <= prev_dea and curr_dif > curr_dea
            is_death_cross = prev_dif >= prev_dea and curr_dif < curr_dea
            
            # 检查 DIF 穿越零轴
            is_cross_zero_up = prev_dif <= 0 and curr_dif > 0
            is_cross_zero_down = prev_dif >= 0 and curr_dif < 0
            
            if is_golden_cross or is_cross_zero_up:
                switch_points.append((i, 'golden', 'low'))  # 金叉/上穿零轴，找低点
            elif is_death_cross or is_cross_zero_down:
                switch_points.append((i, 'death', 'high'))  # 死叉/下穿零轴，找高点
        
        # 从最早的切换点开始找（但确保区间足够长）
        # 优先选择区间长度在 60-120 根 K 线的切换点
        for idx, switch_type, point_type in switch_points:
            # 计算区间长度
            range_length = len(df) - 1 - idx
            if range_length >= 60 and range_length <= 200:
                left_boundary = idx
                origin_type = point_type
                break
        
        # 如果没有找到合适的切换点，选择最早的切换点
        if left_boundary is None and switch_points:
            idx, switch_type, point_type = switch_points[0]
            if len(df) - 1 - idx >= 30:
                left_boundary = idx
                origin_type = point_type
        
        if left_boundary is None:
            # 没有找到状态切换点，返回 None 使用原始数据
            return None
        
        # 在左边界附近（前后各 5 根 K 线）找极值价格作为原点
        search_start = max(0, left_boundary - 5)
        search_end = min(len(df), left_boundary + 6)
        search_range = df.iloc[search_start:search_end]
        
        if origin_type == 'low':
            # 找最低价
            min_idx = search_range['low'].idxmin()
            left_boundary = min_idx
        else:
            # 找最高价
            max_idx = search_range['high'].idxmax()
            left_boundary = max_idx
        
        if left_boundary is None:
            # 没有找到状态切换点，使用数据的第一个高点/低点
            # 找前 20 根 K 线的极值点
            first_20 = df.head(20)
            if first_20['high'].max() > first_20['low'].min():
                # 找最高点
                left_boundary = first_20['high'].idxmax()
                origin_type = 'high'
            else:
                left_boundary = first_20['low'].idxmin()
                origin_type = 'low'
        
        # ============ 寻找右边界（终点/破位点）============
        # 策略优化（基于 Gemini 建议）：
        # 
        # 原有逻辑问题：当价格跌破 MA55 后，算法立即终止，导致后续走势（可能又涨回）被丢弃。
        # 这不符合三位一体策略的实际应用——破位后的走势也应该被聚类分析。
        # 
        # 新策略：
        # 1. 放开右边界，强制分析到最后一天
        # 2. 让箱体聚类算法自动处理破位后的走势
        # 3. 聚类算法会把破位后的走势识别为"延伸 C 类"或新的中枢
        #
        # 这样可以确保分析到最新数据，同时不影响结构识别的准确性
        
        right_boundary = len(df) - 1  # 强制使用最新数据作为右边界
        break_type = 'current'  # 标记为当前进行中
        
        # 保留原有的破位检测逻辑，用于记录但不截断分析区间
        # 这可以用于后续的"重点提醒"功能
        first_break_idx = None
        first_break_type = None
        
        for i in range(left_boundary + 10, len(df)):
            curr_close = df.iloc[i]['close']
            curr_ma55 = df.iloc[i]['MA55']
            
            if pd.isna(curr_ma55):
                continue
            
            # 记录第一次破位（但不终止分析）
            if origin_type == 'low':
                # 原点是低点（上涨波段），记录第一次跌破 MA55
                if curr_close < curr_ma55 and first_break_idx is None:
                    # 确认有效跌破（连续 2 根 K 线跌破）
                    if i + 1 < len(df) and df.iloc[i + 1]['close'] < df.iloc[i + 1]['MA55']:
                        first_break_idx = i
                        first_break_type = 'MA55_down'
            else:
                # 原点是高点（下跌波段），记录第一次突破 MA55
                if curr_close > curr_ma55 and first_break_idx is None:
                    # 确认有效突破（连续 2 根 K 线突破）
                    if i + 1 < len(df) and df.iloc[i + 1]['close'] > df.iloc[i + 1]['MA55']:
                        first_break_idx = i
                        first_break_type = 'MA55_up'
        
        # 如果有破位记录，标记 break_type（用于重点提醒）
        if first_break_idx is not None:
            break_type = first_break_type
        
        # 检查有效区间长度，如果太短则返回 None
        range_length = right_boundary - left_boundary + 1
        if range_length < 30:
            # 区间太短，不足以识别结构，返回 None 使用原始数据
            return None
        
        # 获取价格信息
        if origin_type == 'high':
            start_price = df.iloc[left_boundary]['high']
        else:
            start_price = df.iloc[left_boundary]['low']
        
        end_price = df.iloc[right_boundary]['close']
        
        # 获取日期
        start_date = df.iloc[left_boundary].get('date', str(left_boundary))
        end_date = df.iloc[right_boundary].get('date', str(right_boundary))
        
        # 格式化日期
        if hasattr(start_date, 'strftime'):
            start_date = start_date.strftime('%Y-%m-%d')
        elif isinstance(start_date, str) and ' ' in start_date:
            start_date = start_date.split(' ')[0]
        
        if hasattr(end_date, 'strftime'):
            end_date = end_date.strftime('%Y-%m-%d')
        elif isinstance(end_date, str) and ' ' in end_date:
            end_date = end_date.split(' ')[0]
        
        return {
            'start_idx': left_boundary,
            'end_idx': right_boundary,
            'start_date': start_date,
            'end_date': end_date,
            'start_price': round(start_price, 2),
            'end_price': round(end_price, 2),
            'origin_type': origin_type,
            'break_type': break_type
        }

    def _create_structure_result(self) -> Dict[str, Any]:
        """创建结构分析结果骨架，保持对外字段兼容。"""
        return {
            'structure_type': 'unknown',
            'structure_stage': 'unknown',
            'trend_direction': 'unknown',
            'inflection_points': 0,
            'segment_count': 0,
            'description': '',
            'interpretation': {},
            'structure_details': {
                'top_fractals': [],
                'bottom_fractals': [],
                'strokes': [],
                'judgment_criteria': '',
                'line_geometry': {
                    'price_range': None,
                    'points': [],
                    'segments': []
                },
                'render_payload': self._create_empty_render_payload(),
                'explainability': {},
                'pipeline': {}
            }
        }

    def _create_empty_render_payload(self) -> Dict[str, Any]:
        """创建画线层直接消费的默认 render payload。"""
        padding = {
            'top': self.STRUCTURE_RENDER_PADDING,
            'right': self.STRUCTURE_RENDER_PADDING,
            'bottom': self.STRUCTURE_RENDER_PADDING,
            'left': self.STRUCTURE_RENDER_PADDING
        }
        draw_height = (
            self.STRUCTURE_RENDER_HEIGHT
            - (self.STRUCTURE_RENDER_PADDING * 2)
            - self.STRUCTURE_RENDER_DATE_LABEL_HEIGHT
        )
        draw_width = self.STRUCTURE_RENDER_WIDTH - (self.STRUCTURE_RENDER_PADDING * 2)

        return {
            'version': 1,
            'viewport': {
                'width': self.STRUCTURE_RENDER_WIDTH,
                'height': self.STRUCTURE_RENDER_HEIGHT,
                'padding': padding,
                'draw_width': draw_width,
                'draw_height': draw_height,
                'date_label_y': self.STRUCTURE_RENDER_HEIGHT - 10,
                'label_box': {
                    'width': 36,
                    'height': 14,
                    'radius': 2
                }
            },
            'price_range': None,
            'points': [],
            'segments': [],
            'point_count': 0,
            'segment_count': 0
        }

    def _normalize_render_date(self, value: Any, date_only: bool = False) -> str:
        """将时间字段统一为前端画线层可直接显示的字符串。"""
        if value is None:
            return ''

        if hasattr(value, 'strftime'):
            if date_only:
                return value.strftime('%Y-%m-%d')
            return value.strftime('%Y-%m-%d %H:%M')

        text = str(value)
        if date_only:
            if ' ' in text:
                return text.split(' ')[0]
            if 'T' in text:
                return text.split('T')[0]
        return text

    def _determine_structure_trend(self, df: pd.DataFrame) -> str:
        """基于前后半段均价变化给结构识别一个趋势背景。"""
        if len(df) < 2:
            return '震荡'

        half = max(1, len(df) // 2)
        first_half_mean = df.head(half)['close'].mean()
        second_half_mean = df.tail(half)['close'].mean()

        if first_half_mean == 0 or pd.isna(first_half_mean) or pd.isna(second_half_mean):
            return '震荡'

        trend_change = (second_half_mean - first_half_mean) / first_half_mean * 100

        if trend_change > 5:
            return '上涨'
        if trend_change < -5:
            return '下跌'
        return '震荡'

    def _serialize_valid_range(self, valid_range: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """格式化有效区间信息，便于前端和后续画线逻辑直接使用。"""
        if not valid_range:
            return None

        return {
            'start_date': valid_range['start_date'],
            'end_date': valid_range['end_date'],
            'start_price': valid_range['start_price'],
            'end_price': valid_range['end_price'],
            'origin_type': valid_range['origin_type'],
            'break_type': valid_range.get('break_type', 'MA55')
        }

    def _process_containment(self, df: pd.DataFrame) -> pd.DataFrame:
        """处理K线包含关系，输出后续分型识别所需的干净K线序列。"""
        if len(df) < 3:
            return df

        processed: List[Dict[str, Any]] = []
        i = 0
        while i < len(df):
            if i == 0:
                processed.append(df.iloc[i].to_dict())
                i += 1
                continue

            curr = df.iloc[i]
            prev = pd.Series(processed[-1])

            curr_high = curr['high']
            curr_low = curr['low']
            prev_high = prev['high']
            prev_low = prev['low']

            has_containment = (
                (curr_high <= prev_high and curr_low >= prev_low) or
                (prev_high <= curr_high and prev_low >= curr_low)
            )

            if has_containment:
                if len(processed) >= 2:
                    prev_prev = processed[-2]
                    is_up = prev_high >= prev_prev['high']
                else:
                    is_up = True

                if is_up:
                    merged_high = max(prev_high, curr_high)
                    merged_low = max(prev_low, curr_low)
                else:
                    merged_high = min(prev_high, curr_high)
                    merged_low = min(prev_low, curr_low)

                processed[-1]['high'] = merged_high
                processed[-1]['low'] = merged_low
                if 'date' in curr:
                    processed[-1]['date'] = curr['date']
                if 'close' in curr:
                    processed[-1]['close'] = curr['close']
            else:
                processed.append(curr.to_dict())

            i += 1

        return pd.DataFrame(processed)

    def _detect_fractals(self, processed_df: pd.DataFrame) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """识别原始顶底分型。"""
        top_fractals: List[Dict[str, Any]] = []
        bottom_fractals: List[Dict[str, Any]] = []

        for i in range(1, len(processed_df) - 1):
            prev_high = processed_df.iloc[i - 1]['high']
            curr_high = processed_df.iloc[i]['high']
            next_high = processed_df.iloc[i + 1]['high']
            prev_low = processed_df.iloc[i - 1]['low']
            curr_low = processed_df.iloc[i]['low']
            next_low = processed_df.iloc[i + 1]['low']

            if curr_high > prev_high and curr_high > next_high:
                if curr_low > prev_low and curr_low > next_low:
                    top_fractals.append({
                        'index': i,
                        'date': processed_df.iloc[i].get('date', str(i)),
                        'high': curr_high,
                        'low': curr_low,
                        'type': 'top'
                    })

            if curr_low < prev_low and curr_low < next_low:
                if curr_high < prev_high and curr_high < next_high:
                    bottom_fractals.append({
                        'index': i,
                        'date': processed_df.iloc[i].get('date', str(i)),
                        'high': curr_high,
                        'low': curr_low,
                        'type': 'bottom'
                    })

        return top_fractals, bottom_fractals

    def _serialize_fractals(self, fractals: List[Dict[str, Any]], price_key: str) -> List[Dict[str, Any]]:
        """裁剪并格式化分型，用于结构结果输出。"""
        serialized = []
        for fractal in fractals[-self.STRUCTURE_FRACTAL_DISPLAY_LIMIT:]:
            serialized.append({
                'index': fractal['index'],
                'date': fractal['date'],
                price_key: round(fractal[price_key], 2)
            })
        return serialized

    def _merge_and_validate_fractals(
        self,
        top_fractals: List[Dict[str, Any]],
        bottom_fractals: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """合并顶底分型，并先做一轮相邻同类与极值合法性过滤。"""
        all_fractals = [{**f, 'type': 'top'} for f in top_fractals]
        all_fractals.extend({**f, 'type': 'bottom'} for f in bottom_fractals)
        all_fractals.sort(key=lambda x: x['index'])

        filtered_fractals: List[Dict[str, Any]] = []
        for fractal in all_fractals:
            if not filtered_fractals:
                filtered_fractals.append(fractal)
                continue

            last = filtered_fractals[-1]
            if last['type'] == fractal['type']:
                if fractal['type'] == 'top':
                    if fractal['high'] > last['high']:
                        filtered_fractals[-1] = fractal
                else:
                    if fractal['low'] < last['low']:
                        filtered_fractals[-1] = fractal
                continue

            if fractal['type'] == 'top':
                if fractal['high'] > last['low']:
                    filtered_fractals.append(fractal)
            else:
                if fractal['low'] < last['high']:
                    filtered_fractals.append(fractal)

        return filtered_fractals

    def _build_strokes_iterative(self, fractals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """按缠论约束迭代收敛有效分型序列。"""
        if len(fractals) < 2:
            return fractals

        changed = True
        while changed:
            changed = False
            result = [fractals[0]]

            for current in fractals[1:]:
                last = result[-1]

                if current['type'] == last['type']:
                    if current['type'] == 'top':
                        if current['high'] > last['high']:
                            result[-1] = current
                            changed = True
                    else:
                        if current['low'] < last['low']:
                            result[-1] = current
                            changed = True
                    continue

                gap = current['index'] - last['index']
                if gap >= 3:
                    valid = True
                    if last['type'] == 'top':
                        if current['low'] >= last['high']:
                            valid = False
                    else:
                        if current['high'] <= last['low']:
                            valid = False

                    if valid:
                        result.append(current)
                    else:
                        if current['type'] == 'top':
                            if current['high'] > last['high']:
                                result[-1] = current
                                changed = True
                        else:
                            if current['low'] < last['low']:
                                result[-1] = current
                                changed = True
                else:
                    # 相邻异类分型间距不足，不构成有效笔，保留旧分型。
                    pass

            fractals = result

        return fractals

    def _build_confirmed_strokes(
        self,
        final_fractals: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """从最终分型序列构建确认完成的笔。"""
        strokes: List[Dict[str, Any]] = []
        valid_fractals: List[Dict[str, Any]] = []

        for i in range(len(final_fractals) - 1):
            from_fractal = final_fractals[i]
            to_fractal = final_fractals[i + 1]

            if from_fractal['type'] != to_fractal['type']:
                strokes.append({
                    'from': from_fractal,
                    'to': to_fractal,
                    'length': to_fractal['index'] - from_fractal['index']
                })
                if i == 0:
                    valid_fractals.append(from_fractal)
                valid_fractals.append(to_fractal)

        return strokes, valid_fractals

    def _resolve_stroke_prices_and_direction(
        self,
        from_fractal: Dict[str, Any],
        to_fractal: Dict[str, Any]
    ) -> Dict[str, Any]:
        """根据分型类型得到更适合画线和结构识别的笔价格与方向。"""
        from_type = from_fractal['type']
        to_type = to_fractal['type']

        from_price = from_fractal['high'] if from_type == 'top' else from_fractal['low']
        to_price = to_fractal['high'] if to_type == 'top' else to_fractal['low']

        direction = '上涨' if to_price > from_price else '下跌'

        if from_type == 'top' and to_type == 'bottom' and direction == '上涨':
            to_price_alt = to_fractal['high']
            if to_price_alt < from_price:
                direction = '下跌'
                to_price = to_price_alt

        if from_type == 'bottom' and to_type == 'top' and direction == '下跌':
            to_price_alt = to_fractal['low']
            if to_price_alt > from_price:
                direction = '上涨'
                to_price = to_price_alt

        return {
            'from_price': round(from_price, 2),
            'to_price': round(to_price, 2),
            'direction': direction
        }

    def _build_render_strokes(
        self,
        strokes: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """构建前端当前使用的画线笔列表，并保留对应的分型锚点。"""
        render_source = strokes[-self.STRUCTURE_STROKE_WINDOW:]
        stroke_list: List[Dict[str, Any]] = []
        render_fractals: List[Dict[str, Any]] = []

        for i, stroke in enumerate(render_source):
            from_fractal = stroke['from']
            to_fractal = stroke['to']
            stroke_meta = self._resolve_stroke_prices_and_direction(from_fractal, to_fractal)

            stroke_list.append({
                'from_date': from_fractal.get('date', str(from_fractal['index'])),
                'to_date': to_fractal.get('date', str(to_fractal['index'])),
                'from_price': stroke_meta['from_price'],
                'to_price': stroke_meta['to_price'],
                'direction': stroke_meta['direction'],
                'length': stroke['length'],
                'from_type': from_fractal['type'],
                'to_type': to_fractal['type']
            })

            if i == 0:
                render_fractals.append(from_fractal)
            render_fractals.append(to_fractal)

        return stroke_list, render_fractals

    def _append_current_stroke_from_fractal(
        self,
        stroke_list: List[Dict[str, Any]],
        from_fractal: Dict[str, Any],
        to_date: Any,
        to_price: float,
        direction: str,
        length: int
    ) -> None:
        """向画线结果中追加一笔进行中的笔。"""
        from_price = from_fractal['high'] if from_fractal['type'] == 'top' else from_fractal['low']
        stroke_list.append({
            'from_date': from_fractal.get('date', str(from_fractal['index'])),
            'to_date': to_date,
            'from_price': round(from_price, 2),
            'to_price': round(to_price, 2),
            'direction': direction,
            'length': length,
            'from_type': from_fractal['type'],
            'to_type': 'current',
            'is_current': True
        })

    def _append_current_render_stroke(
        self,
        stroke_list: List[Dict[str, Any]],
        render_fractals: List[Dict[str, Any]],
        processed_df: pd.DataFrame
    ) -> None:
        """如果最新K线尚未形成新分型，则补上一笔进行中的延伸笔。"""
        if not render_fractals or len(processed_df) == 0:
            return

        last_valid = render_fractals[-1]
        last_kline = processed_df.iloc[-1]
        last_kline_index = len(processed_df) - 1

        if last_valid['index'] >= last_kline_index:
            return

        # 已确认笔锚定分型极值；未完成当前笔锚定最新收盘价，减少日内高低点噪音并反映“当下”位置。
        latest_close = last_kline['close']
        latest_date = last_kline.get('date', str(last_kline_index))

        if last_valid['type'] == 'top':
            from_price = last_valid['high']
            if latest_close < from_price:
                self._append_current_stroke_from_fractal(
                    stroke_list, last_valid, latest_date, latest_close, '下跌',
                    last_kline_index - last_valid['index']
                )
            else:
                if len(render_fractals) >= 2 and render_fractals[-2]['type'] == 'bottom':
                    prev_valid = render_fractals[-2]
                    if stroke_list and stroke_list[-1].get('to_type') == 'top':
                        stroke_list.pop()
                    self._append_current_stroke_from_fractal(
                        stroke_list, prev_valid, latest_date, latest_close, '上涨',
                        last_kline_index - prev_valid['index']
                    )
                else:
                    self._append_current_stroke_from_fractal(
                        stroke_list, last_valid, latest_date, latest_close, '上涨',
                        last_kline_index - last_valid['index']
                    )
        else:
            from_price = last_valid['low']
            if latest_close > from_price:
                self._append_current_stroke_from_fractal(
                    stroke_list, last_valid, latest_date, latest_close, '上涨',
                    last_kline_index - last_valid['index']
                )
            else:
                if len(render_fractals) >= 2 and render_fractals[-2]['type'] == 'top':
                    prev_valid = render_fractals[-2]
                    if stroke_list and stroke_list[-1].get('to_type') == 'bottom':
                        stroke_list.pop()
                    self._append_current_stroke_from_fractal(
                        stroke_list, prev_valid, latest_date, latest_close, '下跌',
                        last_kline_index - prev_valid['index']
                    )
                else:
                    self._append_current_stroke_from_fractal(
                        stroke_list, last_valid, latest_date, latest_close, '下跌',
                        last_kline_index - last_valid['index']
                    )

    def _build_line_geometry(self, stroke_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """提供给后续画线优化直接消费的几何数据。"""
        if not stroke_list:
            return {
                'price_range': None,
                'points': [],
                'segments': [],
                'point_count': 0,
                'segment_count': 0
            }

        prices = [price for stroke in stroke_list for price in (stroke['from_price'], stroke['to_price'])]
        min_price = min(prices)
        max_price = max(prices)
        price_span = max_price - min_price or 1

        points: List[Dict[str, Any]] = []
        for i, stroke in enumerate(stroke_list):
            if i == 0:
                points.append({
                    'sequence': 0,
                    'price': stroke['from_price'],
                    'date': stroke['from_date'],
                    'type': stroke['from_type'],
                    'role': 'from'
                })
            points.append({
                'sequence': i + 1,
                'price': stroke['to_price'],
                'date': stroke['to_date'],
                'type': stroke['to_type'],
                'role': 'to',
                'is_current': bool(stroke.get('is_current'))
                })

        total_points = len(points)
        for i, point in enumerate(points):
            point['x_ratio'] = round(i / (total_points - 1), 6) if total_points > 1 else 0.0
            point['y_ratio'] = round(1 - ((point['price'] - min_price) / price_span), 6)

            point_type = point.get('type')
            if point_type == 'top':
                point['label_side'] = 'above'
            elif point_type == 'bottom':
                point['label_side'] = 'below'
            elif point_type == 'current' and i > 0:
                point['label_side'] = 'above' if point['price'] >= points[i - 1]['price'] else 'below'
            else:
                point['label_side'] = 'below'

        segments = []
        for i, stroke in enumerate(stroke_list):
            segments.append({
                'sequence': i,
                'from_point': i,
                'to_point': i + 1,
                'direction': stroke['direction'],
                'length': stroke['length'],
                'is_current': bool(stroke.get('is_current')),
                'from_price': stroke['from_price'],
                'to_price': stroke['to_price']
            })

        return {
            'price_range': {
                'min': round(min_price, 2),
                'max': round(max_price, 2),
                'range': round(max_price - min_price, 2)
            },
            'points': points,
            'segments': segments,
            'point_count': len(points),
            'segment_count': len(segments)
        }

    def _build_render_payload(self, line_geometry: Dict[str, Any]) -> Dict[str, Any]:
        """基于原始几何层，构建前端 SVG 可直接消费的画线 payload。"""
        payload = self._create_empty_render_payload()
        points = line_geometry.get('points', [])
        segments = line_geometry.get('segments', [])
        if not points:
            return payload

        viewport = payload['viewport']
        padding = viewport['padding']
        draw_width = viewport['draw_width']
        draw_height = viewport['draw_height']
        label_box = viewport['label_box']
        label_box_width = label_box['width']
        label_box_height = label_box['height']
        date_label_y = viewport['date_label_y']

        render_points: List[Dict[str, Any]] = []
        total_points = len(points)
        for point in points:
            x = padding['left'] + (point.get('x_ratio', 0.0) * draw_width)
            y = padding['top'] + (point.get('y_ratio', 0.0) * draw_height)
            label_side = point.get('label_side', 'below')
            label_y = y - 15 if label_side == 'above' else y + 18
            point_type = point.get('type')
            is_current = bool(point.get('is_current'))

            if point_type == 'top':
                marker_fill = '#ef4444'
            elif point_type == 'current':
                marker_fill = '#fbbf24'
            else:
                marker_fill = '#22c55e'

            show_date_label = (
                point.get('sequence') in (0, total_points - 1)
                or is_current
            )

            render_points.append({
                'sequence': point.get('sequence', 0),
                'point_id': point.get('point_id'),
                'type': point_type,
                'role': point.get('role'),
                'price': float(point.get('price', 0.0)),
                'price_label': f"{float(point.get('price', 0.0)):.1f}",
                'date': self._normalize_render_date(point.get('date')),
                'date_label': self._normalize_render_date(point.get('date'), date_only=True),
                'x': round(float(x), 3),
                'y': round(float(y), 3),
                'label_x': round(float(x), 3),
                'label_y': round(float(label_y), 3),
                'label_side': label_side,
                'label_box_width': label_box_width,
                'label_box_height': label_box_height,
                'marker_radius': 5,
                'marker_fill': marker_fill,
                'marker_stroke': 'white',
                'marker_stroke_width': 1.5,
                'show_date_label': show_date_label,
                'date_label_y': date_label_y,
                'is_current': is_current
            })

        render_segments: List[Dict[str, Any]] = []
        for segment in segments:
            from_point = render_points[segment['from_point']]
            to_point = render_points[segment['to_point']]
            is_current = bool(segment.get('is_current'))
            direction = segment.get('direction')
            render_segments.append({
                'sequence': segment.get('sequence', 0),
                'segment_id': segment.get('segment_id'),
                'from_point': segment['from_point'],
                'to_point': segment['to_point'],
                'x1': from_point['x'],
                'y1': from_point['y'],
                'x2': to_point['x'],
                'y2': to_point['y'],
                'direction': direction,
                'length': segment.get('length', 0),
                'is_current': is_current,
                'stroke': '#ef4444' if direction == '上涨' else '#22c55e',
                'stroke_width': 2,
                'stroke_dasharray': '4,2' if is_current else None
            })

        payload['price_range'] = line_geometry.get('price_range')
        payload['points'] = render_points
        payload['segments'] = render_segments
        payload['point_count'] = len(render_points)
        payload['segment_count'] = len(render_segments)
        return payload

    def _resolve_structure_profile(self, structure_type: str) -> Tuple[str, Optional[str], str]:
        """Resolve structure family, visible numbering prefix, and standard qualification."""
        mapping = {
            'A五段式': ('A', 'a', 'standard'),
            '延伸A': ('A', None, 'extended'),
            '延伸A类': ('A', None, 'extended'),
            'B双平台式': ('B', 'b', 'standard'),
            '延伸B': ('B', None, 'extended'),
            '延伸B类': ('B', None, 'extended'),
            'C单平台式': ('C', 'c', 'standard'),
            '延伸C': ('C', None, 'extended'),
            '延伸C类': ('C', None, 'extended'),
            'D三段式': ('D', 'd', 'standard'),
            '延伸D': ('D', None, 'extended'),
            '延伸D类': ('D', None, 'extended'),
            '结构未完成': ('unfinished', None, 'unfinished'),
            '未完成结构': ('unfinished', None, 'unfinished'),
            '延伸结构': ('extended', None, 'extended'),
            '复杂结构': ('complex', None, 'failed'),
            '上升通道': ('channel', None, 'over_limit'),
            '下降通道': ('channel', None, 'over_limit'),
            '大平台震荡': ('range', None, 'over_limit'),
        }
        return mapping.get(structure_type, ('complex', None, 'failed'))

    def _resolve_structure_family(self, structure_type: str) -> Tuple[str, Optional[str]]:
        """Map structure type to explainability family and point id prefix."""
        family, prefix, _ = self._resolve_structure_profile(structure_type)
        return family, prefix

    def _build_extended_structure_type(self, family: str) -> str:
        mapping = {
            'A': '延伸A类',
            'B': '延伸B类',
            'C': '延伸C类',
            'D': '延伸D类',
        }
        return mapping.get(family, '复杂结构')

    def _get_standard_structure_limit(self, structure_type: str) -> Optional[int]:
        limits = {
            'A五段式': 6,
            'B双平台式': 10,
            'C单平台式': 6,
            'D三段式': 4,
        }
        return limits.get(structure_type)

    def _summarize_macro_components(self, macro_components: List[Any]) -> List[str]:
        summary: List[str] = []
        for component in macro_components or []:
            if hasattr(component, 'to_dict'):
                data = component.to_dict()
            elif isinstance(component, dict):
                data = component
            else:
                continue
            summary.append(f"{data.get('type')}({len(data.get('strokes', []))}笔)")
        return summary

    def _classify_structure_by_counts(
        self,
        stroke_count: int,
        inflection_count: int
    ) -> Tuple[str, str, str, List[str]]:
        """Fallback classification when macro component clustering is unavailable."""
        criteria: List[str] = []
        if stroke_count == 3:
            criteria.append("✅ D类结构（兜底）：笔数=3")
            return ('D三段式', 'd1-d4拐点区间', f"D三段式结构，{stroke_count}笔{inflection_count}拐点", criteria)
        if stroke_count == 5:
            criteria.append("✅ C类结构（兜底）：笔数=5")
            return ('C单平台式', 'c1-c6拐点区间', f"单平台结构，{stroke_count}笔{inflection_count}拐点", criteria)
        if stroke_count == 9:
            criteria.append("✅ B类结构（兜底）：笔数=9")
            return ('B双平台式', 'b1-b10拐点区间', f"B双平台式结构，{stroke_count}笔{inflection_count}拐点", criteria)
        if stroke_count < 3:
            criteria.append(f"⚠️ 笔数={stroke_count} < 3，结构未完成")
            return ('结构未完成', f'{inflection_count}个拐点', f"结构未完成，{stroke_count}笔", criteria)
        if stroke_count in [4, 6, 7, 8]:
            criteria.append(f"⚠️ 笔数={stroke_count}，非标准结构，建议升维分析")
            return ('延伸结构', f'{inflection_count}个拐点', f"延伸结构，{stroke_count}笔，建议升维分析", criteria)
        criteria.append(f"⚠️ 笔数={stroke_count}，结构复杂")
        return ('复杂结构', f'{inflection_count}个拐点', f"复杂结构，{stroke_count}笔，需人工确认", criteria)

    def _determine_stroke_trend(self, strokes: List[Dict[str, Any]]) -> str:
        """Infer the focused structure trend from the focused stroke slice."""
        if not strokes:
            return '震荡'

        first_price = strokes[0].get('from_price')
        last_price = strokes[-1].get('to_price')
        if not isinstance(first_price, (int, float)) or not isinstance(last_price, (int, float)):
            return '震荡'
        if first_price == 0:
            return '震荡'

        change_pct = (float(last_price) - float(first_price)) / float(first_price) * 100
        if change_pct > 5:
            return '上涨'
        if change_pct < -5:
            return '下跌'
        return '震荡'

    def _build_focus_structure_classification(
        self,
        focused_strokes: List[Dict[str, Any]],
        inflection_count: int,
        trend_direction: str,
        preferred_structure_type: Optional[str] = None,
        preferred_structure_stage: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Classify the currently focused structure slice and qualify standard vs extended."""
        focused_macro_components = self._consolidate_boxes(focused_strokes, threshold=0.55)
        if preferred_structure_type:
            structure_type = preferred_structure_type
            structure_stage = preferred_structure_stage or f'{preferred_structure_type}聚焦区间'
            description = f'峰值切片后聚焦{preferred_structure_type}'
            criteria = [f'✅ 峰值切片优先采用右侧结构：{preferred_structure_type}']
        elif focused_macro_components:
            structure_type, structure_stage, description, criteria = self._classify_structure_by_macro_components(
                focused_macro_components,
                trend_direction,
            )
        else:
            structure_type, structure_stage, description, criteria = self._classify_structure_by_counts(
                len(focused_strokes),
                inflection_count,
            )

        family, _, qualification = self._resolve_structure_profile(structure_type)
        qualification_reason = None
        public_structure_type = structure_type
        public_structure_stage = structure_stage
        public_description = description

        limit = self._get_standard_structure_limit(structure_type)
        if qualification == 'standard' and isinstance(limit, int) and inflection_count > limit:
            public_structure_type = self._build_extended_structure_type(family)
            public_structure_stage = f'超出标准点数，按{public_structure_type}跟踪'
            public_description = f'当前聚焦区间仍属{family}类原型，但已超出标准点数'
            qualification = 'extended'
            qualification_reason = f'超出标准点数，按{public_structure_type}跟踪'
            criteria = list(criteria) + [f'⚠️ 当前聚焦区间超出{structure_type}标准点数，停止标准编号']
        elif qualification == 'extended':
            qualification_reason = f'当前聚焦区间为{structure_type}，停止标准编号'
        elif family == 'complex':
            qualification_reason = '当前聚焦区间暂无法归入标准或延伸原型'
        elif family == 'unfinished':
            qualification_reason = '当前聚焦区间仍未形成可执行结构'

        return {
            'type': public_structure_type,
            'stage': public_structure_stage,
            'description': public_description,
            'archetype_family': family,
            'standard_qualification': qualification,
            'qualification_reason': qualification_reason,
            'trend_direction': trend_direction,
            'component_summary': self._summarize_macro_components(focused_macro_components),
            'criteria': list(criteria),
        }

    def _extract_stage_point_id(
        self,
        stage: str,
        prefix: Optional[str],
        point_ids: List[str]
    ) -> Optional[str]:
        """Extract a point id from stage text and return None when unavailable."""
        stage_text = str(stage or '').lower()
        if not stage_text:
            return None

        candidate: Optional[str] = None
        if prefix:
            prefix_text = str(prefix).lower()
            match = re.search(rf'{re.escape(prefix_text)}(\d+)', stage_text)
            if match:
                candidate = f'{prefix_text}{match.group(1)}'
        else:
            match = re.search(r'第\s*(\d+)\s*个?拐点', stage_text)
            if match:
                candidate = f'p{match.group(1)}'
            else:
                fallback_match = re.search(r'p(\d+)', stage_text)
                if fallback_match:
                    candidate = f'p{fallback_match.group(1)}'

        if candidate and candidate in point_ids:
            return candidate
        return None

    def _build_structure_explainability(
        self,
        structure_type: str,
        line_geometry: Dict[str, Any],
        prediction: Dict[str, Any],
        peak_analysis: Optional[Dict[str, Any]],
        structure_start_point_index: Optional[int] = None,
        focus_origin_source: Optional[str] = None,
        explainability_status: Optional[str] = None,
        downgrade_reason: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Attach stable point/segment ids and build explainability metadata."""
        structure_family, prefix, standard_qualification = self._resolve_structure_profile(structure_type)
        points = list((line_geometry or {}).get('points', []))
        segments = list((line_geometry or {}).get('segments', []))
        start_index = 0
        has_visible_structure_start = False
        if (
            isinstance(structure_start_point_index, int)
            and 0 <= structure_start_point_index < len(points)
        ):
            start_index = structure_start_point_index
            has_visible_structure_start = True
        elif prefix and points:
            has_visible_structure_start = True

        labeled_points: List[Dict[str, Any]] = []
        for idx, point in enumerate(points):
            is_live_point = bool(point.get('is_current'))
            if is_live_point:
                point_id = 'live'
            elif prefix and idx >= start_index:
                point_id = f'{prefix}{idx - start_index + 1}'
            else:
                point_id = f'p{idx + 1}'
            labeled_points.append({**point, 'point_id': point_id})

        labeled_segments: List[Dict[str, Any]] = []
        for segment in segments:
            segment_copy = {**segment}
            from_index = segment.get('from_point')
            to_index = segment.get('to_point')
            if (
                isinstance(from_index, int)
                and isinstance(to_index, int)
                and 0 <= from_index < len(labeled_points)
                and 0 <= to_index < len(labeled_points)
            ):
                from_point_id = labeled_points[from_index]['point_id']
                to_point_id = labeled_points[to_index]['point_id']
                segment_copy['segment_id'] = f'{from_point_id}-{to_point_id}'
            labeled_segments.append(segment_copy)

        labeled_geometry = {
            **line_geometry,
            'points': labeled_points,
            'segments': labeled_segments,
            'point_count': len(labeled_points),
            'segment_count': len(labeled_segments)
        }

        point_ids = [point['point_id'] for point in labeled_points]
        live_point = next((point for point in labeled_points if point['point_id'] == 'live'), None)
        last_confirmed_point = None
        if live_point:
            live_index = labeled_points.index(live_point)
            if live_index > 0:
                last_confirmed_point = labeled_points[live_index - 1]
        prediction_data = prediction if isinstance(prediction, dict) else {}
        current_point_id = self._extract_stage_point_id(
            prediction_data.get('current_stage', ''),
            prefix,
            point_ids
        )
        used_current_fallback = False
        if current_point_id is None:
            if last_confirmed_point:
                current_point_id = last_confirmed_point['point_id']
                used_current_fallback = True
            elif point_ids:
                current_point_id = point_ids[-1]
                used_current_fallback = True

        next_point_id = self._extract_stage_point_id(
            prediction_data.get('next_stage', ''),
            prefix,
            point_ids
        )
        next_stage_text = str(prediction_data.get('next_stage', '')).lower()
        if next_point_id is None and prefix:
            projected_match = re.search(rf'{re.escape(prefix)}(\d+)', next_stage_text)
            if projected_match:
                next_point_id = f'{prefix}{projected_match.group(1)}'
        stage_point_token = False
        if prefix:
            stage_point_token = bool(re.search(rf'{re.escape(prefix)}\d+', next_stage_text))
        else:
            stage_point_token = bool(
                re.search(r'第\s*\d+\s*个?拐点', next_stage_text)
                or re.search(r'p\d+', next_stage_text)
            )
        is_non_segment_completion_state = (
            ('结构完成' in next_stage_text or '方向选择' in next_stage_text)
            and not stage_point_token
        )

        point_index_map = {point['point_id']: idx for idx, point in enumerate(labeled_points)}
        point_price_map = {
            point['point_id']: point.get('price')
            for point in labeled_points
            if point.get('point_id')
        }

        current_segment = None
        if live_point and last_confirmed_point and current_point_id == last_confirmed_point['point_id']:
            current_segment = {
                'from_point_id': current_point_id,
                'to_point_id': 'live',
                'label': f'{current_point_id}→live',
            }
        elif current_point_id and current_point_id in point_index_map:
            current_idx = point_index_map[current_point_id]
            if current_idx > 0:
                is_crossing_left_context = prefix and (current_idx - 1) < start_index
                if not is_crossing_left_context:
                    from_point_id = labeled_points[current_idx - 1]['point_id']
                    current_segment = {
                        'from_point_id': from_point_id,
                        'to_point_id': current_point_id,
                        'label': f'{from_point_id}→{current_point_id}',
                    }

        next_segment_preview = None
        if (
            current_point_id
            and next_point_id
            and current_point_id in point_index_map
            and current_point_id != next_point_id
            and not is_non_segment_completion_state
        ):
            next_segment_preview = {
                'from_point_id': current_point_id,
                'to_point_id': next_point_id,
                'label': f'{current_point_id}→{next_point_id}',
                'status': 'projected'
            }

        current_segment_id = None
        if current_segment:
            current_segment_id = f"{current_segment['from_point_id']}-{current_segment['to_point_id']}"
        next_segment_id = None
        if next_segment_preview:
            next_segment_id = f"{next_segment_preview['from_point_id']}-{next_segment_preview['to_point_id']}"
        structure_start_point_id = (
            labeled_points[start_index]['point_id']
            if labeled_points and has_visible_structure_start
            else None
        )

        point_labels = []
        should_hide_internal_ids = standard_qualification != 'standard'
        for idx, point in enumerate(labeled_points):
            role = 'normal'
            if point['point_id'] == current_point_id:
                role = 'current'
            elif point['point_id'] == 'live':
                role = 'projected'
            elif structure_start_point_id and point['point_id'] == structure_start_point_id:
                role = 'start'

            show_label = True
            if structure_family in ('complex', 'unfinished') or should_hide_internal_ids:
                show_label = role in ('start', 'current')
            elif prefix and idx < start_index:
                show_label = False

            visible_label = point['point_id'] if show_label else ''
            if should_hide_internal_ids and re.match(r'^p\d+$', point['point_id'], re.IGNORECASE):
                visible_label = ''

            point_labels.append({
                'point_id': point['point_id'],
                'label': visible_label,
                'role': role
            })

        segment_labels = []
        for segment in labeled_segments:
            segment_id = segment.get('segment_id')
            from_index = segment.get('from_point')
            to_index = segment.get('to_point')
            if (
                not segment_id
                or not isinstance(from_index, int)
                or not isinstance(to_index, int)
                or from_index < 0
                or to_index < 0
                or from_index >= len(labeled_points)
                or to_index >= len(labeled_points)
            ):
                continue
            from_point_id = labeled_points[from_index]['point_id']
            to_point_id = labeled_points[to_index]['point_id']
            role = 'normal'
            if segment_id == current_segment_id:
                role = 'current'
            elif segment_id == next_segment_id:
                role = 'projected'

            show_label = True
            if structure_family in ('complex', 'unfinished') or should_hide_internal_ids:
                show_label = role in ('current', 'projected')
            elif prefix and (from_index < start_index or to_index < start_index):
                show_label = False

            segment_labels.append({
                'segment_id': segment_id,
                'from_point_id': from_point_id,
                'to_point_id': to_point_id,
                'label': f'{from_point_id}→{to_point_id}' if show_label else '',
                'role': role
            })

        reason_parts = []
        if prefix:
            reason_parts.append('标准结构编号从当前结构起点重新计数')
        elif standard_qualification == 'extended':
            reason_parts.append('延伸结构停止标准编号，仅突出起点与当前段')
        else:
            reason_parts.append('复杂/未完成结构使用通用锚点，仅突出起点与当前段')
        if used_current_fallback:
            reason_parts.append('current_stage 无法映射，已回退到最后确认点')
        if is_non_segment_completion_state:
            reason_parts.append('next_stage 为完成/方向选择态，已抑制下一段预览')
        if not prefix:
            reason_parts.append('避免伪造标准编号')
        if (
            structure_family in ('complex', 'unfinished')
            and not structure_start_point_id
            and focus_origin_source == 'macro_origin'
        ):
            reason_parts.append('真实原点位于当前窗口外，避免将窗口首点误标为起点')
        if isinstance(peak_analysis, dict) and peak_analysis.get('is_peak_structure'):
            reason_parts.append('峰值切片后聚焦右侧结构')
        display_reason = '；'.join(reason_parts)

        explainability = {
            'structure_family': structure_family,
            'standard_qualification': standard_qualification,
            'structure_start_point_id': structure_start_point_id,
            'current_point_id': current_point_id,
            'a4_price': point_price_map.get('a4'),
            'b8_price': point_price_map.get('b8'),
            'd3_price': point_price_map.get('d3'),
            'd4_price': point_price_map.get('d4'),
            'last_confirmed_price': last_confirmed_point.get('price') if last_confirmed_point else None,
            'current_segment': current_segment,
            'next_segment_preview': next_segment_preview,
            'point_labels': point_labels,
            'segment_labels': segment_labels,
            'display_reason': display_reason,
            'focus_origin_source': focus_origin_source,
            'explainability_status': explainability_status,
            'downgrade_reason': downgrade_reason,
            'qualification_reason': downgrade_reason,
        }
        return labeled_geometry, explainability

    def _normalize_trinity_anchor(
        self,
        anchor: Optional[Dict[str, Any]],
        *,
        source: Optional[str] = None,
        semantic: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(anchor, dict):
            return None
        price = anchor.get('price')
        date = anchor.get('date')
        point_id = anchor.get('point_id')
        if price is None and date is None and point_id is None:
            return None
        return {
            'point_id': point_id,
            'price': price,
            'date': date,
            'source': source or anchor.get('source'),
            'semantic': semantic or anchor.get('semantic'),
        }

    def _build_background_origin_anchor(
        self,
        raw_classification: Dict[str, Any],
        focus_structure: Optional[Dict[str, Any]] = None,
        focus_origin_analysis: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        origin = (
            raw_classification.get('macro_origin')
            or (focus_structure or {}).get('reference_origin')
            or (focus_origin_analysis or {}).get('macro_origin')
            or {}
        )
        if origin.get('outside_window'):
            return None

        normalized_origin = self._normalize_trinity_anchor(
            origin,
            source='macro_origin',
            semantic='background_origin',
        )
        return normalized_origin

    def _build_focus_origin_anchor(
        self,
        focus_structure: Dict[str, Any],
        focus_origin_analysis: Dict[str, Any],
        raw_classification: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        priority = ('peak_extreme', 'valley_extreme', 'recent_component', 'macro_origin')
        selected_source = (
            focus_structure.get('start_anchor_source')
            or focus_origin_analysis.get('selected_origin_kind')
        )
        if selected_source not in priority:
            selected_source = 'macro_origin'
        anchor = (
            focus_structure.get('start_anchor')
            or raw_classification.get('macro_origin')
            or focus_origin_analysis.get('macro_origin')
            or {}
        )
        return self._normalize_trinity_anchor(
            anchor,
            source=selected_source,
            semantic='focus_origin',
        )

    def _build_execution_origin_anchor(
        self,
        structure_payload: Dict[str, Any],
        focus_origin: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        details = structure_payload.get('structure_details') if isinstance(structure_payload, dict) else {}
        details = details or {}
        explainability = details.get('explainability') or {}
        return self._normalize_trinity_anchor(
            {
                'point_id': explainability.get('current_point_id'),
                'price': None,
                'date': None,
            },
            source='current_structure',
            semantic='execution_origin',
        )

    def _build_numbering_explainability(
        self,
        focus_classification: Dict[str, Any],
        explainability: Dict[str, Any],
        qualification: Optional[str] = None,
    ) -> Dict[str, Any]:
        qualification = qualification or focus_classification.get('standard_qualification') or 'failed'
        if qualification in {'extended', 'unfinished', 'failed', 'over_limit'}:
            display_reason = explainability.get('display_reason') or ''
            uses_standard_numbering_reason = (
                '标准结构从聚焦起点重新编号' in display_reason
                or '标准结构编号从当前结构起点重新计数' in display_reason
            )
            return {
                'status': 'downgraded',
                'reason': (
                    display_reason
                    if display_reason and not uses_standard_numbering_reason
                    else None
                    or '非标准结构停止标准编号，仅保留解释锚点'
                ),
                'evidence': ['停止标准 A/B/C/D 编号'],
            }
        return {
            'status': 'passed',
            'reason': explainability.get('display_reason') or '标准结构从聚焦起点重新编号',
            'evidence': ['聚焦起点已锁定', '结构编号从当前结构起点重新开始'],
        }

    def _normalize_trinity_price(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float, np.integer, np.floating)):
            normalized = float(value)
            return normalized if np.isfinite(normalized) else None
        try:
            normalized = float(str(value).strip())
            return normalized if np.isfinite(normalized) else None
        except (TypeError, ValueError):
            return None

    def _calculate_trinity_volume_metrics(self, df: pd.DataFrame) -> Dict[str, Optional[float]]:
        if df is None or len(df) == 0:
            return {
                'volume_ratio_5': None,
                'volume_ratio_20': None,
                'amount_ratio_20': None,
            }

        latest = df.iloc[-1]

        def safe_ratio(column: str, window: int) -> Optional[float]:
            if column not in df.columns:
                return None
            series = pd.to_numeric(df[column], errors='coerce')
            if series.empty or pd.isna(series.iloc[-1]):
                return None
            base = series.tail(window).mean()
            if pd.isna(base) or not np.isfinite(base) or base == 0:
                return None
            return round(float(series.iloc[-1] / base), 4)

        return {
            'volume_ratio_5': safe_ratio('volume', 5),
            'volume_ratio_20': safe_ratio('volume', 20),
            'amount_ratio_20': safe_ratio('amount', 20),
        }

    def _extract_trinity_boundaries(
        self,
        structure_payload: Dict[str, Any],
    ) -> Dict[str, Optional[float]]:
        boundaries = {
            'upper': None,
            'lower': None,
            'mid': None,
            'breakout_trigger': None,
            'breakdown_trigger': None,
            'stop_loss': None,
        }

        details = structure_payload.get('structure_details') if isinstance(structure_payload, dict) else {}
        details = details or {}
        prediction = details.get('prediction') if isinstance(details, dict) else {}
        prediction = prediction or {}
        key_price_levels = prediction.get('key_price_levels') if isinstance(prediction, dict) else []

        for level in key_price_levels or []:
            if not isinstance(level, dict):
                continue

            price = self._normalize_trinity_price(level.get('price'))
            if price is None:
                continue

            level_type = str(level.get('type') or '')
            note = str(level.get('note') or '')
            label = f'{level_type} {note}'

            is_stop = level_type == 'stop' or '止损' in label
            if is_stop:
                if boundaries['stop_loss'] is None:
                    boundaries['stop_loss'] = price
                continue

            is_lower = any(keyword in label for keyword in ('底分型', '支撑', '下沿', '下轨'))
            is_upper = any(keyword in label for keyword in ('压力', '阻力', '上沿', '上轨'))
            if '突破' in label and '跌破' not in label:
                is_upper = True

            if is_upper:
                if boundaries['upper'] is None:
                    boundaries['upper'] = price
                if boundaries['breakout_trigger'] is None:
                    boundaries['breakout_trigger'] = price

            if is_lower:
                if boundaries['lower'] is None:
                    boundaries['lower'] = price
                if boundaries['breakdown_trigger'] is None:
                    boundaries['breakdown_trigger'] = price

        if boundaries['stop_loss'] is None and boundaries['lower'] is not None:
            boundaries['stop_loss'] = boundaries['lower']

        if (
            boundaries['upper'] is not None
            and boundaries['lower'] is not None
            and boundaries['upper'] > boundaries['lower']
        ):
            boundaries['mid'] = round((boundaries['upper'] + boundaries['lower']) / 2, 2)

        return boundaries

    def _resolve_trinity_structure_family(
        self,
        focus_classification: Dict[str, Any],
        structure_type: str,
    ) -> Tuple[str, str, Optional[str]]:
        resolved_type = structure_type or focus_classification.get('type')
        return STRUCTURE_FAMILY_MAP.get(resolved_type, ('complex', 'failed', None))

    def _build_trinity_boundaries(
        self,
        structure_payload: Dict[str, Any],
    ) -> Dict[str, Optional[float]]:
        details = structure_payload.get('structure_details') if isinstance(structure_payload, dict) else {}
        details = details or {}
        boundary = details.get('boundary_levels') or {}
        boundaries = {
            'upper': self._normalize_trinity_price(boundary.get('upper')),
            'lower': self._normalize_trinity_price(boundary.get('lower')),
            'mid': self._normalize_trinity_price(boundary.get('mid')),
            'breakout_trigger': self._normalize_trinity_price(
                boundary.get('breakout_trigger') or boundary.get('upper')
            ),
            'breakdown_trigger': self._normalize_trinity_price(
                boundary.get('breakdown_trigger') or boundary.get('lower')
            ),
            'stop_loss': self._normalize_trinity_price(boundary.get('stop_loss')),
        }
        if any(value is not None for value in boundaries.values()):
            return boundaries
        return self._extract_trinity_boundaries(structure_payload)

    def _build_trinity_node_map(
        self,
        explainability: Dict[str, Any],
        qualification: str,
    ) -> Dict[str, Optional[float]]:
        if qualification != 'standard':
            return {'a4': None, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': None}
        return {
            'a4': self._normalize_trinity_price(explainability.get('a4_price')),
            'b8': self._normalize_trinity_price(explainability.get('b8_price')),
            'd3': self._normalize_trinity_price(explainability.get('d3_price')),
            'd4': self._normalize_trinity_price(explainability.get('d4_price')),
            'last_confirmed': self._normalize_trinity_price(explainability.get('last_confirmed_price')),
        }

    def _build_trinity_structure_decision(
        self,
        structure_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        interpretation = structure_payload.get('interpretation') if isinstance(structure_payload, dict) else {}
        interpretation = interpretation or {}
        focus_structure = interpretation.get('focus_structure') or {}
        spacetime_gate = interpretation.get('spacetime_gate') or {}
        details = structure_payload.get('structure_details') if isinstance(structure_payload, dict) else {}
        details = details or {}
        focus_origin_analysis = details.get('focus_origin_analysis') or {}
        focus_classification = details.get('focus_classification') or {}
        raw_classification = details.get('raw_classification') or {}
        explainability = details.get('explainability') or {}

        background_origin = self._build_background_origin_anchor(
            raw_classification,
            focus_structure,
            focus_origin_analysis,
        )
        focus_origin = self._build_focus_origin_anchor(
            focus_structure,
            focus_origin_analysis,
            raw_classification,
        )
        execution_origin = self._build_execution_origin_anchor(
            structure_payload,
            focus_origin,
        )
        structure_type = structure_payload.get('structure_type') if isinstance(structure_payload, dict) else None
        family, default_qualification, standard_candidate = self._resolve_trinity_structure_family(
            focus_classification,
            structure_type,
        )
        qualification = (
            focus_classification.get('standard_qualification')
            or focus_structure.get('standard_qualification')
            or default_qualification
        )
        numbering_explainability = self._build_numbering_explainability(
            focus_classification,
            explainability,
            qualification,
        )

        trend_direction = structure_payload.get('trend_direction') if isinstance(structure_payload, dict) else None
        boundaries = self._build_trinity_boundaries(structure_payload)
        node_map = self._build_trinity_node_map(explainability, qualification)
        has_standard_trade_node = any(
            node_map.get(node_key) is not None
            for node_key in ('a4', 'b8', 'd3', 'd4')
        )
        has_valid_boundary_range = (
            boundaries.get('upper') is not None
            and boundaries.get('lower') is not None
            and boundaries['upper'] > boundaries['lower']
        )
        display_reason = explainability.get('display_reason') or ''
        uses_standard_numbering_reason = (
            '标准结构从聚焦起点重新编号' in display_reason
            or '标准结构编号从当前结构起点重新计数' in display_reason
        )
        display_reason_candidate = (
            display_reason
            if display_reason and (qualification == 'standard' or not uses_standard_numbering_reason)
            else None
        )
        return {
            'background_origin': background_origin,
            'focus_origin': focus_origin,
            'execution_origin': execution_origin,
            'family': family,
            'type': structure_type,
            'standard_candidate': standard_candidate,
            'qualification': qualification,
            'direction': {
                '上涨': 'up',
                '下跌': 'down',
                '震荡': 'neutral',
            }.get(trend_direction, 'neutral'),
            'boundaries': boundaries,
            'node_map': node_map,
            'can_trade_by_structure_nodes': (
                qualification == 'standard'
                and family == 'standard'
                and has_standard_trade_node
            ),
            'can_trade_by_boundaries': has_valid_boundary_range,
            'explainability': {
                'status': numbering_explainability.get('status') or 'passed',
                'reason': (
                    display_reason_candidate
                    or focus_origin_analysis.get('explainability_reason')
                    or numbering_explainability.get('reason')
                    or focus_structure.get('qualification_reason')
                    or structure_payload.get('description')
                    or ''
                ),
                'evidence': [
                    item for item in [
                        structure_payload.get('description') or '',
                        focus_structure.get('summary') or '',
                        spacetime_gate.get('required_confirmation') or '',
                        *(numbering_explainability.get('evidence') or []),
                    ] if item
                ],
            },
        }

    def _build_trinity_spacetime_decision(
        self,
        structure_payload: Dict[str, Any],
        macd_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        interpretation = structure_payload.get('interpretation') if isinstance(structure_payload, dict) else {}
        gate = (interpretation or {}).get('spacetime_gate') or {}
        status = macd_payload.get('status') if isinstance(macd_payload, dict) else None
        status = status or '未知'
        return {
            'status': status,
            'direction_bias': (
                'bullish'
                if status in ('极强', '强', '中偏强')
                else 'bearish'
                if status in ('极弱', '弱', '中偏弱')
                else 'neutral'
            ),
            'expected_structures': {
                'up': ['A五段式', 'B双平台式', 'C单平台式'],
                'down': ['D三段式', 'B双平台式', 'C单平台式'],
            },
            'structure_match': bool(gate.get('child_structure_match')),
            'mismatch_reason': gate.get('wait_reason'),
            'divergence_policy': {
                'top_divergence_valid': bool(macd_payload.get('top_divergence')) if isinstance(macd_payload, dict) else False,
                'bottom_divergence_valid': bool(macd_payload.get('bottom_divergence')) if isinstance(macd_payload, dict) else False,
                'reason': (
                    macd_payload.get('divergence_note')
                    if isinstance(macd_payload, dict)
                    else None
                ) or '沿用现有 MACD 背离字段',
            },
        }

    def _build_trinity_moving_average_decision(
        self,
        moving_averages: Dict[str, Any],
        breakthrough_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        moving_averages = moving_averages if isinstance(moving_averages, dict) else {}
        breakthrough_payload = breakthrough_payload if isinstance(breakthrough_payload, dict) else {}
        above_ma55 = moving_averages.get('price_vs_ma55') == 'above'
        above_ma233 = moving_averages.get('price_vs_ma233') == 'above'
        ma_status = moving_averages.get('ma_status') or ''
        allow_long = above_ma55
        allow_short = not above_ma55 and '空头' in ma_status
        breakthrough_state = 'none'
        if breakthrough_payload.get('pattern_type'):
            if breakthrough_payload.get('direction') == 'up' and breakthrough_payload.get('is_valid'):
                breakthrough_state = 'valid_breakout'
            elif breakthrough_payload.get('direction') == 'down' and breakthrough_payload.get('is_valid'):
                breakthrough_state = 'valid_breakdown'

        return {
            'ma55_role': 'support' if above_ma55 else 'resistance',
            'ma233_role': 'support' if above_ma233 else 'resistance',
            'price_position': {
                'above_ma55': above_ma55,
                'above_ma233': above_ma233,
                'deviation_ma55_pct': None,
                'deviation_ma233_pct': None,
            },
            'breakthrough_state': breakthrough_state,
            'ma_gate': {
                'allow_long': allow_long,
                'allow_short': allow_short,
                'reason': '沿用现有 MA55 / MA233 相对位置与突破字段',
            },
        }

    def _build_trinity_volume_confirmation_decision(
        self,
        period_payload: Dict[str, Any],
        breakthrough_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        breakthrough_payload = breakthrough_payload if isinstance(breakthrough_payload, dict) else {}
        period_payload = period_payload if isinstance(period_payload, dict) else {}
        ratio_5 = self._normalize_trinity_price(period_payload.get('volume_ratio_5'))
        ratio_20 = self._normalize_trinity_price(period_payload.get('volume_ratio_20'))
        amount_ratio = self._normalize_trinity_price(period_payload.get('amount_ratio_20'))
        has_volume_data = any(value is not None for value in (ratio_5, ratio_20, amount_ratio))
        signal_valid = bool(breakthrough_payload.get('is_valid'))
        breakout_confirmed = bool(
            (ratio_5 is not None and ratio_5 >= 1.2)
            or (ratio_20 is not None and ratio_20 >= 1.15)
            or (amount_ratio is not None and amount_ratio >= 1.15)
        )
        pullback_healthy = bool(
            (ratio_5 is not None and ratio_5 <= 0.85)
            or (ratio_20 is not None and ratio_20 <= 0.9)
            or (amount_ratio is not None and amount_ratio <= 0.9)
        )
        direction = breakthrough_payload.get('direction')
        supports_breakout = direction == 'up' and signal_valid and breakout_confirmed
        supports_breakdown = direction == 'down' and signal_valid and breakout_confirmed
        volume_reason = (
            '放量确认突破，缩量回踩更健康'
            if supports_breakout
            else '放量确认跌破，反抽仍需谨慎'
            if supports_breakdown
            else '量能放大但突破形态未确认'
            if direction == 'up' and breakout_confirmed and not signal_valid
            else '量能放大但跌破形态未确认'
            if direction == 'down' and breakout_confirmed and not signal_valid
            else '量能数据不足，暂不作为确认信号'
            if not has_volume_data
            else '量能未充分确认，需等待二次验证'
        )
        return {
            'volume_ratio_5': ratio_5,
            'volume_ratio_20': ratio_20,
            'amount_ratio_20': amount_ratio,
            'turnover_rate': None,
            'volume_state': (
                'expanding'
                if breakout_confirmed
                else 'shrinking'
                if pullback_healthy
                else 'normal'
            ),
            'breakout_volume': (
                'confirmed'
                if supports_breakout
                else 'weak'
            ),
            'breakdown_volume': (
                'confirmed'
                if supports_breakdown
                else 'not_applicable'
            ),
            'pullback_volume': 'healthy_shrink' if pullback_healthy else 'normal',
            'volume_gate': {
                'supports_breakout': supports_breakout,
                'supports_breakdown': supports_breakdown,
                'supports_pullback_confirmation': pullback_healthy,
                'confidence_adjustment': (
                    'upgrade'
                    if supports_breakout or supports_breakdown or pullback_healthy
                    else 'neutral'
                    if not has_volume_data
                    else 'downgrade'
                ),
                'reason': volume_reason,
            },
        }

    def _build_trinity_trade_qualification(
        self,
        structure_decision: Dict[str, Any],
        spacetime_decision: Dict[str, Any],
        moving_average_decision: Dict[str, Any],
        volume_decision: Dict[str, Any],
        execution_payload: Dict[str, Any],
        level_nesting_decision: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        execution_payload = execution_payload if isinstance(execution_payload, dict) else {}
        volume_decision = volume_decision if isinstance(volume_decision, dict) else {}
        level_nesting_decision = level_nesting_decision if isinstance(level_nesting_decision, dict) else {}
        ma_gate = moving_average_decision.get('ma_gate') or {}
        action = execution_payload.get('action') or 'wait'
        direction = execution_payload.get('direction')
        structure_family = structure_decision.get('family')
        qualification = structure_decision.get('qualification')
        structure_direction = structure_decision.get('direction')
        can_trade_by_nodes = bool(structure_decision.get('can_trade_by_structure_nodes'))
        can_trade_by_boundaries = bool(structure_decision.get('can_trade_by_boundaries'))
        is_long_intent = direction == 'long'
        is_short_intent = direction == 'short'
        allow_long = bool(ma_gate.get('allow_long'))
        allow_short = bool(ma_gate.get('allow_short'))
        volume_gate = volume_decision.get('volume_gate') or {}
        supports_breakout = volume_gate.get('supports_breakout')
        supports_breakdown = volume_gate.get('supports_breakdown')
        supports_pullback_confirmation = volume_gate.get('supports_pullback_confirmation')
        confidence_adjustment = volume_gate.get('confidence_adjustment') or 'neutral'
        direction_matches_structure = (
            (is_long_intent and structure_direction == 'up')
            or (is_short_intent and structure_direction == 'down')
        )
        direction_gate_passed = (
            (is_long_intent and allow_long and structure_direction != 'down')
            or (is_short_intent and allow_short and structure_direction != 'up')
        )
        if is_long_intent:
            volume_gate_passed = (
                confidence_adjustment == 'neutral'
                or supports_breakout is None
                or bool(supports_breakout)
                or bool(supports_pullback_confirmation)
            )
        elif is_short_intent:
            volume_gate_passed = (
                confidence_adjustment == 'neutral'
                or supports_breakdown is None
                or bool(supports_breakdown)
                or bool(supports_pullback_confirmation)
            )
        else:
            volume_gate_passed = True

        def apply_confidence(base: str) -> str:
            if confidence_adjustment == 'upgrade':
                return {'low': 'medium', 'medium': 'high', 'high': 'high'}.get(base, base)
            if confidence_adjustment == 'downgrade':
                return {'high': 'medium', 'medium': 'low', 'low': 'low'}.get(base, base)
            return base

        reasons = [
            structure_decision.get('explainability', {}).get('reason') or '沿用结构解释',
            spacetime_decision.get('mismatch_reason') or '时空未额外否决',
            moving_average_decision.get('ma_gate', {}).get('reason') or '沿用均线门控',
            volume_decision.get('volume_gate', {}).get('reason') or '沿用量能门控',
        ]
        nesting_permission = level_nesting_decision.get('permission') or {}
        light_probe_only = (
            bool(nesting_permission.get('allow_only_light_probe'))
            and not nesting_permission.get('allow_position_increase')
        )
        is_child_countertrend_long = (
            level_nesting_decision.get('resonance') == 'child_countertrend'
            and level_nesting_decision.get('parent_bias') == 'bearish'
            and (level_nesting_decision.get('child_signal') == 'long' or is_long_intent)
        )
        nesting_resonance = level_nesting_decision.get('resonance')
        nesting_reason = nesting_permission.get('reason') or '级别嵌套未放行'
        if nesting_resonance in {'blocked', 'structure_mismatch', 'parent_unclear'}:
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': 'low',
                'reason': [nesting_reason, *reasons],
            }
        if nesting_resonance == 'boundary_probe':
            if action in {'buy', 'sell'} and can_trade_by_boundaries and direction_gate_passed and volume_gate_passed:
                return {
                    'trade_mode': 'conditional_boundary_trade',
                    'position_permission': 'light_probe',
                    'confidence': apply_confidence('medium'),
                    'reason': [nesting_reason, *reasons],
                }
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': 'low',
                'reason': [nesting_reason, *reasons],
            }
        if action == 'wait':
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': apply_confidence('low'),
                'reason': ['等待触发或确认信号', *reasons],
            }
        if is_child_countertrend_long and not nesting_permission.get('allow_position_increase'):
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': apply_confidence('low'),
                'reason': [
                    nesting_permission.get('reason') or '子级别逆父级别，禁止升级为标准节点交易',
                    *reasons,
                ],
            }
        if structure_family == 'unfinished' or qualification == 'unfinished':
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': apply_confidence('low'),
                'reason': ['未完成结构仅等待', *reasons],
            }
        if structure_family in {'extended', 'channel', 'range'} or qualification in {'extended', 'over_limit'}:
            if not can_trade_by_boundaries:
                return {
                    'trade_mode': 'no_trade',
                    'position_permission': 'no_position',
                    'confidence': apply_confidence('low'),
                    'reason': ['非标准结构边界无效，禁止交易', *reasons],
                }
            if direction_gate_passed and volume_gate_passed:
                return {
                    'trade_mode': 'conditional_boundary_trade',
                    'position_permission': 'light_probe',
                    'confidence': apply_confidence('medium'),
                    'reason': ['非标准结构只允许边界条件交易', *reasons],
                }
            return {
                'trade_mode': 'wait_confirmation',
                'position_permission': 'no_position',
                'confidence': apply_confidence('low'),
                'reason': ['非标准结构边界或门控未满足，继续等待', *reasons],
            }
        if action == 'avoid':
            return {
                'trade_mode': 'risk_control',
                'position_permission': 'reduce_only',
                'confidence': apply_confidence('high'),
                'reason': ['当前信号要求规避或仅做风险控制', *reasons],
            }
        node_semantic = level_nesting_decision.get('node_semantic') or {}
        if (
            light_probe_only
            and nesting_resonance == 'aligned'
            and structure_family == 'standard'
            and qualification == 'standard'
            and isinstance(node_semantic, dict)
            and node_semantic.get('family') == 'D'
            and node_semantic.get('actionable_node') == 'd3'
            and can_trade_by_boundaries
            and direction_gate_passed
            and volume_gate_passed
        ):
            return {
                'trade_mode': 'conditional_boundary_trade',
                'position_permission': 'light_probe',
                'confidence': apply_confidence('medium'),
                'reason': [
                    nesting_permission.get('reason') or 'D类不稳定节点只允许边界条件轻仓试探',
                    *reasons,
                ],
            }
        if can_trade_by_nodes and direction_matches_structure and direction_gate_passed and volume_gate_passed:
            return {
                'trade_mode': 'standard_node_trade',
                'position_permission': 'light_probe' if light_probe_only else 'half_position',
                'confidence': apply_confidence('medium'),
                'reason': [
                    (
                        nesting_permission.get('reason') or '级别权限限制为轻仓试探'
                    )
                    if light_probe_only
                    else '标准结构节点可交易',
                    *reasons,
                ],
            }
        if action in {'sell', 'reduce'}:
            return {
                'trade_mode': 'no_trade',
                'position_permission': 'no_position',
                'confidence': apply_confidence('medium'),
                'reason': ['方向或门控冲突，不放行节点交易', *reasons],
            }
        if not can_trade_by_nodes:
            return {
                'trade_mode': 'no_trade',
                'position_permission': 'no_position',
                'confidence': apply_confidence('low'),
                'reason': ['标准结构缺少真实可交易节点', *reasons],
            }
        return {
            'trade_mode': 'no_trade',
            'position_permission': 'no_position',
            'confidence': apply_confidence('medium'),
            'reason': ['方向或门控未满足，暂不交易', *reasons],
        }

    def _build_trinity_execution_decision(
        self,
        execution_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        execution_payload = execution_payload if isinstance(execution_payload, dict) else {}
        position_sizing = execution_payload.get('position_sizing') or {}
        if not isinstance(position_sizing, dict):
            position_sizing = {}
        position_sizing = dict(position_sizing)
        if position_sizing.get('max_ratio') is None:
            position_sizing['max_ratio'] = execution_payload.get('timeframe_cap_ratio')
        if position_sizing.get('reason') is None:
            position_sizing['reason'] = (
                execution_payload.get('rationale')
                or execution_payload.get('wait_reason')
                or '沿用现有执行摘要'
            )
        if position_sizing.get('upgrade_condition') is None:
            position_sizing['upgrade_condition'] = execution_payload.get('upgrade_condition')
        if position_sizing.get('downgrade_condition') is None:
            position_sizing['downgrade_condition'] = execution_payload.get('wait_reason')
        return {
            'entry_style': execution_payload.get('entry_style') or 'none',
            'triggers': execution_payload.get('trigger') or [],
            'invalidation': execution_payload.get('invalidation') or [],
            'confirmation': execution_payload.get('confirmation') or [],
            'position_sizing': position_sizing,
            'risk_flags': execution_payload.get('risk_flags') or [],
        }

    def _build_trinity_candidate_structure_decision(
        self,
        *,
        structure_payload: Dict[str, Any],
        execution_payload: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        interpretation = structure_payload.get('interpretation') if isinstance(structure_payload, dict) else {}
        interpretation = interpretation or {}
        focus_structure = interpretation.get('focus_structure') or {}
        current_leg = interpretation.get('current_leg') or {}
        next_confirmation = interpretation.get('next_confirmation') or {}
        gate = interpretation.get('spacetime_gate') or {}
        family = str(focus_structure.get('archetype_family') or '').strip()
        trend_direction = (
            {'上涨': 'up', '下跌': 'down', '震荡': 'neutral'}
            .get(structure_payload.get('trend_direction'))
        )
        direction = (
            current_leg.get('direction')
            or focus_structure.get('directional_bias')
            or trend_direction
            or 'neutral'
        )
        direction = direction if direction in {'up', 'down'} else 'neutral'
        if not family:
            return None

        candidate_type_map = {
            ('A', 'up'): 'A延续',
            ('A', 'down'): 'A修正',
            ('B', 'up'): 'B',
            ('B', 'down'): 'B',
            ('B', 'neutral'): 'B',
            ('C', 'up'): 'C',
            ('C', 'down'): 'C',
            ('C', 'neutral'): 'C',
            ('D', 'down'): 'D延续',
            ('D', 'up'): 'D反抽',
            ('D', 'neutral'): 'D',
        }
        candidate_label_map = {
            ('A', 'up'): 'A延续候选',
            ('A', 'down'): 'A修正候选',
            ('B', 'up'): 'B候选',
            ('B', 'down'): 'B候选',
            ('B', 'neutral'): 'B候选',
            ('C', 'up'): 'C候选',
            ('C', 'down'): 'C候选',
            ('C', 'neutral'): 'C候选',
            ('D', 'down'): 'D延续候选',
            ('D', 'up'): 'D反抽候选',
            ('D', 'neutral'): 'D候选',
        }
        invalidation_list = execution_payload.get('invalidation') if isinstance(execution_payload, dict) else None
        invalidation_list = invalidation_list if isinstance(invalidation_list, list) else []

        return {
            'candidate_type': candidate_type_map.get((family, direction), family),
            'candidate_label': candidate_label_map.get((family, direction), f'{family}候选'),
            'current_leg': current_leg.get('label') or '待确认',
            'direction': direction,
            'reason': (
                focus_structure.get('summary')
                or structure_payload.get('description')
                or '候选结构待确认'
            ),
            'upgrade_condition': (
                next_confirmation.get('trigger')
                or gate.get('required_confirmation')
                or '等待下一确认动作'
            ),
            'invalidation': invalidation_list[0] if invalidation_list else '若关键边界失效则取消候选',
        }

    def _build_trinity_wait_state_decision(
        self,
        *,
        structure_payload: Dict[str, Any],
        execution_payload: Dict[str, Any],
        trade_qualification: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        interpretation = structure_payload.get('interpretation') if isinstance(structure_payload, dict) else {}
        interpretation = interpretation or {}
        gate = interpretation.get('spacetime_gate') or {}
        next_confirmation = interpretation.get('next_confirmation') or {}
        confirmation_list = execution_payload.get('confirmation') if isinstance(execution_payload, dict) else None
        confirmation_list = confirmation_list if isinstance(confirmation_list, list) else []
        execution_wait_reason = execution_payload.get('wait_reason')
        gate_wait_reason = gate.get('wait_reason')
        wait_reason = execution_wait_reason or gate_wait_reason
        modifier_keywords = ('量能', '放量', '缩量', '量弱', '背离', 'MA55', 'MA233', '均线')
        generic_wait_reasons = {'等待确认', '等待触发', '继续观察', '等待下一确认', '等待进一步确认'}
        if gate_wait_reason:
            gate_has_modifier = any(keyword in str(gate_wait_reason) for keyword in modifier_keywords)
            execution_has_modifier = any(keyword in str(execution_wait_reason or '') for keyword in modifier_keywords)
            if gate_has_modifier and not execution_has_modifier:
                wait_reason = gate_wait_reason
            elif execution_wait_reason in generic_wait_reasons:
                wait_reason = gate_wait_reason
        if not wait_reason and trade_qualification.get('trade_mode') != 'wait_confirmation':
            return None

        if '父级' in str(wait_reason or ''):
            wait_type = '父级未放行'
        elif any(keyword in str(wait_reason or '') for keyword in ('量能', '放量', '缩量', '量弱')):
            wait_type = '等待量能确认'
        elif '背离' in str(wait_reason or ''):
            wait_type = '等待背离修复'
        elif any(keyword in str(wait_reason or '') for keyword in ('MA55', 'MA233', '均线')):
            wait_type = '等待均线确认'
        elif '回抽' in str(wait_reason or ''):
            wait_type = '等待回抽确认'
        else:
            wait_type = '等待触发'

        return {
            'wait_type': wait_type,
            'wait_label': wait_type,
            'current_block': wait_reason or '等待下一确认信号',
            'next_confirmation_action': (
                gate.get('required_confirmation')
                or next_confirmation.get('trigger')
                or (confirmation_list[0] if confirmation_list else None)
                or '继续观察下一确认动作'
            ),
            'reason': wait_reason or '当前仍处于等待状态',
        }

    def _build_trinity_zero_axis_signal_decision(
        self,
        macd_payload: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        macd_payload = macd_payload if isinstance(macd_payload, dict) else {}
        explicit = macd_payload.get('zero_axis_signal')
        description_candidates = [
            macd_payload.get('description'),
            macd_payload.get('divergence_note'),
            macd_payload.get('note'),
        ]
        description = ' '.join(str(item) for item in description_candidates if item)

        signal_type = None
        reason = None
        formed = False
        if isinstance(explicit, dict) and explicit.get('formed'):
            formed = True
            signal_type = explicit.get('signal_type')
            reason = explicit.get('reason')
        elif '零轴金叉' in description:
            formed = True
            signal_type = 'zero_axis_golden_cross'
            reason = description
        elif '零轴死叉' in description:
            formed = True
            signal_type = 'zero_axis_death_cross'
            reason = description
        elif '二次金叉' in description or '二次死叉' in description:
            formed = True
            signal_type = 'secondary_confirmation'
            reason = description
        elif '失败' in description and '零轴' in description:
            signal_type = 'formation_failure'
            reason = description

        if not signal_type:
            return None

        signal_label_map = {
            'zero_axis_golden_cross': '零轴金叉',
            'zero_axis_death_cross': '零轴死叉',
            'secondary_confirmation': '二次确认',
            'formation_failure': '信号失败',
            'zero_axis_pullback': '零轴上方回抽',
        }
        impact = (
            'promote'
            if signal_type in {'zero_axis_golden_cross', 'secondary_confirmation', 'zero_axis_pullback'}
            else 'suppress'
        )
        return {
            'formed': formed,
            'signal_type': signal_type,
            'signal_label': signal_label_map.get(signal_type, signal_type),
            'reason': reason or '零轴强信号已触发',
            'impact_on_judgment': impact,
        }

    def _build_trinity_resonance_state_decision(
        self,
        *,
        level_nesting_decision: Optional[Dict[str, Any]],
        moving_average_decision: Dict[str, Any],
        volume_decision: Dict[str, Any],
    ) -> Dict[str, Any]:
        nesting = level_nesting_decision if isinstance(level_nesting_decision, dict) else {}
        resonance = nesting.get('resonance')
        permission = nesting.get('permission') or {}
        if resonance == 'aligned':
            return {
                'status': 'supportive',
                'reason': permission.get('reason') or '父级支持，子级顺父级',
                'impact_on_judgment': 'promote',
                'is_hard_constraint': False,
            }
        if resonance in {'blocked', 'structure_mismatch', 'parent_unclear'}:
            return {
                'status': 'conflicting',
                'reason': permission.get('reason') or '父级级别嵌套未放行，当前级别先等待确认',
                'impact_on_judgment': 'suppress',
                'is_hard_constraint': True,
            }
        if resonance == 'boundary_probe':
            return {
                'status': 'neutral',
                'reason': permission.get('reason') or '父级仅允许边界轻仓试探，不能升级标准交易',
                'impact_on_judgment': 'suppress',
                'is_hard_constraint': False,
            }
        if resonance in {'child_countertrend', 'conflict'}:
            return {
                'status': 'conflicting',
                'reason': permission.get('reason') or '父级强冲突，子级逆父级',
                'impact_on_judgment': 'suppress',
                'is_hard_constraint': True,
            }

        ma_reason = ((moving_average_decision.get('ma_gate') or {}).get('reason')) or '均线暂未额外放行'
        volume_reason = ((volume_decision.get('volume_gate') or {}).get('reason')) or '量能暂未额外放行'
        return {
            'status': 'neutral',
            'reason': f'{ma_reason}；{volume_reason}',
            'impact_on_judgment': 'neutral',
            'is_hard_constraint': False,
        }

    def _build_trinity_divergence_weight_decision(
        self,
        *,
        spacetime_decision: Dict[str, Any],
        conclusion_bias: str,
    ) -> Dict[str, Any]:
        divergence = spacetime_decision.get('divergence_policy') or {}
        top = bool(divergence.get('top_divergence_valid'))
        bottom = bool(divergence.get('bottom_divergence_valid'))
        reason = divergence.get('reason') or '沿用现有 MACD 背离字段'

        if conclusion_bias == 'bullish' and top:
            return {
                'status': 'hard_block',
                'label': '顶背离压制',
                'reason': reason,
                'impact_on_judgment': 'suppress',
            }
        if conclusion_bias == 'bearish' and bottom:
            return {
                'status': 'hard_block',
                'label': '底背离压制',
                'reason': reason,
                'impact_on_judgment': 'suppress',
            }
        if bottom:
            return {
                'status': 'supportive',
                'label': '底背离加分',
                'reason': reason,
                'impact_on_judgment': 'promote',
            }
        if top:
            return {
                'status': 'suppressive',
                'label': '顶背离压制',
                'reason': reason,
                'impact_on_judgment': 'suppress',
            }
        return {
            'status': 'neutral',
            'label': '背离影响中性',
            'reason': reason,
            'impact_on_judgment': 'neutral',
        }

    def _build_trinity_judgment_decision(
        self,
        *,
        trade_qualification: Dict[str, Any],
        execution_payload: Dict[str, Any],
        wait_state: Optional[Dict[str, Any]],
        zero_axis_signal: Optional[Dict[str, Any]],
        resonance_state: Optional[Dict[str, Any]],
        divergence_weight: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        suppressive_divergence_reason = (
            (divergence_weight or {}).get('reason')
            if (divergence_weight or {}).get('impact_on_judgment') == 'suppress'
            else None
        )
        critical_reason = (
            (resonance_state or {}).get('reason')
            if (resonance_state or {}).get('is_hard_constraint')
            else (wait_state or {}).get('current_block')
            or suppressive_divergence_reason
            or execution_payload.get('rationale')
            or execution_payload.get('wait_reason')
            or '等待下一步确认'
        )
        hard_block = bool((resonance_state or {}).get('is_hard_constraint')) or (
            (divergence_weight or {}).get('status') == 'hard_block'
        )
        if hard_block or trade_qualification.get('trade_mode') in {'wait_confirmation', 'no_trade'}:
            level = 'strict_wait'
            label = '严格等待'
            current_best_action = '继续等待'
        elif execution_payload.get('can_trade') and not wait_state:
            level = 'confirmed_execute'
            label = '确认执行'
            current_best_action = execution_payload.get('action') or 'wait'
        else:
            level = 'candidate_probe'
            label = '候选可试'
            current_best_action = '轻仓试'

        supporting_factors = [
            item for item in [
                (zero_axis_signal or {}).get('signal_label')
                if (zero_axis_signal or {}).get('impact_on_judgment') == 'promote'
                else None,
                (divergence_weight or {}).get('label')
                if (divergence_weight or {}).get('impact_on_judgment') == 'promote'
                else None,
                (resonance_state or {}).get('reason')
                if (resonance_state or {}).get('status') == 'supportive'
                else None,
                execution_payload.get('rationale'),
            ] if item
        ]
        limiting_factors = [
            item for item in [
                (wait_state or {}).get('current_block'),
                (divergence_weight or {}).get('label')
                if (divergence_weight or {}).get('impact_on_judgment') == 'suppress'
                else None,
                (resonance_state or {}).get('reason')
                if (resonance_state or {}).get('status') == 'conflicting'
                else None,
            ] if item
        ]

        return {
            'level': level,
            'label': label,
            'current_best_action': current_best_action,
            'critical_reason': critical_reason,
            'supporting_factors': supporting_factors,
            'limiting_factors': limiting_factors,
        }

    def _build_trinity_execution_plan_decision(
        self,
        *,
        execution_payload: Dict[str, Any],
        judgment: Dict[str, Any],
        candidate_structure: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        trigger_list = execution_payload.get('trigger') if isinstance(execution_payload, dict) else None
        trigger_list = trigger_list if isinstance(trigger_list, list) else []
        confirmation_list = execution_payload.get('confirmation') if isinstance(execution_payload, dict) else None
        confirmation_list = confirmation_list if isinstance(confirmation_list, list) else []
        invalidation_list = execution_payload.get('invalidation') if isinstance(execution_payload, dict) else None
        invalidation_list = invalidation_list if isinstance(invalidation_list, list) else []
        return {
            'probe_entry': trigger_list[0] if trigger_list else '继续等待触发',
            'confirm_entry': (
                confirmation_list[0]
                if confirmation_list
                else (candidate_structure or {}).get('upgrade_condition')
                or '等待进一步确认'
            ),
            'invalidation': invalidation_list[0] if invalidation_list else '若条件失效则取消',
            'current_position_action': judgment.get('current_best_action') or '继续等待',
        }

    def _build_trinity_decision(
        self,
        *,
        level: str,
        structure_payload: Dict[str, Any],
        macd_payload: Dict[str, Any],
        moving_averages: Dict[str, Any],
        breakthrough_payload: Dict[str, Any],
        execution_payload: Dict[str, Any],
        level_nesting_payload: Optional[Dict[str, Any]],
        period_payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        structure_payload = structure_payload if isinstance(structure_payload, dict) else {}
        execution_payload = execution_payload if isinstance(execution_payload, dict) else {}
        structure_decision = self._build_trinity_structure_decision(structure_payload)
        spacetime_decision = self._build_trinity_spacetime_decision(structure_payload, macd_payload)
        moving_average_decision = self._build_trinity_moving_average_decision(moving_averages, breakthrough_payload)
        volume_decision = self._build_trinity_volume_confirmation_decision(period_payload or {}, breakthrough_payload)
        trade_qualification = self._build_trinity_trade_qualification(
            structure_decision,
            spacetime_decision,
            moving_average_decision,
            volume_decision,
            execution_payload,
            level_nesting_payload,
        )
        execution_decision = self._build_trinity_execution_decision(execution_payload)
        candidate_structure = self._build_trinity_candidate_structure_decision(
            structure_payload=structure_payload,
            execution_payload=execution_payload,
        )
        wait_state = self._build_trinity_wait_state_decision(
            structure_payload=structure_payload,
            execution_payload=execution_payload,
            trade_qualification=trade_qualification,
        )
        zero_axis_signal = self._build_trinity_zero_axis_signal_decision(macd_payload)

        raw_action = execution_payload.get('action') or 'wait'
        action = raw_action
        can_trade = bool(execution_payload.get('can_trade'))
        if trade_qualification['trade_mode'] in {'wait_confirmation', 'no_trade'}:
            action = 'wait'
            can_trade = False
        elif action == 'wait':
            can_trade = False
        conclusion_bias = (
            'bullish'
            if execution_payload.get('direction') == 'long'
            else 'bearish'
            if execution_payload.get('direction') == 'short'
            else 'neutral'
        )
        resonance_state = self._build_trinity_resonance_state_decision(
            level_nesting_decision=level_nesting_payload,
            moving_average_decision=moving_average_decision,
            volume_decision=volume_decision,
        )
        divergence_weight = self._build_trinity_divergence_weight_decision(
            spacetime_decision=spacetime_decision,
            conclusion_bias=conclusion_bias,
        )
        judgment = self._build_trinity_judgment_decision(
            trade_qualification=trade_qualification,
            execution_payload=execution_payload,
            wait_state=wait_state,
            zero_axis_signal=zero_axis_signal,
            resonance_state=resonance_state,
            divergence_weight=divergence_weight,
        )
        if judgment.get('level') == 'strict_wait':
            action = 'wait'
            can_trade = False
        execution_plan = self._build_trinity_execution_plan_decision(
            execution_payload=execution_payload,
            judgment=judgment,
            candidate_structure=candidate_structure,
        )
        return {
            'version': 'v2',
            'level': level,
            'conclusion': {
                'action': action,
                'action_label': action,
                'bias': conclusion_bias,
                'confidence': trade_qualification['confidence'],
                'can_trade': can_trade,
                'wait_reason': (
                    execution_payload.get('wait_reason')
                    or judgment.get('critical_reason')
                    if action == 'wait'
                    else execution_payload.get('wait_reason')
                ),
            },
            'structure': structure_decision,
            'spacetime': spacetime_decision,
            'moving_average': moving_average_decision,
            'volume_confirmation': volume_decision,
            'level_nesting': level_nesting_payload,
            'trade_qualification': trade_qualification,
            'execution': execution_decision,
            'candidate_structure': candidate_structure,
            'wait_state': wait_state,
            'zero_axis_signal': zero_axis_signal,
            'resonance_state': resonance_state,
            'divergence_weight': divergence_weight,
            'judgment': judgment,
            'execution_plan': execution_plan,
            'judgment_criteria': [],
            'ai_summary_facts': [
                structure_payload.get('description') or '',
                judgment.get('critical_reason') or '',
                execution_payload.get('rationale') or execution_payload.get('wait_reason') or '',
            ],
        }

    def _level_label(self, level: Optional[str]) -> str:
        return self.LEVEL_LABELS.get(level or '', level or '当前级别')

    def _resolve_level_nesting_parent_status(self, parent_payload: Dict[str, Any]) -> Optional[str]:
        decision = parent_payload.get('trinity_decision') if isinstance(parent_payload, dict) else {}
        decision = decision or {}
        spacetime = decision.get('spacetime') or {}
        macd = parent_payload.get('macd') or {}
        return spacetime.get('status') or macd.get('status')

    def _spacetime_parent_bias(self, status: Optional[str]) -> str:
        if status in ('极强', '强', '中偏强'):
            return 'bullish'
        if status in ('极弱', '弱', '中偏弱'):
            return 'bearish'
        return 'neutral'

    def _normalize_level_nesting_direction(self, value: Optional[str]) -> str:
        if value in ('up', '上涨', 'long', 'bullish'):
            return 'up'
        if value in ('down', '下跌', 'short', 'bearish'):
            return 'down'
        return 'neutral'

    def _resolve_level_nesting_structure_profile(
        self,
        child_payload: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        decision = child_payload.get('trinity_decision') or {}
        structure_decision = decision.get('structure') or {}
        period_structure = child_payload.get('structure') or {}
        interpretation = period_structure.get('interpretation') or {}
        focus_structure = interpretation.get('focus_structure') or {}

        structure_type = (
            structure_decision.get('type')
            or period_structure.get('structure_type')
            or focus_structure.get('archetype_label')
        )
        standard_candidate = structure_decision.get('standard_candidate')
        focus_family = focus_structure.get('archetype_family')
        candidate_for_family = standard_candidate or structure_type

        family, _, resolved_qualification = self._resolve_structure_profile(candidate_for_family)
        if family not in {'A', 'B', 'C', 'D'} and focus_family in {'A', 'B', 'C', 'D'}:
            family = focus_family

        structure_group = structure_decision.get('family')
        qualification = (
            structure_decision.get('qualification')
            or focus_structure.get('standard_qualification')
            or resolved_qualification
            or 'unknown'
        )
        if structure_group in {'range', 'channel'}:
            qualification = structure_group
        elif qualification == 'over_limit' and structure_group in {'range', 'channel'}:
            qualification = structure_group
        elif qualification == 'failed' and family == 'complex':
            qualification = 'complex'

        direction = self._normalize_level_nesting_direction(
            structure_decision.get('direction')
            or focus_structure.get('directional_bias')
            or period_structure.get('trend_direction')
        )
        if direction == 'neutral':
            direction = {
                'A': 'up',
                'B': 'up',
                'C': 'up',
                'D': 'down',
            }.get(family, direction)

        return {
            'type': structure_type or '未知结构',
            'family': family if family in {'A', 'B', 'C', 'D'} else 'unknown',
            'qualification': qualification,
            'direction': direction,
        }

    def _compact_condition_list(self, items: List[Optional[str]], fallback: str) -> List[str]:
        result: List[str] = []
        for item in items:
            if not isinstance(item, str):
                continue
            value = item.strip()
            if value and value not in result:
                result.append(value)
        if result:
            return result[:3]
        return [fallback]

    def _family_condition_templates(self, level_label: str, family: str) -> Dict[str, List[str]]:
        templates = {
            'A': {
                'wait': [f'等待{level_label}有效突破结构上沿', f'等待{level_label}站上MA55后回踩不破'],
                'confirm': [f'{level_label}放量突破确认', f'{level_label}回踩MA55不破'],
                'invalid': [f'{level_label}跌回结构内按假突破处理', f'{level_label}跌破MA55且反抽不过失效'],
            },
            'B': {
                'wait': [f'等待{level_label}B类结构边界确认', f'等待{level_label}平台边界回踩不破'],
                'confirm': [f'{level_label}边界放量突破确认', f'{level_label}回踩平台上沿不破'],
                'invalid': [f'{level_label}跌回平台下沿失效', f'{level_label}突破后量能失败并回落结构内，按假突破处理'],
            },
            'C': {
                'wait': [f'等待{level_label}突破平台上沿', f'等待{level_label}回踩平台边界不破'],
                'confirm': [f'{level_label}放量突破平台上沿', f'{level_label}突破后回踩不破'],
                'invalid': [f'{level_label}跌破中枢下沿失效', f'{level_label}跌破MA55且反抽不过失效'],
            },
            'D': {
                'wait': [f'关注{level_label}D类三段结构节奏演化', f'等待{level_label}三段结构边界确认'],
                'confirm': [f'{level_label}三段结构关键拐点确认', f'{level_label}结构完成并出现方向选择'],
                'invalid': [f'{level_label}跌破原建仓级别止损位立即退出', f'{level_label}反抽不过关键均线，按失败处理'],
            },
        }
        return templates.get(family, {
            'wait': [f'等待{level_label}结构确认'],
            'confirm': [f'{level_label}确认信号形成'],
            'invalid': [f'{level_label}结构失效'],
        })

    def _format_level_nesting_boundary_price(self, value: Optional[float]) -> Optional[str]:
        normalized = self._normalize_trinity_price(value)
        if normalized is None:
            return None
        return f'{normalized:.2f}'

    def _build_level_nesting_boundary_semantic(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        family: str,
        qualification: str,
        level_label: str,
        direction: str,
    ) -> Optional[Dict[str, Any]]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        structure_payload = child_payload.get('structure') or {}
        structure_details = structure_payload.get('structure_details') or {}
        boundaries = structure_details.get('boundary_levels')
        if not isinstance(boundaries, dict) or not boundaries:
            return None

        upper = self._normalize_trinity_price(boundaries.get('upper'))
        lower = self._normalize_trinity_price(boundaries.get('lower'))
        if upper is None or lower is None or upper <= lower:
            return None

        mid = self._normalize_trinity_price(boundaries.get('mid'))
        if mid is None:
            mid = round((upper + lower) / 2, 2)

        breakout_trigger = self._normalize_trinity_price(boundaries.get('breakout_trigger'))
        if breakout_trigger is None:
            breakout_trigger = upper

        breakdown_trigger = self._normalize_trinity_price(boundaries.get('breakdown_trigger'))
        if breakdown_trigger is None:
            breakdown_trigger = lower

        stop_loss = self._normalize_trinity_price(boundaries.get('stop_loss'))
        if stop_loss is None:
            stop_loss = lower

        upper_text = self._format_level_nesting_boundary_price(upper)
        lower_text = self._format_level_nesting_boundary_price(lower)

        if family == 'C' and qualification in {'standard', 'extended', 'complex'}:
            return {
                'mode': 'c_pivot',
                'label': 'C类中枢边界',
                'upper': upper,
                'lower': lower,
                'mid': mid,
                'breakout_trigger': breakout_trigger,
                'breakdown_trigger': breakdown_trigger,
                'stop_loss': stop_loss,
                'reason': f'{level_label}优先按中枢上沿{upper_text} / 下沿{lower_text}处理',
            }

        if qualification == 'range':
            return {
                'mode': 'range_box',
                'label': '区间上下沿',
                'upper': upper,
                'lower': lower,
                'mid': mid,
                'breakout_trigger': breakout_trigger,
                'breakdown_trigger': breakdown_trigger,
                'stop_loss': stop_loss,
                'reason': f'{level_label}当前按区间上沿{upper_text} / 下沿{lower_text}等待方向选择',
            }

        if qualification == 'channel':
            reason = (
                f'{level_label}当前按通道下沿{lower_text}等待跌破或反抽确认'
                if direction == 'down'
                else f'{level_label}当前按通道上沿{upper_text}等待突破或回踩确认'
            )
            return {
                'mode': 'channel_band',
                'label': '通道上下沿',
                'upper': upper,
                'lower': lower,
                'mid': mid,
                'breakout_trigger': breakout_trigger,
                'breakdown_trigger': breakdown_trigger,
                'stop_loss': stop_loss,
                'reason': reason,
            }

        return None

    def _build_boundary_semantic_conditions(
        self,
        level_label: str,
        boundary_semantic: Optional[Dict[str, Any]],
        qualification: str,
        direction: str,
    ) -> Optional[Dict[str, List[str]]]:
        boundary_semantic = boundary_semantic if isinstance(boundary_semantic, dict) else {}
        upper = self._format_level_nesting_boundary_price(boundary_semantic.get('upper'))
        lower = self._format_level_nesting_boundary_price(boundary_semantic.get('lower'))
        if upper is None or lower is None:
            return None

        mode = boundary_semantic.get('mode')
        if mode == 'c_pivot':
            if direction == 'down':
                return {
                    'wait_conditions': [
                        f'等待{level_label}跌破中枢下沿{lower}',
                        f'等待{level_label}反抽中枢下沿{lower}不过',
                    ],
                    'confirm_conditions': [
                        f'{level_label}跌破中枢下沿{lower}后继续转弱',
                        f'{level_label}跌破后反抽{lower}不过',
                    ],
                    'invalidation_conditions': [
                        f'{level_label}重新站回中枢下沿{lower}上方，按假跌破处理',
                        f'{level_label}反抽后站回中枢内，按跌破失败处理',
                    ],
                }
            return {
                'wait_conditions': [
                    f'等待{level_label}突破平台上沿{upper}',
                    f'等待{level_label}回踩平台上沿{upper}不破',
                ],
                'confirm_conditions': [
                    f'{level_label}放量突破平台上沿{upper}',
                    f'{level_label}突破后回踩{upper}不破',
                ],
                'invalidation_conditions': [
                    f'跌破{level_label}中枢下沿{lower}失效',
                    f'{level_label}跌回中枢内，按假突破处理',
                ],
            }

        if mode == 'range_box':
            return {
                'wait_conditions': [
                    f'等待{level_label}突破区间上沿{upper}或跌破区间下沿{lower}',
                ],
                'confirm_conditions': [
                    f'{level_label}突破{upper}后回踩不破再确认',
                    f'{level_label}跌破{lower}后反抽不过再确认',
                ],
                'invalidation_conditions': [
                    f'{level_label}重新回到{lower}-{upper}区间内，按假突破/假跌破处理',
                ],
            }

        if mode == 'channel_band' and direction == 'down':
            return {
                'wait_conditions': [
                    f'等待{level_label}跌破通道下沿{lower}或反抽通道上沿{upper}不过',
                ],
                'confirm_conditions': [
                    f'{level_label}跌破{lower}后反抽不过再确认',
                    f'{level_label}反抽通道上沿{upper}失败后继续转弱',
                ],
                'invalidation_conditions': [
                    f'{level_label}重新站回通道上沿{upper}上方，按跌破失败处理',
                ],
            }

        if mode == 'channel_band':
            return {
                'wait_conditions': [
                    f'等待{level_label}突破通道上沿{upper}或回踩通道下沿{lower}不破',
                ],
                'confirm_conditions': [
                    f'{level_label}突破{upper}后回踩不破再确认',
                    f'{level_label}回踩通道下沿{lower}后重新转强',
                ],
                'invalidation_conditions': [
                    f'{level_label}跌破通道下沿{lower}失效',
                    f'{level_label}突破后重新跌回通道内，按假突破处理',
                ],
            }

        return None

    def _build_level_nesting_modifier_context(
        self,
        child_payload: Optional[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        decision = child_payload.get('trinity_decision') or {}
        return {
            'moving_average': (
                decision.get('moving_average')
                if isinstance(decision.get('moving_average'), dict)
                else {}
            ),
            'volume_confirmation': (
                decision.get('volume_confirmation')
                if isinstance(decision.get('volume_confirmation'), dict)
                else {}
            ),
            'divergence_weight': (
                decision.get('divergence_weight')
                if isinstance(decision.get('divergence_weight'), dict)
                else {}
            ),
        }

    def _build_level_nesting_modifier_conditions(
        self,
        *,
        level_label: str,
        direction: str,
        moving_average_decision: Optional[Dict[str, Any]],
        volume_decision: Optional[Dict[str, Any]],
        divergence_weight: Optional[Dict[str, Any]],
    ) -> Dict[str, List[str]]:
        moving_average_decision = (
            moving_average_decision if isinstance(moving_average_decision, dict) else {}
        )
        volume_decision = volume_decision if isinstance(volume_decision, dict) else {}
        divergence_weight = divergence_weight if isinstance(divergence_weight, dict) else {}

        wait_conditions: List[str] = []
        confirm_conditions: List[str] = []
        invalidation_conditions: List[str] = []

        volume_gate = volume_decision.get('volume_gate') or {}
        volume_reason = str(volume_gate.get('reason') or '').strip()
        breakout_volume = volume_decision.get('breakout_volume')
        if direction == 'up' and (
            '突破量弱' in volume_reason
            or (
                breakout_volume == 'weak'
                and volume_gate.get('confidence_adjustment') == 'downgrade'
            )
        ):
            confirm_conditions.append(f'{level_label}突破量弱，等待二次放量确认')

        ma_gate = moving_average_decision.get('ma_gate') or {}
        ma_reason = str(ma_gate.get('reason') or '').strip()
        ma55_role = moving_average_decision.get('ma55_role')
        if direction == 'up' and (
            ma55_role == 'support'
            or 'MA55支撑有效' in ma_reason
        ):
            confirm_conditions.append(f'{level_label}MA55回踩不破再确认')
            invalidation_conditions.append(f'{level_label}跌破MA55后反抽不过，按支撑失效处理')

        suppressive = divergence_weight.get('impact_on_judgment') == 'suppress'
        divergence_label = str(divergence_weight.get('label') or '').strip()
        divergence_reason = str(divergence_weight.get('reason') or '').strip()
        if suppressive and divergence_label:
            wait_conditions.append(f'{divergence_label}，先等待风险释放')
        if suppressive and divergence_reason:
            invalidation_conditions.append(divergence_reason)

        return {
            'wait_conditions': wait_conditions,
            'confirm_conditions': confirm_conditions,
            'invalidation_conditions': invalidation_conditions,
        }

    def _build_node_semantic_conditions(
        self,
        level_label: str,
        node_semantic: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, List[str]]]:
        node_semantic = node_semantic if isinstance(node_semantic, dict) else {}
        family = node_semantic.get('family')
        actionable_node = node_semantic.get('actionable_node')
        if family == 'B' and (not isinstance(actionable_node, str) or not actionable_node.startswith('b')):
            return None
        if family == 'D' and (not isinstance(actionable_node, str) or not actionable_node.startswith('d')):
            return None
        templates = {
            'b1': {
                'wait': [f'等待{level_label}B类b1启动确认', f'等待{level_label}启动段放量并站稳平台上沿'],
                'confirm': [f'{level_label}启动段放量突破确认', f'{level_label}回踩平台上沿不破'],
                'invalid': [f'{level_label}启动后跌回平台内，按假启动处理', f'{level_label}跌破平台下沿失效'],
            },
            'b3': {
                'wait': [f'等待{level_label}B类b3回踩确认', f'等待{level_label}回踩平台上沿不破'],
                'confirm': [f'{level_label}回踩平台上沿不破', f'{level_label}回踩后重新转强并放量确认'],
                'invalid': [f'{level_label}回踩跌回平台下沿失效', f'{level_label}回踩后量能衰竭并重新跌回结构内'],
            },
            'b5': {
                'wait': [f'等待{level_label}B类b5中继确认', f'等待{level_label}中继段回踩边界后止跌'],
                'confirm': [f'{level_label}中继回踩确认后再度转强', f'{level_label}平台边界支撑有效并恢复放量'],
                'invalid': [f'{level_label}中继确认失败并跌回平台下沿', f'{level_label}中继段回抽不过关键边界失效'],
            },
            'b7': {
                'wait': [f'等待{level_label}B类b7末端确认', f'等待{level_label}末端确认后给出方向选择'],
                'confirm': [f'{level_label}末端确认后出现有效突破', f'{level_label}方向选择配合量价共振'],
                'invalid': [f'{level_label}末端确认失败并重新跌回平台内', f'{level_label}方向选择后快速反抽失败'],
            },
            'd1': {
                'wait': [f'等待{level_label}D类d2修正展开', f'等待{level_label}起点观察后进入修正段'],
                'confirm': [f'{level_label}D类d2修正展开并守住起点', f'{level_label}修正段开始后仍保持结构完整'],
                'invalid': [f'{level_label}D类起点观察失效并跌回原趋势内', f'{level_label}修正段未展开且结构重新转弱'],
            },
            'd3': {
                'wait': [f'等待{level_label}D类d3反向修正完成', f'等待{level_label}反向修正结束并确认转向'],
                'confirm': [f'{level_label}D类d4结构完成并出现确认信号', f'{level_label}反向修正完成后给出方向选择'],
                'invalid': [f'{level_label}D类d3确认失败并重新跌回修正段', f'{level_label}反向修正后无延续并跌破关键止损位'],
            },
            'd4': {
                'wait': [f'等待{level_label}D类d4结构完成后的方向选择', f'等待{level_label}结构完成后确认突破或转弱'],
                'confirm': [f'{level_label}D类d4结构完成并出现方向选择', f'{level_label}结构完成后的方向选择获得量价确认'],
                'invalid': [f'{level_label}D类d4完成后方向选择失败', f'{level_label}结构完成后迅速回到原区间内失效'],
            },
        }
        template = templates.get(actionable_node)
        if not template:
            return None
        return {
            'wait_conditions': template['wait'],
            'confirm_conditions': template['confirm'],
            'invalidation_conditions': template['invalid'],
        }

    def _build_level_nesting_conditions(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        level_label: str,
        family: str,
        qualification: str,
        direction: str,
        node_semantic: Optional[Dict[str, Any]] = None,
        boundary_semantic: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, List[str]]:
        child_payload = child_payload if isinstance(child_payload, dict) else {}
        decision = child_payload.get('trinity_decision') or {}
        execution_plan = decision.get('execution_plan') or {}
        wait_state = decision.get('wait_state') or {}
        execution = decision.get('execution') or {}
        modifier_context = self._build_level_nesting_modifier_context(child_payload)
        modifier_conditions = self._build_level_nesting_modifier_conditions(
            level_label=level_label,
            direction=direction,
            moving_average_decision=modifier_context.get('moving_average'),
            volume_decision=modifier_context.get('volume_confirmation'),
            divergence_weight=modifier_context.get('divergence_weight'),
        )
        semantic_conditions = self._build_node_semantic_conditions(level_label, node_semantic)
        boundary_conditions = self._build_boundary_semantic_conditions(
            level_label,
            boundary_semantic,
            qualification,
            direction,
        )
        templates = self._family_condition_templates(level_label, family)

        if semantic_conditions:
            wait_items = [
                *(semantic_conditions.get('wait_conditions') or []),
                *(modifier_conditions.get('wait_conditions') or []),
                execution_plan.get('probe_entry'),
                wait_state.get('next_confirmation_action'),
            ]
            confirm_items = [
                *(semantic_conditions.get('confirm_conditions') or []),
                *(modifier_conditions.get('confirm_conditions') or []),
                execution_plan.get('confirm_entry'),
                *((execution.get('confirmation') or []) if isinstance(execution.get('confirmation'), list) else []),
            ]
            invalid_items = [
                *(semantic_conditions.get('invalidation_conditions') or []),
                *(modifier_conditions.get('invalidation_conditions') or []),
                execution_plan.get('invalidation'),
                *((execution.get('invalidation') or []) if isinstance(execution.get('invalidation'), list) else []),
            ]
        elif boundary_conditions:
            wait_items = [
                *(boundary_conditions.get('wait_conditions') or []),
                *(modifier_conditions.get('wait_conditions') or []),
                execution_plan.get('probe_entry'),
                wait_state.get('next_confirmation_action'),
            ]
            confirm_items = [
                *(boundary_conditions.get('confirm_conditions') or []),
                *(modifier_conditions.get('confirm_conditions') or []),
                execution_plan.get('confirm_entry'),
                *((execution.get('confirmation') or []) if isinstance(execution.get('confirmation'), list) else []),
            ]
            invalid_items = [
                *(boundary_conditions.get('invalidation_conditions') or []),
                *(modifier_conditions.get('invalidation_conditions') or []),
                execution_plan.get('invalidation'),
                *((execution.get('invalidation') or []) if isinstance(execution.get('invalidation'), list) else []),
            ]
        else:
            wait_items = [
                *templates['wait'],
                *(modifier_conditions.get('wait_conditions') or []),
                execution_plan.get('probe_entry'),
                wait_state.get('next_confirmation_action'),
            ]
            confirm_items = [
                *templates['confirm'],
                *(modifier_conditions.get('confirm_conditions') or []),
                execution_plan.get('confirm_entry'),
                *((execution.get('confirmation') or []) if isinstance(execution.get('confirmation'), list) else []),
            ]
            invalid_items = [
                *templates['invalid'],
                *(modifier_conditions.get('invalidation_conditions') or []),
                execution_plan.get('invalidation'),
                *((execution.get('invalidation') or []) if isinstance(execution.get('invalidation'), list) else []),
            ]

        if qualification == 'extended':
            wait_items.insert(0, f'{level_label}延伸结构沿用{family}类框架，等待边界确认')
        elif qualification == 'unfinished':
            wait_items.insert(0, f'{level_label}结构未完成，先观察不执行')
        elif qualification == 'complex':
            wait_items.insert(0, f'{level_label}复杂结构只看边界，不套标准节点')
        elif qualification in {'range', 'channel'}:
            wait_items.insert(0, f'{level_label}按上下沿边界等待突破/跌破确认')

        return {
            'wait_conditions': self._compact_condition_list(wait_items, f'等待{level_label}结构确认'),
            'confirm_conditions': self._compact_condition_list(confirm_items, f'{level_label}确认信号形成'),
            'invalidation_conditions': self._compact_condition_list(invalid_items, f'{level_label}结构失效'),
        }

    def _operation_frame_for_family(self, family: str, qualification: str) -> str:
        if qualification in {'range', 'channel'}:
            return 'range_boundary'
        return {
            'A': 'trend_continuation',
            'B': 'swing_platform',
            'C': 'platform_boundary',
            'D': 'three_leg_reversal',
        }.get(family, 'wait_structure')

    def _downgrade_execution_strength(
        self,
        *,
        resonance: str,
        family: str,
        qualification: str,
        parent_status: Optional[str],
    ) -> Tuple[str, Optional[str]]:
        if qualification == 'standard' and resonance == 'aligned':
            if family == 'D':
                return 'light_probe', 'D类结构按三段节奏处理，执行需谨慎'
            return 'normal', None
        if qualification == 'extended':
            return 'light_probe', f'延伸{family}沿用{family}类框架，但拐点偏多，需等待确认'
        if qualification == 'unfinished':
            return 'observe_only', '结构未完成，只观察不执行'
        if qualification == 'complex':
            return 'wait_confirmation', '复杂结构只看边界，不套标准节点'
        if qualification in {'range', 'channel'}:
            return 'wait_confirmation', '区间/通道结构按上下沿边界等待确认'
        if resonance in {'boundary_probe', 'structure_mismatch', 'parent_unclear'}:
            return 'wait_confirmation', None
        if resonance == 'child_countertrend':
            return 'light_probe', '子级逆父级，只允许轻仓试探或做T'
        return 'wait_confirmation', None

    def _build_level_nesting_permission_reason(
        self,
        *,
        parent_label: str,
        child_label: str,
        parent_status: Optional[str],
        family: str,
        qualification: str,
        resonance: str,
        execution_strength: str,
        node_semantic: Optional[Dict[str, Any]] = None,
        boundary_semantic: Optional[Dict[str, Any]] = None,
    ) -> str:
        status_text = parent_status or '状态未知'
        family_text = f'{family}类' if family in {'A', 'B', 'C', 'D'} else '结构'
        qualification_text = {
            'standard': '标准结构',
            'extended': '延伸结构',
            'unfinished': '未完成结构',
            'complex': '复杂结构',
            'range': '区间结构',
            'channel': '通道结构',
            'failed': '结构未通过',
            'unknown': '结构未知',
        }.get(qualification, qualification)
        node_label = (node_semantic or {}).get('label')
        boundary_label = (boundary_semantic or {}).get('label')
        if resonance == 'aligned':
            if isinstance(node_label, str) and node_label:
                return f'{parent_label}{status_text}支持{child_label}{node_label}，但仍需按节点确认节奏执行'
            if isinstance(boundary_label, str) and boundary_label:
                return f'{parent_label}{status_text}支持{child_label}{boundary_label}，但仍需按边界确认节奏执行'
            return f'{parent_label}{status_text}，{child_label}{qualification_text}{family_text}命中三位一体表，按{child_label}条件执行'
        if resonance == 'boundary_probe':
            if isinstance(boundary_label, str) and boundary_label and not isinstance(node_label, str):
                return f'{parent_label}{status_text}支持{child_label}{boundary_label}，但仍需按边界确认节奏执行'
            return f'{parent_label}{status_text}，{child_label}{qualification_text}{family_text}命中平台边界逻辑，只允许轻仓等待确认'
        if resonance == 'child_countertrend':
            return f'{parent_label}{status_text}，{child_label}{qualification_text}{family_text}逆父级，只允许轻仓试探或做T'
        if resonance == 'structure_mismatch':
            return f'{parent_label}{status_text}与{child_label}{qualification_text}{family_text}不匹配，先等待结构重新确认'
        if resonance == 'blocked':
            return f'{parent_label}{status_text}不支持{child_label}当前方向，先等待父级放行'
        return f'{parent_label}{status_text}无法明确放行，{child_label}先等待确认'

    def _extract_level_nesting_stage_token(self, value: Optional[str], prefix: str) -> Optional[str]:
        if not isinstance(value, str):
            return None
        match = re.search(rf'({prefix}\d+)', value.lower())
        return match.group(1) if match else None

    def _resolve_b_actionable_node(self, stage_token: Optional[str]) -> Optional[str]:
        mapping = {
            'b1': 'b1',
            'b2': 'b3',
            'b3': 'b3',
            'b4': 'b5',
            'b5': 'b5',
            'b6': 'b7',
            'b7': 'b7',
        }
        return mapping.get(stage_token or '')

    def _resolve_d_actionable_node(self, stage_token: Optional[str]) -> Optional[str]:
        return {
            'd1': 'd1',
            'd2': 'd3',
            'd3': 'd3',
            'd4': 'd4',
        }.get(stage_token or '')

    def _build_level_nesting_node_semantic(
        self,
        *,
        child_payload: Optional[Dict[str, Any]],
        family: str,
        qualification: str,
        level_label: str,
    ) -> Optional[Dict[str, Any]]:
        if family not in {'B', 'D'} or qualification != 'standard':
            return None

        child_payload = child_payload if isinstance(child_payload, dict) else {}
        structure_payload = child_payload.get('structure') or {}
        interpretation = structure_payload.get('interpretation') or {}
        details = structure_payload.get('structure_details') or {}
        prediction = details.get('prediction') or {}
        explainability = details.get('explainability') or {}
        current_leg = interpretation.get('current_leg') or {}
        stage_token = (
            self._extract_level_nesting_stage_token(prediction.get('current_stage'), family.lower())
            or self._extract_level_nesting_stage_token(prediction.get('next_stage'), family.lower())
            or self._extract_level_nesting_stage_token(current_leg.get('label'), family.lower())
            or self._extract_level_nesting_stage_token(explainability.get('current_point_id'), family.lower())
        )

        actionable_node = (
            self._resolve_b_actionable_node(stage_token)
            if family == 'B'
            else self._resolve_d_actionable_node(stage_token)
        )
        if not actionable_node:
            return None

        unstable_point = prediction.get('unstable_point') or {}
        label_map = {
            'b1': 'B类b1启动确认',
            'b3': 'B类b3回踩确认',
            'b5': 'B类b5中继确认',
            'b7': 'B类b7末端确认',
            'd1': 'D类d1起点观察',
            'd2': 'D类d2修正展开',
            'd3': 'D类d3反向修正完成',
            'd4': 'D类d4结构完成',
        }
        evidence = [
            current_leg.get('label') or '',
            prediction.get('current_stage') or '',
            prediction.get('next_stage') or '',
            explainability.get('current_point_id') or '',
        ]
        if family == 'D' and unstable_point.get('description'):
            evidence.insert(0, unstable_point.get('description'))

        reason = '；'.join([item for item in evidence if item]) or f'{level_label}{label_map[actionable_node]}'
        return {
            'family': family,
            'actionable_node': actionable_node,
            'label': label_map[actionable_node],
            'reason': reason,
            'evidence': [item for item in evidence if item][:3],
        }

    def _build_trinity_level_nesting_decision(
        self,
        *,
        level: str,
        normalized_results: Dict[str, Any],
        raw_level_nesting: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        parent_map = {
            'daily': 'weekly',
            'hour60': 'daily',
            'hour30': 'daily',
            'hour15': 'hour60',
        }
        parent_level = parent_map.get(level)
        parent_label = self._level_label(parent_level)
        child_label = self._level_label(level)
        parent_payload = normalized_results.get(parent_level or '') if parent_level else None
        child_payload = normalized_results.get(level)

        if not parent_level or not isinstance(parent_payload, dict):
            conditions = self._build_level_nesting_conditions(
                child_payload=child_payload,
                level_label=child_label,
                family='unknown',
                qualification='unknown',
                direction='neutral',
                node_semantic=None,
                boundary_semantic=None,
            )
            return {
                'parent_level': parent_level,
                'child_level': level,
                'parent_spacetime_status': None,
                'child_structure_type': '未知结构',
                'child_structure_family': 'unknown',
                'child_structure_qualification': 'unknown',
                'child_structure_direction': 'neutral',
                'structure_match': False,
                'parent_bias': 'neutral',
                'child_signal': 'wait',
                'resonance': 'parent_unclear',
                'operation_bias': 'wait',
                'operation_frame': 'wait_structure',
                'node_semantic': None,
                'boundary_semantic': None,
                'execution_strength': 'wait_confirmation',
                'downgrade_reason': f'{parent_label}缺失或尚未归一化',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': level in ('hour30', 'hour15'),
                    'allow_only_light_probe': True,
                    'reason': f'{parent_label}缺失，{child_label}只能等待确认',
                },
                **conditions,
            }

        parent_status = self._resolve_level_nesting_parent_status(parent_payload)
        profile = self._resolve_level_nesting_structure_profile(child_payload)
        parent_bias = self._spacetime_parent_bias(parent_status)
        family = profile['family']
        qualification = profile['qualification']
        direction = profile['direction']
        child_signal = 'long' if direction == 'up' else 'short' if direction == 'down' else 'wait'
        operation_bias = child_signal
        table_config = self.SPACETIME_STRUCTURE_TABLE.get(parent_status or '')

        if not table_config:
            resonance = 'parent_unclear'
            structure_match = False
        else:
            if direction == 'up':
                expected_structures = table_config.get('上涨结构') or []
            elif direction == 'down':
                expected_structures = table_config.get('下跌结构') or []
            else:
                expected_structures = list(dict.fromkeys((table_config.get('上涨结构') or []) + (table_config.get('下跌结构') or [])))
            structure_match = family in expected_structures

            if direction == 'up' and not table_config.get('上涨结构'):
                resonance = 'blocked'
            elif direction == 'down' and not table_config.get('下跌结构'):
                resonance = 'blocked'
            elif family == 'C' and parent_status in ('中偏强', '中偏弱') and structure_match:
                resonance = 'boundary_probe'
            elif structure_match and direction in {'up', 'down'}:
                resonance = 'aligned'
            elif parent_bias == 'bearish' and child_signal == 'long':
                resonance = 'child_countertrend'
            elif parent_bias == 'bullish' and child_signal == 'short':
                resonance = 'child_countertrend'
            elif not structure_match:
                resonance = 'structure_mismatch'
            else:
                resonance = 'parent_unclear'

        operation_frame = self._operation_frame_for_family(family, qualification)
        execution_strength, downgrade_reason = self._downgrade_execution_strength(
            resonance=resonance,
            family=family,
            qualification=qualification,
            parent_status=parent_status,
        )
        if resonance == 'boundary_probe':
            execution_strength = 'light_probe'
        if resonance in {'blocked', 'structure_mismatch', 'parent_unclear'} and execution_strength == 'normal':
            execution_strength = 'wait_confirmation'

        node_semantic = self._build_level_nesting_node_semantic(
            child_payload=child_payload,
            family=family,
            qualification=qualification,
            level_label=child_label,
        )
        boundary_semantic = self._build_level_nesting_boundary_semantic(
            child_payload=child_payload,
            family=family,
            qualification=qualification,
            level_label=child_label,
            direction=direction,
        )
        if resonance in {'blocked', 'parent_unclear', 'child_countertrend'}:
            boundary_semantic = None
        elif qualification not in {'range', 'channel'} and resonance not in {'aligned', 'boundary_probe'}:
            boundary_semantic = None
        conditions = self._build_level_nesting_conditions(
            child_payload=child_payload,
            level_label=child_label,
            family=family,
            qualification=qualification,
            direction=direction,
            node_semantic=node_semantic,
            boundary_semantic=boundary_semantic,
        )
        allow_position_increase = resonance == 'aligned' and execution_strength == 'normal'
        allow_only_light_probe = execution_strength in {'light_probe', 'wait_confirmation'} and resonance != 'blocked'
        reason = self._build_level_nesting_permission_reason(
            parent_label=parent_label,
            child_label=child_label,
            parent_status=parent_status,
            family=family,
            qualification=qualification,
            resonance=resonance,
            execution_strength=execution_strength,
            node_semantic=node_semantic,
            boundary_semantic=boundary_semantic,
        )
        permission = {
            'allow_position_increase': allow_position_increase,
            'allow_t_trade': level in ('hour30', 'hour15') and resonance != 'blocked',
            'allow_only_light_probe': allow_only_light_probe,
            'reason': reason,
        }
        if resonance == 'child_countertrend':
            resonance = 'child_countertrend'
            permission = {
                'allow_position_increase': False,
                'allow_t_trade': level in ('hour30', 'hour15'),
                'allow_only_light_probe': True,
                'reason': reason,
            }

        return {
            'parent_level': parent_level,
            'child_level': level,
            'parent_spacetime_status': parent_status,
            'child_structure_type': profile['type'],
            'child_structure_family': family,
            'child_structure_qualification': qualification,
            'child_structure_direction': direction,
            'structure_match': structure_match,
            'parent_bias': parent_bias,
            'child_signal': child_signal,
            'resonance': resonance,
            'operation_bias': operation_bias,
            'operation_frame': operation_frame,
            'node_semantic': node_semantic,
            'boundary_semantic': boundary_semantic,
            'execution_strength': execution_strength,
            'downgrade_reason': downgrade_reason,
            'permission': permission,
            **conditions,
        }

    def _refresh_trinity_decisions_with_level_nesting(
        self,
        results: Dict[str, Any],
        raw_level_nesting: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        normalized_results = {}
        for level_name, payload in results.items():
            if not isinstance(payload, dict) or payload.get('error'):
                continue
            payload['trinity_decision'] = self._build_trinity_decision(
                level=level_name,
                structure_payload=payload.get('structure') or {},
                macd_payload=payload.get('macd') or {},
                moving_averages=payload.get('moving_averages') or {},
                breakthrough_payload=payload.get('breakthrough') or {},
                execution_payload=((payload.get('structure') or {}).get('execution') or {}),
                level_nesting_payload=None,
                period_payload=payload,
            )
            normalized_results[level_name] = payload

        level_nesting_decisions = {}
        for level_name, payload in normalized_results.items():
            level_nesting_decisions[level_name] = self._build_trinity_level_nesting_decision(
                level=level_name,
                normalized_results=normalized_results,
                raw_level_nesting=raw_level_nesting,
            )

        for level_name, payload in normalized_results.items():
            payload['trinity_decision'] = self._build_trinity_decision(
                level=level_name,
                structure_payload=payload.get('structure') or {},
                macd_payload=payload.get('macd') or {},
                moving_averages=payload.get('moving_averages') or {},
                breakthrough_payload=payload.get('breakthrough') or {},
                execution_payload=((payload.get('structure') or {}).get('execution') or {}),
                level_nesting_payload=level_nesting_decisions.get(level_name),
                period_payload=payload,
            )

        return normalized_results

    def _build_macro_background(
        self,
        moving_averages: Dict[str, Any],
        trend_direction: str,
        points: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build a large-scale context bias separate from the focused leg direction."""
        price_vs_ma55 = moving_averages.get('price_vs_ma55')
        price_vs_ma233 = moving_averages.get('price_vs_ma233')
        ma_status = moving_averages.get('ma_status')

        if price_vs_ma55 == 'above' and price_vs_ma233 == 'above' and ma_status == '多头排列':
            return {
                'direction': 'bullish',
                'label': '偏多',
                'confidence': 'high',
                'basis': ['价格在 MA55 / MA233 上方', 'MA55 高于 MA233'],
            }
        if price_vs_ma55 == 'below' and price_vs_ma233 == 'below' and ma_status == '空头排列':
            return {
                'direction': 'bearish',
                'label': '偏空',
                'confidence': 'high',
                'basis': ['价格在 MA55 / MA233 下方', 'MA55 低于 MA233'],
            }
        if trend_direction == '震荡':
            return {
                'direction': 'range',
                'label': '整理',
                'confidence': 'medium',
                'basis': ['均线与结构方向未完全同向'],
            }

        swing_basis = '最近骨架仍偏多' if trend_direction == '上涨' else '最近骨架仍偏空'
        return {
            'direction': 'mixed',
            'label': '混合',
            'confidence': 'medium',
            'basis': ['均线与结构方向未完全同向', swing_basis],
        }

    def _build_spacetime_gate(
        self,
        parent_status: Optional[str],
        structure_type: str,
        trend_direction: str,
    ) -> Dict[str, Any]:
        """Build parent-status gating so lower levels only act on allowed structures."""
        structure_family, _, standard_qualification = self._resolve_structure_profile(structure_type)

        if not parent_status:
            return {
                'parent_status': None,
                'allowed_child_structures': [],
                'child_structure_family': structure_family,
                'standard_qualification': standard_qualification,
                'child_structure_match': None,
                'resonance_enabled': None,
                'structure_readiness': 'independent',
                'wait_reason': None,
                'required_confirmation': None,
                'explanation': None,
            }

        advice = self.generate_operation_advice(
            major_status=parent_status,
            minor_structure=structure_family,
            minor_trend=trend_direction,
        )
        matched_structures = advice.get('matched_structures', [])
        if isinstance(matched_structures, dict):
            normalized: List[str] = []
            for key in ('上涨结构', '下跌结构'):
                for item in matched_structures.get(key, []):
                    if item not in normalized:
                        normalized.append(item)
            matched_structures = normalized
        elif not isinstance(matched_structures, list):
            matched_structures = []

        is_complex = structure_family in ('complex', 'unfinished')
        is_extended = standard_qualification == 'extended'
        child_structure_label = (
            structure_family
            if structure_family in ('A', 'B', 'C', 'D')
            else '复杂结构' if structure_family == 'complex' else '未完成结构'
        )
        child_structure_match = bool(advice.get('structure_match')) and not is_complex
        resonance_enabled = child_structure_match and not is_extended

        if is_complex:
            wait_reason = f'{parent_status}背景下当前仍属复杂/未完成结构，暂不操作'
            required_confirmation = '等待结构明确为标准 A/B/C/D 后再判断'
            structure_readiness = 'complex'
        elif is_extended and child_structure_match:
            wait_reason = f'{parent_status}允许{child_structure_label}类原型，但当前为延伸结构，先看当前执行段'
            required_confirmation = '等待当前执行段与关键边界确认'
            structure_readiness = 'extended'
        elif resonance_enabled:
            wait_reason = None
            required_confirmation = None
            structure_readiness = 'matched'
        else:
            expected = '、'.join(matched_structures) if matched_structures else '匹配结构'
            wait_reason = f'{parent_status}仅接受{expected}结构，当前{child_structure_label}原型暂不操作'
            required_confirmation = '等待匹配结构完成关键确认或重新识别'
            structure_readiness = 'unmatched'

        return {
            'parent_status': parent_status,
            'allowed_child_structures': matched_structures,
            'child_structure_family': structure_family,
            'standard_qualification': standard_qualification,
            'child_structure_match': child_structure_match,
            'resonance_enabled': resonance_enabled,
            'structure_readiness': structure_readiness,
            'wait_reason': wait_reason,
            'required_confirmation': required_confirmation,
            'explanation': advice.get('explanation'),
        }

    def _resolve_focus_structure_maturity(
        self,
        structure_type: str,
        prediction: Dict[str, Any],
        point_ids: List[str],
        has_live_tail: bool
    ) -> str:
        """Resolve interpretation maturity from confirmed points and live-tail state."""
        structure_family, _, standard_qualification = self._resolve_structure_profile(structure_type)
        confirmed_point_count = len([point_id for point_id in point_ids if point_id and point_id != 'live'])
        if has_live_tail:
            return 'developing'
        if standard_qualification == 'extended':
            return 'confirmed'
        if structure_type == 'D三段式' and confirmed_point_count >= 4:
            return 'confirmed'
        if structure_type in ('A五段式', 'C单平台式') and confirmed_point_count >= 6:
            return 'confirmed'
        if structure_type == 'B双平台式' and confirmed_point_count >= 10:
            return 'confirmed'
        if structure_family in ('complex', 'unfinished'):
            return 'candidate'
        return 'candidate'

    def _build_scenario_paths(
        self,
        structure_type: str,
        labeled_points: List[Dict[str, Any]],
        peak_analysis: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Build compact re-judgment scenarios for UI and AI consumers."""
        structure_family, _, standard_qualification = self._resolve_structure_profile(structure_type)
        confirmed_points = [point for point in labeled_points if point.get('point_id') != 'live']
        last_confirmed = confirmed_points[-1] if confirmed_points else None
        start_confirmed = confirmed_points[0] if confirmed_points else None
        upper_ref = last_confirmed.get('price') if last_confirmed else None
        lower_ref = min(
            (float(point.get('price')) for point in confirmed_points if point.get('price') is not None),
            default=None,
        )

        if structure_family in ('B', 'C'):
            upper_text = f'{upper_ref:.2f}' if isinstance(upper_ref, (int, float)) else '关键上沿'
            lower_text = f'{lower_ref:.2f}' if isinstance(lower_ref, (int, float)) else '关键下沿'
            return [
                {
                    'code': 'up_break',
                    'label': '上破上沿',
                    'trigger': f'有效突破 {upper_text}',
                    'effect': '平台向上突破，可能升级为推进结构',
                },
                {
                    'code': 'down_break',
                    'label': '下破下沿',
                    'trigger': f'有效跌破 {lower_text}',
                    'effect': '平台破坏，转入下行延续或更弱结构',
                },
            ]

        if structure_family == 'A':
            upper_text = f'{upper_ref:.2f}' if isinstance(upper_ref, (int, float)) else '关键高点'
            lower_text = (
                f'{start_confirmed.get("price"):.2f}'
                if start_confirmed and isinstance(start_confirmed.get('price'), (int, float))
                else '关键低点'
            )
            return [
                {
                    'code': 'trend_continue',
                    'label': '延续推进',
                    'trigger': f'重新站稳并突破 {upper_text}',
                    'effect': '趋势推进继续，保持 A 原型',
                },
                {
                    'code': 'trend_fail',
                    'label': '推进失效',
                    'trigger': f'跌破 {lower_text} 附近关键支撑',
                    'effect': '推进原型失效，可能降级为延伸平台或复杂结构',
                },
            ]

        if structure_family == 'D':
            upper_text = f'{upper_ref:.2f}' if isinstance(upper_ref, (int, float)) else '关键终点'
            return [
                {
                    'code': 'd_complete',
                    'label': '完成确认',
                    'trigger': f'确认新的 d4 / 终点并观察 {upper_text}',
                    'effect': '最小完整结构确认，等待后续结构承接',
                },
                {
                    'code': 'd_extend',
                    'label': '继续扩展',
                    'trigger': '终点未确认且继续扩展',
                    'effect': 'D 原型可能升级为更大平台或推进结构',
                },
            ]

        if standard_qualification == 'extended':
            return [
                {
                    'code': 'current_leg_confirm',
                    'label': '确认当前执行段',
                    'trigger': '等待当前执行段完成并守住关键边界',
                    'effect': f'{structure_type}继续按原型跟踪',
                },
                {
                    'code': 'focus_rejudge',
                    'label': '重新切片',
                    'trigger': '关键边界被破坏或出现新的主峰/主谷',
                    'effect': '当前延伸结构需要重新切分',
                },
            ]

        return [
            {
                'code': 'continue',
                'label': '继续观察',
                'trigger': '等待下一确认拐点',
                'effect': '继续按当前原型跟踪',
            },
            {
                'code': 'rejudge',
                'label': '改判',
                'trigger': '关键阈值被突破或跌破',
                'effect': '原型需要重新判断',
            },
        ]

    def _build_structure_interpretation(
        self,
        structure_type: str,
        trend_direction: str,
        explanation: Dict[str, Any],
        prediction: Dict[str, Any],
        moving_averages: Dict[str, Any],
        peak_analysis: Optional[Dict[str, Any]],
        labeled_points: List[Dict[str, Any]],
        valid_range: Optional[Dict[str, Any]],
        focus_trend_direction: Optional[str] = None,
        parent_spacetime_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build a stable interpretation layer above raw structure labels."""
        point_ids = [point.get('point_id') for point in labeled_points]
        has_live_tail = bool(point_ids and point_ids[-1] == 'live')
        live_point = labeled_points[-1] if has_live_tail and labeled_points else None
        last_confirmed = (
            labeled_points[-2]
            if has_live_tail and len(labeled_points) >= 2
            else labeled_points[-1]
            if labeled_points
            else None
        )

        macro_background = self._build_macro_background(moving_averages, trend_direction, labeled_points)
        structure_family, prefix, standard_qualification = self._resolve_structure_profile(structure_type)
        effective_trend_direction = focus_trend_direction or trend_direction
        maturity = self._resolve_focus_structure_maturity(
            structure_type,
            prediction if isinstance(prediction, dict) else {},
            point_ids,
            has_live_tail,
        )

        focus_mode = 'full_range'
        if isinstance(peak_analysis, dict) and peak_analysis.get('is_peak_structure'):
            focus_mode = 'peak_slice_right' if peak_analysis.get('peak_type') == 'mountain_peak' else 'valley_slice_right'

        archetype_label_map = {
            'A五段式': 'A五段式原型',
            '延伸A': '延伸A原型',
            '延伸A类': '延伸A类原型',
            'B双平台式': 'B双平台原型',
            '延伸B': '延伸B原型',
            '延伸B类': '延伸B类原型',
            'C单平台式': 'C平台原型',
            '延伸C': '延伸C原型',
            '延伸C类': '延伸C类原型',
            'D三段式': 'D三段式原型',
            '延伸D': '延伸D原型',
            '延伸D类': '延伸D类原型',
        }
        archetype_label = archetype_label_map.get(structure_type, structure_type or '结构原型')

        directional_bias = 'two_way'
        if structure_family in ('B', 'C'):
            directional_bias = 'range'
        elif effective_trend_direction == '上涨':
            directional_bias = 'up'
        elif effective_trend_direction == '下跌':
            directional_bias = 'down'

        current_direction = 'unknown'
        current_leg_label = '待确认'
        if has_live_tail and live_point and last_confirmed:
            current_direction = (
                'down'
                if float(live_point.get('price', 0.0)) < float(last_confirmed.get('price', 0.0))
                else 'up'
            )
            current_leg_label = f"{last_confirmed.get('point_id')}→live {'下行形成中' if current_direction == 'down' else '上行形成中'}"

        next_stage_text = str((prediction or {}).get('next_stage', '')).lower()
        target_point_id = None
        if prefix:
            match = re.search(rf'{re.escape(prefix)}(\d+)', next_stage_text)
            if match:
                target_point_id = f'{prefix}{match.group(1)}'
        else:
            match = re.search(r'p(\d+)', next_stage_text)
            if match:
                target_point_id = f'p{match.group(1)}'

        start_anchor_point_id = explanation.get('structure_start_point_id')
        start_anchor = next(
            (point for point in labeled_points if point.get('point_id') == start_anchor_point_id),
            None,
        )
        spacetime_gate = self._build_spacetime_gate(
            parent_status=parent_spacetime_status,
            structure_type=structure_type,
            trend_direction=effective_trend_direction,
        )
        explainability_status = explanation.get('explainability_status', 'passed')
        qualification_reason = explanation.get('qualification_reason') or explanation.get('downgrade_reason')

        return {
            'macro_background': macro_background,
            'focus_structure': {
                'focus_mode': focus_mode,
                'archetype_family': structure_family,
                'archetype_label': archetype_label,
                'standard_qualification': standard_qualification,
                'maturity': maturity,
                'directional_bias': directional_bias,
                'summary': (prediction or {}).get('prediction_alert') or structure_type,
                'start_anchor': {
                    'point_id': start_anchor_point_id,
                    'price': start_anchor.get('price') if start_anchor else None,
                    'date': start_anchor.get('date') if start_anchor else None,
                    'semantic': 'focus_origin',
                },
                'reference_origin': {
                    'point_id': None,
                    'price': valid_range.get('start_price'),
                    'date': valid_range.get('start_date'),
                    'semantic': 'macro_origin',
                } if valid_range else None,
                'start_anchor_source': explanation.get('focus_origin_source', 'none'),
                'explainability_status': explainability_status,
                'downgrade_reason': explanation.get('downgrade_reason'),
                'qualification_reason': qualification_reason,
                'display_reason': explanation.get('display_reason', ''),
            },
            'current_leg': {
                'last_confirmed_point_id': last_confirmed.get('point_id') if last_confirmed else None,
                'live_point_id': 'live' if has_live_tail else None,
                'from_point_id': last_confirmed.get('point_id') if last_confirmed else None,
                'to_point_id': 'live' if has_live_tail else None,
                'direction': current_direction,
                'status': 'forming' if has_live_tail else 'absent',
                'label': current_leg_label,
            },
            'next_confirmation': {
                'type': 'pivot',
                'label': f"等待 {(prediction or {}).get('next_stage')}",
                'trigger': (prediction or {}).get('prediction_alert') or '等待下一确认拐点',
                'target_point_id': target_point_id,
            } if (prediction or {}).get('next_stage') else None,
            'scenario_paths': self._build_scenario_paths(structure_type, labeled_points, peak_analysis),
            'spacetime_gate': spacetime_gate,
        }

    def _resolve_peak_structure_start_point_index(
        self,
        line_geometry: Dict[str, Any],
        peak_analysis: Optional[Dict[str, Any]]
    ) -> Optional[int]:
        """Map peak stroke index to the actual extreme endpoint point index."""
        if not isinstance(peak_analysis, dict) or not peak_analysis.get('is_peak_structure'):
            return None

        peak_index = peak_analysis.get('peak_index')
        if not isinstance(peak_index, int):
            return None

        segments = list((line_geometry or {}).get('segments', []))
        points = list((line_geometry or {}).get('points', []))
        if peak_index < 0 or peak_index >= len(segments):
            return None

        peak_segment = segments[peak_index]
        from_point = peak_segment.get('from_point')
        to_point = peak_segment.get('to_point')
        if not isinstance(from_point, int) or not isinstance(to_point, int):
            return None
        if from_point < 0 or to_point < 0:
            return None
        if points and (from_point >= len(points) or to_point >= len(points)):
            return None

        peak_price = peak_analysis.get('peak_price')
        from_price = peak_segment.get('from_price')
        to_price = peak_segment.get('to_price')
        if (
            isinstance(peak_price, (int, float))
            and isinstance(from_price, (int, float))
            and isinstance(to_price, (int, float))
        ):
            peak_val = float(peak_price)
            from_diff = abs(float(from_price) - peak_val)
            to_diff = abs(float(to_price) - peak_val)
            if from_diff < to_diff:
                return from_point
            if to_diff < from_diff:
                return to_point

        peak_type = peak_analysis.get('peak_type')
        if isinstance(from_price, (int, float)) and isinstance(to_price, (int, float)):
            if peak_type == 'mountain_peak':
                return from_point if float(from_price) >= float(to_price) else to_point
            if peak_type == 'valley_bottom':
                return from_point if float(from_price) <= float(to_price) else to_point

        return to_point

    def _build_window_extreme_focus_candidate(
        self,
        line_geometry: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Pick a visible dominant peak/valley when most of the actionable structure sits to its right."""
        points = list((line_geometry or {}).get('points', []))
        confirmed_points: List[Tuple[int, Dict[str, Any]]] = [
            (index, point)
            for index, point in enumerate(points)
            if not point.get('is_current') and point.get('type') != 'current'
        ]
        if len(confirmed_points) < 8:
            return None

        def build_candidate(kind: str, candidate_index: int) -> Optional[Dict[str, Any]]:
            if candidate_index <= 0 or candidate_index >= len(confirmed_points) - 2:
                return None

            original_index, point = confirmed_points[candidate_index]
            right_count = len(confirmed_points) - candidate_index - 1
            left_count = candidate_index
            if right_count < 6 or right_count <= left_count:
                return None

            return {
                'kind': kind,
                'point_index': original_index,
                'price': point.get('price'),
                'date': point.get('date'),
                'right_count': right_count,
                'left_count': left_count,
                'source_variant': 'window_extreme',
                'reason': (
                    '宏观原点在窗口外，检测到窗口主峰后右侧仍有独立节奏，优先从窗口主峰开始解释当前结构'
                    if kind == 'peak_extreme'
                    else '宏观原点在窗口外，检测到窗口主谷后右侧仍有独立节奏，优先从窗口主谷开始解释当前结构'
                ),
            }

        prices: List[float] = []
        for _, point in confirmed_points:
            price = point.get('price')
            if isinstance(price, (int, float)):
                prices.append(float(price))
            else:
                return None

        peak_candidate = build_candidate('peak_extreme', prices.index(max(prices)))
        valley_candidate = build_candidate('valley_extreme', prices.index(min(prices)))
        candidates = [candidate for candidate in (peak_candidate, valley_candidate) if candidate]
        if not candidates:
            return None

        return max(
            candidates,
            key=lambda candidate: (
                int(candidate['right_count']),
                -int(candidate['left_count']),
            ),
        )

    def _build_focus_origin_analysis(
        self,
        valid_range: Optional[Dict[str, Any]],
        line_geometry: Dict[str, Any],
        peak_analysis: Optional[Dict[str, Any]],
        macro_components: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        """Resolve the preferred explainable origin for the current focus structure."""
        points = list((line_geometry or {}).get('points', []))
        macro_origin = None
        candidates: List[Dict[str, Any]] = []

        def find_point_index(target_date: Optional[str], target_price: Optional[float]) -> Optional[int]:
            normalized_target_date = str(target_date or '').split(' ')[0]
            for idx, point in enumerate(points):
                point_date = str(point.get('date') or '').split(' ')[0]
                point_price = point.get('price')
                if normalized_target_date and point_date != normalized_target_date:
                    continue
                if (
                    isinstance(target_price, (int, float))
                    and isinstance(point_price, (int, float))
                    and abs(float(point_price) - float(target_price)) <= 0.01
                ):
                    return idx
            return None

        if isinstance(valid_range, dict):
            macro_point_index = find_point_index(
                valid_range.get('start_date'),
                valid_range.get('start_price'),
            )
            macro_origin = {
                'point_index': macro_point_index,
                'price': valid_range.get('start_price'),
                'date': valid_range.get('start_date'),
                'source': 'valid_range',
                'outside_window': macro_point_index is None,
            }
            candidates.append({
                'kind': 'macro_origin',
                'point_index': macro_point_index,
                'price': valid_range.get('start_price'),
                'date': valid_range.get('start_date'),
                'reason': '使用 valid_range 原点作为宏观起点',
                'outside_window': macro_point_index is None,
                'selected': False,
            })

        normalized_components: List[Dict[str, Any]] = []
        for component in macro_components or []:
            if hasattr(component, 'to_dict'):
                normalized_components.append(component.to_dict())
            elif isinstance(component, dict):
                normalized_components.append(component)
        prefer_window_extreme_candidate = False
        if len(normalized_components) >= 2:
            recent_component = normalized_components[-1]
            previous_component = normalized_components[-2]
            selected_component = recent_component
            component_reason = '检测到最近组件边界，优先从最近推进起点开始解释当前结构'
            if (
                recent_component.get('type') == 'Directional'
                and previous_component.get('type') == 'Platform'
            ):
                selected_component = previous_component
                component_reason = '检测到平台后接推进，优先从最近平台起点开始解释当前结构'
                prefer_window_extreme_candidate = True
            elif recent_component.get('type') == 'Platform':
                component_reason = '检测到最近平台，优先从最近平台起点开始解释当前结构'

            component_strokes = selected_component.get('strokes') or []
            component_start = component_strokes[0] if component_strokes else {}
            component_point_index = find_point_index(
                component_start.get('from_date'),
                component_start.get('from_price'),
            )
            if component_point_index is not None:
                component_point = points[component_point_index]
                candidates.append({
                    'kind': 'recent_component',
                    'point_index': component_point_index,
                    'price': component_point.get('price'),
                    'date': component_point.get('date'),
                    'reason': component_reason,
                    'selected': False,
                })

        peak_point_index = self._resolve_peak_structure_start_point_index(line_geometry, peak_analysis)
        peak_kind = None
        peak_reason = None
        if isinstance(peak_analysis, dict) and peak_analysis.get('is_peak_structure'):
            peak_type = peak_analysis.get('peak_type')
            if peak_type == 'mountain_peak':
                peak_kind = 'peak_extreme'
                peak_reason = '检测到主峰切片，优先从峰值极点开始解释右侧结构'
            elif peak_type == 'valley_bottom':
                peak_kind = 'valley_extreme'
                peak_reason = '检测到主谷切片，优先从谷值极点开始解释右侧结构'

        if peak_kind:
            peak_point = (
                points[peak_point_index]
                if isinstance(peak_point_index, int) and 0 <= peak_point_index < len(points)
                else {}
            )
            candidates.append({
                'kind': peak_kind,
                'point_index': peak_point_index,
                'price': peak_point.get('price', peak_analysis.get('peak_price')),
                'date': peak_point.get('date'),
                'source_variant': 'peak_analysis',
                'reason': peak_reason,
                'selected': False,
            })

        if (
            not peak_kind
            and macro_origin
            and macro_origin.get('outside_window')
            and prefer_window_extreme_candidate
        ):
            visible_extreme_candidate = self._build_window_extreme_focus_candidate(line_geometry)
            if visible_extreme_candidate:
                candidates.append({
                    'kind': visible_extreme_candidate['kind'],
                    'point_index': visible_extreme_candidate['point_index'],
                    'price': visible_extreme_candidate['price'],
                    'date': visible_extreme_candidate['date'],
                    'source_variant': visible_extreme_candidate.get('source_variant'),
                    'reason': visible_extreme_candidate['reason'],
                    'selected': False,
                })

        selected_origin_kind = 'none'
        selected_point_index = None
        selected_origin_variant = None
        explainability_status = 'failed'
        explainability_reason = '未找到可用的聚焦起点，回退到默认起点'

        for candidate in candidates:
            if candidate['kind'] in ('peak_extreme', 'valley_extreme') and candidate.get('point_index') is not None:
                selected_origin_kind = candidate['kind']
                selected_point_index = candidate['point_index']
                selected_origin_variant = candidate.get('source_variant')
                explainability_status = 'passed'
                explainability_reason = candidate['reason']
                candidate['selected'] = True
                break

        if selected_origin_kind == 'none':
            for candidate in candidates:
                if candidate['kind'] == 'recent_component' and candidate.get('point_index') is not None:
                    selected_origin_kind = 'recent_component'
                    selected_point_index = candidate['point_index']
                    selected_origin_variant = candidate.get('source_variant')
                    explainability_status = 'passed'
                    explainability_reason = candidate['reason']
                    candidate['selected'] = True
                    break

        if selected_origin_kind == 'none':
            for candidate in candidates:
                if candidate['kind'] == 'macro_origin':
                    selected_origin_kind = 'macro_origin'
                    selected_point_index = candidate['point_index']
                    selected_origin_variant = candidate.get('source_variant')
                    explainability_status = 'passed'
                    explainability_reason = (
                        candidate['reason']
                        if candidate.get('point_index') is not None
                        else f"{candidate['reason']}；当前窗口未包含该原点"
                    )
                    candidate['selected'] = True
                    break

        return {
            'macro_origin': macro_origin,
            'candidates': candidates,
            'selected_origin_kind': selected_origin_kind,
            'selected_point_index': selected_point_index,
            'selected_origin_variant': selected_origin_variant,
            'explainability_status': explainability_status,
            'explainability_reason': explainability_reason,
        }

    def _validate_focus_structure_explainability(
        self,
        structure_type: str,
        inflection_count: int,
        focus_origin_analysis: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Decide whether the public structure label is still explainable."""
        analysis = focus_origin_analysis if isinstance(focus_origin_analysis, dict) else {}
        macro_origin = analysis.get('macro_origin') or {}
        if (
            analysis.get('selected_origin_kind') == 'macro_origin'
            and analysis.get('selected_point_index') is None
            and macro_origin.get('outside_window')
        ):
            return {
                'passed': False,
                'status': 'downgraded',
                'reason': (
                    analysis.get('explainability_reason')
                    or '真实宏观原点位于当前窗口外，不能将窗口首点包装成标准起点'
                ),
            }
        if analysis.get('selected_origin_kind') == 'none':
            return {
                'passed': False,
                'status': 'downgraded',
                'reason': analysis.get('explainability_reason') or '未找到可解释的当前结构起点',
            }
        return {
            'passed': True,
            'status': analysis.get('explainability_status', 'passed'),
            'reason': analysis.get('explainability_reason', ''),
        }

    def _build_structure_focus_context(
        self,
        line_geometry: Dict[str, Any],
        focus_origin_analysis: Optional[Dict[str, Any]],
        peak_analysis: Optional[Dict[str, Any]],
        confirmed_strokes: List[Dict[str, Any]],
        stroke_list: List[Dict[str, Any]],
        valid_fractals: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """统一导出当前聚焦结构上下文，峰值切片时聚焦到右侧结构。"""
        render_structure_start_point_index = None
        if isinstance(focus_origin_analysis, dict):
            selected_point_index = focus_origin_analysis.get('selected_point_index')
            if isinstance(selected_point_index, int):
                render_structure_start_point_index = selected_point_index
        if render_structure_start_point_index is None:
            render_structure_start_point_index = self._resolve_peak_structure_start_point_index(
                line_geometry,
                peak_analysis
            )
        render_strokes = list(stroke_list or [])
        full_confirmed_strokes = list(confirmed_strokes or [])
        focused_valid_fractals = list(valid_fractals or [])
        has_current_stroke = bool(
            render_strokes and (
                render_strokes[-1].get('is_current')
                or render_strokes[-1].get('to_type') == 'current'
            )
        )
        render_confirmed_count = len(render_strokes) - (1 if has_current_stroke else 0)
        render_confirmed_offset = max(0, len(full_confirmed_strokes) - render_confirmed_count)

        render_start_index = 0
        if isinstance(render_structure_start_point_index, int) and render_structure_start_point_index > 0:
            render_start_index = min(render_structure_start_point_index, render_confirmed_count)

        confirmed_start_index = render_confirmed_offset + render_start_index
        focused_strokes = (
            render_strokes[render_start_index:render_confirmed_count]
            if render_start_index < render_confirmed_count
            else []
        )
        if confirmed_start_index > 0:
            focused_valid_fractals = (
                focused_valid_fractals[confirmed_start_index:]
                if confirmed_start_index < len(focused_valid_fractals)
                else []
            )

        return {
            'render_structure_start_point_index': render_structure_start_point_index,
            'confirmed_structure_start_point_index': confirmed_start_index,
            'strokes': focused_strokes,
            'valid_fractals': focused_valid_fractals,
            'stroke_count': len(focused_strokes),
            'inflection_count': len(focused_valid_fractals),
        }

    def _build_structure_pipeline_metadata(
        self,
        lookback: int,
        actual_lookback: int,
        recent: pd.DataFrame,
        processed_df: pd.DataFrame,
        top_fractals: List[Dict[str, Any]],
        bottom_fractals: List[Dict[str, Any]],
        validated_fractals: List[Dict[str, Any]],
        final_fractals: List[Dict[str, Any]],
        strokes: List[Dict[str, Any]],
        stroke_list: List[Dict[str, Any]],
        valid_range_info: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """暴露结构识别流水线的中间统计，便于后续画线优化和调试。"""
        return {
            'lookback_requested': lookback,
            'lookback_used': actual_lookback,
            'analysis_kline_count': len(recent),
            'processed_kline_count': len(processed_df),
            'valid_range_applied': valid_range_info is not None,
            'render_window_size': self.STRUCTURE_STROKE_WINDOW,
            'raw_fractal_count': {
                'top': len(top_fractals),
                'bottom': len(bottom_fractals),
                'total': len(top_fractals) + len(bottom_fractals)
            },
            'validated_fractal_count': len(validated_fractals),
            'final_fractal_count': len(final_fractals),
            'confirmed_stroke_count': len(strokes),
            'render_stroke_count': len(stroke_list),
            'has_current_stroke': bool(stroke_list and stroke_list[-1].get('is_current'))
        }

    def _run_structure_pipeline(self, df: pd.DataFrame, lookback: int) -> Optional[Dict[str, Any]]:
        """执行结构识别前半段流水线，集中产出后续分类与画线所需中间结果。"""
        actual_lookback = min(lookback, len(df))
        if actual_lookback < self.STRUCTURE_MIN_KLINES:
            return None

        recent = df.tail(actual_lookback).copy().reset_index(drop=True)
        trend_direction = self._determine_structure_trend(recent)

        valid_range = self._find_valid_range(recent)
        if valid_range:
            recent = recent.iloc[valid_range['start_idx']:valid_range['end_idx'] + 1].copy().reset_index(drop=True)
        valid_range_info = self._serialize_valid_range(valid_range)

        processed_df = self._process_containment(recent)
        top_fractals, bottom_fractals = self._detect_fractals(processed_df)
        validated_fractals = self._merge_and_validate_fractals(top_fractals, bottom_fractals)
        final_fractals = self._build_strokes_iterative(validated_fractals)
        strokes, valid_fractals = self._build_confirmed_strokes(final_fractals)
        stroke_list, render_fractals = self._build_render_strokes(strokes)
        self._append_current_render_stroke(stroke_list, render_fractals, processed_df)

        return {
            'actual_lookback': actual_lookback,
            'recent': recent,
            'trend_direction': trend_direction,
            'valid_range_info': valid_range_info,
            'processed_df': processed_df,
            'top_fractals': top_fractals,
            'bottom_fractals': bottom_fractals,
            'validated_fractals': validated_fractals,
            'final_fractals': final_fractals,
            'strokes': strokes,
            'valid_fractals': valid_fractals,
            'stroke_list': stroke_list
        }

    def _apply_peak_structure_override(
        self,
        result: Dict[str, Any],
        peak_analysis: Dict[str, Any],
        judgment_criteria: List[str]
    ) -> None:
        """峰值切片后，将战术焦点收敛到右侧结构。"""
        result['structure_details']['peak_analysis'] = peak_analysis

        right_structure_type = peak_analysis['right_structure']
        result['structure_type'] = right_structure_type
        result['structure_stage'] = f"峰值{peak_analysis['peak_price']:.2f}后{right_structure_type}"

        if peak_analysis['peak_type'] == 'mountain_peak':
            left_structure_warning = {
                'type': 'mountain_peak_left',
                'title': '⚠️ 左侧风险警示',
                'left_structure': peak_analysis['left_structure'],
                'peak_price': peak_analysis['peak_price'],
                'warning': '这是"下跌中继平台"，不是底！',
                'risk_description': (
                    f'左侧曾有{peak_analysis["left_structure"]}上涨至{peak_analysis["peak_price"]:.2f}，'
                    f'一旦右侧{right_structure_type}破位，下方将出现巨大真空区，杀跌速度会极其迅猛。'
                ),
                'key_defense': '绝对防守底线：右侧平台下轨',
                'action_hint': '破位无条件清仓，绝不扛单'
            }
        else:
            left_structure_warning = {
                'type': 'valley_bottom_left',
                'title': '💡 左侧机会提示',
                'left_structure': peak_analysis['left_structure'],
                'valley_price': peak_analysis['peak_price'],
                'opportunity': '这是"上涨中继平台"，有继续上涨潜力！',
                'opportunity_description': (
                    f'左侧经历{peak_analysis["left_structure"]}下跌至{peak_analysis["peak_price"]:.2f}后反弹，'
                    f'右侧{right_structure_type}若突破上方压力，上方空间可能打开。'
                ),
                'key_resistance': '关键阻力位：右侧平台上轨',
                'action_hint': '突破可加仓，失败则减仓观望'
            }

        result['structure_details']['left_structure_warning'] = left_structure_warning

        peak_type_name = '山峰' if peak_analysis['peak_type'] == 'mountain_peak' else '山谷'
        left_comp_summary = [f"{mc['type']}({len(mc['strokes'])}笔)" for mc in peak_analysis['left_components']]
        right_comp_summary = [f"{mc['type']}({len(mc['strokes'])}笔)" for mc in peak_analysis['right_components']]

        judgment_criteria.append("")
        judgment_criteria.append("📊 峰值切片分析：")
        judgment_criteria.append(f"极值点: {peak_analysis['peak_price']:.2f} ({peak_type_name})")
        judgment_criteria.append(
            f"左侧结构: {peak_analysis['left_structure']} ({' → '.join(left_comp_summary) if left_comp_summary else '未完成'})"
        )
        judgment_criteria.append(
            f"右侧结构: {peak_analysis['right_structure']} ({' → '.join(right_comp_summary) if right_comp_summary else '未完成'})"
        )

        judgment_criteria.append("")
        judgment_criteria.append(f"⚔️ 战术层面：聚焦右侧{right_structure_type}，按该结构执行操作")
        if peak_analysis['peak_type'] == 'mountain_peak':
            judgment_criteria.append("🚨 战略警示：左侧上涨已过，当前是下跌中继平台")
            judgment_criteria.append("💡 操作要点：破位即清仓，绝不扛单")
        else:
            judgment_criteria.append("🌟 战略提示：左侧下跌已结束，当前是上涨中继平台")
            judgment_criteria.append("💡 操作要点：突破可加仓，失败则减仓")

    def _apply_structure_fallback(
        self,
        result: Dict[str, Any],
        stroke_count: int,
        inflection_count: int,
        macro_components: List['TrinityStockAnalyzer.MacroComponent'],
        judgment_criteria: List[str]
    ) -> None:
        """当聚类分类失效时，用原始笔数兜底。"""
        if result['structure_type'] != 'unknown' and macro_components:
            return

        structure_type, structure_stage, description, criteria = self._classify_structure_by_counts(
            stroke_count,
            inflection_count,
        )
        result['structure_type'] = structure_type
        result['structure_stage'] = structure_stage
        result['description'] = description
        judgment_criteria.extend(criteria)
    
    def detect_structure(self, df: pd.DataFrame, lookback: int = 200, macd_status: str = None) -> Dict:
        """
        识别结构类型（A五段式/B双平台式/C单平台式/D三段式）- 优化版
        
        新算法核心思想：
        1. 先确定"有效区间"（通过 MACD 状态切换和 MA55 破位）
        2. 在有效区间内统计笔数和拐点
        3. 按决策树分类结构类型
        
        有效区间确定：
        - 左边界（起点/原点）：MACD 状态切换处的绝对最高/最低价
        - 右边界（终点/破位点）：价格有效跌破/突破 MA55 且反抽不破
        
        结构类型分类：
        - D类（3笔4拐点）：N字型，d3 不能低于 d1
        - A类（5笔6拐点）：单边趋势，高低点依次推进，MACD 远离零轴
        - C类（5笔6拐点）：单平台震荡，高低点重叠，MACD 在零轴附近缠绕
        - B类（9笔10拐点）：双平台，两个平台价格区间不能重叠
        
        参数：
        - df: K线数据（需包含 MACD 和 MA55）
        - lookback: 回溯K线数
        - macd_status: 当前MACD状态
        
        返回：
        - structure_type: 结构类型
        - structure_stage: 结构阶段
        - trend_direction: 趋势方向
        - inflection_points: 拐点数量
        - segment_count: 笔的数量
        - description: 描述
        - structure_details: 结构详细信息
        """
        result = self._create_structure_result()

        pipeline = self._run_structure_pipeline(df, lookback)
        if pipeline is None:
            actual_lookback = min(lookback, len(df))
            result['description'] = '数据不足以判断结构'
            result['structure_details']['judgment_criteria'] = (
                f'数据不足，需要至少{self.STRUCTURE_MIN_KLINES}根K线'
            )
            result['structure_details']['pipeline'] = {
                'lookback_requested': lookback,
                'lookback_used': actual_lookback,
                'valid_range_applied': False
            }
            return result

        actual_lookback = pipeline['actual_lookback']
        recent = pipeline['recent']
        result['trend_direction'] = pipeline['trend_direction']

        valid_range_info = pipeline['valid_range_info']
        result['structure_details']['valid_range'] = valid_range_info

        processed_df = pipeline['processed_df']
        top_fractals = pipeline['top_fractals']
        bottom_fractals = pipeline['bottom_fractals']
        result['structure_details']['top_fractals'] = self._serialize_fractals(top_fractals, 'high')
        result['structure_details']['bottom_fractals'] = self._serialize_fractals(bottom_fractals, 'low')

        validated_fractals = pipeline['validated_fractals']
        final_fractals = pipeline['final_fractals']
        strokes = pipeline['strokes']
        valid_fractals = pipeline['valid_fractals']
        stroke_list = pipeline['stroke_list']

        result['structure_details']['strokes'] = stroke_list
        line_geometry = self._build_line_geometry(stroke_list)
        result['structure_details']['line_geometry'] = line_geometry

        full_stroke_count = len(strokes)
        full_inflection_count = len(valid_fractals)
        result['segment_count'] = full_stroke_count
        result['inflection_points'] = full_inflection_count
        result['structure_details']['pipeline'] = self._build_structure_pipeline_metadata(
            lookback=lookback,
            actual_lookback=actual_lookback,
            recent=recent,
            processed_df=processed_df,
            top_fractals=top_fractals,
            bottom_fractals=bottom_fractals,
            validated_fractals=validated_fractals,
            final_fractals=final_fractals,
            strokes=strokes,
            stroke_list=stroke_list,
            valid_range_info=valid_range_info
        )

        judgment_criteria = [
            f"识别到 {len(top_fractals)} 个顶分型，{len(bottom_fractals)} 个底分型",
            f"过滤后得到 {full_stroke_count} 笔，{full_inflection_count} 个拐点"
        ]

        if valid_range_info:
            judgment_criteria.append(f"有效区间: {valid_range_info['start_date']} ~ {valid_range_info['end_date']}")
            judgment_criteria.append(f"原点类型: {'高点' if valid_range_info['origin_type'] == 'high' else '低点'}")

        macro_components = self._consolidate_boxes(stroke_list, threshold=0.55)
        result['structure_details']['macro_components'] = [mc.to_dict() for mc in macro_components]
        judgment_criteria.append(f"聚类算法: 将 {full_stroke_count} 笔聚类为 {len(macro_components)} 个宏观组件")

        if macro_components:
            raw_structure_type, raw_structure_stage, raw_description, extra_criteria = (
                self._classify_structure_by_macro_components(macro_components, result['trend_direction'])
            )
            judgment_criteria.extend(extra_criteria)
        else:
            judgment_criteria.append("⚠️ 聚类算法失败，使用原始笔数判断")
            raw_structure_type, raw_structure_stage, raw_description, extra_criteria = (
                self._classify_structure_by_counts(full_stroke_count, full_inflection_count)
            )
            judgment_criteria.extend(extra_criteria)

        result['structure_type'] = raw_structure_type
        result['structure_stage'] = raw_structure_stage
        result['description'] = raw_description
        result['structure_details']['raw_classification'] = {
            'type': raw_structure_type,
            'stage': raw_structure_stage,
            'description': raw_description,
            'component_summary': self._summarize_macro_components(
                result['structure_details']['macro_components']
            ),
        }

        peak_analysis = self._analyze_peak_structure(stroke_list, macro_components)
        focus_origin_analysis = self._build_focus_origin_analysis(
            valid_range=valid_range_info,
            line_geometry=line_geometry,
            peak_analysis=peak_analysis,
            macro_components=macro_components,
        )
        result['structure_details']['raw_classification']['macro_origin'] = (
            focus_origin_analysis.get('macro_origin')
        )
        result['structure_details']['focus_origin_analysis'] = focus_origin_analysis
        if peak_analysis['is_peak_structure']:
            self._apply_peak_structure_override(result, peak_analysis, judgment_criteria)

        focus_context = self._build_structure_focus_context(
            line_geometry=line_geometry,
            focus_origin_analysis=focus_origin_analysis,
            peak_analysis=peak_analysis,
            confirmed_strokes=strokes,
            stroke_list=stroke_list,
            valid_fractals=valid_fractals
        )
        stroke_count = focus_context['stroke_count']
        inflection_count = focus_context['inflection_count']
        focused_strokes = focus_context['strokes']
        focused_valid_fractals = focus_context['valid_fractals']
        structure_start_point_index = focus_context['render_structure_start_point_index']
        result['segment_count'] = stroke_count
        result['inflection_points'] = inflection_count
        focus_trend_direction = self._determine_stroke_trend(focused_strokes)
        preferred_focus_structure_type = None
        preferred_focus_structure_stage = None
        if isinstance(peak_analysis, dict) and peak_analysis.get('is_peak_structure'):
            preferred_focus_structure_type = peak_analysis.get('right_structure')
            peak_price = peak_analysis.get('peak_price')
            if preferred_focus_structure_type and isinstance(peak_price, (int, float)):
                preferred_focus_structure_stage = (
                    f'峰值{float(peak_price):.2f}后{preferred_focus_structure_type}'
                )
        focus_classification = self._build_focus_structure_classification(
            focused_strokes=focused_strokes,
            inflection_count=inflection_count,
            trend_direction=focus_trend_direction,
            preferred_structure_type=preferred_focus_structure_type,
            preferred_structure_stage=preferred_focus_structure_stage,
        )
        result['structure_details']['focus_classification'] = {
            'type': focus_classification['type'],
            'stage': focus_classification['stage'],
            'description': focus_classification['description'],
            'archetype_family': focus_classification['archetype_family'],
            'standard_qualification': focus_classification['standard_qualification'],
            'qualification_reason': focus_classification['qualification_reason'],
            'trend_direction': focus_classification['trend_direction'],
            'component_summary': focus_classification['component_summary'],
        }
        result['structure_type'] = focus_classification['type']
        result['structure_stage'] = focus_classification['stage']
        result['description'] = focus_classification['description']
        judgment_criteria.extend(focus_classification['criteria'])

        explainability_verdict = self._validate_focus_structure_explainability(
            result['structure_type'],
            inflection_count,
            focus_origin_analysis,
        )
        if (
            focus_origin_analysis.get('selected_origin_kind') in ('peak_extreme', 'valley_extreme')
            and focus_origin_analysis.get('selected_origin_variant') == 'window_extreme'
        ):
            focus_origin_label = '峰值极点' if focus_origin_analysis.get('selected_origin_kind') == 'peak_extreme' else '谷值极点'
            if focus_classification['standard_qualification'] == 'extended':
                explainability_verdict = {
                    'passed': False,
                    'status': 'downgraded',
                    'reason': (
                        f'从{focus_origin_label}重新聚焦后，右侧仍超出标准点数，'
                        '不能继续包装为延伸结构'
                    ),
                }
            elif focus_classification['archetype_family'] in ('complex', 'unfinished'):
                explainability_verdict = {
                    'passed': False,
                    'status': 'downgraded',
                    'reason': (
                        f'从{focus_origin_label}重新聚焦后，右侧仍无法稳定解释为标准结构，'
                        '已降级为等待确认'
                    ),
                }
        explainability_status = explainability_verdict['status']
        explainability_reason = explainability_verdict['reason']
        if focus_classification['standard_qualification'] == 'extended' and explainability_verdict['passed']:
            explainability_status = 'extended'
            explainability_reason = (
                focus_classification['qualification_reason'] or explainability_reason
            )
        result['structure_details']['focus_origin_analysis']['explainability_status'] = (
            explainability_status
        )
        result['structure_details']['focus_origin_analysis']['explainability_reason'] = (
            explainability_reason
        )
        if not explainability_verdict['passed']:
            result['structure_type'] = '复杂结构'
            result['structure_stage'] = '等待确认'
            result['description'] = '当前聚焦区间无法诚实解释为标准结构，已降级'
            result['structure_details']['focus_classification'].update({
                'type': result['structure_type'],
                'stage': result['structure_stage'],
                'description': result['description'],
                'archetype_family': 'complex',
                'standard_qualification': 'failed',
                'qualification_reason': explainability_verdict['reason'],
                'trend_direction': focus_trend_direction,
            })
            judgment_criteria.append(f"⚠️ 解释性降级: {explainability_verdict['reason']}")

        if result['description'] not in (
            '当前聚焦区间无法诚实解释为标准结构，已降级',
            focus_classification['description'],
        ):
            result['description'] = f"识别为{result['structure_type']}，{result['trend_direction']}趋势"
        result['structure_details']['judgment_criteria'] = '\n'.join(judgment_criteria)
        prediction = self._analyze_structure_prediction(
            result['structure_type'],
            stroke_count,
            inflection_count,
            focused_strokes,
            focused_valid_fractals,
            focus_trend_direction,
            recent,
            macd_status
        )
        result['structure_details']['prediction'] = prediction
        result['structure_details']['boundary_levels'] = self._extract_trinity_boundaries(
            {'structure_details': {'prediction': prediction}}
        )

        peak_analysis = result['structure_details'].get('peak_analysis')

        labeled_geometry, explainability = self._build_structure_explainability(
            result['structure_type'],
            line_geometry,
            prediction,
            peak_analysis,
            structure_start_point_index=structure_start_point_index,
            focus_origin_source=result['structure_details']['focus_origin_analysis'].get('selected_origin_kind'),
            explainability_status=result['structure_details']['focus_origin_analysis'].get('explainability_status'),
            downgrade_reason=result['structure_details']['focus_origin_analysis'].get('explainability_reason'),
        )
        result['structure_details']['line_geometry'] = labeled_geometry
        result['structure_details']['explainability'] = explainability
        result['structure_details']['render_payload'] = self._build_render_payload(labeled_geometry)
        result['interpretation'] = self._build_structure_interpretation(
            structure_type=result['structure_type'],
            trend_direction=result['trend_direction'],
            explanation=explainability,
            prediction=prediction,
            moving_averages=self.analyze_ma_position(recent.iloc[-1]) if len(recent) else {},
            peak_analysis=peak_analysis,
            labeled_points=labeled_geometry.get('points', []),
            valid_range=valid_range_info,
            focus_trend_direction=focus_trend_direction,
        )

        return result
    
    def _analyze_structure_prediction(
        self, 
        structure_type: str, 
        stroke_count: int, 
        inflection_count: int,
        strokes: List[Dict],
        valid_fractals: List[Dict],
        trend_direction: str,
        recent: pd.DataFrame,
        macd_status: str = None
    ) -> Dict:
        """
        分析结构拓扑的预测性
        
        参数：
        - structure_type: 结构类型
        - stroke_count: 笔数
        - inflection_count: 拐点数
        - strokes: 笔列表
        - valid_fractals: 有效分型列表
        - trend_direction: 趋势方向
        - recent: 最近的K线数据
        - macd_status: MACD状态（用于判断d3不稳定点）
        
        返回：
        - current_stage: 当前所处阶段（第几个拐点）
        - next_stage: 下一阶段预期
        - prediction_alert: 预测性提醒（核心信息）
        - key_price_levels: 关键预测价位
        - confidence: 预测置信度
        - unstable_point: 是否处于不稳定点（d3）
        """
        prediction = {
            'current_stage': '',
            'next_stage': '',
            'prediction_alert': '',
            'key_price_levels': [],
            'confidence': 'medium',
            'action_hint': '',
            'unstable_point': None,  # 是否处于不稳定点
            'structure_perfect': None  # 结构必完美定理判断
        }
        
        # 获取当前价格
        current_price = recent.iloc[-1]['close'] if len(recent) > 0 else 0
        current_high = recent.iloc[-1]['high'] if len(recent) > 0 else 0
        current_low = recent.iloc[-1]['low'] if len(recent) > 0 else 0
        
        # 判断当前是否处于"进行中的笔"
        is_in_current_stroke = False
        last_fractal = valid_fractals[-1] if valid_fractals else None
        if last_fractal and strokes:
            last_stroke = strokes[-1]
            if last_stroke.get('is_current') or last_stroke.get('to_type') == 'current':
                is_in_current_stroke = True

        structure_family, _, standard_qualification = self._resolve_structure_profile(structure_type)
        if standard_qualification == 'extended':
            direction_text = '上行' if trend_direction == '上涨' else '下行' if trend_direction == '下跌' else '双向'
            prediction['current_stage'] = f'{structure_type}进行中'
            if structure_family in ('B', 'C'):
                prediction['next_stage'] = '等待平台边界确认'
                prediction['prediction_alert'] = f'📍 {structure_type}仍在展开，优先观察平台边界与当前执行段。'
                prediction['action_hint'] = '先看当前执行段是否完成，再判断边界突破或跌破'
                prediction['key_price_levels'] = [
                    {'price': float(current_high), 'type': '上沿参考', 'note': '延伸平台上沿'},
                    {'price': float(current_low), 'type': '下沿参考', 'note': '延伸平台下沿'},
                ]
            elif structure_family == 'A':
                prediction['next_stage'] = '等待推进段确认'
                prediction['prediction_alert'] = f'📍 {structure_type}{direction_text}推进中，暂不使用标准 a1-a6 编号。'
                prediction['action_hint'] = '跟踪当前推进段是否延续，失守关键起涨/起跌点则重判'
            elif structure_family == 'D':
                prediction['next_stage'] = '等待修正段完成'
                prediction['prediction_alert'] = f'📍 {structure_type}{direction_text}修正中，先等当前执行段完成。'
                prediction['action_hint'] = '等当前修正段完成后再看是否形成新的终点确认'
            else:
                prediction['next_stage'] = '等待结构再次明朗'
                prediction['prediction_alert'] = f'📍 {structure_type}仍在展开，先跟踪当前执行段。'
                prediction['action_hint'] = '等待新的确认拐点'
            prediction['confidence'] = 'medium'
            return prediction
        
        # 根据结构类型生成预测
        if structure_type == 'D三段式':
            # D三段式：3笔4拐点
            # d1(起点) -> d2 -> d3 -> d4(终点)
            # 
            # 核心概念（来自文档）：
            # - d3是反向修正的终点（不稳定点）
            #   - 在"强"状态下跌中，d3是卖出不稳定点
            #   - 在"弱"状态上涨中，d3是买入不稳定点
            # - d4是第二段攻击/杀跌的终点
            #   - 在下跌结构中，d4是空头衰竭买入机会
            #   - 在上涨结构中，d4是多头衰竭卖出机会
            
            if inflection_count >= 4:
                # 已经到达d4拐点，结构完成
                prediction['current_stage'] = 'd4拐点'
                prediction['next_stage'] = '结构完成，等待方向选择'
                prediction['prediction_alert'] = '⚠️ D三段式已完成！结构完美，即将选择方向。'

                # d4判断：空头衰竭买入机会 or 多头衰竭卖出机会
                if len(strokes) >= 3:
                    last_stroke = strokes[-1]
                    if last_stroke.get('direction') == '下跌':
                        prediction['action_hint'] = 'd4是空头衰竭买入机会，可关注建仓信号'
                    else:
                        prediction['action_hint'] = 'd4是多头衰竭卖出机会，可关注减仓信号'

                prediction['confidence'] = 'high'

            elif inflection_count >= 3:
                # 当前在d3拐点，即将形成d4
                prediction['current_stage'] = 'd3拐点'
                prediction['next_stage'] = 'd4拐点（结构完成）'
                
                # ============ 新增：d3不稳定点判断 ============
                # 根据MACD状态判断d3的操作性质
                unstable_type = None
                if macd_status == '强' and trend_direction == '下跌':
                    # 在"强"状态下跌中，d3是卖出不稳定点
                    unstable_type = '卖出不稳定点'
                    prediction['unstable_point'] = {
                        'is_unstable': True,
                        'type': unstable_type,
                        'description': '在"强"状态下跌中，d3是卖出不稳定点，后续可能继续下跌'
                    }
                    prediction['prediction_alert'] = f'⚠️ D三段式d3拐点（{unstable_type}）！强状态下的下跌修正，后续可能继续下跌。'
                    prediction['action_hint'] = 'd3是不稳定卖出点，如持有可考虑减仓'
                    
                elif macd_status == '弱' and trend_direction == '上涨':
                    # 在"弱"状态上涨中，d3是买入不稳定点
                    unstable_type = '买入不稳定点'
                    prediction['unstable_point'] = {
                        'is_unstable': True,
                        'type': unstable_type,
                        'description': '在"弱"状态上涨中，d3是买入不稳定点，后续可能继续上涨'
                    }
                    prediction['prediction_alert'] = f'⚠️ D三段式d3拐点（{unstable_type}）！弱状态下的上涨修正，后续可能继续上涨。'
                    prediction['action_hint'] = 'd3是不稳定买入点，可考虑轻仓尝试'
                    
                else:
                    # 其他情况，d3是正常的反向修正终点
                    prediction['unstable_point'] = {
                        'is_unstable': False,
                        'type': '正常修正点',
                        'description': f'd3是反向修正终点，MACD状态为{macd_status or "未知"}'
                    }
                    prediction['prediction_alert'] = f'📍 D三段式在d3拐点，反向修正即将完成，等待d4形成。'
                    prediction['action_hint'] = '等待d4形成，关注结构完成后的方向选择'
                
                # 计算d4目标价位
                if len(strokes) >= 2:
                    first_stroke = strokes[0]
                    if first_stroke['direction'] == '上涨':
                        # 上涨结构，d4是多头衰竭卖出机会
                        target_price = first_stroke['from_price']
                        prediction['key_price_levels'] = [
                            {'price': target_price, 'type': 'd4目标', 'note': '多头衰竭卖出机会'}
                        ]
                    else:
                        # 下跌结构，d4是空头衰竭买入机会
                        target_price = first_stroke['from_price']
                        prediction['key_price_levels'] = [
                            {'price': target_price, 'type': 'd4目标', 'note': '空头衰竭买入机会'}
                        ]
                
                prediction['confidence'] = 'high'
                
            elif inflection_count == 2:
                prediction['current_stage'] = 'd2拐点'
                prediction['next_stage'] = 'd3拐点'
                prediction['prediction_alert'] = '📍 D三段式进行中，等待d3拐点形成。d3通常是最佳入场点。'
                
                if last_fractal:
                    if last_fractal['type'] == 'top':
                        # 从顶到底，等待底分型形成
                        prediction['action_hint'] = '等待底分型确认，d3拐点是潜在买点'
                    else:
                        # 从底到顶，等待顶分型形成
                        prediction['action_hint'] = '等待顶分型确认，d3拐点是潜在卖点'
                
                prediction['confidence'] = 'medium'
                
            else:
                prediction['current_stage'] = 'd1拐点（起点）'
                prediction['next_stage'] = 'd2拐点'
                prediction['prediction_alert'] = '🔄 D三段式刚开始，等待d2拐点形成。'
                prediction['confidence'] = 'low'
                
        elif structure_type == 'A五段式':
            # A五段式：5笔6拐点
            # a1 -> a2 -> a3(主升/跌浪起点) -> a4 -> a5 -> a6
            # 第三浪是主升/跌浪
            
            if inflection_count >= 5:
                prediction['current_stage'] = f'a{inflection_count}拐点'
                prediction['next_stage'] = 'a6拐点（结构完成）'
                prediction['prediction_alert'] = f'⚠️ A五段式即将完成！当前在a{inflection_count}拐点，结构完成后将有大行情。'
                prediction['action_hint'] = '结构即将完成，准备迎接大级别行情'
                prediction['confidence'] = 'high'
                
            elif inflection_count == 4:
                prediction['current_stage'] = 'a4拐点'
                prediction['next_stage'] = 'a5拐点（第五浪）'
                prediction['prediction_alert'] = '📍 A五段式在a4拐点，第五浪即将开始。第五浪通常是最后一波。'
                prediction['action_hint'] = '第五浪即将开始，可考虑轻仓参与'
                prediction['confidence'] = 'medium'
                
            elif inflection_count == 3:
                prediction['current_stage'] = 'a3拐点'
                prediction['next_stage'] = 'a4拐点'
                prediction['prediction_alert'] = '🔥 A五段式在第三浪！这是主升/跌浪，行情最猛烈。'
                
                if trend_direction == '上涨':
                    prediction['action_hint'] = '第三浪上涨中，可积极参与，注意持仓'
                else:
                    prediction['action_hint'] = '第三浪下跌中，注意风险控制'
                
                prediction['confidence'] = 'high'
                
            else:
                prediction['current_stage'] = f'a{inflection_count}拐点'
                prediction['next_stage'] = f'a{inflection_count + 1}拐点'
                prediction['prediction_alert'] = '🔄 A五段式进行中，等待关键拐点形成。'
                prediction['confidence'] = 'low'
                
        elif structure_type == 'C单平台式':
            # C单平台式：5笔6拐点，含单平台整理
            # 平台整理后通常会突破
            
            if inflection_count >= 5:
                prediction['current_stage'] = f'c{inflection_count}拐点'
                prediction['next_stage'] = 'c6拐点（突破点）'
                prediction['prediction_alert'] = '⚠️ C单平台式即将完成！平台整理后通常会有突破行情。'
                prediction['action_hint'] = '关注平台突破方向，准备跟随'
                prediction['confidence'] = 'high'
                
            elif inflection_count == 3 or inflection_count == 4:
                prediction['current_stage'] = f'c{inflection_count}拐点'
                prediction['next_stage'] = f'c{inflection_count + 1}拐点'
                prediction['prediction_alert'] = '📍 C单平台式平台整理中，整理结束后通常会有突破。'
                prediction['action_hint'] = '平台整理期间观望，等待突破确认'
                prediction['confidence'] = 'medium'
                
            else:
                prediction['current_stage'] = f'c{inflection_count}拐点'
                prediction['prediction_alert'] = '🔄 C单平台式进行中，等待平台形成。'
                prediction['confidence'] = 'low'
                
        elif structure_type == 'B双平台式':
            # B双平台式：9笔10拐点，双平台整理
            # 双平台后通常会有大行情
            
            if inflection_count >= 9:
                prediction['current_stage'] = f'b{inflection_count}拐点'
                prediction['next_stage'] = 'b10拐点（大行情起点）'
                prediction['prediction_alert'] = '⚠️ B双平台式即将完成！双平台整理后通常会有大级别行情！'
                prediction['action_hint'] = '双平台即将完成，准备迎接大级别行情'
                prediction['confidence'] = 'high'
                
            elif inflection_count >= 5:
                prediction['current_stage'] = f'b{inflection_count}拐点'
                prediction['next_stage'] = f'b{inflection_count + 1}拐点'
                prediction['prediction_alert'] = '📍 B双平台式整理中，两个平台后通常有大行情。'
                prediction['action_hint'] = '耐心等待双平台完成，大行情在后头'
                prediction['confidence'] = 'medium'
                
            else:
                prediction['current_stage'] = f'b{inflection_count}拐点'
                prediction['prediction_alert'] = '🔄 B双平台式进行中，需要更多拐点完成结构。'
                prediction['confidence'] = 'low'
        
        else:
            # 复杂结构
            prediction['current_stage'] = f'第{inflection_count}个拐点'
            prediction['prediction_alert'] = '结构复杂，需人工确认方向。'
            prediction['confidence'] = 'low'
        
        # 添加关键价位提示
        if last_fractal and current_price > 0:
            if last_fractal['type'] == 'bottom':
                # 最后一个拐点是底分型，关注上方压力
                if last_fractal['high'] > current_price:
                    prediction['key_price_levels'].append({
                        'price': round(last_fractal['high'], 2),
                        'type': '近期压力',
                        'note': '突破后可能继续上涨'
                    })
            else:
                # 最后一个拐点是顶分型，关注下方支撑
                if last_fractal['low'] < current_price:
                    prediction['key_price_levels'].append({
                        'price': round(last_fractal['low'], 2),
                        'type': '近期支撑',
                        'note': '跌破后可能继续下跌'
                    })
        
        return prediction

    def _build_structure_archetype(
        self,
        structure_type: str,
        structure_stage: str,
        trend_direction: str,
        macro_components: List[Dict[str, Any]],
        inflection_count: int,
        segment_count: int,
        peak_analysis: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Build a compact structure archetype summary for downstream execution rules."""
        structure_family, _, standard_qualification = self._resolve_structure_profile(structure_type)
        component_types = [
            component.get('type', 'Unknown')
            for component in (macro_components or [])[:3]
        ]
        component_path = ' -> '.join(component_types) if component_types else 'Unknown'
        maturity = 'early'
        if inflection_count >= 5 or segment_count >= 4:
            maturity = 'late'
        elif inflection_count >= 3 or segment_count >= 2:
            maturity = 'mid'

        confidence = 'low' if structure_type in ('复杂结构', '结构未完成') else 'medium'
        if standard_qualification == 'extended':
            confidence = 'low'
        if peak_analysis and peak_analysis.get('is_peak_structure'):
            confidence = 'low'

        alternatives = []
        if structure_family == 'A':
            alternatives.append({
                'type': 'C单平台式',
                'confidence': 0.35,
                'reason': '平台段占比仍高',
            })
        elif structure_family == 'C':
            alternatives.append({
                'type': 'A五段式',
                'confidence': 0.3,
                'reason': '突破后可升级为趋势原型',
            })
        elif structure_family == 'B':
            alternatives.append({
                'type': 'C单平台式',
                'confidence': 0.25,
                'reason': '若平台段收缩，可能退化为单平台',
            })

        return {
            'primary': structure_type or '结构未完成',
            'maturity': maturity,
            'confidence': confidence,
            'reason': component_path,
            'alternatives': alternatives,
        }

    def _detect_execution_phase(
        self,
        macd_status: str,
        trend_direction: str,
        moving_averages: Dict[str, Any],
        ma_physics: Dict[str, Any],
        breakthrough: Dict[str, Any],
        prediction: Dict[str, Any],
        divergence_note: str,
    ) -> Dict[str, Any]:
        """Translate structure, MA, and breakthrough context into a trade execution phase."""
        support_pressure = ma_physics.get('support_pressure', {}) if isinstance(ma_physics, dict) else {}
        traction = ma_physics.get('traction', {}) if isinstance(ma_physics, dict) else {}
        resonance = ma_physics.get('resonance', {}) if isinstance(ma_physics, dict) else {}
        stage = prediction.get('current_stage', '') if isinstance(prediction, dict) else ''
        pattern_type = breakthrough.get('pattern_type') if isinstance(breakthrough, dict) else None
        direction = breakthrough.get('direction') if isinstance(breakthrough, dict) else None
        breakthrough_valid = breakthrough.get('is_valid') is True if isinstance(breakthrough, dict) else False

        if divergence_note or traction.get('traction_force') == '强':
            return {
                'code': 'exhaustion_risk',
                'label': '衰竭风险',
                'bias': 'neutral',
                'tradable': False,
                'maturity': 'late',
                'reason': divergence_note or '偏离均线过大',
            }

        if (
            pattern_type in ('回抽突破', '回抽跌破')
            and support_pressure.get('status')
        ):
            return {
                'code': 'pullback_confirm',
                'label': '回抽确认',
                'bias': 'bullish' if direction == 'up' else 'bearish',
                'tradable': True,
                'maturity': 'mid',
                'reason': support_pressure.get('status'),
            }

        if pattern_type in (
            '有效突破',
            '有效跌破',
            '慢速突破',
            '慢速跌破',
            '反向突破',
            '反向跌破',
            '普通突破',
            '普通跌破',
        ):
            return {
                'code': 'breakout_attempt',
                'label': '突破尝试',
                'bias': 'bullish' if direction == 'up' else 'bearish',
                'tradable': pattern_type in ('有效突破', '有效跌破', '反向突破', '反向跌破'),
                'maturity': 'mid',
                'reason': pattern_type,
            }

        if trend_direction == '震荡':
            return {
                'code': 'platform_building',
                'label': '平台整理',
                'bias': 'neutral',
                'tradable': False,
                'maturity': 'mid',
                'reason': '当前仍在平台边界内',
            }

        correction_stages = ('a4', 'b3', 'b5', 'b7', 'c3', 'c4', 'd3')
        if any(marker in stage for marker in correction_stages):
            return {
                'code': 'correction_in_progress',
                'label': '修正进行中',
                'bias': 'bullish' if trend_direction == '上涨' else 'bearish',
                'tradable': False,
                'maturity': 'mid',
                'reason': stage or '当前处于逆向修正段',
            }

        price_vs_ma55 = moving_averages.get('price_vs_ma55') if isinstance(moving_averages, dict) else None
        ma_status = moving_averages.get('ma_status') if isinstance(moving_averages, dict) else None
        aligned_up = trend_direction == '上涨' and price_vs_ma55 == 'above' and ma_status == '多头排列'
        aligned_down = trend_direction == '下跌' and price_vs_ma55 == 'below' and ma_status == '空头排列'
        if breakthrough_valid and (aligned_up or aligned_down):
            return {
                'code': 'trend_continuation',
                'label': '趋势延续',
                'bias': 'bullish' if aligned_up else 'bearish',
                'tradable': True,
                'maturity': 'mid' if resonance.get('convergence_strength') in ('中', '强') else 'early',
                'reason': pattern_type or macd_status or '突破确认后顺趋势运行',
            }

        return {
            'code': 'trend_launch',
            'label': '趋势启动',
            'bias': 'bullish' if trend_direction == '上涨' else 'bearish' if trend_direction == '下跌' else 'neutral',
            'tradable': False,
            'maturity': 'early',
            'reason': macd_status or '趋势刚启动',
        }

    def _extract_latest_confirmed_levels(self, prediction: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Derive same-timeframe confirmed stop references from structure prediction levels."""
        confirmed_levels = []
        key_levels = prediction.get('key_price_levels', []) if isinstance(prediction, dict) else []

        for level in key_levels:
            if not isinstance(level, dict):
                continue

            level_type = str(level.get('type', ''))
            note = str(level.get('note', ''))
            if (
                level_type == 'stop'
                or '支撑' in level_type
                or '底分型' in note
                or '确认' in note
            ):
                confirmed_levels.append(level)

        return confirmed_levels

    def _build_period_execution(
        self,
        level: str,
        latest_price: Optional[float],
        macd_status: str,
        moving_averages: Dict[str, Any],
        ma_physics: Dict[str, Any],
        breakthrough: Dict[str, Any],
        phase: Dict[str, Any],
        archetype: Dict[str, Any],
        prediction: Dict[str, Any],
        latest_confirmed_levels: List[Dict[str, Any]],
        spacetime_gate: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Build per-period execution constraints for the current timeframe."""
        timeframe_cap_ratio_map = {
            'hour15': 0.25,
            'hour30': 1 / 3,
            'hour60': 0.5,
            'daily': 0.5,
        }
        timeframe_cap_ratio = timeframe_cap_ratio_map.get(level, 0.5)

        ma_status = moving_averages.get('ma_status') if isinstance(moving_averages, dict) else None
        t_mode = (
            'positive_only' if ma_status == '多头排列'
            else 'negative_only' if ma_status == '空头排列'
            else 'disabled'
        )
        bias = phase.get('bias', 'neutral') if isinstance(phase, dict) else 'neutral'
        phase_code = phase.get('code') if isinstance(phase, dict) else None
        can_trade = bool(phase.get('tradable'))
        gate_blocks_execution = bool(
            isinstance(spacetime_gate, dict)
            and spacetime_gate.get('parent_status')
            and spacetime_gate.get('resonance_enabled') is False
        )
        if gate_blocks_execution:
            can_trade = False
        if phase_code == 'pullback_confirm' and bias == 'bullish':
            action = 'buy'
        elif phase_code == 'pullback_confirm' and bias == 'bearish':
            action = 'sell'
        elif phase_code == 'exhaustion_risk':
            action = 'reduce'
        elif phase_code == 'trend_continuation' and can_trade:
            action = 'hold'
        else:
            action = 'wait'
        if gate_blocks_execution:
            action = 'wait'

        stop_reference = latest_confirmed_levels[0] if latest_confirmed_levels else None
        stop_price = stop_reference.get('price') if isinstance(stop_reference, dict) else None
        direction = 'long' if bias == 'bullish' else 'short' if bias == 'bearish' else 'neutral'
        setup_quality = 'A' if can_trade and breakthrough.get('is_valid') else 'C' if can_trade else 'avoid'
        timing_timeframe = level if level in ('daily', 'hour60', 'hour30', 'hour15') else None

        key_levels = (prediction or {}).get('key_price_levels') or latest_confirmed_levels or []
        trigger = ['等待确认性触发']
        if phase_code == 'pullback_confirm':
            trigger = ['MA55支撑有效后重新转强']

        invalidation = ['原建仓级别失效立即退出']
        if stop_price is not None:
            invalidation = [f'跌破同级别止损位 {stop_price} 立即退出']

        confirmation = ['次级别结构继续共振']
        if breakthrough.get('is_valid') is True:
            confirmation = ['突破形态有效', '次级别结构继续共振']

        take_profit_plan = {
            'model': 'inverted_pyramid' if can_trade else 'none',
            'triggers': ['A类末端', 'B类末端', '15/30分钟顶背离'] if can_trade else [],
            'ladder': ['首抛 50%', '二抛 30%', '三抛 15%'] if can_trade else [],
            'keep_runner': bool(can_trade),
        }

        return {
            'can_trade': can_trade,
            'action': action,
            'direction': direction,
            'setup_quality': setup_quality,
            'rationale': phase.get('reason') or archetype.get('reason') or '',
            'timing_timeframe': timing_timeframe,
            'timeframe_cap_ratio': timeframe_cap_ratio_map.get(level),
            'trigger': trigger,
            'invalidation': invalidation,
            'confirmation': confirmation,
            'entry_style': 'pullback_confirm' if phase_code == 'pullback_confirm' else 'trend_hold' if phase_code == 'trend_continuation' else 'wait',
            'position_sizing': {
                'starter': '轻仓试探',
                'initial': '20%-30%' if can_trade else '0%',
                'add_on': '仅在浮盈后追加',
                'max': '遵守级别上限',
                'pyramid_rule': {
                    'model': 'positive_pyramid',
                    'add_step_rules': [
                        '第一次加仓 <= 起手仓位 100%',
                        '第二次加仓 <= 第一次加仓 50%',
                        '第三次加仓 <= 第二次加仓 50%',
                    ],
                },
            },
            't_trade_rule': {
                'mode': t_mode,
                'max_quick_take_profit_points': 3,
            },
            'risk_rules': {
                'stop_loss_basis': 'same_timeframe',
                'no_timeframe_upcast_after_break': True,
                'no_left_side_averaging_down': True,
                'right_side_add_only': True,
                'right_side_add_conditions': ['V型反转', '有效突破MA55', '确认的日线底分型'],
            },
            'take_profit_plan': take_profit_plan,
            'key_levels': key_levels,
            'risk_flags': [] if can_trade else (
                ['当前仅满足观察，不满足执行']
                + (['时空门控未通过，当前级别暂不操作'] if gate_blocks_execution else [])
            ),
            'wait_reason': None if can_trade else (
                (spacetime_gate or {}).get('wait_reason')
                or '等待更明确的回抽确认或突破确认'
            ),
        }

    def _apply_spacetime_gate_to_results(self, results: Dict[str, Any]) -> None:
        """Inject parent-status gating into per-period interpretation and execution buses."""
        parent_status_map = {
            'weekly': None,
            'daily': ((results.get('weekly') or {}).get('macd') or {}).get('status'),
            'hour60': ((results.get('daily') or {}).get('macd') or {}).get('status'),
            'hour30': ((results.get('daily') or {}).get('macd') or {}).get('status'),
            'hour15': ((results.get('hour60') or {}).get('macd') or {}).get('status'),
        }

        for level, period_result in results.items():
            if not isinstance(period_result, dict) or period_result.get('error'):
                continue

            structure = period_result.get('structure')
            if not isinstance(structure, dict):
                continue

            interpretation = structure.get('interpretation')
            if not isinstance(interpretation, dict):
                interpretation = {}
                structure['interpretation'] = interpretation

            gate = self._build_spacetime_gate(
                parent_status=parent_status_map.get(level),
                structure_type=structure.get('structure_type'),
                trend_direction=structure.get('trend_direction'),
            )
            interpretation['spacetime_gate'] = gate

            execution = structure.get('execution')
            if isinstance(execution, dict):
                gate_blocks_execution = bool(
                    gate.get('parent_status') and gate.get('resonance_enabled') is False
                )
                if gate_blocks_execution:
                    execution['can_trade'] = False
                    execution['action'] = 'wait'
                    execution['setup_quality'] = 'avoid'
                    execution['entry_style'] = 'wait'
                    risk_flags = list(execution.get('risk_flags') or [])
                    if '时空门控未通过，当前级别暂不操作' not in risk_flags:
                        risk_flags.append('时空门控未通过，当前级别暂不操作')
                    execution['risk_flags'] = risk_flags
                if gate.get('wait_reason'):
                    execution['wait_reason'] = gate.get('wait_reason')
    
    def calculate_key_levels(self, df: pd.DataFrame) -> Dict:
        """
        计算关键支撑压力位
        """
        result = {
            'support_levels': [],
            'resistance_levels': [],
            'ma55': None,
            'ma233': None
        }
        
        if len(df) == 0:
            return result
        
        latest = df.iloc[-1]
        
        if pd.notna(latest.get('MA55')):
            result['ma55'] = round(latest['MA55'], 2)
            strength = '支撑' if latest['close'] > latest['MA55'] else '压力'
            result['support_levels'].append({
                'level': round(latest['MA55'], 2),
                'type': 'MA55',
                'strength': strength
            })
        
        if pd.notna(latest.get('MA233')):
            result['ma233'] = round(latest['MA233'], 2)
            strength = '支撑' if latest['close'] > latest['MA233'] else '压力'
            result['support_levels'].append({
                'level': round(latest['MA233'], 2),
                'type': 'MA233',
                'strength': strength
            })
        
        lookback = min(60, len(df))
        recent = df.tail(lookback)
        
        recent_high = recent['high'].max()
        result['resistance_levels'].append({
            'level': round(recent_high, 2),
            'type': '近期高点',
            'strength': '中'
        })
        
        recent_low = recent['low'].min()
        result['support_levels'].append({
            'level': round(recent_low, 2),
            'type': '近期低点',
            'strength': '中'
        })
        
        return result
    
    def generate_operation_advice(self, major_status: str, minor_structure: str = None,
                                   minor_trend: str = None) -> Dict:
        """
        根据时空要素和结构要素应用表生成操作建议
        
        核心逻辑：大级别（日线）时空状态 + 小级别（30分钟/15分钟）结构 = 操作建议
        
        参数：
        - major_status: 大级别（日线）MACD状态（极强/强/中偏强/中偏弱/弱/极弱）
        - minor_structure: 小级别结构类型（A/B/C/D）
        - minor_trend: 小级别趋势方向（上涨/下跌/震荡），用于选择操作建议
        
        返回：
        - 操作建议字典
        """
        # 获取时空结构表
        table = self.SPACETIME_STRUCTURE_TABLE
        
        # 默认值
        advice = {
            'major_status': major_status,           # 大级别状态
            'minor_structure': minor_structure,     # 小级别结构
            'minor_trend': minor_trend,             # 小级别趋势
            'matched_structures': [],               # 当前趋势对应的匹配结构
            'operation_advice': '',                 # 操作建议
            'structure_match': False,               # 小级别结构是否匹配
            'structure_direction': '',              # 结构方向（上涨结构/下跌结构）
            'explanation': ''                       # 解释说明
        }
        
        # 获取对应状态的操作建议
        if major_status not in table:
            advice['operation_advice'] = '状态未知，无法生成操作建议'
            return advice
        
        status_config = table[major_status]
        
        # 根据小级别趋势方向选择对应的结构和操作建议
        # 提取结构类型的首字母（支持完整名称如"B双平台式"或简写如"B"）
        structure_key = minor_structure[0] if minor_structure and len(minor_structure) > 0 else None
        
        if minor_trend == '上涨':
            advice['matched_structures'] = status_config['上涨结构']
            advice['operation_advice'] = status_config['上涨操作']
            advice['structure_direction'] = '上涨结构'
            # 检查小级别结构是否匹配
            if structure_key and structure_key in status_config['上涨结构']:
                advice['structure_match'] = True
        elif minor_trend == '下跌':
            advice['matched_structures'] = status_config['下跌结构']
            advice['operation_advice'] = status_config['下跌操作']
            advice['structure_direction'] = '下跌结构'
            # 检查小级别结构是否匹配
            if structure_key and structure_key in status_config['下跌结构']:
                advice['structure_match'] = True
        else:
            # 震荡行情，综合展示
            advice['matched_structures'] = {
                '上涨结构': status_config['上涨结构'],
                '下跌结构': status_config['下跌结构']
            }
            advice['operation_advice'] = f"上涨：{status_config['上涨操作']}；下跌：{status_config['下跌操作']}"
            advice['structure_direction'] = '震荡（双向关注）'
            # 震荡行情中也要检查结构匹配
            if structure_key:
                if structure_key in status_config['上涨结构']:
                    advice['structure_match'] = True
                    advice['structure_direction'] = '上涨结构（震荡中）'
                elif structure_key in status_config['下跌结构']:
                    advice['structure_match'] = True
                    advice['structure_direction'] = '下跌结构（震荡中）'
        
        # 生成解释说明
        structure_desc = {
            'A': 'A五段式', 'B': 'B双平台式', 'C': 'C单平台式', 'D': 'D三段式'
        }
        
        if minor_structure and minor_trend:
            minor_desc = structure_desc.get(minor_structure, minor_structure)
            if advice['structure_match']:
                # 根据结构方向给出更精确的解释
                if '上涨结构' in advice['structure_direction']:
                    advice['explanation'] = f"日线状态【{major_status}】，小级别{minor_desc}属于上涨结构，当前趋势{minor_trend}，符合上涨操作条件。"
                elif '下跌结构' in advice['structure_direction']:
                    advice['explanation'] = f"日线状态【{major_status}】，小级别{minor_desc}属于下跌结构，当前趋势{minor_trend}，符合下跌操作条件。"
                else:
                    advice['explanation'] = f"日线状态【{major_status}】，小级别呈现{minor_trend}{minor_desc}，符合操作条件。"
            else:
                matched = advice['matched_structures']
                if isinstance(matched, list):
                    # 上涨或下跌趋势，但结构不匹配
                    expected = '、'.join([structure_desc.get(s, s) for s in matched]) if matched else '无'
                    advice['explanation'] = f"日线状态【{major_status}】，期望小级别{minor_trend}结构为：{expected}，当前为{minor_desc}，不符合操作条件。"
                else:
                    # 震荡趋势，展示双向结构
                    up_structures = matched.get('上涨结构', [])
                    down_structures = matched.get('下跌结构', [])
                    up_desc = '、'.join([structure_desc.get(s, s) for s in up_structures]) if up_structures else '无'
                    down_desc = '、'.join([structure_desc.get(s, s) for s in down_structures]) if down_structures else '无'
                    if structure_key in up_structures:
                        advice['explanation'] = f"日线状态【{major_status}】，小级别{minor_desc}属于上涨结构({up_desc})，可关注上涨方向操作。"
                    elif structure_key in down_structures:
                        advice['explanation'] = f"日线状态【{major_status}】，小级别{minor_desc}属于下跌结构({down_desc})，可关注下跌方向操作。"
                    else:
                        advice['explanation'] = f"日线状态【{major_status}】，小级别{minor_desc}震荡，期望上涨结构：{up_desc}，下跌结构：{down_desc}，当前结构不符合标准操作条件，需等待结构明朗。"
        
        return advice
    
    def analyze_level_operation(self, results: Dict) -> Dict:
        """
        多维度级别联动的操作建议分析
        
        三个分析维度：
        1. 维度一：周线状态 + 日线结构（判断大级别趋势方向）
        2. 维度二：日线状态 + 30分钟结构（寻找具体买卖点）
        3. 维度三：60分钟状态 + 15分钟结构（日内或短线操作）
        
        返回：
        - 包含三个维度操作建议的字典
        """
        multi_dimension_advice = {
            'dimension1': None,  # 周线+日线
            'dimension2': None,  # 日线+30分钟
            'dimension3': None   # 60分钟+15分钟
        }
        
        # 维度一：周线状态 + 日线结构
        weekly = results.get('weekly', {})
        daily = results.get('daily', {})
        
        if 'error' not in weekly and weekly and 'error' not in daily and daily:
            weekly_status = weekly.get('macd', {}).get('status')
            daily_structure = daily.get('structure', {}).get('structure_type')
            daily_trend = daily.get('structure', {}).get('trend_direction')
            
            if weekly_status:
                advice1 = self.generate_operation_advice(
                    major_status=weekly_status,
                    minor_structure=daily_structure,
                    minor_trend=daily_trend
                )
                multi_dimension_advice['dimension1'] = {
                    'major_level': 'weekly',
                    'major_level_name': '周线',
                    'major_status': weekly_status,
                    'minor_level': 'daily',
                    'minor_level_name': '日线',
                    'minor_structure': daily_structure,
                    'minor_trend': daily_trend,
                    'advice': advice1
                }
        
        # 维度二：日线状态 + 30分钟结构
        hour30 = results.get('hour30', {})
        
        if 'error' not in daily and daily and 'error' not in hour30 and hour30:
            daily_status = daily.get('macd', {}).get('status')
            hour30_structure = hour30.get('structure', {}).get('structure_type')
            hour30_trend = hour30.get('structure', {}).get('trend_direction')
            
            if daily_status:
                advice2 = self.generate_operation_advice(
                    major_status=daily_status,
                    minor_structure=hour30_structure,
                    minor_trend=hour30_trend
                )
                multi_dimension_advice['dimension2'] = {
                    'major_level': 'daily',
                    'major_level_name': '日线',
                    'major_status': daily_status,
                    'minor_level': 'hour30',
                    'minor_level_name': '30分钟',
                    'minor_structure': hour30_structure,
                    'minor_trend': hour30_trend,
                    'advice': advice2
                }
        
        # 维度三：60分钟状态 + 15分钟结构
        hour60 = results.get('hour60', {})
        hour15 = results.get('hour15', {})
        
        if 'error' not in hour60 and hour60 and 'error' not in hour15 and hour15:
            hour60_status = hour60.get('macd', {}).get('status')
            hour15_structure = hour15.get('structure', {}).get('structure_type')
            hour15_trend = hour15.get('structure', {}).get('trend_direction')
            
            if hour60_status:
                advice3 = self.generate_operation_advice(
                    major_status=hour60_status,
                    minor_structure=hour15_structure,
                    minor_trend=hour15_trend
                )
                multi_dimension_advice['dimension3'] = {
                    'major_level': 'hour60',
                    'major_level_name': '60分钟',
                    'major_status': hour60_status,
                    'minor_level': 'hour15',
                    'minor_level_name': '15分钟',
                    'minor_structure': hour15_structure,
                    'minor_trend': hour15_trend,
                    'advice': advice3
                }
        
        return multi_dimension_advice
    
    def analyze_single_period(self, df: pd.DataFrame, period_name: str) -> Dict:
        """
        分析单个周期的数据
        """
        if df is None or len(df) == 0:
            return {'error': f'无法获取{period_name}数据'}
        
        # 计算技术指标
        df = self.calculate_ma(df, periods=[55, 233])
        df = self.calculate_macd(df)
        
        latest = df.iloc[-1]
        latest_price = round(float(latest['close']), 2) if pd.notna(latest.get('close')) else None
        
        # 执行各项分析
        ma_analysis = self.analyze_ma_position(latest)
        macd_status = self.determine_macd_status(df)
        # 传递MACD状态用于背离豁免判断
        divergence = self.detect_divergence(df, macd_status=macd_status.get('status'))
        # 传递MACD状态用于判断d3不稳定点
        structure = self.detect_structure(df, macd_status=macd_status.get('status'))
        key_levels = self.calculate_key_levels(df)
        
        # 新增：均线物理性质分析
        ma_physics = self.analyze_ma_physics(df)
        
        # 新增：突破形态识别
        breakthrough = self.detect_breakthrough_pattern(df)

        structure_details = structure.get('structure_details', {})
        prediction = structure_details.get('prediction', {})
        focus_classification = structure_details.get('focus_classification', {})
        execution_trend_direction = focus_classification.get('trend_direction') or structure.get('trend_direction')
        archetype = self._build_structure_archetype(
            structure_type=structure.get('structure_type'),
            structure_stage=structure.get('structure_stage'),
            trend_direction=execution_trend_direction,
            macro_components=structure_details.get('macro_components', []),
            inflection_count=structure.get('inflection_points', 0),
            segment_count=structure.get('segment_count', 0),
            peak_analysis=structure_details.get('peak_analysis'),
        )
        execution_phase = self._detect_execution_phase(
            macd_status=macd_status.get('status'),
            trend_direction=execution_trend_direction,
            moving_averages={
                'price_vs_ma55': ma_analysis['price_vs_ma55'],
                'ma_status': ma_analysis['ma_status'],
            },
            ma_physics=ma_physics,
            breakthrough=breakthrough,
            prediction=prediction,
            divergence_note=divergence.get('divergence_note', ''),
        )
        latest_confirmed_levels = self._extract_latest_confirmed_levels(prediction)
        structure['archetype'] = archetype
        structure['execution_phase'] = execution_phase
        structure['execution'] = self._build_period_execution(
            level=period_name,
            latest_price=latest_price,
            macd_status=macd_status.get('status'),
            moving_averages={
                'price_vs_ma55': ma_analysis['price_vs_ma55'],
                'ma_status': ma_analysis['ma_status'],
            },
            ma_physics=ma_physics,
            breakthrough=breakthrough,
            phase=execution_phase,
            archetype=archetype,
            prediction=prediction,
            latest_confirmed_levels=latest_confirmed_levels,
        )
        
        # 安全获取pctChg（分钟级别可能没有此字段）
        pct_chg = None
        if 'pctChg' in df.columns and pd.notna(latest.get('pctChg')):
            pct_chg = round(latest['pctChg'], 2)
        
        # 收集所有重点提醒
        # 注意：不包含 breakthrough.alerts，因为突破形态已有单独展示区域
        all_alerts = []
        all_alerts.extend(ma_physics.get('alerts', []))
        
        result = {
            'period': period_name,
            'analysis_date': latest['date'].strftime('%Y-%m-%d %H:%M') if pd.notna(latest['date']) else None,
            'latest_price': latest_price,
            'price_change_pct': pct_chg,
            'volume': int(latest['volume']) if pd.notna(latest['volume']) else None,
            
            # 均线分析
            'moving_averages': {
                'MA55': round(latest['MA55'], 2) if pd.notna(latest.get('MA55')) else None,
                'MA233': round(latest['MA233'], 2) if pd.notna(latest.get('MA233')) else None,
                'price_vs_ma55': ma_analysis['price_vs_ma55'],
                'price_vs_ma233': ma_analysis['price_vs_ma233'],
                'distance_ma55_pct': ma_analysis['distance_ma55'],
                'distance_ma233_pct': ma_analysis['distance_ma233'],
                'ma_status': ma_analysis['ma_status']
            },
            
            # 均线物理性质（新增）
            'ma_physics': ma_physics,
            
            # 突破形态识别（新增）
            'breakthrough': breakthrough,
            
            # MACD时空状态
            'macd': {
                'DIF': macd_status.get('DIF'),
                'DEA': macd_status.get('DEA'),
                'MACD': macd_status.get('MACD'),
                'status': macd_status['status'],
                'description': macd_status['description'],
                'top_divergence': divergence['top_divergence'],
                'bottom_divergence': divergence['bottom_divergence'],
                'divergence_note': divergence['divergence_note']
            },
            
            # 结构分析
            'structure': structure,
            
            # 关键价位
            'key_levels': key_levels,
            
            # 重点提醒（新增：汇总所有关键信号）
            'key_alerts': all_alerts if all_alerts else None
        }
        result.update(self._calculate_trinity_volume_metrics(df))
        result['trinity_decision'] = self._build_trinity_decision(
            level=period_name,
            structure_payload=result.get('structure') or {},
            macd_payload=result.get('macd') or {},
            moving_averages=result.get('moving_averages') or {},
            breakthrough_payload=result.get('breakthrough') or {},
            execution_payload=((result.get('structure') or {}).get('execution') or {}),
            level_nesting_payload=None,
            period_payload=result,
        )
        return result
    
    def analyze_level_nesting(self, results: Dict) -> Dict:
        """
        级别嵌套分析
        
        分析三种维度：
        1. 周线+日线+60分钟
        2. 日线+30分钟+15分钟
        3. 60分钟+15分钟
        """
        nesting_analysis = {
            'dimension1': None,  # 周线+日线+60分钟
            'dimension2': None,  # 日线+30分钟+15分钟
            'dimension3': None,  # 60分钟+15分钟
            'summary': ''
        }
        
        # 维度一：周线+日线+60分钟
        if 'weekly' in results and 'daily' in results:
            weekly = results['weekly']
            daily = results['daily']
            hour60 = results.get('hour60', {})
            
            if 'error' not in weekly and 'error' not in daily:
                dim1 = {
                    'weekly_status': weekly.get('macd', {}).get('status', '未知'),
                    'weekly_structure': weekly.get('structure', {}).get('structure_type', '未知'),
                    'daily_status': daily.get('macd', {}).get('status', '未知'),
                    'daily_structure': daily.get('structure', {}).get('structure_type', '未知'),
                    'daily_ma55_position': daily.get('moving_averages', {}).get('price_vs_ma55'),
                    'hour60_status': hour60.get('macd', {}).get('status', '未知') if 'error' not in hour60 else '无数据',
                    'analysis': ''
                }
                
                # 生成分析结论
                analyses = []
                if dim1['weekly_status'] in ['极强', '强']:
                    analyses.append(f"周线处于{dim1['weekly_status']}状态，大级别趋势向上")
                elif dim1['weekly_status'] in ['极弱', '弱']:
                    analyses.append(f"周线处于{dim1['weekly_status']}状态，大级别趋势向下")
                
                if dim1['daily_ma55_position'] == 'above':
                    analyses.append("日线站上MA55，可参考60分钟级别MA55做防守")
                else:
                    analyses.append("日线在MA55下方，需警惕进一步回调")
                
                if dim1['daily_status'] == '极强':
                    analyses.append("日线极强状态，忽略小级别顶部背离，逢低加仓")
                
                dim1['analysis'] = '；'.join(analyses) if analyses else '需进一步分析'
                nesting_analysis['dimension1'] = dim1
        
        # 维度二：日线+30分钟+15分钟
        if 'daily' in results:
            daily = results['daily']
            hour30 = results.get('hour30', {})
            hour15 = results.get('hour15', {})
            
            if 'error' not in daily:
                dim2 = {
                    'daily_status': daily.get('macd', {}).get('status', '未知'),
                    'daily_structure': daily.get('structure', {}).get('structure_type', '未知'),
                    'hour30_status': hour30.get('macd', {}).get('status', '未知') if 'error' not in hour30 else '无数据',
                    'hour15_structure': hour15.get('structure', {}).get('structure_type', '未知') if 'error' not in hour15 else '无数据',
                    'analysis': ''
                }
                
                analyses = []
                analyses.append(f"日线时空状态：{dim2['daily_status']}")
                
                if dim2['daily_status'] in ['极强', '强']:
                    analyses.append("日线强势，可用30分钟/15分钟找买点")
                    analyses.append("注意：15分钟反弹最多补1/4仓位，30分钟反弹最多补1/3仓位")
                elif dim2['daily_status'] in ['极弱', '弱']:
                    analyses.append("日线弱势，等待小级别完成D结构后再考虑介入")
                
                dim2['analysis'] = '；'.join(analyses)
                nesting_analysis['dimension2'] = dim2
        
        # 维度三：60分钟+15分钟
        if 'hour60' in results:
            hour60 = results['hour60']
            hour15 = results.get('hour15', {})
            
            if 'error' not in hour60:
                dim3 = {
                    'hour60_status': hour60.get('macd', {}).get('status', '未知'),
                    'hour60_ma55_position': hour60.get('moving_averages', {}).get('price_vs_ma55'),
                    'hour15_structure': hour15.get('structure', {}).get('structure_type', '未知') if 'error' not in hour15 else '无数据',
                    'analysis': ''
                }
                
                analyses = []
                if dim3['hour60_ma55_position'] == 'above':
                    analyses.append("60分钟站上MA55，可作为日线级别的防守线")
                else:
                    analyses.append("60分钟在MA55下方，需警惕日线级别回调")
                
                if dim3['hour15_structure'] == 'D三段式':
                    analyses.append("15分钟已完成D结构，可能传导至60分钟级别")
                
                dim3['analysis'] = '；'.join(analyses) if analyses else '需进一步分析'
                nesting_analysis['dimension3'] = dim3
        
        # 生成总体摘要（只显示不同周期的状态，避免重复）
        summary_parts = []
        if nesting_analysis['dimension1']:
            # 维度一：周线 + 日线
            summary_parts.append(f"周线{nesting_analysis['dimension1']['weekly_status']}")
            summary_parts.append(f"日线{nesting_analysis['dimension1']['daily_status']}")
        if nesting_analysis['dimension2']:
            # 维度二：只添加 30 分钟状态（日线已在维度一展示）
            if nesting_analysis['dimension2'].get('hour30_status'):
                summary_parts.append(f"30分钟{nesting_analysis['dimension2']['hour30_status']}")
        if nesting_analysis['dimension3']:
            # 维度三：60 分钟状态
            if nesting_analysis['dimension3'].get('hour60_status'):
                summary_parts.append(f"60分钟{nesting_analysis['dimension3']['hour60_status']}")
        
        nesting_analysis['summary'] = ' / '.join(summary_parts) if summary_parts else '级别嵌套分析完成'
        
        # ============ 新增：时空双重确认分析 ============
        spacetime_confirmation = self.analyze_spacetime_confirmation(results)
        nesting_analysis['spacetime_confirmation'] = spacetime_confirmation
        
        # ============ 新增：做T与加仓决策树 ============
        trading_decision = self.analyze_trading_decision(
            results,
            spacetime_confirmation=spacetime_confirmation,
        )
        nesting_analysis['trading_decision'] = trading_decision
        
        return nesting_analysis

    def analyze_spacetime_confirmation(self, results: Dict) -> Dict:
        """
        时空双重确认分析（维度五）
        
        判断宏观调整是否彻底结束：
        1. 空间确认：日线级别是否包含完整的D结构
        2. 时间确认：周线级别下跌时间与前一段下跌时间偏差是否<3周
        
        返回：
        - space_confirmed: 空间是否确认
        - time_confirmed: 时间是否确认
        - spacetime_resonance: 时空是否共振
        - analysis: 分析说明
        """
        confirmation = {
            'space_confirmed': False,
            'time_confirmed': False,
            'spacetime_resonance': False,
            'space_analysis': None,
            'time_analysis': None,
            'analysis': ''
        }
        
        weekly = results.get('weekly', {})
        daily = results.get('daily', {})
        
        if 'error' in weekly or 'error' in daily:
            confirmation['analysis'] = '缺少周线或日线数据，无法进行时空确认'
            return confirmation
        
        # ============ 1. 空间确认（寻找D结构）============
        # 检查日线是否有完整的D结构
        daily_structure = daily.get('structure', {})
        daily_structure_type = daily_structure.get('structure_type', '')
        
        # 获取日线结构预测
        daily_prediction = daily_structure.get('structure_details', {}).get('prediction', {})
        daily_inflection_count = daily_structure.get('inflection_points', 0)
        
        # 空间确认：日线有完整D结构（d1-d4）或已完成
        if daily_structure_type == 'D三段式' and daily_inflection_count >= 4:
            confirmation['space_confirmed'] = True
            confirmation['space_analysis'] = {
                'type': 'D三段式完整',
                'inflection_points': daily_inflection_count,
                'description': '日线包含完整的D结构，空间调整到位'
            }
        elif daily_structure_type == 'D三段式' and daily_inflection_count >= 3:
            # d3已形成，等待d4
            confirmation['space_analysis'] = {
                'type': 'D三段式进行中',
                'inflection_points': daily_inflection_count,
                'description': '日线D结构进行中，等待d4完成确认空间调整'
            }
        else:
            confirmation['space_analysis'] = {
                'type': daily_structure_type or '未知',
                'inflection_points': daily_inflection_count,
                'description': f'日线结构为{daily_structure_type}，未满足空间确认条件'
            }
        
        # ============ 2. 时间确认（三周时间偏差法则）============
        # 需要周线K线数据来计算时间周期
        # 这里我们使用周线结构中的笔数来估算时间周期
        
        weekly_structure = weekly.get('structure', {})
        weekly_strokes = weekly_structure.get('structure_details', {}).get('strokes', [])
        
        if len(weekly_strokes) >= 2:
            # 计算最近两段下跌的时间周期
            # 找到最近的下跌笔
            recent_down_strokes = [s for s in weekly_strokes if s.get('direction') == '下跌']
            
            if len(recent_down_strokes) >= 2:
                # 比较最近两段下跌的长度（K线数）
                current_down = recent_down_strokes[-1]
                prev_down = recent_down_strokes[-2]
                
                current_length = current_down.get('length', 0)
                prev_length = prev_down.get('length', 0)
                
                if prev_length > 0:
                    time_diff = abs(current_length - prev_length)
                    time_diff_pct = time_diff / prev_length * 100
                    
                    # 时间偏差不超过3周（假设每周一根K线）
                    # 这里用K线数来近似时间周期
                    if time_diff <= 3:
                        confirmation['time_confirmed'] = True
                        confirmation['time_analysis'] = {
                            'current_length': current_length,
                            'prev_length': prev_length,
                            'time_diff': time_diff,
                            'description': f'周线下跌时间偏差{time_diff}周，满足时间确认（<3周）'
                        }
                    else:
                        confirmation['time_analysis'] = {
                            'current_length': current_length,
                            'prev_length': prev_length,
                            'time_diff': time_diff,
                            'description': f'周线下跌时间偏差{time_diff}周，超过3周阈值，时间未确认'
                        }
                else:
                    confirmation['time_analysis'] = {
                        'description': '无法计算时间偏差（前一段下跌长度为0）'
                    }
            else:
                confirmation['time_analysis'] = {
                    'description': f'周线下跌笔数不足（需至少2段，当前{len(recent_down_strokes)}段）'
                }
        else:
            confirmation['time_analysis'] = {
                'description': f'周线笔数不足（需至少2笔，当前{len(weekly_strokes)}笔）'
            }
        
        # ============ 3. 时空共振判断 ============
        if confirmation['space_confirmed'] and confirmation['time_confirmed']:
            confirmation['spacetime_resonance'] = True
            confirmation['analysis'] = '时空共振确认！空间调整到位+时间对称，未来上涨极具爆发力。此时不应减仓，收紧至60分钟MA55监控，突破即全面进攻信号。'
        elif confirmation['space_confirmed']:
            confirmation['analysis'] = '空间确认但时间未确认，等待时间维度满足条件。'
        elif confirmation['time_confirmed']:
            confirmation['analysis'] = '时间确认但空间未确认，等待日线D结构完成。'
        else:
            confirmation['analysis'] = '时空均未确认，调整可能尚未结束。'
        
        return confirmation

    def analyze_trading_decision(
        self,
        results: Dict,
        spacetime_confirmation: Optional[Dict] = None,
    ) -> Dict:
        """
        做T与加仓决策树分析（维度六）
        
        四个核心问题：
        1. 大级别态势：周线与日线的趋势是否共振向上？
        2. 微观背离监测：15分钟或30分钟上是否已出现顶背离？
        3. 前期调整质检：前期下跌是否满足时空确认？
        4. MA55生命线相对位置：当前价格是否已在MA55上方完成回踩确认？
        
        返回：
        - decision_type: '加仓' / '做T' / '观望'
        - t_type: 做T类型（正T/反T/突破做T/接刀子做T）
        - analysis: 分析说明
        - action_hint: 操作提示
        """
        decision = {
            'decision_type': '观望',
            't_type': None,
            'core_questions': {},
            'analysis': '',
            'action_hint': '',
            'can_trade': False,
            'action': 'wait',
            'direction': 'neutral',
            'setup_quality': 'avoid',
            'rationale': '',
            'analysis_order': 'top_down',
            'execution_order': 'bottom_up',
            'primary_timeframe': 'daily',
            'timing_timeframe': 'daily',
            'timeframe_cap_ratio': 0.5,
            'trigger': [],
            'invalidation': [],
            'confirmation': [],
            'position_sizing': {},
            't_trade_rule': {},
            'risk_rules': {
                'stop_loss_basis': 'same_timeframe',
            },
            'take_profit_plan': {
                'model': 'none',
            },
            'key_levels': [],
            'risk_flags': [],
            'wait_reason': None,
        }
        
        weekly = results.get('weekly', {})
        daily = results.get('daily', {})
        hour60 = results.get('hour60', {})
        hour30 = results.get('hour30', {})
        hour15 = results.get('hour15', {})
        daily_structure = daily.get('structure', {}) if isinstance(daily, dict) else {}
        has_execution_bus = isinstance(daily_structure, dict) and 'execution' in daily_structure
        daily_execution = daily_structure.get('execution', {}) if has_execution_bus else {}
        spacetime = spacetime_confirmation
        if spacetime is None:
            spacetime = results.get('nesting_analysis', {}).get('spacetime_confirmation', {})
        if not isinstance(spacetime, dict):
            spacetime = {}

        stable_execution_fields = [
            'can_trade',
            'action',
            'direction',
            'setup_quality',
            'rationale',
            'timing_timeframe',
            'timeframe_cap_ratio',
            'trigger',
            'invalidation',
            'confirmation',
            'position_sizing',
            't_trade_rule',
            'risk_rules',
            'take_profit_plan',
            'key_levels',
            'risk_flags',
            'wait_reason',
        ]
        if isinstance(daily_execution, dict):
            for field in stable_execution_fields:
                if field in daily_execution:
                    decision[field] = daily_execution[field]
        risk_rules = decision.get('risk_rules') or {}
        if not isinstance(risk_rules, dict):
            risk_rules = {}
        risk_rules['stop_loss_basis'] = 'same_timeframe'
        decision['risk_rules'] = risk_rules
        
        # ============ 问题1：大级别态势 ============
        weekly_status = weekly.get('macd', {}).get('status', '未知') if 'error' not in weekly else '无数据'
        daily_status = daily.get('macd', {}).get('status', '未知') if 'error' not in daily else '无数据'
        
        weekly_up = weekly_status in ['极强', '强', '中偏强']
        daily_up = daily_status in ['极强', '强', '中偏强']
        major_resonance_up = weekly_up and daily_up
        
        decision['core_questions']['major_resonance'] = {
            'weekly_status': weekly_status,
            'daily_status': daily_status,
            'resonance_up': major_resonance_up,
            'description': '周线与日线共振向上' if major_resonance_up else '周线与日线未共振向上'
        }
        
        # ============ 问题2：微观背离监测 ============
        micro_divergence = False
        micro_divergence_type = None
        
        if 'error' not in hour15:
            if hour15.get('macd', {}).get('top_divergence'):
                micro_divergence = True
                micro_divergence_type = '15分钟顶背离'
        
        if not micro_divergence and 'error' not in hour30:
            if hour30.get('macd', {}).get('top_divergence'):
                micro_divergence = True
                micro_divergence_type = '30分钟顶背离'
        
        decision['core_questions']['micro_divergence'] = {
            'has_divergence': micro_divergence,
            'divergence_type': micro_divergence_type,
            'description': f'存在{micro_divergence_type}，偏向反T' if micro_divergence else '无小级别顶背离，具备冲击潜力'
        }
        
        # ============ 问题3：前期调整质检 ============
        adjustment_qualified = spacetime.get('spacetime_resonance', False) if spacetime else False
        
        decision['core_questions']['adjustment_quality'] = {
            'spacetime_resonance': adjustment_qualified,
            'description': '前期下跌满足时空确认' if adjustment_qualified else '前期下跌未满足时空确认'
        }
        
        # ============ 问题4：MA55生命线相对位置 ============
        daily_ma55_position = daily.get('moving_averages', {}).get('price_vs_ma55', '未知') if 'error' not in daily else '无数据'
        hour60_ma55_position = hour60.get('moving_averages', {}).get('price_vs_ma55', '未知') if 'error' not in hour60 else '无数据'
        
        ma55_confirmed = daily_ma55_position == 'above' and hour60_ma55_position == 'above'
        
        decision['core_questions']['ma55_position'] = {
            'daily_position': daily_ma55_position,
            'hour60_position': hour60_ma55_position,
            'confirmed': ma55_confirmed,
            'description': '日线和60分钟均在MA55上方' if ma55_confirmed else 'MA55位置未确认'
        }
        
        extremely_strong = daily_status == '极强' or weekly_status == '极强'
        action = decision.get('action')
        rationale = decision.get('rationale') or '等待更明确信号'
        if has_execution_bus:
            if action == 'buy':
                decision['decision_type'] = '加仓'
                decision['analysis'] = f"自上而下分析后，日线执行总线给出买入信号。{rationale}"
                decision['action_hint'] = '按 bottom_up 执行，等待次级别触发后分批介入'
            elif action == 'add':
                decision['decision_type'] = '加仓'
                decision['analysis'] = f"自上而下分析后，日线执行总线允许右侧加仓。{rationale}"
                decision['action_hint'] = '按 bottom_up 执行，等待次级别触发后分批加仓'
            elif action in ['sell', 'reduce']:
                decision['decision_type'] = '做T'
                decision['t_type'] = '反T'
                decision['analysis'] = f"自上而下分析后，日线执行总线偏向减仓或反T。{rationale}"
                decision['action_hint'] = '优先减仓锁定利润，等待次级别回补机会'
            elif action == 'hold':
                decision['decision_type'] = '观望'
                decision['analysis'] = f"当前以持仓跟随为主。{rationale}"
                decision['action_hint'] = '维持仓位，等待更清晰的加减仓触发'
            elif action == 'wait':
                decision['decision_type'] = '观望'
                decision['analysis'] = f"当前执行总线要求继续等待。{rationale}"
                decision['action_hint'] = '等待执行总线触发信号后再行动'
            else:
                decision['decision_type'] = '观望'
                decision['analysis'] = f"当前执行总线动作暂不可识别，保守等待。{rationale}"
                decision['action_hint'] = '等待执行总线触发信号后再行动'
        else:
            if extremely_strong and ma55_confirmed:
                decision['decision_type'] = '加仓'
                decision['analysis'] = '极强状态共振！MACD切入极强状态，价格将无视常规结构压制。严禁做反T，立刻加仓！'
                decision['action_hint'] = '极强状态确认，建议加仓，防守位设为60分钟MA55'
            elif major_resonance_up and not micro_divergence and adjustment_qualified and ma55_confirmed:
                decision['decision_type'] = '加仓'
                decision['analysis'] = '大级别共振向上，无微观背离，前期调整质检通过，MA55确认。满足加仓条件。'
                decision['action_hint'] = '建议加仓，防守位设为60分钟MA55'
            elif micro_divergence:
                decision['decision_type'] = '做T'
                decision['t_type'] = '反T'
                decision['analysis'] = f'存在{micro_divergence_type}，偏向反T（先卖后买）。'
                decision['action_hint'] = '利用均线牵引性，急拉触碰MA55时卖出，回落接回'
            elif daily_status in ['弱', '极弱']:
                decision['decision_type'] = '做T'
                decision['t_type'] = '反T'
                decision['analysis'] = f'日线处于{daily_status}状态，适合反T。'
                decision['action_hint'] = '空头排列下只做反T，急拉触碰MA55时卖出，回落接回'
            elif daily_status in ['强', '中偏强'] and daily_ma55_position == 'above':
                decision['decision_type'] = '做T'
                decision['t_type'] = '正T'
                decision['analysis'] = f'日线处于{daily_status}状态，MA55上方，适合正T。'
                decision['action_hint'] = '多头排列下可做正T，利用盘中急跌在次级别结构下轨买入，冲高抛出'
            else:
                decision['decision_type'] = '观望'
                decision['analysis'] = '当前条件不满足做T或加仓，建议观望。'
                decision['action_hint'] = '等待更明确信号'

        if adjustment_qualified:
            resonance_confirmation = '时空共振确认，执行可信度提升'
            confirmations = decision.get('confirmation') or []
            if resonance_confirmation not in confirmations:
                confirmations = list(confirmations) + [resonance_confirmation]
            decision['confirmation'] = confirmations
        
        return decision
    
    def analyze_with_local_data(self, code: str, data: Dict) -> Dict:
        """
        使用本地数据库数据进行分析（推荐方式）
        
        参数：
        - code: 股票代码
        - data: 从数据库获取的数据，格式如下：
            {
                'stock_code': 'sh.600000',
                'stock_name': '浦发银行',
                'periods': {
                    'weekly': [...],  # K线数据列表
                    'daily': [...],
                    'hour60': [...],
                    ...
                }
            }
        
        返回：
        - 完整分析结果字典
        """
        try:
            results = {}
            periods_data = data.get('periods', {})
            analyzed_levels = []
            
            # 处理每个周期的数据
            for level, kline_data in periods_data.items():
                if not kline_data or len(kline_data) == 0:
                    results[level] = {'error': f'无{level}数据'}
                    continue
                
                analyzed_levels.append(level)
                
                # 转换数据格式为 DataFrame
                df = self.convert_to_dataframe(kline_data)
                
                if df is None or len(df) == 0:
                    results[level] = {'error': f'{level}数据格式错误'}
                    continue
                
                # 分析该周期
                results[level] = self.analyze_single_period(df, level)

            self._apply_spacetime_gate_to_results(results)
            
            # 级别嵌套分析
            nesting = self.analyze_level_nesting(results)
            
            self._refresh_trinity_decisions_with_level_nesting(results, nesting)

            # 多维度跨级别操作建议（三个维度）
            multi_dimension_operation = self.analyze_level_operation(results)
            
            self._refresh_trinity_decisions_with_level_nesting(results, nesting)

            # 构建输出结果 - 使用北京时间
            beijing_tz = ZoneInfo('Asia/Shanghai')
            beijing_time = datetime.now(beijing_tz)
            
            result = {
                'stock_code': code,
                'stock_name': data.get('stock_name', ''),
                'analysis_time': beijing_time.strftime('%Y-%m-%d %H:%M:%S'),
                'analyzed_levels': analyzed_levels,
                'periods': results,
                'level_nesting': nesting,
                'multi_dimension_operation': multi_dimension_operation  # 多维度操作建议
            }
            
            return result
            
        except Exception as e:
            return {'error': f'分析过程异常: {str(e)}'}
    
    def convert_to_dataframe(self, kline_data: List[Dict]) -> Optional[pd.DataFrame]:
        """
        将数据库K线数据转换为DataFrame格式
        
        数据库字段映射：
        - date -> date（可能来自 trade_date 或 trade_time）
        - open_price 或 open -> open
        - high_price 或 high -> high
        - low_price 或 low -> low
        - close_price 或 close -> close
        - volume -> volume
        - amount -> amount
        - turnover_rate 或 turn -> turn (可选)
        - pct_chg 或 pctChg -> pctChg (可选)
        - MA5/MA10/MA20/MA55/MA233 -> 均线数据 (可选)
        - macd/macd_signal/macd_hist -> MACD数据 (可选)
        - boll_upper/boll_middle/boll_lower -> 布林带数据 (可选)
        """
        if not kline_data:
            return None
        
        try:
            rows = []
            for item in kline_data:
                row = {
                    'date': item.get('date'),
                    'open': item.get('open'),
                    'high': item.get('high'),
                    'low': item.get('low'),
                    'close': item.get('close'),
                    'volume': item.get('volume'),
                    'amount': item.get('amount'),
                    'turn': item.get('turn'),
                    'pctChg': item.get('pctChg'),
                }
                
                # 转换日期格式（支持多种格式）
                if isinstance(row['date'], str):
                    date_str = row['date']
                    try:
                        # 尝试解析 ISO 格式（带时区，如 2025-02-28T10:30:00+08:00）
                        if 'T' in date_str:
                            # 使用 dateutil 或手动处理
                            # 移除时区后缀后解析
                            import re
                            # 处理 ISO 8601 格式
                            clean_date = re.sub(r'[+-]\d{2}:\d{2}$', '', date_str)
                            clean_date = clean_date.replace('T', ' ')
                            row['date'] = datetime.strptime(clean_date.split('.')[0], '%Y-%m-%d %H:%M:%S')
                        else:
                            # 尝试简单日期格式
                            row['date'] = datetime.strptime(date_str, '%Y-%m-%d')
                    except ValueError:
                        # 尝试其他格式
                        try:
                            row['date'] = datetime.strptime(date_str.split(' ')[0], '%Y-%m-%d')
                        except:
                            row['date'] = datetime.now()
                elif isinstance(row['date'], datetime):
                    pass
                else:
                    row['date'] = datetime.now()
                
                # 确保数值类型
                for col in ['open', 'high', 'low', 'close', 'volume', 'amount']:
                    if row.get(col) is not None:
                        try:
                            row[col] = float(row[col])
                        except (ValueError, TypeError):
                            row[col] = None
                
                # 添加技术指标字段（优先使用已计算的值）
                # 支持大写和小写的字段名
                row['MA5'] = item.get('MA5') or item.get('ma5')
                row['MA10'] = item.get('MA10') or item.get('ma10')
                row['MA20'] = item.get('MA20') or item.get('ma20')
                row['MA55'] = item.get('MA55') or item.get('ma55')
                row['MA233'] = item.get('MA233') or item.get('ma233')
                
                # MACD 字段映射（数据库字段 -> 分析脚本期望的字段名）
                # 数据库: macd=DIF, macd_signal=DEA, macd_hist=MACD柱
                # 脚本期望: DIF, DEA, MACD
                row['DIF'] = item.get('macd')  # 数据库的 macd 字段实际存储的是 DIF
                row['DEA'] = item.get('macd_signal')  # 数据库的 macd_signal 字段实际存储的是 DEA
                row['MACD'] = item.get('macd_hist')  # 数据库的 macd_hist 字段实际存储的是 MACD柱
                
                # 保留原始字段名以兼容
                row['macd'] = item.get('macd')
                row['macd_signal'] = item.get('macd_signal')
                row['macd_hist'] = item.get('macd_hist')
                row['boll_upper'] = item.get('boll_upper')
                row['boll_middle'] = item.get('boll_middle')
                row['boll_lower'] = item.get('boll_lower')
                
                rows.append(row)
            
            df = pd.DataFrame(rows)
            
            # 按日期排序（旧到新）
            df = df.sort_values('date').reset_index(drop=True)
            
            return df
            
        except Exception as e:
            return None

    def analyze(self, code: str, days: int = 1100, levels: List[str] = None) -> Dict:
        """
        执行完整的股票分析
        
        参数：
        - code: 股票代码
        - days: 分析天数（默认1100天，约3年，确保MA233计算充分）
        - levels: 要分析的周期列表，如 ['weekly', 'daily', 'hour60']
        
        返回：
        - 完整分析结果字典
        """
        if levels is None:
            levels = ['daily']  # 默认只分析日线
        
        end_date = datetime.now().strftime('%Y-%m-%d')
        # 确保至少获取足够数据计算MA233（需要至少233个交易日，约330自然日）
        # 默认1100天约等于3年数据，可计算完整的MA233和进行级别嵌套分析
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        if not self.login():
            return {'error': '登录baostock失败'}
        
        try:
            results = {}
            
            # 获取各周期数据并分析
            for level in levels:
                freq = self.FREQUENCY_MAP.get(level, 'd')
                df = self.get_stock_data(code, start_date, end_date, frequency=freq)
                results[level] = self.analyze_single_period(df, level)

            self._apply_spacetime_gate_to_results(results)
            
            # 级别嵌套分析
            nesting = self.analyze_level_nesting(results)

            self._refresh_trinity_decisions_with_level_nesting(results, nesting)
            
            # 构建输出结果 - 使用北京时间
            beijing_tz = ZoneInfo('Asia/Shanghai')
            beijing_time = datetime.now(beijing_tz)
            
            result = {
                'stock_code': code,
                'analysis_time': beijing_time.strftime('%Y-%m-%d %H:%M:%S'),
                'analyzed_levels': levels,
                'periods': results,
                'level_nesting': nesting
            }
            
            return result
            
        except Exception as e:
            return {'error': f'分析过程异常: {str(e)}'}
        finally:
            self.logout()


def main():
    parser = argparse.ArgumentParser(description='三位一体股票分析器（增强版）')
    parser.add_argument('--code', type=str, 
                        help='股票代码（格式：sh.600000 或 sz.000001），--stdin模式下可选')
    parser.add_argument('--days', type=int, default=1500,
                        help='分析天数（默认1500天，约4年，确保周线MA233计算充分）')
    parser.add_argument('--levels', type=str, default='weekly,daily,hour60,hour30,hour15',
                        help='分析周期，多个用逗号分隔，默认分析所有周期')
    parser.add_argument('--stdin', action='store_true',
                        help='从标准输入读取JSON数据进行分析（推荐，数据来自数据库）')
    
    args = parser.parse_args()
    
    analyzer = TrinityStockAnalyzer()
    
    # 从stdin读取数据进行离线分析
    if args.stdin:
        try:
            # 从stdin读取JSON数据
            input_data = sys.stdin.read()
            if not input_data.strip():
                result = {'error': 'stdin数据为空'}
            else:
                data = json.loads(input_data)
                # 从数据中提取股票代码
                code = data.get('stock_code') or args.code
                if not code:
                    result = {'error': '缺少股票代码（请在数据中提供stock_code或使用--code参数）'}
                else:
                    result = analyzer.analyze_with_local_data(code, data)
        except json.JSONDecodeError as e:
            result = {'error': f'JSON解析失败: {str(e)}'}
        except Exception as e:
            result = {'error': f'处理stdin数据失败: {str(e)}'}
    else:
        # 从baostock获取数据进行在线分析（备用模式）
        if not args.code:
            result = {'error': '缺少--code参数（或使用--stdin从数据库获取数据）'}
        else:
            # 解析周期参数
            levels = [l.strip() for l in args.levels.split(',')]
            result = analyzer.analyze(args.code, args.days, levels)
    
    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


if __name__ == '__main__':
    main()
