#!/usr/bin/env python3
"""
Baostock 数据获取脚本
用于获取股票的历史 K 线数据
"""

import baostock as bs
import pandas as pd
import json
import sys
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

# 登录重试配置
MAX_LOGIN_RETRIES = 3
LOGIN_RETRY_DELAY = 2  # 秒

# 登录 baostock（带重试机制）
def login(max_retries: int = MAX_LOGIN_RETRIES) -> bool:
    """
    登录 baostock 系统，支持重试
    
    Args:
        max_retries: 最大重试次数，默认3次
    
    Returns:
        登录是否成功
    """
    last_error = None
    
    for attempt in range(max_retries):
        try:
            lg = bs.login()
            if lg.error_code == '0':
                # 登录成功信息输出到 stderr，避免干扰 JSON 输出
                print(f"login success! (attempt {attempt + 1})", file=sys.stderr)
                return True
            else:
                last_error = f"登录失败(尝试 {attempt + 1}/{max_retries}): {lg.error_msg}"
                print(last_error, file=sys.stderr)
                
                # 如果不是最后一次尝试，等待后重试
                if attempt < max_retries - 1:
                    # 先登出再重试，清理可能的残留状态
                    try:
                        bs.logout()
                    except:
                        pass
                    time.sleep(LOGIN_RETRY_DELAY)
        except Exception as e:
            last_error = f"登录异常(尝试 {attempt + 1}/{max_retries}): {str(e)}"
            print(last_error, file=sys.stderr)
            if attempt < max_retries - 1:
                time.sleep(LOGIN_RETRY_DELAY)
    
    # 所有重试都失败
    print(json.dumps({"success": False, "error": f"登录失败: {last_error}"}))
    sys.exit(1)

def logout():
    """登出 baostock 系统"""
    bs.logout()
    print("logout success!", file=sys.stderr)

def get_stock_code_format(code: str) -> tuple:
    """
    将股票代码转换为 baostock 格式
    例如: 000001 -> (sh.000001 或 sz.000001, 代码)
    """
    code = code.strip().upper()
    
    # 已经是 baostock 格式
    if code.startswith('sh.') or code.startswith('sz.'):
        return code, code[3:]
    
    # 港股格式
    if code.endswith('.HK'):
        stock_code = code.replace('.HK', '')
        return f"hk.{stock_code}", stock_code
    
    # A股代码判断
    pure_code = code.split('.')[0]  # 去掉可能的后缀
    
    # 上海市场: 6开头
    if pure_code.startswith('6'):
        return f"sh.{pure_code}", pure_code
    # 深圳市场: 0、3开头
    elif pure_code.startswith('0') or pure_code.startswith('3'):
        return f"sz.{pure_code}", pure_code
    # 创业板: 3开头
    elif pure_code.startswith('3'):
        return f"sz.{pure_code}", pure_code
    # 科创板: 688开头
    elif pure_code.startswith('688'):
        return f"sh.{pure_code}", pure_code
    else:
        # 默认深圳
        return f"sz.{pure_code}", pure_code

