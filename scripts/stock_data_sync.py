#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
股票数据同步脚本（增强版）

功能：
1. 获取多周期K线数据（日线、周线、月线、60分钟、30分钟、15分钟、5分钟）
2. 计算技术指标（MA、MACD、布林带）
3. 支持增量同步和全量同步
4. 输出 JSON 格式数据

使用方法：
python stock_data_sync.py kline sz.000001 2020-01-01 2025-01-01 d
python stock_data_sync.py sync sz.000001 --days 1825 --freqs d,w,60
"""

import argparse
import json
import sys
import io
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple

import numpy as np
import pandas as pd

try:
    import baostock as bs
except ImportError:
    print(json.dumps({"success": False, "error": "未安装baostock，请执行 pip install baostock"}))
    sys.exit(1)


class StockDataSync:
    """股票数据同步器"""
    
    # 频率映射
    FREQUENCY_MAP = {
        'd': 'd',      # 日线
        'w': 'w',      # 周线
        'm': 'm',      # 月线
        '5': '5',      # 5分钟
        '15': '15',    # 15分钟
        '30': '30',    # 30分钟
        '60': '60',    # 60分钟
    }
    
    # 分钟级别周期
    MINUTE_FREQUENCIES = ['5', '15', '30', '60']
    
    def __init__(self):
        self._suppress_baostock_output()
    
    def _suppress_baostock_output(self):
        """抑制 baostock 的输出"""
        self._original_stdout = sys.stdout
        self._original_stderr = sys.stderr
    
    def _login(self) -> bool:
        """登录 baostock（抑制输出）"""
        try:
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
            lg = bs.login()
            sys.stdout = self._original_stdout
            sys.stderr = self._original_stderr
            return lg.error_code == '0'
        except Exception as e:
            sys.stdout = self._original_stdout
            sys.stderr = self._original_stderr
            return False
    
    def _logout(self):
        """登出 baostock（抑制输出）"""
        try:
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
            bs.logout()
            sys.stdout = self._original_stdout
            sys.stderr = self._original_stderr
        except:
            sys.stdout = self._original_stdout
            sys.stderr = self._original_stderr
    
    def format_stock_code(self, code: str) -> Tuple[str, str]:
        """
        将股票代码转换为 baostock 格式
        
        Returns:
            (baostock_code, pure_code)
        """
        code = code.strip().upper()
        
        # 已经是 baostock 格式
        if code.startswith('SH.') or code.startswith('SZ.'):
            return code.lower(), code[3:]
        
        if code.startswith('sh.') or code.startswith('sz.'):
            return code, code[3:].upper()
        
        # 港股格式
        if code.endswith('.HK'):
            return f"hk.{code.replace('.HK', '')}", code.replace('.HK', '')
        
        # A股代码判断
        pure_code = code.split('.')[0]
        
        # 上海市场: 6开头
        if pure_code.startswith('6'):
            return f"sh.{pure_code}", pure_code
        # 深圳市场: 0、3开头
        elif pure_code.startswith('0') or pure_code.startswith('3'):
            return f"sz.{pure_code}", pure_code
        else:
            return f"sz.{pure_code}", pure_code
    
    def get_kline_data(
        self,
        code: str,
        start_date: str,
        end_date: str,
        frequency: str = 'd',
        adjustflag: str = '2'  # 2=前复权
    ) -> Dict[str, Any]:
        """
        获取 K 线数据并计算技术指标
        
        Args:
            code: 股票代码
            start_date: 开始日期 YYYY-MM-DD
            end_date: 结束日期 YYYY-MM-DD
            frequency: 周期 d/w/m/5/15/30/60
            adjustflag: 复权类型 1=后复权 2=前复权 3=不复权
        
        Returns:
            包含 K 线数据和技术指标的字典
        """
        if not self._login():
            return {"success": False, "error": "登录 baostock 失败"}
        
        try:
            bs_code, pure_code = self.format_stock_code(code)
            bs_freq = self.FREQUENCY_MAP.get(frequency, 'd')
            is_minute = frequency in self.MINUTE_FREQUENCIES
            
            # 选择字段
            if is_minute:
                fields = "date,time,code,open,high,low,close,volume,amount"
            else:
                fields = "date,code,open,high,low,close,volume,amount,turn,pctChg"
            
            # 查询数据
            rs = bs.query_history_k_data_plus(
                bs_code,
                fields,
                start_date=start_date,
                end_date=end_date,
                frequency=bs_freq,
                adjustflag=adjustflag
            )
            
            if rs.error_code != '0':
                return {"success": False, "error": f"查询失败: {rs.error_msg}"}
            
            # 收集数据
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                return {"success": False, "error": "未查询到数据"}
            
            # 创建 DataFrame
            if is_minute:
                df = pd.DataFrame(data_list, columns=["date", "time", "code", "open", "high", "low", "close", "volume", "amount"])
                # 解析时间
                df['date'] = pd.to_datetime(df['time'], format='%Y%m%d%H%M%S%f')
                df = df.drop(columns=['time'])
            else:
                df = pd.DataFrame(data_list, columns=["date", "code", "open", "high", "low", "close", "volume", "amount", "turn", "pctChg"])
                df['date'] = pd.to_datetime(df['date'])
            
            # 类型转换
            numeric_cols = ['open', 'high', 'low', 'close', 'volume', 'amount']
            if not is_minute:
                numeric_cols.extend(['turn', 'pctChg'])
            
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # 分钟级别添加空白列
            if is_minute:
                df['turn'] = np.nan
                df['pctChg'] = np.nan
            
            # 排序
            df = df.sort_values('date').reset_index(drop=True)
            
            # 计算技术指标
            df = self._calculate_indicators(df)
            
            # 格式化日期
            if is_minute:
                df['date'] = df['date'].dt.strftime('%Y-%m-%d %H:%M')
            else:
                df['date'] = df['date'].dt.strftime('%Y-%m-%d')
            
            # 替换 NaN 为 None
            df = df.replace({np.nan: None})
            
            # 转换为记录列表
            kline = df.to_dict(orient='records')
            
            return {
                "success": True,
                "data": {
                    "code": pure_code,
                    "bsCode": bs_code,
                    "frequency": frequency,
                    "count": len(kline),
                    "start_date": start_date,
                    "end_date": end_date,
                    "kline": kline
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            self._logout()
    
    def _calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算技术指标
        
        P0修复：min_periods 使用与 window 相同的值
        历史数据不足时返回 NaN，而不是生成"伪完整"指标值
        这样可以避免分析时误用不准确的均线数据
        """
        df = df.copy()
        
        # 均线 - min_periods 与 window 相同，数据不足时返回 NaN
        df['ma5'] = df['close'].rolling(window=5, min_periods=5).mean().round(4)
        df['ma10'] = df['close'].rolling(window=10, min_periods=10).mean().round(4)
        df['ma20'] = df['close'].rolling(window=20, min_periods=20).mean().round(4)
        df['ma55'] = df['close'].rolling(window=55, min_periods=55).mean().round(4)
        df['ma233'] = df['close'].rolling(window=233, min_periods=233).mean().round(4)
        
        # MACD
        macd = self._calculate_macd(df['close'])
        df['macd'] = macd['macd']
        df['macd_signal'] = macd['signal']
        df['macd_hist'] = macd['hist']
        
        # 布林带 - min_periods=20 确保有足够数据计算标准差
        boll = self._calculate_boll(df['close'])
        df['boll_upper'] = boll['upper']
        df['boll_middle'] = boll['middle']
        df['boll_lower'] = boll['lower']
        
        return df
    
    def _calculate_macd(
        self,
        close: pd.Series,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> Dict[str, pd.Series]:
        """计算 MACD 指标"""
        ema_fast = close.ewm(span=fast, adjust=False).mean()
        ema_slow = close.ewm(span=slow, adjust=False).mean()
        
        macd = ema_fast - ema_slow
        signal_line = macd.ewm(span=signal, adjust=False).mean()
        hist = (macd - signal_line) * 2
        
        return {
            'macd': macd.round(6),
            'signal': signal_line.round(6),
            'hist': hist.round(6)
        }
    
    def _calculate_boll(
        self,
        close: pd.Series,
        period: int = 20,
        std_dev: int = 2
    ) -> Dict[str, pd.Series]:
        """计算布林带指标
        
        P0修复：min_periods=period，数据不足时返回 NaN
        """
        middle = close.rolling(window=period, min_periods=period).mean()
        std = close.rolling(window=period, min_periods=period).std()
        
        upper = middle + std_dev * std
        lower = middle - std_dev * std
        
        return {
            'upper': upper.round(4),
            'middle': middle.round(4),
            'lower': lower.round(4)
        }
    
    def get_stock_info(self, code: str) -> Dict[str, Any]:
        """获取股票基本信息"""
        if not self._login():
            return {"success": False, "error": "登录 baostock 失败"}
        
        try:
            bs_code, pure_code = self.format_stock_code(code)
            
            rs = bs.query_stock_basic_by_code(code=bs_code)
            
            if rs.error_code != '0':
                return {"success": False, "error": f"查询失败: {rs.error_msg}"}
            
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                return {
                    "success": True,
                    "data": {
                        "code": pure_code,
                        "bsCode": bs_code,
                        "name": "",
                        "market": "sh" if bs_code.startswith("sh") else "sz",
                    }
                }
            
            row = data_list[0]
            return {
                "success": True,
                "data": {
                    "code": pure_code,
                    "bsCode": bs_code,
                    "name": row[3] if len(row) > 3 else "",
                    "market": "sh" if bs_code.startswith("sh") else "sz",
                    "listDate": row[6] if len(row) > 6 else None,
                    "status": row[9] if len(row) > 9 else "上市",
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            self._logout()
    
    def sync_multiple_frequencies(
        self,
        code: str,
        frequencies: List[str],
        days: int = 1825
    ) -> Dict[str, Any]:
        """同步多个周期的数据"""
        results = {}
        end_date = datetime.now().strftime('%Y-%m-%d')
        
        for freq in frequencies:
            # 分钟级别限制天数
            actual_days = min(days, 365) if freq in self.MINUTE_FREQUENCIES else days
            start_date = (datetime.now() - timedelta(days=actual_days)).strftime('%Y-%m-%d')
            
            result = self.get_kline_data(code, start_date, end_date, freq)
            results[freq] = {
                "success": result.get("success", False),
                "count": result.get("data", {}).get("count", 0),
                "error": result.get("error")
            }
        
        # 获取股票信息
        info_result = self.get_stock_info(code)
        
        return {
            "success": True,
            "data": {
                "code": code,
                "frequencies": results,
                "info": info_result.get("data") if info_result.get("success") else None
            }
        }


def main():
    parser = argparse.ArgumentParser(description='股票数据同步脚本')
    parser.add_argument('action', choices=['kline', 'info', 'sync'], help='操作类型')
    parser.add_argument('code', help='股票代码')
    parser.add_argument('start_date', nargs='?', help='开始日期')
    parser.add_argument('end_date', nargs='?', help='结束日期')
    parser.add_argument('frequency', nargs='?', default='d', help='数据周期')
    parser.add_argument('--days', type=int, default=1825, help='同步天数')
    parser.add_argument('--freqs', type=str, default='d', help='周期列表，逗号分隔')
    
    args = parser.parse_args()
    
    syncer = StockDataSync()
    
    if args.action == 'kline':
        if not args.start_date or not args.end_date:
            print(json.dumps({"success": False, "error": "请提供开始和结束日期"}))
            sys.exit(1)
        
        result = syncer.get_kline_data(
            args.code,
            args.start_date,
            args.end_date,
            args.frequency
        )
    
    elif args.action == 'info':
        result = syncer.get_stock_info(args.code)
    
    elif args.action == 'sync':
        frequencies = [f.strip() for f in args.freqs.split(',')]
        result = syncer.sync_multiple_frequencies(args.code, frequencies, args.days)
    
    print(json.dumps(result, ensure_ascii=False, default=str))


if __name__ == '__main__':
    main()
