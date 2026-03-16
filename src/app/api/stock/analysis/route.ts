import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { stockDataService } from '@/services/stock-data.service';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  checkDataFreshness,
  getAnalysisRecords,
  getBaostockLatestDate,
  getCurrentTimeInfo,
  getMinRecords,
  Frequency,
} from '@/lib/stock-freshness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'stock_analyzer.py');

// 使用 spawn 执行 Python 脚本并通过 stdin 传递数据
function executePythonScript(inputData: object): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const process = spawn('python3', [SCRIPT_PATH, '--stdin'], {
      timeout: 60000,
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
    
    // 通过 stdin 传递数据
    const inputJson = JSON.stringify(inputData);
    process.stdin.write(inputJson);
    process.stdin.end();
  });
}

// 周期映射（前端 -> 数据库频率）
const LEVEL_TO_FREQUENCY: Record<string, string> = {
  weekly: 'w',
  daily: 'd',
  hour60: '60',
  hour30: '30',
  hour15: '15',
};

// 股票代码格式转换：002050 -> sz.002050, 600000 -> sh.600000
function formatStockCode(code: string): string {
  if (code.startsWith('sh.') || code.startsWith('sz.')) {
    return code;
  }
  
  if (code.includes('.HK')) {
    return code;
  }
  
  const pureCode = code.replace(/\.(SH|SZ|sh|sz)$/i, '');
  
  if (pureCode.startsWith('6')) {
    return `sh.${pureCode}`;
  } else if (pureCode.startsWith('0') || pureCode.startsWith('3')) {
    return `sz.${pureCode}`;
  }
  
  return `sz.${pureCode}`;
}

// 从数据库获取多周期数据
// P1修复：只取分析所需的窗口数据，避免全表扫描
async function getKlineDataFromDB(code: string, levels: string[]): Promise<Record<string, any[]>> {
  const client = getSupabaseClient();
  const result: Record<string, any[]> = {};
  
  for (const level of levels) {
    const freq = LEVEL_TO_FREQUENCY[level];
    if (!freq) continue;
    
    // P1修复：获取分析所需的记录数
    const maxRecords = getAnalysisRecords(freq as Frequency);
    
    // 分钟级别需要同时按时间排序
    const isMinuteLevel = ['5', '15', '30', '60'].includes(freq);
    
    // 先获取总数，判断是否需要限制
    const { count } = await client
      .from('stock_kline_data_v2')
      .select('*', { count: 'exact', head: true })
      .eq('code', code)
      .eq('frequency', freq);
    
    const totalRecords = count || 0;
    
    // 如果数据量超过需要的记录数，只取最新的 N 条
    if (totalRecords > maxRecords) {
      // 使用 range 获取最新的 maxRecords 条数据
      // 先倒序取最新的，再正序排列返回
      const { data, error } = await client
        .from('stock_kline_data_v2')
        .select('*')
        .eq('code', code)
        .eq('frequency', freq)
        .order('trade_date', { ascending: false })
        .limit(maxRecords);
      
      if (!error && data && data.length > 0) {
        // 分钟级别需要按时间排序
        let sortedData = data;
        if (isMinuteLevel) {
          sortedData = data.sort((a, b) => {
            const dateCompare = a.trade_date.localeCompare(b.trade_date);
            if (dateCompare !== 0) return dateCompare;
            return (a.trade_time || '').localeCompare(b.trade_time || '');
          });
        } else {
          sortedData = data.reverse(); // 反转为正序
        }
        
        result[level] = sortedData.map(transformDbRecord);
      }
    } else {
      // 数据量不大，获取全部数据
      const allData: any[] = [];
      const pageSize = 1000;
      let page = 0;
      
      while (true) {
        let query = client
          .from('stock_kline_data_v2')
          .select('*')
          .eq('code', code)
          .eq('frequency', freq)
          .order('trade_date', { ascending: true });
        
        if (isMinuteLevel) {
          query = query.order('trade_time', { ascending: true });
        }
        
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error || !data || data.length === 0) break;
        
        allData.push(...data);
        
        if (data.length < pageSize) break;
        page++;
      }
      
      if (allData.length > 0) {
        result[level] = allData.map(transformDbRecord);
      }
    }
  }
  
  return result;
}

// 转换数据库记录格式
function transformDbRecord(item: any): any {
  // 处理日期格式
  let dateStr: string;
  if (item.trade_time) {
    // 分钟级别使用 trade_time
    dateStr = typeof item.trade_time === 'string' 
      ? item.trade_time 
      : new Date(item.trade_time).toISOString();
  } else {
    // 日线/周线使用 trade_date
    dateStr = typeof item.trade_date === 'string' 
      ? item.trade_date.split('T')[0] + ' 00:00'
      : new Date(item.trade_date).toISOString().split('T')[0] + ' 00:00';
  }
  
  return {
    date: dateStr,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume,
    amount: item.amount,
    turn: item.turnover_rate,
    pctChg: item.pct_chg,
    MA5: item.ma5,
    MA10: item.ma10,
    MA20: item.ma20,
    MA55: item.ma55,
    MA233: item.ma233,
    macd: item.macd,
    macd_signal: item.macd_signal,
    macd_hist: item.macd_hist,
    boll_upper: item.boll_upper,
    boll_middle: item.boll_middle,
    boll_lower: item.boll_lower,
  };
}

