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
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
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
        result = {
            'structure_type': 'unknown',
            'structure_stage': 'unknown',
            'trend_direction': 'unknown',
            'inflection_points': 0,
            'segment_count': 0,
            'description': '',
            'structure_details': {
                'top_fractals': [],  # 顶分型列表
                'bottom_fractals': [],  # 底分型列表
                'strokes': [],  # 笔列表
                'judgment_criteria': ''  # 判断标准说明
            }
        }
        
        # 如果数据量不足，使用所有可用数据
        actual_lookback = min(lookback, len(df))
        if actual_lookback < 60:
            result['description'] = '数据不足以判断结构'
            result['structure_details']['judgment_criteria'] = '数据不足，需要至少60根K线'
            return result
        
        recent = df.tail(actual_lookback).copy()
        recent = recent.reset_index(drop=True)
        
        # 计算趋势方向
        first_half_mean = recent.head(len(recent)//2)['close'].mean()
        second_half_mean = recent.tail(len(recent)//2)['close'].mean()
        trend_change = (second_half_mean - first_half_mean) / first_half_mean * 100
        
        if trend_change > 5:
            result['trend_direction'] = '上涨'
        elif trend_change < -5:
            result['trend_direction'] = '下跌'
        else:
            result['trend_direction'] = '震荡'
        
        # ============ 新增：有效区间确定 ============
        # 根据 MACD 状态切换和 MA55 破位来确定有效区间
        valid_range = self._find_valid_range(recent)
        
        if valid_range:
            # 截取有效区间内的数据
            start_idx = valid_range['start_idx']
            end_idx = valid_range['end_idx']
            recent = recent.iloc[start_idx:end_idx + 1].copy()
            recent = recent.reset_index(drop=True)
            
            # 存储有效区间信息
            result['structure_details']['valid_range'] = {
                'start_date': valid_range['start_date'],
                'end_date': valid_range['end_date'],
                'start_price': valid_range['start_price'],
                'end_price': valid_range['end_price'],
                'origin_type': valid_range['origin_type'],  # 'high' 或 'low'
                'break_type': valid_range.get('break_type', 'MA55')  # 破位类型
            }
        else:
            # 没有找到有效区间，使用原始数据
            result['structure_details']['valid_range'] = None
        
        # ============ 第一步：处理K线包含关系 ============
        # 缠论包含关系处理：
        # 如果相邻两根K线存在包含关系（一根K线的高低点完全包含在另一根内），
        # 则合并为一根K线，方向与前一根非包含K线相同
        
        def process_containment(df):
            """处理K线包含关系（缠论标准：上涨取高，下跌取低）

            缠论标准规则：
            - 上涨趋势中：合并取 high=max, low=max（保留强势方向）
            - 下跌趋势中：合并取 high=min, low=min（保留弱势方向）
            - 方向由已处理的前两根非包含K线的高低点关系决定
            """
            if len(df) < 3:
                return df

            processed = []
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

                # 判断包含关系
                has_containment = (
                    (curr_high <= prev_high and curr_low >= prev_low) or
                    (prev_high <= curr_high and prev_low >= curr_low)
                )

                if has_containment:
                    # 根据前两根已处理K线判断合并方向
                    # 上涨（前K线高点 > 前前K线高点）：取高（high=max, low=max）
                    # 下跌（前K线高点 < 前前K线高点）：取低（high=min, low=min）
                    if len(processed) >= 2:
                        prev_prev = processed[-2]
                        is_up = prev_high >= prev_prev['high']
                    else:
                        # 仅有一根已处理K线，默认按上涨处理（取大）
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
        
        # 处理包含关系后的K线
        processed_df = process_containment(recent)
        
        # ============ 第二步：识别顶底分型 ============
        # 缠论标准定义：
        # 顶分型：三根K线中，中间K线的高点最高，低点也最高（相对左右两根）
        # 底分型：三根K线中，中间K线的低点最低，高点也最低（相对左右两根）
        top_fractals = []  # 存储顶分型
        bottom_fractals = []  # 存储底分型
        
        for i in range(1, len(processed_df) - 1):
            prev_high = processed_df.iloc[i-1]['high']
            curr_high = processed_df.iloc[i]['high']
            next_high = processed_df.iloc[i+1]['high']
            prev_low = processed_df.iloc[i-1]['low']
            curr_low = processed_df.iloc[i]['low']
            next_low = processed_df.iloc[i+1]['low']
            
            # 顶分型：中间K线高点最高，且低点比左右两根K线的低点都高
            if curr_high > prev_high and curr_high > next_high:
                if curr_low > prev_low and curr_low > next_low:
                    top_fractals.append({
                        'index': i,
                        'date': processed_df.iloc[i].get('date', str(i)),
                        'high': curr_high,
                        'low': curr_low,
                        'type': 'top'
                    })
            
            # 底分型：中间K线低点最低，且高点比左右两根K线的高点都低
            if curr_low < prev_low and curr_low < next_low:
                if curr_high < prev_high and curr_high < next_high:
                    bottom_fractals.append({
                        'index': i,
                        'date': processed_df.iloc[i].get('date', str(i)),
                        'high': curr_high,
                        'low': curr_low,
                        'type': 'bottom'
                    })
        
        # 存储分型信息
        result['structure_details']['top_fractals'] = [
            {'index': f['index'], 'date': f['date'], 'high': round(f['high'], 2)} 
            for f in top_fractals[-10:]  # 只保留最近10个
        ]
        result['structure_details']['bottom_fractals'] = [
            {'index': f['index'], 'date': f['date'], 'low': round(f['low'], 2)} 
            for f in bottom_fractals[-10:]
        ]
        
        # ============ 第二步：合并相邻的同类型分型，并验证有效性 ============
        # 合并所有分型，按时间排序
        all_fractals = []
        for f in top_fractals:
            all_fractals.append({**f, 'type': 'top'})
        for f in bottom_fractals:
            all_fractals.append({**f, 'type': 'bottom'})
        all_fractals.sort(key=lambda x: x['index'])
        
        # 过滤相邻的同类型分型，保留更极端的
        # 同时验证分型的有效性：顶分型高点 > 前一个底分型低点，底分型低点 < 前一个顶分型高点
        filtered_fractals = []
        for f in all_fractals:
            if not filtered_fractals:
                filtered_fractals.append(f)
            else:
                last = filtered_fractals[-1]
                if last['type'] == f['type']:
                    # 同类型，保留更极端的
                    if f['type'] == 'top':
                        # 保留高点更高的
                        if f['high'] > last['high']:
                            filtered_fractals[-1] = f
                    else:
                        # 保留低点更低的
                        if f['low'] < last['low']:
                            filtered_fractals[-1] = f
                else:
                    # 不同类型，需要验证有效性
                    if f['type'] == 'top':
                        # 顶分型的高点必须高于前一个底分型的低点
                        if f['high'] > last['low']:
                            filtered_fractals.append(f)
                    else:
                        # 底分型的低点必须低于前一个顶分型的高点
                        if f['low'] < last['high']:
                            filtered_fractals.append(f)
        
        all_fractals = filtered_fractals
        
        # ============ 第三步：构建笔（使用迭代合并算法）============
        
        # 过滤无效的笔：相邻分型必须是顶底交替，且至少间隔3根K线
        # 使用迭代合并策略：当相邻分型间隔太近时，保留更极端的分型
        
        def build_strokes_iterative(fractals):
            """
            迭代构建笔，使用缠论标准算法：
            1. 相邻分型间隔必须 >= 3
            2. 如果间隔太近，保留更极端的分型（顶分型留高点更高的，底分型留低点更低的）
            3. 重复检查直到稳定
            """
            if len(fractals) < 2:
                return fractals
            
            # 持续迭代直到稳定
            changed = True
            while changed:
                changed = False
                result = [fractals[0]]
                
                for i in range(1, len(fractals)):
                    current = fractals[i]
                    last = result[-1]
                    
                    if current['type'] == last['type']:
                        # 同类型，保留更极端的
                        if current['type'] == 'top':
                            if current['high'] > last['high']:
                                result[-1] = current
                                changed = True
                        else:
                            if current['low'] < last['low']:
                                result[-1] = current
                                changed = True
                    else:
                        # 不同类型，检查间隔
                        gap = current['index'] - last['index']
                        
                        if gap >= 3:
                            # 检查方向有效性
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
                                # 方向无效，保留更极端的
                                if current['type'] == 'top':
                                    if current['high'] > last['high']:
                                        result[-1] = current
                                        changed = True
                                else:
                                    if current['low'] < last['low']:
                                        result[-1] = current
                                        changed = True
                        else:
                            # 间隔太近（gap < 3），不同类型
                            # 缠论规则：相邻异类分型不能构成有效笔，保留旧分型（last），跳过新分型（current）
                            # 错误做法：用新分型替换旧分型（会导致重要极值点如高点209.88被错误丢弃）
                            pass  # 直接跳过 current，保留 last
                
                fractals = result
            
            return result
        
        # 执行迭代构建
        final_fractals = build_strokes_iterative(all_fractals)
        
        # 从最终分型构建笔
        strokes = []
        valid_fractals = []
        
        # 相邻的顶底分型形成一笔
        for i in range(len(final_fractals) - 1):
            from_f = final_fractals[i]
            to_f = final_fractals[i + 1]
            
            # 确保是顶底交替
            if from_f['type'] != to_f['type']:
                strokes.append({
                    'from': from_f,
                    'to': to_f,
                    'length': to_f['index'] - from_f['index']
                })
                if i == 0:
                    valid_fractals.append(from_f)
                valid_fractals.append(to_f)
        
        # 存储笔信息 - 使用更合理的价格比较判断方向
        stroke_list = []
        for s in strokes[-15:]:
            from_type = s['from']['type']
            to_type = s['to']['type']
            
            # 根据分型类型确定起止价格
            # 关键改进：对于笔的起点和终点，应该比较的是"关键价格点"
            # 顶分型：关注高点（最高点）
            # 底分型：关注低点（最低点）
            
            if from_type == 'top':
                # 从顶分型开始，起点用高点
                from_price = s['from']['high']
            else:
                # 从底分型开始，起点用低点
                from_price = s['from']['low']
            
            if to_type == 'top':
                # 到顶分型结束，终点用高点
                to_price = s['to']['high']
            else:
                # 到底分型结束，终点用低点
                to_price = s['to']['low']
            
            # 根据实际价格变化判断方向
            # 但需要考虑：如果从顶到底，但终点低点 > 起点高点，说明这个底分型无效
            # 如果从底到顶，但终点高点 < 起点低点，说明这个顶分型无效
            # 这些情况应该在之前的验证中已经过滤，这里只是双重检查
            
            if to_price > from_price:
                direction = '上涨'
            else:
                direction = '下跌'
            
            # 双重检查：验证方向与分型类型的一致性
            # 从顶分型到顶分型，应该是下跌笔（to_price < from_price）
            # 从底分型到顶分型，应该是上涨笔（to_price > from_price）
            if from_type == 'top' and to_type == 'bottom' and direction == '上涨':
                # 异常：从顶到底却判断为上涨，说明这个底分型有问题
                # 尝试使用底分型的高点来比较
                to_price_alt = s['to']['high']
                if to_price_alt < from_price:
                    direction = '下跌'
                    to_price = to_price_alt
            
            if from_type == 'bottom' and to_type == 'top' and direction == '下跌':
                # 异常：从底到顶却判断为下跌，说明这个顶分型有问题
                # 尝试使用顶分型的低点来比较
                to_price_alt = s['to']['low']
                if to_price_alt > from_price:
                    direction = '上涨'
                    to_price = to_price_alt
            
            stroke_list.append({
                'from_date': s['from'].get('date', str(s['from']['index'])),
                'to_date': s['to'].get('date', str(s['to']['index'])),
                'from_price': round(from_price, 2),
                'to_price': round(to_price, 2),
                'direction': direction,
                'length': s['length'],
                'from_type': s['from']['type'],  # 顶分型或底分型
                'to_type': s['to']['type']
            })
        
        # 重新构建 valid_fractals，确保与 stroke_list 一致
        # valid_fractals 应该只包含 stroke_list 中出现的分型
        valid_fractals_for_current = []
        if stroke_list:
            # 获取 stroke_list 对应的原始 strokes
            start_idx = len(strokes) - len(stroke_list)
            # 第一笔的起点
            if start_idx >= 0 and start_idx < len(strokes):
                valid_fractals_for_current.append(strokes[start_idx]['from'])
            # 每一笔的终点
            for s in strokes[start_idx:]:
                valid_fractals_for_current.append(s['to'])
        
        # ============ 检查是否需要添加"当前进行中的笔" ============
        # 如果最后一笔的结束点不是最新的K线，需要添加一个未完成的笔
        # 注意：这里使用 processed_df 因为分型是基于处理后的K线识别的
        if valid_fractals_for_current and len(processed_df) > 0:
            last_valid = valid_fractals_for_current[-1]
            last_kline = processed_df.iloc[-1]
            last_kline_index = len(processed_df) - 1
            
            # 调试日志已移除
            
            # 如果最后一个拐点不是最后一根K线
            if last_valid['index'] < last_kline_index:
                # 获取最新K线的价格
                latest_high = last_kline['high']
                latest_low = last_kline['low']
                latest_close = last_kline['close']
                latest_date = last_kline.get('date', str(last_kline_index))
                
                # 根据最后一个拐点的类型，确定起点价格
                # 缠论规则：进行中的笔应该延伸到当前K线的极值点
                if last_valid['type'] == 'top':
                    # 顶分型，起点用高点
                    from_price = last_valid['high']
                    
                    # 判断价格走势方向
                    if latest_close < from_price:
                        # 价格确实下跌，画下跌笔到最低点（使用最低价更准确）
                        stroke_list.append({
                            'from_date': last_valid.get('date', str(last_valid['index'])),
                            'to_date': latest_date,
                            'from_price': round(from_price, 2),
                            'to_price': round(latest_low, 2),  # 使用最低价
                            'direction': '下跌',
                            'length': last_kline_index - last_valid['index'],
                            'from_type': last_valid['type'],
                            'to_type': 'current',
                            'is_current': True
                        })
                    else:
                        # 价格上涨超过顶分型高点，顶分型可能无效
                        # 需要回溯到上一个底分型，画上涨笔到最高点
                        if len(valid_fractals_for_current) >= 2:
                            prev_valid = valid_fractals_for_current[-2]
                            if prev_valid['type'] == 'bottom':
                                # 移除最后一笔（因为它以可能无效的顶分型结束）
                                if stroke_list and stroke_list[-1].get('to_type') == 'top':
                                    stroke_list.pop()
                                
                                # 从上一个底分型开始添加上涨笔
                                from_price = prev_valid['low']
                                stroke_list.append({
                                    'from_date': prev_valid.get('date', str(prev_valid['index'])),
                                    'to_date': latest_date,
                                    'from_price': round(from_price, 2),
                                    'to_price': round(latest_high, 2),  # 使用最高价
                                    'direction': '上涨',
                                    'length': last_kline_index - prev_valid['index'],
                                    'from_type': prev_valid['type'],
                                    'to_type': 'current',
                                    'is_current': True
                                })
                        else:
                            # 没有前一个拐点，直接从顶分型画上涨笔（这种情况较少见）
                            stroke_list.append({
                                'from_date': last_valid.get('date', str(last_valid['index'])),
                                'to_date': latest_date,
                                'from_price': round(from_price, 2),
                                'to_price': round(latest_high, 2),
                                'direction': '上涨',
                                'length': last_kline_index - last_valid['index'],
                                'from_type': last_valid['type'],
                                'to_type': 'current',
                                'is_current': True
                            })
                else:
                    # 底分型，起点用低点
                    from_price = last_valid['low']
                    
                    # 判断价格走势方向
                    if latest_close > from_price:
                        # 价格确实上涨，画上涨笔到最高点（使用最高价更准确）
                        stroke_list.append({
                            'from_date': last_valid.get('date', str(last_valid['index'])),
                            'to_date': latest_date,
                            'from_price': round(from_price, 2),
                            'to_price': round(latest_high, 2),  # 使用最高价
                            'direction': '上涨',
                            'length': last_kline_index - last_valid['index'],
                            'from_type': last_valid['type'],
                            'to_type': 'current',
                            'is_current': True
                        })
                    else:
                        # 价格继续下跌，底分型可能无效
                        # 需要回溯到上一个顶分型，画下跌笔到最低点
                        if len(valid_fractals_for_current) >= 2:
                            prev_valid = valid_fractals_for_current[-2]
                            if prev_valid['type'] == 'top':
                                # 移除最后一笔（因为它以可能无效的底分型结束）
                                if stroke_list and stroke_list[-1].get('to_type') == 'bottom':
                                    stroke_list.pop()
                                
                                # 从上一个顶分型开始添加下跌笔
                                from_price = prev_valid['high']
                                stroke_list.append({
                                    'from_date': prev_valid.get('date', str(prev_valid['index'])),
                                    'to_date': latest_date,
                                    'from_price': round(from_price, 2),
                                    'to_price': round(latest_low, 2),  # 使用最低价
                                    'direction': '下跌',
                                    'length': last_kline_index - prev_valid['index'],
                                    'from_type': prev_valid['type'],
                                    'to_type': 'current',
                                    'is_current': True
                                })
                        else:
                            # 没有前一个拐点，直接从底分型画下跌笔（这种情况较少见）
                            stroke_list.append({
                                'from_date': last_valid.get('date', str(last_valid['index'])),
                                'to_date': latest_date,
                                'from_price': round(from_price, 2),
                                'to_price': round(latest_low, 2),
                                'direction': '下跌',
                                'length': last_kline_index - last_valid['index'],
                                'from_type': last_valid['type'],
                                'to_type': 'current',
                                'is_current': True
                            })
        
        result['structure_details']['strokes'] = stroke_list
        
        # 更新统计
        stroke_count = len(strokes)
        inflection_count = len(valid_fractals)
        result['segment_count'] = stroke_count
        result['inflection_points'] = inflection_count
        
        # ============ 第三步：箱体聚类合并（Price Clustering）============
        # 将机械的多笔聚类成宏观组件（平台/连接段）
        # 解决量化系统"死板"问题：让走势从"机械的13笔"蜕变成"宏观的3大段"
        
        judgment_criteria = []
        judgment_criteria.append(f"识别到 {len(top_fractals)} 个顶分型，{len(bottom_fractals)} 个底分型")
        judgment_criteria.append(f"过滤后得到 {stroke_count} 笔，{inflection_count} 个拐点")
        
        # 获取有效区间信息
        valid_range_info = result['structure_details'].get('valid_range')
        if valid_range_info:
            judgment_criteria.append(f"有效区间: {valid_range_info['start_date']} ~ {valid_range_info['end_date']}")
            judgment_criteria.append(f"原点类型: {'高点' if valid_range_info['origin_type'] == 'high' else '低点'}")
        
        # 执行箱体聚类
        macro_components = self._consolidate_boxes(stroke_list, threshold=0.55)
        
        # 存储聚类结果
        result['structure_details']['macro_components'] = [mc.to_dict() for mc in macro_components]
        judgment_criteria.append(f"聚类算法: 将 {stroke_count} 笔聚类为 {len(macro_components)} 个宏观组件")
        
        # ============ 第四步：基于宏观组件分类结构类型 ============
        # 核心逻辑：
        # - 1个组件 = C类（单平台）或 D类（单边）
        # - 2个组件 = B类（双平台）或 A类（趋势启动/突破）
        # - 3个组件 = B类（平台+连接+平台）或 A类（趋势中继）
        
        if macro_components:
            # 使用聚类算法分类
            structure_type, structure_stage, description, extra_criteria = \
                self._classify_structure_by_macro_components(macro_components, result['trend_direction'])
            
            result['structure_type'] = structure_type
            result['structure_stage'] = structure_stage
            result['description'] = description
            judgment_criteria.extend(extra_criteria)
        else:
            # 聚类失败，使用原始笔数判断（兜底逻辑）
            judgment_criteria.append("⚠️ 聚类算法失败，使用原始笔数判断")
        
        # ============ 峰值切片分析（Peak Slicing）============
        # 当走势跨度较长（>=4个组件），检测是否存在"山峰/山谷"形态
        # 核心逻辑：以全局最高点/最低点为界，将走势劈成两半，分别识别结构
        
        peak_analysis = self._analyze_peak_structure(stroke_list, macro_components)
        
        if peak_analysis['is_peak_structure']:
            # 存储峰值分析结果
            result['structure_details']['peak_analysis'] = peak_analysis
            
            # ============ 关键优化：战术层面聚焦右半部分 ============
            # 根据Gemini建议：
            # - 战术层面：聚焦右半部分，按右半部分的结构类型执行操作
            # - 战略层面：左半部分作为风险警示（下跌中继平台一旦破位，杀伤力极大）
            
            # 使用右半部分的结构类型作为当前操作依据
            right_structure_type = peak_analysis['right_structure']
            result['structure_type'] = right_structure_type
            result['structure_stage'] = f"峰值{peak_analysis['peak_price']:.2f}后{right_structure_type}"
            
            # ============ 构建左侧风险警示（战略层面）============
            left_structure_warning = None
            if peak_analysis['peak_type'] == 'mountain_peak':
                # 山峰形态：右侧是下跌结构，左侧上涨结构作为风险警示
                left_structure_warning = {
                    'type': 'mountain_peak_left',
                    'title': '⚠️ 左侧风险警示',
                    'left_structure': peak_analysis['left_structure'],
                    'peak_price': peak_analysis['peak_price'],
                    'warning': '这是"下跌中继平台"，不是底！',
                    'risk_description': f'左侧曾有{peak_analysis["left_structure"]}上涨至{peak_analysis["peak_price"]:.2f}，'
                                        f'一旦右侧{right_structure_type}破位，下方将出现巨大真空区，杀跌速度会极其迅猛。',
                    'key_defense': '绝对防守底线：右侧平台下轨',
                    'action_hint': '破位无条件清仓，绝不扛单'
                }
            else:
                # 山谷形态：右侧是上涨结构，左侧下跌结构作为机会提示
                left_structure_warning = {
                    'type': 'valley_bottom_left',
                    'title': '💡 左侧机会提示',
                    'left_structure': peak_analysis['left_structure'],
                    'valley_price': peak_analysis['peak_price'],
                    'opportunity': '这是"上涨中继平台"，有继续上涨潜力！',
                    'opportunity_description': f'左侧经历{peak_analysis["left_structure"]}下跌至{peak_analysis["peak_price"]:.2f}后反弹，'
                                                f'右侧{right_structure_type}若突破上方压力，上方空间可能打开。',
                    'key_resistance': '关键阻力位：右侧平台上轨',
                    'action_hint': '突破可加仓，失败则减仓观望'
                }
            
            result['structure_details']['left_structure_warning'] = left_structure_warning
            
            # 构建详细的判断依据
            peak_type_name = '山峰' if peak_analysis['peak_type'] == 'mountain_peak' else '山谷'
            left_comp_summary = []
            for mc in peak_analysis['left_components']:
                left_comp_summary.append(f"{mc['type']}({len(mc['strokes'])}笔)")
            right_comp_summary = []
            for mc in peak_analysis['right_components']:
                right_comp_summary.append(f"{mc['type']}({len(mc['strokes'])}笔)")
            
            judgment_criteria.append(f"")
            judgment_criteria.append(f"📊 峰值切片分析：")
            judgment_criteria.append(f"极值点: {peak_analysis['peak_price']:.2f} ({peak_type_name})")
            judgment_criteria.append(f"左侧结构: {peak_analysis['left_structure']} ({' → '.join(left_comp_summary) if left_comp_summary else '未完成'})")
            judgment_criteria.append(f"右侧结构: {peak_analysis['right_structure']} ({' → '.join(right_comp_summary) if right_comp_summary else '未完成'})")
            
            # 根据峰值类型给出操作建议
            if peak_analysis['peak_type'] == 'mountain_peak':
                judgment_criteria.append(f"")
                judgment_criteria.append(f"⚔️ 战术层面：聚焦右侧{right_structure_type}，按该结构执行操作")
                judgment_criteria.append(f"🚨 战略警示：左侧上涨已过，当前是下跌中继平台")
                judgment_criteria.append(f"💡 操作要点：破位即清仓，绝不扛单")
            else:
                judgment_criteria.append(f"")
                judgment_criteria.append(f"⚔️ 战术层面：聚焦右侧{right_structure_type}，按该结构执行操作")
                judgment_criteria.append(f"🌟 战略提示：左侧下跌已结束，当前是上涨中继平台")
                judgment_criteria.append(f"💡 操作要点：突破可加仓，失败则减仓")
            
            result['description'] = f"{right_structure_type}（峰值切片：{peak_analysis['description']}）"
        
        # ============ 兜底逻辑：基于原始笔数的分类（当聚类失败时）============
        if result['structure_type'] == 'unknown' or not macro_components:
            # 原始的分类逻辑作为兜底
            if stroke_count == 3:
                # D类：3笔4拐点
                result['structure_type'] = 'D三段式'
                result['structure_stage'] = 'd1-d4拐点区间'
                result['description'] = f"D三段式结构，{stroke_count}笔{inflection_count}拐点"
                judgment_criteria.append("✅ D类结构（兜底）：笔数=3")
            
            elif stroke_count == 5:
                # A类或C类
                result['structure_type'] = 'C单平台式'
                result['structure_stage'] = 'c1-c6拐点区间'
                result['description'] = f"单平台结构，{stroke_count}笔{inflection_count}拐点"
                judgment_criteria.append("✅ C类结构（兜底）：笔数=5")
            
            elif stroke_count == 9:
                # B类
                result['structure_type'] = 'B双平台式'
                result['structure_stage'] = 'b1-b10拐点区间'
                result['description'] = f"B双平台式结构，{stroke_count}笔{inflection_count}拐点"
                judgment_criteria.append("✅ B类结构（兜底）：笔数=9")
            
            elif stroke_count < 3:
                result['structure_type'] = '结构未完成'
                result['structure_stage'] = f'{inflection_count}个拐点'
                result['description'] = f"结构未完成，{stroke_count}笔"
                judgment_criteria.append(f"⚠️ 笔数={stroke_count} < 3，结构未完成")
            
            elif stroke_count in [4, 6, 7, 8]:
                result['structure_type'] = '延伸结构'
                result['structure_stage'] = f'{inflection_count}个拐点'
                result['description'] = f"延伸结构，{stroke_count}笔，建议升维分析"
                judgment_criteria.append(f"⚠️ 笔数={stroke_count}，非标准结构，建议升维分析")
            
            else:
                result['structure_type'] = '复杂结构'
                result['structure_stage'] = f'{inflection_count}个拐点'
                result['description'] = f"复杂结构，{stroke_count}笔，需人工确认"
                judgment_criteria.append(f"⚠️ 笔数={stroke_count}，结构复杂")
        
        result['description'] = f"识别为{result['structure_type']}，{result['trend_direction']}趋势"
        result['structure_details']['judgment_criteria'] = '\n'.join(judgment_criteria)
        
        # ============ 第五步：添加预测性分析 ============
        # 根据当前结构阶段，提供预测性提醒
        prediction = self._analyze_structure_prediction(
            result['structure_type'], 
            stroke_count, 
            inflection_count,
            stroke_list,  # 使用处理后的笔列表（包含方向信息）
            valid_fractals,
            result['trend_direction'],
            recent,
            macd_status  # 传递MACD状态用于判断d3不稳定点
        )
        result['structure_details']['prediction'] = prediction
        
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
            
            if inflection_count >= 3:
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
                
            elif inflection_count >= 4:
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
        
        # 安全获取pctChg（分钟级别可能没有此字段）
        pct_chg = None
        if 'pctChg' in df.columns and pd.notna(latest.get('pctChg')):
            pct_chg = round(latest['pctChg'], 2)
        
        # 收集所有重点提醒
        # 注意：不包含 breakthrough.alerts，因为突破形态已有单独展示区域
        all_alerts = []
        all_alerts.extend(ma_physics.get('alerts', []))
        
        return {
            'period': period_name,
            'analysis_date': latest['date'].strftime('%Y-%m-%d %H:%M') if pd.notna(latest['date']) else None,
            'latest_price': round(latest['close'], 2),
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
        trading_decision = self.analyze_trading_decision(results)
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

    def analyze_trading_decision(self, results: Dict) -> Dict:
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
            'action_hint': ''
        }
        
        weekly = results.get('weekly', {})
        daily = results.get('daily', {})
        hour60 = results.get('hour60', {})
        hour30 = results.get('hour30', {})
        hour15 = results.get('hour15', {})
        
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
        # 获取时空确认结果
        spacetime = results.get('nesting_analysis', {}).get('spacetime_confirmation', {})
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
        
        # ============ 决策判断 ============
        
        # 极强状态共振：日线或周线MACD零轴附近金叉，切入极强状态
        extremely_strong = daily_status == '极强' or weekly_status == '极强'
        
        # 判断决策类型
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
            
            # 级别嵌套分析
            nesting = self.analyze_level_nesting(results)
            
            # 多维度跨级别操作建议（三个维度）
            multi_dimension_operation = self.analyze_level_operation(results)
            
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
            
            # 级别嵌套分析
            nesting = self.analyze_level_nesting(results)
            
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