def get_kline_data(
    code: str,
    start_date: str,
    end_date: str,
    frequency: str = 'd',
    adjustflag: str = '3'
) -> Dict[str, Any]:
    """
    获取 K 线数据
    
    Args:
        code: 股票代码（如 000001 或 sh.000001）
        start_date: 开始日期 (YYYY-MM-DD)
        end_date: 结束日期 (YYYY-MM-DD)
        frequency: 数据频率 d=日k线 w=周 m=月 5=5分钟 15=15分钟 30=30分钟 60=60分钟
        adjustflag: 复权类型 1=后复权 2=前复权 3=不复权
    
    Returns:
        包含 K 线数据的字典
    """
    login()
    
    try:
        bs_code, pure_code = get_stock_code_format(code)
        
        # 频率映射
        freq_map = {
            'd': 'd',      # 日线
            'w': 'w',      # 周线
            'm': 'm',      # 月线
            '5': '5',      # 5分钟
            '15': '15',    # 15分钟
            '30': '30',    # 30分钟
            '60': '60',    # 60分钟
            '120': '60',   # 120分钟用60分钟代替
        }
        
        bs_freq = freq_map.get(frequency, 'd')
        
        # 根据频率选择字段（分钟级别不支持 turn 和 pctChg）
        is_minute_level = frequency in ['5', '15', '30', '60', '120']
        fields = "date,code,open,high,low,close,volume,amount"
        if not is_minute_level:
            fields += ",turn,pctChg"
        
        # 获取 K 线数据
        rs = bs.query_history_k_data_plus(
            bs_code,
            fields,
            start_date=start_date,
            end_date=end_date,
            frequency=bs_freq,
            adjustflag=adjustflag
        )
        
        if rs.error_code != '0':
            return {
                "success": False,
                "error": f"查询失败: {rs.error_msg}"
            }
        
        # 转换为列表
        data_list = []
        while (rs.error_code == '0') & rs.next():
            data_list.append(rs.get_row_data())
        
        if not data_list:
            return {
                "success": False,
                "error": "未查询到数据"
            }
        
        # 创建 DataFrame（根据实际返回的字段）
        if is_minute_level:
            columns = ["date", "code", "open", "high", "low", "close", "volume", "amount"]
        else:
            columns = ["date", "code", "open", "high", "low", "close", "volume", "amount", "turn", "pctChg"]
        
        df = pd.DataFrame(data_list, columns=columns)
        
        # 数据类型转换
        numeric_cols = ['open', 'high', 'low', 'close', 'volume', 'amount']
        if not is_minute_level:
            numeric_cols.extend(['turn', 'pctChg'])
        
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # 分钟级别数据添加空白的 turn 和 pctChg 列
        if is_minute_level:
            df['turn'] = None
            df['pctChg'] = None
        
        # 计算均线（使用 min_periods 确保数据量不足时返回 NaN）
        df['ma5'] = df['close'].rolling(window=5, min_periods=5).mean().round(2)
        df['ma20'] = df['close'].rolling(window=20, min_periods=20).mean().round(2)
        df['ma55'] = df['close'].rolling(window=55, min_periods=55).mean().round(2)
        df['ma233'] = df['close'].rolling(window=233, min_periods=233).mean().round(2)
        
        # 计算 MACD
        macd_result = calculate_macd(df['close'])
        df['macd'] = macd_result['macd']
        df['macd_signal'] = macd_result['signal']
        df['macd_hist'] = macd_result['hist']
        
        # 计算布林带
        boll_result = calculate_boll(df['close'])
        df['boll_upper'] = boll_result['upper']
        df['boll_middle'] = boll_result['middle']
        df['boll_lower'] = boll_result['lower']
        
        # 转换为 JSON 格式
        # 替换 NaN 为 None (JSON null)，使用 fillna 方法
        df = df.fillna(value=float('nan'))  # 先确保所有值都是浮点数 NaN
        df = df.replace({float('nan'): None})  # 然后替换为 None
        
        result = {
            "success": True,
            "data": {
                "code": code,
                "bsCode": bs_code,
                "frequency": frequency,
                "count": len(df),
                "start_date": start_date,
                "end_date": end_date,
                "kline": df.to_dict(orient='records')
            }
        }
        
        return result
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        logout()

def calculate_macd(close_prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, pd.Series]:
    """
    计算 MACD 指标
    
    Args:
        close_prices: 收盘价序列
        fast: 快线周期
        slow: 慢线周期
        signal: 信号线周期
    
    Returns:
        包含 MACD 线、信号线、柱状图的字典
    """
    ema_fast = close_prices.ewm(span=fast, adjust=False).mean()
    ema_slow = close_prices.ewm(span=slow, adjust=False).mean()
    
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    hist = (macd - signal_line) * 2  # 柱状图放大2倍
    
    return {
        'macd': macd.round(4),
        'signal': signal_line.round(4),
        'hist': hist.round(4)
    }