/**
 * GET /api/stock/analysis - 获取股票技术分析
 * 
 * 查询参数：
 * - code: 股票代码（必填）
 * - levels: 分析周期（默认 weekly,daily,hour60,hour30,hour15）
 * - force_refresh: 是否强制从远程获取数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const levelsParam = searchParams.get('levels') || 'weekly,daily,hour60,hour30,hour15';
    const forceRefresh = searchParams.get('force_refresh') === 'true';
    const levels = levelsParam.split(',').map(l => l.trim());

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    const bsCode = formatStockCode(code);
    console.log(`[Stock Analysis] Analyzing ${bsCode}, levels: ${levelsParam}, forceRefresh: ${forceRefresh}`);

    // 1. 从数据库获取数据
    let dbData = await getKlineDataFromDB(code, levels);
    
    const timeInfo = getCurrentTimeInfo();
    const sourceLatestDate = await getBaostockLatestDate(code);
    
    // 检查数据完整性
    const checkDataIntegrity = (level: string, data: any[]): { 
      isValid: boolean; 
      reason: string;
      hasValidMA233: boolean;
    } => {
      if (!data || data.length === 0) {
        return { isValid: false, reason: '无数据', hasValidMA233: false };
      }

      const frequency = LEVEL_TO_FREQUENCY[level] as Frequency | undefined;
      const minRecords = frequency ? getMinRecords(frequency) : 233;
      
      // 检查数据条数是否满足最低要求
      if (data.length < minRecords) {
        return { 
          isValid: false, 
          reason: `数据不足（需要至少${minRecords}条，当前${data.length}条）`,
          hasValidMA233: false
        };
      }
      
      // 满足最小记录数后，MA233 才可信。
      const hasValidMA233 = data.length >= minRecords;
      
      const lastRecord = data[data.length - 1];
      const lastDate = lastRecord.date.split(' ')[0];
      const freshnessResult = frequency
        ? checkDataFreshness(frequency, lastDate, sourceLatestDate, timeInfo)
        : { isFresh: false, reason: '未知周期' };

      if (!freshnessResult.isFresh) {
        return {
          isValid: false,
          reason: freshnessResult.reason,
          hasValidMA233
        };
      }
      
      return { isValid: true, reason: '数据有效', hasValidMA233 };
    };
    
    // 2. 检查数据完整性
    const integrityCheck: Record<string, { isValid: boolean; reason: string; recordCount: number }> = {};
    const invalidLevels: string[] = [];
    
    for (const level of levels) {
      const data = dbData[level] || [];
      const { isValid, reason, hasValidMA233 } = checkDataIntegrity(level, data);
      
      integrityCheck[level] = {
        isValid,
        reason,
        recordCount: data.length,
      };
      
      if (!isValid) {
        invalidLevels.push(level);
        console.log(`[Stock Analysis] ${level} 数据不完整: ${reason}`);
      } else if (!hasValidMA233) {
        console.log(`[Stock Analysis] ${level} MA233可能不准确（数据量${data.length} < 233）`);
      }
    }
    
    // 数据未准备好时，analysis 接口只返回错误，不再私自触发同步。
    if (invalidLevels.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `数据未准备好: ${invalidLevels.join(', ')}`,
          integrityCheck,
          code: 'DATA_INCOMPLETE'
        },
        { status: 409 }
      );
    }
    
    const missingLevels = levels.filter(level => !dbData[level] || dbData[level].length === 0);
    
    if (missingLevels.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `缺少分析数据: ${missingLevels.join(', ')}`,
          integrityCheck,
          code: 'DATA_INCOMPLETE'
        },
        { status: 409 }
      );
    }

    if (forceRefresh) {
      const freqsToSync = levels.map(level => LEVEL_TO_FREQUENCY[level]).filter(Boolean);
      if (freqsToSync.length > 0) {
        await stockDataService.syncStockData(code, freqsToSync as any, undefined, true);
        dbData = await getKlineDataFromDB(code, levels);
      }
    }

    // 3. 准备传递给 Python 的数据
    const inputData = {
      stock_code: bsCode,
      periods: dbData,  // Python 脚本期望的字段名
    };

    // 4. 调用 Python 脚本分析（通过 stdin 传递数据）
    console.log(`[Stock Analysis] 准备分析数据，各周期数据量:`, 
      Object.entries(dbData).map(([k, v]) => `${k}: ${(v as any[]).length}条`).join(', ')
    );
    
    const { stdout, stderr } = await executePythonScript(inputData);

    // 5. 解析结果
    const jsonStr = stdout.trim();
    
    if (!jsonStr.startsWith('{')) {
      console.error('[Stock Analysis] Invalid output:', jsonStr.slice(0, 500));
      return NextResponse.json(
        { success: false, error: '分析失败：输出格式错误' },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonStr);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('[Stock Analysis] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '分析失败' },
      { status: 500 }
    );
  }
}
