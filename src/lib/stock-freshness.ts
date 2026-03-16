/**
 * 股票数据新鲜度统一判定模块
 * 
 * P1修复：统一所有模块的数据新鲜度判定逻辑
 * 
 * 使用场景：
 * - data-integrity API
 * - check-sync API
 * - stock-data.service.ts
 * - sync-status API
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// ============== 类型定义 ==============

export type Frequency = 'd' | 'w' | 'm' | '5' | '15' | '30' | '60';

export interface FreshnessResult {
  isFresh: boolean;
  reason: string;
  localDate: string | null;
  sourceDate: string | null;
}

export interface TimeInfo {
  todayStr: string;
  dayOfWeek: number;
  isWeekend: boolean;
  lastFridayStr: string;
}

// ============== 常量定义 ==============

// baostock 查询结果缓存（内存缓存，5分钟有效期）
interface CacheEntry {
  date: string | null;
  timestamp: number;
}
const baostockCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// ============== 工具函数 ==============

/**
 * 获取当前时间信息
 */
export function getCurrentTimeInfo(): TimeInfo {
  const now = new Date();
  const localDateStr = now.toLocaleDateString('en-CA');
  const [year, month, day] = localDateStr.split('-').map(Number);
  const today = new Date(year, month - 1, day);
  const dayOfWeek = today.getDay();
  
  // 计算上周五的日期（用于周线判断）
  let daysToLastFriday: number;
  if (dayOfWeek === 0) daysToLastFriday = 2;      // 周日 -> 2天前是周五
  else if (dayOfWeek === 6) daysToLastFriday = 1; // 周六 -> 1天前是周五
  else daysToLastFriday = dayOfWeek + 2;          // 周一到周五 -> 上周五
  
  const lastFriday = new Date(today);
  lastFriday.setDate(today.getDate() - daysToLastFriday);
  const lastFridayStr = lastFriday.toISOString().split('T')[0];
  
  return {
    todayStr: localDateStr,
    dayOfWeek,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    lastFridayStr,
  };
}

/**
 * 获取昨天的日期字符串
 */
export function getYesterdayStr(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * 查询 baostock 获取最新可用的交易日
 */
export async function getBaostockLatestDate(code: string): Promise<string | null> {
  // 检查缓存
  const cached = baostockCache.get(code);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.date;
  }
  
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'stock_data_sync.py');
    const endDate = new Date().toLocaleDateString('en-CA');
    const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
    
    const { stdout } = await execAsync(
      `python3 "${scriptPath}" kline "${code}" "${startDate}" "${endDate}" d`,
      { timeout: 30000 }
    );
    
    const result = JSON.parse(stdout);
    if (result.success && result.data?.kline?.length > 0) {
      const lastRecord = result.data.kline[result.data.kline.length - 1];
      const latestDate = lastRecord.date?.split(' ')[0] || lastRecord.date;
      
      baostockCache.set(code, { date: latestDate, timestamp: Date.now() });
      return latestDate;
    }
    
    return null;
  } catch (error) {
    console.error('[StockFreshness] getBaostockLatestDate error:', error);
    return null;
  }
}

/**
 * 清除 baostock 缓存
 */
export function clearBaostockCache(code?: string): void {
  if (code) {
    baostockCache.delete(code);
  } else {
    baostockCache.clear();
  }
}

// ============== 核心判定函数 ==============

/**
 * 判断数据是否新鲜（统一逻辑）
 * 
 * 规则：
 * - 周线：数据日期 >= 上周五
 * - 日线：数据日期 >= baostock最新日期
 * - 分钟线：数据日期 >= baostock最新日期
 */
