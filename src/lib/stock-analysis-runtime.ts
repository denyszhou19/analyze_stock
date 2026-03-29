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
  type Frequency,
} from '@/lib/stock-freshness';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'stock_analyzer.py');

export const DEFAULT_ANALYSIS_LEVELS = ['weekly', 'daily', 'hour60', 'hour30', 'hour15'] as const;

export interface StockAnalysisRunOptions {
  code: string;
  levels?: string[];
  forceRefresh?: boolean;
  skipIntegrityCheck?: boolean;
}

export interface StockAnalysisRunResult {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
  code?: string;
  integrityCheck?: Record<string, { isValid: boolean; reason: string; recordCount: number }>;
}

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

    process.stdin.write(JSON.stringify(inputData));
    process.stdin.end();
  });
}

const LEVEL_TO_FREQUENCY: Record<string, string> = {
  weekly: 'w',
  daily: 'd',
  hour60: '60',
  hour30: '30',
  hour15: '15',
};

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

function transformDbRecord(item: any): any {
  let dateStr: string;
  if (item.trade_time) {
    dateStr = typeof item.trade_time === 'string'
      ? item.trade_time
      : new Date(item.trade_time).toISOString();
  } else {
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

async function getKlineDataFromDB(code: string, levels: string[]): Promise<Record<string, any[]>> {
  const client = getSupabaseClient();
  const result: Record<string, any[]> = {};

  await Promise.all(levels.map(async (level) => {
    const freq = LEVEL_TO_FREQUENCY[level];
    if (!freq) return;

    const maxRecords = getAnalysisRecords(freq as Frequency);
    const isMinuteLevel = ['5', '15', '30', '60'].includes(freq);

    const { count } = await client
      .from('stock_kline_data_v2')
      .select('*', { count: 'exact', head: true })
      .eq('code', code)
      .eq('frequency', freq);

    const totalRecords = count || 0;

    if (totalRecords > maxRecords) {
      const { data, error } = await client
        .from('stock_kline_data_v2')
        .select('*')
        .eq('code', code)
        .eq('frequency', freq)
        .order('trade_date', { ascending: false })
        .limit(maxRecords);

      if (!error && data && data.length > 0) {
        let sortedData = data;
        if (isMinuteLevel) {
          sortedData = data.sort((a, b) => {
            const dateCompare = a.trade_date.localeCompare(b.trade_date);
            if (dateCompare !== 0) return dateCompare;
            return (a.trade_time || '').localeCompare(b.trade_time || '');
          });
        } else {
          sortedData = data.reverse();
        }

        result[level] = sortedData.map(transformDbRecord);
      }
      return;
    }

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
  }));

  return result;
}

export async function getStockInfoSnapshot(code: string): Promise<Record<string, any>> {
  const info = await stockDataService.getStockInfo(code);

  if (!info.name) {
    const client = getSupabaseClient();
    const { data: holding } = await client
      .from('stock_holdings')
      .select('name')
      .eq('code', code)
      .single();

    if (holding?.name) {
      info.name = holding.name;
    }
  }

  return info;
}

export async function runStockAnalysis({
  code,
  levels = [...DEFAULT_ANALYSIS_LEVELS],
  forceRefresh = false,
  skipIntegrityCheck = false,
}: StockAnalysisRunOptions): Promise<StockAnalysisRunResult> {
  const bsCode = formatStockCode(code);
  console.log(`[Stock Analysis] Analyzing ${bsCode}, levels: ${levels.join(',')}, forceRefresh: ${forceRefresh}`);

  let dbData = await getKlineDataFromDB(code, levels);

  const timeInfo = getCurrentTimeInfo();
  const sourceLatestDate = skipIntegrityCheck ? null : await getBaostockLatestDate(code);

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

    if (data.length < minRecords) {
      return {
        isValid: false,
        reason: `数据不足（需要至少${minRecords}条，当前${data.length}条）`,
        hasValidMA233: false,
      };
    }

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
        hasValidMA233,
      };
    }

    return { isValid: true, reason: '数据有效', hasValidMA233 };
  };

  const integrityCheck: Record<string, { isValid: boolean; reason: string; recordCount: number }> = {};
  const invalidLevels: string[] = [];

  if (!skipIntegrityCheck) {
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

    if (invalidLevels.length > 0) {
      return {
        success: false,
        status: 409,
        error: `数据未准备好: ${invalidLevels.join(', ')}`,
        integrityCheck,
        code: 'DATA_INCOMPLETE',
      };
    }
  }

  const missingLevels = levels.filter(level => !dbData[level] || dbData[level].length === 0);
  if (missingLevels.length > 0) {
    return {
      success: false,
      status: 409,
      error: `缺少分析数据: ${missingLevels.join(', ')}`,
      integrityCheck,
      code: 'DATA_INCOMPLETE',
    };
  }

  if (forceRefresh) {
    const freqsToSync = levels.map(level => LEVEL_TO_FREQUENCY[level]).filter(Boolean);
    if (freqsToSync.length > 0) {
      await stockDataService.syncStockData(code, freqsToSync as Frequency[], undefined, true);
      dbData = await getKlineDataFromDB(code, levels);
    }
  }

  const inputData = {
    stock_code: bsCode,
    periods: dbData,
  };

  console.log(
    '[Stock Analysis] 准备分析数据，各周期数据量:',
    Object.entries(dbData).map(([k, v]) => `${k}: ${(v as any[]).length}条`).join(', ')
  );

  const { stdout } = await executePythonScript(inputData);
  const jsonStr = stdout.trim();

  if (!jsonStr.startsWith('{')) {
    console.error('[Stock Analysis] Invalid output:', jsonStr.slice(0, 500));
    return {
      success: false,
      status: 500,
      error: '分析失败：输出格式错误',
    };
  }

  const result = JSON.parse(jsonStr);
  if (result.error) {
    return {
      success: false,
      status: 400,
      error: result.error,
    };
  }

  return {
    success: true,
    status: 200,
    data: result,
  };
}