def calculate_boll(close_prices: pd.Series, period: int = 20, std_dev: int = 2) -> Dict[str, pd.Series]:
    """
    计算布林带指标
    
    Args:
        close_prices: 收盘价序列
        period: 计算周期
        std_dev: 标准差倍数
    
    Returns:
        包含上轨、中轨、下轨的字典
    """
    middle = close_prices.rolling(window=period).mean()
    std = close_prices.rolling(window=period).std()
    
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    
    return {
        'upper': upper.round(2),
        'middle': middle.round(2),
        'lower': lower.round(2)
    }

def get_stock_info(code: str) -> Dict[str, Any]:
    """
    获取股票基本信息
    """
    login()
    
    try:
        bs_code, pure_code = get_stock_code_format(code)
        
        # 获取证券信息
        rs = bs.query_stock_basic_by_code(code=bs_code)
        
        if rs.error_code != '0':
            return {
                "success": False,
                "error": f"查询失败: {rs.error_msg}"
            }
        
        data_list = []
        while (rs.error_code == '0') & rs.next():
            data_list.append(rs.get_row_data())
        
        if not data_list:
            return {
                "success": True,
                "data": {
                    "code": code,
                    "bsCode": bs_code,
                    "name": "",
                    "type": "股票"
                }
            }
        
        # 返回基本信息
        row = data_list[0]
        return {
            "success": True,
            "data": {
                "code": code,
                "bsCode": bs_code,
                "code_name": row[3] if len(row) > 3 else "",
                "ipoDate": row[6] if len(row) > 6 else "",
                "outDate": row[7] if len(row) > 7 else "",
                "type": row[8] if len(row) > 8 else "股票",
                "status": row[9] if len(row) > 9 else ""
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        logout()

def sync_stock_data(code: str, days: int = 365) -> Dict[str, Any]:
    """
    同步股票历史数据
    
    Args:
        code: 股票代码
        days: 同步历史天数
    
    Returns:
        同步结果
    """
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    # 获取日线数据
    result = get_kline_data(code, start_date, end_date, 'd')
    
    if not result['success']:
        return result
    
    # 获取股票信息
    info_result = get_stock_info(code)
    
    if info_result['success']:
        result['data']['info'] = info_result['data']
    
    return result

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "请提供操作类型: kline, info, sync",
            "usage": "python baostock_data.py <action> [args...]"
        }))
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == 'kline':
        # 获取 K 线数据
        if len(sys.argv) < 5:
            print(json.dumps({
                "success": False,
                "error": "参数不足",
                "usage": "python baostock_data.py kline <code> <start_date> <end_date> [frequency]"
            }))
            sys.exit(1)
        
        code = sys.argv[2]
        start_date = sys.argv[3]
        end_date = sys.argv[4]
        frequency = sys.argv[5] if len(sys.argv) > 5 else 'd'
        
        result = get_kline_data(code, start_date, end_date, frequency)
        print(json.dumps(result, ensure_ascii=False, default=str))
        
    elif action == 'info':
        # 获取股票信息
        if len(sys.argv) < 3:
            print(json.dumps({
                "success": False,
                "error": "参数不足",
                "usage": "python baostock_data.py info <code>"
            }))
            sys.exit(1)
        
        code = sys.argv[2]
        result = get_stock_info(code)
        print(json.dumps(result, ensure_ascii=False, default=str))
        
    elif action == 'sync':
        # 同步股票数据
        if len(sys.argv) < 3:
            print(json.dumps({
                "success": False,
                "error": "参数不足",
                "usage": "python baostock_data.py sync <code> [days]"
            }))
            sys.exit(1)
        
        code = sys.argv[2]
        days = int(sys.argv[3]) if len(sys.argv) > 3 else 365
        
        result = sync_stock_data(code, days)
        print(json.dumps(result, ensure_ascii=False, default=str))
        
    else:
        print(json.dumps({
            "success": False,
            "error": f"未知操作类型: {action}"
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