export function checkDataFreshness(
  frequency: Frequency,
  localDate: string | null,
  sourceDate: string | null,
  timeInfo?: TimeInfo
): FreshnessResult {
  const info = timeInfo || getCurrentTimeInfo();
  
  if (!localDate) {
    return {
      isFresh: false,
      reason: '无数据',
      localDate: null,
      sourceDate,
    };
  }
  
  // 提取日期部分（处理可能的时间格式）
  const localDateOnly = localDate.split(' ')[0].split('T')[0];
  
  switch (frequency) {
    case 'w': {
      // 周线：数据日期 >= 上周五，就是新鲜的
      if (localDateOnly >= info.lastFridayStr) {
        return {
          isFresh: true,
          reason: '数据最新',
          localDate: localDateOnly,
          sourceDate,
        };
      }
      return {
        isFresh: false,
        reason: `周线过期 (${localDateOnly} < ${info.lastFridayStr})`,
        localDate: localDateOnly,
        sourceDate,
      };
    }
    
    case 'd': {
      // 日线：需要与 baostock 最新日期比较
      if (!sourceDate) {
        // 无法获取源端日期，使用宽松策略
        const yesterdayStr = getYesterdayStr();
        if (localDateOnly >= yesterdayStr) {
          return {
            isFresh: true,
            reason: '数据最新（宽松判定）',
            localDate: localDateOnly,
            sourceDate,
          };
        }
        return {
          isFresh: false,
          reason: `日线过期 (${localDateOnly} < ${yesterdayStr})`,
          localDate: localDateOnly,
          sourceDate,
        };
      }
      
      if (localDateOnly >= sourceDate) {
        return {
          isFresh: true,
          reason: '数据最新',
          localDate: localDateOnly,
          sourceDate,
        };
      }
      return {
        isFresh: false,
        reason: `日线过期 (${localDateOnly} < ${sourceDate})`,
        localDate: localDateOnly,
        sourceDate,
      };
    }
    
    case '60':
    case '30':
    case '15':
    case '5': {
      // 分钟线：与日线相同，需要与 baostock 最新日期比较
      if (!sourceDate) {
        const yesterdayStr = getYesterdayStr();
        if (localDateOnly >= yesterdayStr) {
          return {
            isFresh: true,
            reason: '数据最新（宽松判定）',
            localDate: localDateOnly,
            sourceDate,
          };
        }
        return {
          isFresh: false,
          reason: `${frequency}分钟过期 (${localDateOnly} < ${yesterdayStr})`,
          localDate: localDateOnly,
          sourceDate,
        };
      }
      
      if (localDateOnly >= sourceDate) {
        return {
          isFresh: true,
          reason: '数据最新',
          localDate: localDateOnly,
          sourceDate,
        };
      }
      return {
        isFresh: false,
        reason: `${frequency}分钟过期 (${localDateOnly} < ${sourceDate})`,
        localDate: localDateOnly,
        sourceDate,
      };
    }
    
    default:
      return {
        isFresh: false,
        reason: '未知周期',
        localDate: localDateOnly,
        sourceDate,
      };
  }
}

// ============== 数据窗口配置 ==============

/**
 * 各周期的数据窗口配置
 * 用于分析时读取适量的数据，避免全表扫描
 */
export const DATA_WINDOW_CONFIG: Record<Frequency, {
  syncDays: number;      // 同步时拉取的天数
  analysisRecords: number; // 分析时读取的记录数
  minRecords: number;    // 最小记录数（用于完整性检查）
}> = {
  'w': { syncDays: 1700, analysisRecords: 260, minRecords: 233 },   // 周线：约243周，分析取260根
  'd': { syncDays: 500, analysisRecords: 400, minRecords: 233 },    // 日线：分析取400根
  'm': { syncDays: 500, analysisRecords: 200, minRecords: 100 },    // 月线：分析取200根
  '60': { syncDays: 180, analysisRecords: 400, minRecords: 233 },   // 60分钟：分析取400根
  '30': { syncDays: 180, analysisRecords: 600, minRecords: 233 },   // 30分钟：分析取600根
  '15': { syncDays: 90, analysisRecords: 800, minRecords: 233 },    // 15分钟：分析取800根
  '5': { syncDays: 30, analysisRecords: 400, minRecords: 233 },     // 5分钟：分析取400根
};

/**
 * 获取同步天数
 */
export function getSyncDays(frequency: Frequency): number {
  return DATA_WINDOW_CONFIG[frequency]?.syncDays || 365;
}

/**
 * 获取分析时读取的记录数
 */
export function getAnalysisRecords(frequency: Frequency): number {
  return DATA_WINDOW_CONFIG[frequency]?.analysisRecords || 400;
}

/**
 * 获取最小记录数
 */
export function getMinRecords(frequency: Frequency): number {
  return DATA_WINDOW_CONFIG[frequency]?.minRecords || 233;
}
