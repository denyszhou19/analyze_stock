/**
 * 股票数据统一服务模块
 * 
 * 功能：
 * 1. 统一管理股票K线数据的获取、存储、同步
 * 2. 支持缓存机制：当天数据直接返回
 * 3. 支持增量同步：只同步新增数据
 * 4. 为K线图和三位一体分析提供统一数据源
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  checkDataFreshness,
  getBaostockLatestDate as getFreshnessLatestDate,
  getCurrentTimeInfo,
  getMinRecords,
  type Frequency as FreshnessFrequency,
} from '@/lib/stock-freshness';

const execAsync = promisify(exec);

// ============== 类型定义 ==============

export type Frequency = 'd' | 'w' | 'm' | '5' | '15' | '30' | '60';

export interface KlineRecord {
  date: string;           // 交易日期或时间
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  turn: number | null;    // 换手率
  pctChg: number | null;  // 涨跌幅
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma55: number | null;
  ma233: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
  boll_upper: number | null;
  boll_middle: number | null;
  boll_lower: number | null;
}

export interface StockData {
  code: string;
  frequency: Frequency;
  count: number;
  source: 'database' | 'api' | 'cache';
  kline: KlineRecord[];
  lastSyncAt?: string;
  isLatest?: boolean;  // 是否为当天最新数据
}

export interface SyncResult {
  success: boolean;
  code: string;
  frequency: Frequency;
  count: number;
  newRecords: number;
  updatedRecords: number;
  message?: string;
}

export interface StockInfo {
  code: string;
  name?: string;
  market?: string;
  industry?: string;
  listDate?: string;
  status?: string;
  lastSyncAt?: string;
  lastDataDate?: string;  // K线数据最后日期
}

// ============== 常量定义 ==============

// 周期映射（前端 -> baostock）
const FREQUENCY_MAP: Record<string, string> = {
  '5min': '5',
  '15min': '15',
  '30min': '30',
  '60min': '60',
  '120min': '60',
  'd': 'd',
  'w': 'w',
  'm': 'm',
};

// 分钟级别周期
const MINUTE_FREQUENCIES = ['5', '15', '30', '60'];

// API 调用重试配置
const MAX_API_RETRIES = 3;
const API_RETRY_DELAY = 2000; // 毫秒

// 需要重试的错误关键词
const RETRY_ERROR_KEYWORDS = [
  '用户未登录',
  '登录失败',
  'login',
  'connection',
  'timeout',
  'network',
];

// 各周期默认数据天数
const DEFAULT_DAYS: Record<string, number> = {
  '5': 30,      // 5分钟：30天
  '15': 60,     // 15分钟：60天
  '30': 90,     // 30分钟：90天
  '60': 180,    // 60分钟：180天
  'd': 1825,    // 日线：5年
  'w': 1825,    // 周线：5年
  'm': 1825,    // 月线：5年
};

// Python 脚本路径
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'stock_data_sync.py');

// ============== 股票数据服务类 ==============

class StockDataService {
  /**
   * 查询 baostock 获取最新可用交易日
   * 用于判断本地数据是否需要同步
   */
  async getBaostockLatestDate(code: string): Promise<string | null> {
    return getFreshnessLatestDate(code);
  }

  /**
   * 获取股票K线数据（统一入口）
   * 
   * 逻辑：
   * 1. 先查数据库
   * 2. 如果数据库有当天最新数据，直接返回
   * 3. 如果数据库有数据但不是最新，返回数据库数据（后台可触发同步）
   * 4. 如果数据库无数据，从API获取并保存
   */
  async getKlineData(
    code: string,
    frequency: string = 'd',
    options: {
      forceRefresh?: boolean;  // 强制刷新
      startDate?: string;
      endDate?: string;
      saveToDb?: boolean;      // 是否保存到数据库
    } = {}
  ): Promise<StockData> {
    const { forceRefresh = false, startDate, endDate, saveToDb = true } = options;
    const freq = (FREQUENCY_MAP[frequency] || frequency) as Frequency;
    
    console.log(`[StockDataService] getKlineData: ${code}, freq: ${freq}, forceRefresh: ${forceRefresh}`);

    // 1. 如果不是强制刷新，先尝试从数据库获取
    if (!forceRefresh) {
      const dbData = await this.getFromDatabase(code, freq, startDate, endDate);
      
      if (dbData) {
        // 检查是否为当天最新数据
        const isLatest = await this.isLatestData(dbData.kline, freq, code);
        
        if (isLatest) {
          console.log(`[StockDataService] 返回数据库缓存数据（当天最新）`);
          return {
            ...dbData,
            source: 'cache',
            isLatest: true,
          };
        }
        
        // 数据不是最新，但仍然返回（前端可以选择后台同步）
        console.log(`[StockDataService] 返回数据库数据（非最新）`);
        return {
          ...dbData,
          source: 'database',
          isLatest: false,
        };
      }
    }

    // 2. 从 API 获取数据
    console.log(`[StockDataService] 从 API 获取数据`);
    const apiData = await this.fetchFromApi(code, freq, startDate, endDate);
    
    // 3. 保存到数据库
    if (saveToDb && apiData.kline.length > 0) {
      await this.saveToDatabase(code, freq, apiData.kline);
    }

    return {
      ...apiData,
      source: 'api',
      isLatest: true,
    };
  }

  /**
   * 同步股票数据（增量同步）
   * 
   * 逻辑：
   * 1. 查询数据库中该股票该周期的最后一条数据日期
   * 2. 如果没有数据，全量同步
   * 3. 如果有数据，只同步最后日期之后的数据
   */
  /**
   * 根据周期获取合理的数据天数
   * 
   * P0修复：周线至少需要1700天（约243周），满足MA233计算需求
   * 日线至少需要500天，满足MA233计算需求
   */
  private getDaysForFrequency(frequency: Frequency): number {
    switch (frequency) {
      case 'w':   // 周线：1700天约243周，满足MA233需求
        return 1700;
      case 'd':   // 日线：500天约满足MA233需求
        return 500;
      case '60':  // 60分钟：半年约500根
        return 180;
      case '30':  // 30分钟：半年约1000根
        return 180;
      case '15':  // 15分钟：3个月约1200根，减少数据量
        return 90;
      default:
        return 500;
    }
  }

  /**
   * P2优化：同步频率做有限并发
   * 
   * 并发策略：
   * - 周线与日线串行（数据量最大，避免资源竞争）
   * - 分钟级别（60/30/15）并发执行（3个并发）
   * 
   * 这样既保证了性能，又避免了资源过度竞争
   */
  async syncStockData(
    code: string,
    frequencies: Frequency[] = ['d'],
    days?: number,  // 可选，不传则根据周期自动计算
    forceFull: boolean = false  // P0修复：支持强制全量同步
  ): Promise<SyncResult[]> {
    // P1修复：在入口先查一次 baostock 最新日期，避免每个频率重复查询
    const baostockLatestDate = await this.getBaostockLatestDate(code);
    console.log(`[StockDataService] baostock 最新日期: ${baostockLatestDate}`);

    // P2优化：按频率分组，确定并发策略
    // 周线和日线数据量大，串行执行
    // 分钟级别数据量相对较小，可以并发
    const weeklyDaily: Frequency[] = [];
    const minuteLevels: Frequency[] = [];
    
    for (const freq of frequencies) {
      if (freq === 'w' || freq === 'd') {
        weeklyDaily.push(freq);
      } else {
        minuteLevels.push(freq);
      }
    }
    
    const results: SyncResult[] = [];
    
    // 1. 先串行执行周线和日线
    for (const freq of weeklyDaily) {
      const freqDays = days || this.getDaysForFrequency(freq);
      const result = await this.syncSingleFrequency(code, freq, freqDays, forceFull, baostockLatestDate);
      results.push(result);
    }
    
    // 2. 并发执行分钟级别（最多3个并发）
    if (minuteLevels.length > 0) {
      const CONCURRENCY_LIMIT = 3;
      
      // 分批执行
      for (let i = 0; i < minuteLevels.length; i += CONCURRENCY_LIMIT) {
        const batch = minuteLevels.slice(i, i + CONCURRENCY_LIMIT);
        
        console.log(`[StockDataService] 并发同步分钟级别: ${batch.join(',')} (批次 ${Math.floor(i / CONCURRENCY_LIMIT) + 1})`);
        
        const batchResults = await Promise.all(
          batch.map(async freq => {
            const freqDays = days || this.getDaysForFrequency(freq);
            return this.syncSingleFrequency(code, freq, freqDays, forceFull, baostockLatestDate);
          })
        );
        
        results.push(...batchResults);
      }
    }

    return results;
  }

  /**
   * 同步单个周期数据
   * 
   * 修复：使用数据库中实际数据的最后日期来判断是否需要同步，
   * 而不是依赖 sync_status.last_sync_date（可能被错误设置）
   * 
   * 新增：如果检测到正在同步中，会等待并重试，而不是直接跳过
   * 
   * P0修复：支持 forceFull 强制全量同步
   * P1修复：接收外部传入的 baostockLatestDate，避免重复查询
   */
  private async syncSingleFrequency(
    code: string,
    frequency: Frequency,
    defaultDays: number,
    forceFull: boolean = false,
    baostockLatestDate?: string | null  // P1修复：外部传入
  ): Promise<SyncResult> {
    const client = getSupabaseClient();

    // 检查是否正在同步中（防止并发同步）- 带重试机制
    const MAX_WAIT_RETRIES = 30; // 最多等待30次（每次2秒，共60秒）
    const WAIT_INTERVAL = 2000; // 每次等待2秒
    
    for (let retry = 0; retry <= MAX_WAIT_RETRIES; retry++) {
      const { data: currentStatus } = await client
        .from('stock_sync_status')
        .select('sync_status, updated_at')
        .eq('code', code)
        .eq('frequency', frequency)
        .single();

      if (currentStatus?.sync_status !== 'syncing') {
        // 状态不是 syncing，可以继续同步
        break;
      }

      // 检查 syncing 状态是否超时（超过 5 分钟认为是卡住了）
      const updatedAt = currentStatus.updated_at ? new Date(currentStatus.updated_at).getTime() : Date.now();
      const syncDuration = Date.now() - updatedAt;
      const SYNC_TIMEOUT = 5 * 60 * 1000; // 5 分钟超时

      if (syncDuration > SYNC_TIMEOUT) {
        // 同步超时，重置状态
        console.log(`[StockDataService] ${code} ${frequency} 同步超时（${Math.round(syncDuration / 1000)}秒），重置状态`);
        await client
          .from('stock_sync_status')
          .upsert({
            code,
            frequency,
            sync_status: 'failed',
            last_sync_error: '同步超时，已自动重置',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'code,frequency' });
        break;
      }

      if (retry < MAX_WAIT_RETRIES) {
        console.log(`[StockDataService] ${code} ${frequency} 正在同步中，等待后重试 (${retry + 1}/${MAX_WAIT_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL));
      } else {
        // 等待超时
        console.log(`[StockDataService] ${code} ${frequency} 等待同步超时，请稍后重试`);
        return {
          success: false,
          code,
          frequency,
          count: 0,
          newRecords: 0,
          updatedRecords: 0,
          message: '同步繁忙，请稍后重试',
        };
      }
    }

    // 更新同步状态为 syncing
    await client
      .from('stock_sync_status')
      .upsert({
        code,
        frequency,
        sync_status: 'syncing',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'code,frequency' });

    try {
      // 1. 获取数据库中最后一条数据的日期
      const { data: lastRecord } = await client
        .from('stock_kline_data_v2')
        .select('trade_date')
        .eq('code', code)
        .eq('frequency', frequency)
        .order('trade_date', { ascending: false })
        .limit(1)
        .single();

      const { count: localRecordCount } = await client
        .from('stock_kline_data_v2')
        .select('*', { count: 'exact', head: true })
        .eq('code', code)
        .eq('frequency', frequency);

      // 2. 获取 baostock 最新日期，判断是否需要同步
      const today = new Date().toISOString().split('T')[0];
      
      // P1修复：使用外部传入的 baostockLatestDate，避免重复查询
      // 如果外部未传入，则回退到查询（兼容旧调用方式）
      const latestDate = baostockLatestDate ?? await this.getBaostockLatestDate(code);
      
      // 解析本地数据最后日期
      let localLatestDate: string | null = null;
      if (lastRecord?.trade_date) {
        localLatestDate = typeof lastRecord.trade_date === 'string'
          ? lastRecord.trade_date.split('T')[0].split(' ')[0]
          : new Date(lastRecord.trade_date).toISOString().split('T')[0];
      }

      const timeInfo = getCurrentTimeInfo();
      const minRecords = getMinRecords(frequency as FreshnessFrequency);
      const freshnessResult = checkDataFreshness(
        frequency as FreshnessFrequency,
        localLatestDate,
        latestDate,
        timeInfo
      );
      const currentRecordCount = localRecordCount || 0;
      const needsHistoryRepair = currentRecordCount > 0 && currentRecordCount < minRecords;

      // 3. 检查是否需要同步
      // 只有“数据新鲜且记录数达标”时才允许跳过。
      if (!forceFull && freshnessResult.isFresh && !needsHistoryRepair) {
        console.log(
          `[StockDataService] ${code} ${frequency} 数据已是最新且记录数达标 (${localLatestDate}, ${currentRecordCount}/${minRecords})，无需同步`
        );
        
        // 更新同步状态为 success
        await client
          .from('stock_sync_status')
          .upsert({
            code,
            frequency,
            sync_status: 'success',
            last_sync_date: localLatestDate,
            last_sync_error: null,
            retry_count: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'code,frequency' });
        
        return {
          success: true,
          code,
          frequency,
          count: 0,
          newRecords: 0,
          updatedRecords: 0,
          message: '数据已是最新',
        };
      }

      if (!forceFull && needsHistoryRepair) {
        console.log(
          `[StockDataService] ${code} ${frequency} 历史数据不足 (${currentRecordCount}/${minRecords})，执行补齐同步`
        );
      }

      // 4. 确定同步起始日期
      let startDate: string;
      let syncType: 'full' | 'inc' = 'full';
      let deleteFromDate: string | null | false = null;  // false 表示删除全部

      // P0修复：forceFull 或历史不足时，都执行全量重建，避免只补近300天导致历史依旧残缺。
      if (forceFull || needsHistoryRepair) {
        const start = new Date();
        start.setDate(start.getDate() - defaultDays);
        startDate = start.toISOString().split('T')[0];
        deleteFromDate = false;  // false 表示删除全部
        syncType = 'full';
        console.log(
          `[StockDataService] ${forceFull ? '强制全量同步' : '补齐历史全量同步'} ${code} ${frequency}，从 ${startDate} 开始，共 ${defaultDays} 天`
        );
      } else if (localLatestDate) {
        // 增量同步：获取最近300天数据重算技术指标
        const minHistoryDays = 300;
        const start = new Date();
        start.setDate(start.getDate() - minHistoryDays);
        startDate = start.toISOString().split('T')[0];
        deleteFromDate = startDate;
        syncType = 'inc';
        console.log(`[StockDataService] 增量同步 ${code} ${frequency}，本地最新 ${localLatestDate}，baostock最新 ${latestDate}，从 ${startDate} 开始`);
      } else {
        // 全量同步
        const start = new Date();
        start.setDate(start.getDate() - defaultDays);
        startDate = start.toISOString().split('T')[0];
        console.log(`[StockDataService] 全量同步 ${code} ${frequency}，从 ${startDate} 开始，共 ${defaultDays} 天`);
      }

      const endDate = today;

      // 如果起始日期大于结束日期，无需同步
      if (startDate > endDate) {
        console.log(`[StockDataService] ${code} ${frequency} 日期无效，无需同步`);
        
        await client
          .from('stock_sync_status')
          .upsert({
            code,
            frequency,
            sync_status: 'success',
            last_sync_date: localLatestDate,
            last_sync_error: null,
            retry_count: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'code,frequency' });
        
        return {
          success: true,
          code,
          frequency,
          count: 0,
          newRecords: 0,
          updatedRecords: 0,
          message: '数据已是最新',
        };
      }

      // 3. 从 API 获取数据
      const apiData = await this.fetchFromApi(code, frequency, startDate, endDate);

      if (apiData.kline.length === 0) {
        // 无新数据，更新同步状态
        await client
          .from('stock_sync_status')
          .upsert({
            code,
            frequency,
            sync_status: 'success',
            last_sync_date: lastRecord?.trade_date || endDate, // 保持或使用今天
            last_sync_error: null,
            retry_count: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'code,frequency' });
        
        return {
          success: true,
          code,
          frequency,
          count: 0,
          newRecords: 0,
          updatedRecords: 0,
          message: '无新数据',
        };
      }

      // 4. 保存到数据库（传入删除起点）
      const savedCount = await this.saveToDatabase(code, frequency, apiData.kline, deleteFromDate);

      // 5. 更新同步状态
      const syncLatestDate = apiData.kline[apiData.kline.length - 1]?.date;
      // 如果没有新增记录（savedCount = 0），说明数据已是最新，记录今天为最后同步日期
      const finalSyncDate = savedCount > 0 && syncLatestDate 
        ? syncLatestDate.split(' ')[0] 
        : endDate;
      
      // 获取当前记录数
      const { count } = await client
        .from('stock_kline_data_v2')
        .select('*', { count: 'exact', head: true })
        .eq('code', code)
        .eq('frequency', frequency);
      
      await client
        .from('stock_sync_status')
        .upsert({
          code,
          frequency,
          last_sync_date: finalSyncDate,
          last_sync_at: new Date().toISOString(),
          record_count: count || savedCount,
          sync_type: syncType,
          sync_status: 'success',
          last_sync_error: null,
          retry_count: 0,
        }, { onConflict: 'code,frequency' });

      // 6. 更新股票信息同步时间
      await client
        .from('stock_info')
        .upsert({
          code,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: 'code' });

      return {
        success: true,
        code,
        frequency,
        count: apiData.kline.length,
        newRecords: savedCount,
        updatedRecords: 0,
        message: `同步完成，新增 ${savedCount} 条记录`,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '同步失败';
      console.error(`[StockDataService] 同步失败:`, errorMsg);
      
      // 更新同步状态为 failed，记录错误信息
      await client
        .from('stock_sync_status')
        .upsert({
          code,
          frequency,
          sync_status: 'failed',
          last_sync_error: errorMsg,
          last_sync_at: new Date().toISOString(),
          retry_count: 1,  // 每次失败增加重试计数
          updated_at: new Date().toISOString(),
        }, { onConflict: 'code,frequency' });
      
      return {
        success: false,
        code,
        frequency,
        count: 0,
        newRecords: 0,
        updatedRecords: 0,
        message: errorMsg,
      };
    }
  }

  /**
   * 从数据库获取数据
   */
  private async getFromDatabase(
    code: string,
    frequency: Frequency,
    startDate?: string,
    endDate?: string
  ): Promise<StockData | null> {
    const client = getSupabaseClient();

    // 先获取总数
    let countQuery = client
      .from('stock_kline_data_v2')
      .select('*', { count: 'exact', head: true })
      .eq('code', code)
      .eq('frequency', frequency);

    if (startDate) {
      countQuery = countQuery.gte('trade_date', startDate);
    }
    if (endDate) {
      countQuery = countQuery.lte('trade_date', endDate);
    }

    const { count, error: countError } = await countQuery;
    
    if (countError || !count || count === 0) {
      return null;
    }

    // 分页获取所有数据（每页1000条）
    const allData: any[] = [];
    const pageSize = 1000;
    const totalPages = Math.ceil(count / pageSize);

    for (let page = 0; page < totalPages; page++) {
      let dataQuery = client
        .from('stock_kline_data_v2')
        .select('*')
        .eq('code', code)
        .eq('frequency', frequency)
        .order('trade_date', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // 分钟级别数据需要按时间排序
      if (['5', '15', '30', '60'].includes(frequency)) {
        dataQuery = dataQuery.order('trade_time', { ascending: true });
      }

      if (startDate) {
        dataQuery = dataQuery.gte('trade_date', startDate);
      }
      if (endDate) {
        dataQuery = dataQuery.lte('trade_date', endDate);
      }

      const { data, error } = await dataQuery;

      if (error) {
        console.error('[StockDataService] DB query error:', error);
        break;
      }

      if (data && data.length > 0) {
        allData.push(...data);
      }
    }

    if (allData.length === 0) {
      return null;
    }

    // 获取最后同步时间
    const { data: syncStatus } = await client
      .from('stock_sync_status')
      .select('last_sync_at')
      .eq('code', code)
      .eq('frequency', frequency)
      .single();

    return {
      code,
      frequency,
      count: allData.length,
      source: 'database',
      kline: this.transformDbRecords(allData),
      lastSyncAt: syncStatus?.last_sync_at,
    };
  }

  /**
   * 判断错误是否需要重试
   */
  private shouldRetry(error: unknown): boolean {
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      return RETRY_ERROR_KEYWORDS.some(keyword => 
        errorMsg.includes(keyword.toLowerCase())
      );
    }
    return false;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 从 API 获取数据（带重试机制）
   */
  private async fetchFromApi(
    code: string,
    frequency: Frequency,
    startDate?: string,
    endDate?: string
  ): Promise<StockData> {
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || this.getDefaultStartDate(frequency);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
      try {
        console.log(`[StockDataService] API fetch attempt ${attempt}/${MAX_API_RETRIES}: ${code} ${frequency}`);
        
        // 增加 maxBuffer 以支持较大的数据量（10MB）
        const { stdout } = await execAsync(
          `python3 ${SCRIPT_PATH} kline ${code} ${start} ${end} ${frequency}`,
          { 
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024  // 10MB
          }
        );

        // 解析 JSON（过滤非 JSON 行）
        const lines = stdout.trim().split('\n');
        let jsonLine = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            jsonLine = trimmed;
            break;
          }
        }

        if (!jsonLine) {
          throw new Error('API 未返回有效数据');
        }

        const result = JSON.parse(jsonLine);

        // "未查询到数据" 是正常情况（如本周还没有周线数据），返回空数据而非错误
        if (!result.success && result.error === '未查询到数据') {
          console.log(`[StockDataService] ${code} ${frequency} 未查询到数据（可能是非交易时间段）`);
          return {
            code,
            frequency,
            count: 0,
            source: 'api',
            kline: [],
          };
        }

        if (!result.success) {
          const error = new Error(result.error || '获取数据失败');
          // 检查是否需要重试
          if (this.shouldRetry(error) && attempt < MAX_API_RETRIES) {
            console.warn(`[StockDataService] 尝试 ${attempt} 失败（可重试错误）: ${error.message}`);
            lastError = error;
            await this.delay(API_RETRY_DELAY);
            continue;
          }
          throw error;
        }

        // 成功获取数据
        console.log(`[StockDataService] API fetch 成功: ${code} ${frequency}, count: ${result.data.count}`);
        return {
          code,
          frequency,
          count: result.data.count,
          source: 'api',
          kline: this.transformApiRecords(result.data.kline),
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 检查是否需要重试
        if (this.shouldRetry(error) && attempt < MAX_API_RETRIES) {
          console.warn(`[StockDataService] 尝试 ${attempt} 失败（可重试错误）: ${lastError.message}`);
          await this.delay(API_RETRY_DELAY);
          continue;
        }
        
        // 不可重试的错误或已达到最大重试次数
        console.error(`[StockDataService] API fetch 失败 (attempt ${attempt}):`, lastError.message);
        throw lastError;
      }
    }

    // 所有重试都失败
    throw lastError || new Error('获取数据失败');
  }

  /**
   * 保存数据到数据库
   * 
   * 策略：先删除已存在的数据，再插入新数据
   * 这样可以避免唯一索引和 upsert 的兼容性问题
   * 
   * 唯一索引说明：
   * - 日线/周线：(code, frequency, trade_date) WHERE trade_time IS NULL
   * - 分钟级别：(code, frequency, trade_date, trade_time) WHERE trade_time IS NOT NULL
   * 
   * P0修复：保存失败时抛出错误，不再静默继续
   */
  private async saveToDatabase(
    code: string,
    frequency: Frequency,
    kline: KlineRecord[],
    deleteFromDate?: string | null | false  // false 表示删除全部，null/undefined 自动推断
  ): Promise<number> {
    if (kline.length === 0) return 0;

    const client = getSupabaseClient();
    const isMinuteData = MINUTE_FREQUENCIES.includes(frequency);
    
    const records = kline.map(item => {
      // 对于分钟数据，需要完整的时间戳
      let tradeDate: string;
      let tradeTime: string | null = null;
      
      if (isMinuteData) {
        // 分钟数据格式: "2026-02-27 09:30:00"
        if (item.date.includes(' ')) {
          const [datePart] = item.date.split(' ');
          tradeDate = datePart;
          tradeTime = item.date; // 完整的日期时间
        } else {
          tradeDate = item.date;
          tradeTime = item.date;
        }
      } else {
        // 日/周/月数据，只有日期
        tradeDate = item.date.split(' ')[0];
        tradeTime = null;
      }
      
      return {
        code,
        trade_date: tradeDate,
        trade_time: tradeTime,
        frequency,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        amount: item.amount,
        turnover_rate: item.turn,
        pct_chg: item.pctChg,
        ma5: item.ma5,
        ma10: item.ma10,
        ma20: item.ma20,
        ma55: item.ma55,
        ma233: item.ma233,
        macd: item.macd,
        macd_signal: item.macd_signal,
        macd_hist: item.macd_hist,
        boll_upper: item.boll_upper,
        boll_middle: item.boll_middle,
        boll_lower: item.boll_lower,
      };
    });

    // 策略：删除旧数据，再插入新数据
    // 这样可以避免重复数据和 upsert 兼容性问题
    const batchSize = 500;
    let savedCount = 0;
    const expectedCount = records.length;
    const failedRecords: string[] = [];

    // P0修复：支持全量删除
    // deleteFromDate 为 false 时，删除该 code+frequency 的所有数据
    if (deleteFromDate === false) {
      // 全量删除
      console.log(`[StockDataService] 全量删除 ${code} ${frequency} 的所有旧数据`);
      const { error: deleteError } = await client
        .from('stock_kline_data_v2')
        .delete()
        .eq('code', code)
        .eq('frequency', frequency);
      
      if (deleteError) {
        throw new Error(`删除旧数据失败: ${deleteError.message}`);
      }
    } else {
      // 确定删除范围
      const dates = [...new Set(records.map(r => r.trade_date))];
      const minDate = deleteFromDate || dates.reduce((a, b) => a < b ? a : b);
      const maxDate = dates.reduce((a, b) => a > b ? a : b);
      
      // 删除该日期范围内的旧数据
      console.log(`[StockDataService] 删除 ${code} ${frequency} 的旧数据 (${minDate} ~ ${maxDate})`);
      const { error: deleteError } = await client
        .from('stock_kline_data_v2')
        .delete()
        .eq('code', code)
        .eq('frequency', frequency)
        .gte('trade_date', minDate)
        .lte('trade_date', maxDate);
      
      if (deleteError) {
        throw new Error(`删除旧数据失败: ${deleteError.message}`);
      }
    }

    // 分批插入新数据
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error: insertError } = await client
        .from('stock_kline_data_v2')
        .insert(batch);
      
      if (insertError) {
        // P0修复：记录失败的批次
        console.error('[StockDataService] Batch insert error:', insertError.message);
        
        // 尝试逐条插入（兜底），但记录失败
        for (const record of batch) {
          const { error: singleError } = await client
            .from('stock_kline_data_v2')
            .insert(record);
          
          if (singleError) {
            failedRecords.push(`${record.trade_date}${record.trade_time ? ' ' + record.trade_time : ''}`);
          } else {
            savedCount++;
          }
        }
      } else {
        savedCount += batch.length;
      }
    }

    // P0修复：检查保存数量是否等于预期数量
    if (savedCount < expectedCount) {
      const errorMsg = `保存数据不完整: 预期 ${expectedCount} 条，实际保存 ${savedCount} 条`;
      console.error(`[StockDataService] ${errorMsg}`);
      console.error(`[StockDataService] 失败记录: ${failedRecords.slice(0, 10).join(', ')}${failedRecords.length > 10 ? '...' : ''}`);
      throw new Error(errorMsg);
    }

    console.log(`[StockDataService] 成功保存 ${savedCount} 条记录到数据库`);
    return savedCount;
  }

  /**
   * 判断数据是否为当天最新
   */
  private async isLatestData(kline: KlineRecord[], frequency: Frequency, code: string): Promise<boolean> {
    if (kline.length === 0) return false;

    const lastRecord = kline[kline.length - 1];
    const lastDate = lastRecord.date.split(' ')[0];
    const latestDate = await this.getBaostockLatestDate(code);
    const freshnessResult = checkDataFreshness(
      frequency as FreshnessFrequency,
      lastDate,
      latestDate,
      getCurrentTimeInfo()
    );
    return freshnessResult.isFresh;
  }

  /**
   * 获取默认起始日期
   */
  private getDefaultStartDate(frequency: Frequency): string {
    const days = DEFAULT_DAYS[frequency] || 365;
    const start = new Date();
    start.setDate(start.getDate() - days);
    return start.toISOString().split('T')[0];
  }

  /**
   * 转换数据库记录格式
   */
  private transformDbRecords(records: any[]): KlineRecord[] {
    return records.map(item => ({
      date: item.trade_time || item.trade_date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      amount: item.amount,
      turn: item.turnover_rate,
      pctChg: item.pct_chg,
      ma5: item.ma5,
      ma10: item.ma10,
      ma20: item.ma20,
      ma55: item.ma55,
      ma233: item.ma233,
      macd: item.macd,
      macd_signal: item.macd_signal,
      macd_hist: item.macd_hist,
      boll_upper: item.boll_upper,
      boll_middle: item.boll_middle,
      boll_lower: item.boll_lower,
    }));
  }

  /**
   * 转换 API 返回记录格式
   */
  private transformApiRecords(records: any[]): KlineRecord[] {
    return records.map(item => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      amount: item.amount,
      turn: item.turn ?? null,
      pctChg: item.pctChg ?? null,
      ma5: item.ma5 ?? null,
      ma10: item.ma10 ?? null,
      ma20: item.ma20 ?? null,
      ma55: item.ma55 ?? null,
      ma233: item.ma233 ?? null,
      macd: item.macd ?? null,
      macd_signal: item.macd_signal ?? null,
      macd_hist: item.macd_hist ?? null,
      boll_upper: item.boll_upper ?? null,
      boll_middle: item.boll_middle ?? null,
      boll_lower: item.boll_lower ?? null,
    }));
  }

  /**
   * 获取股票信息
   */
  async getStockInfo(code: string): Promise<StockInfo> {
    const client = getSupabaseClient();

    const { data: stockInfo } = await client
      .from('stock_info')
      .select('*')
      .eq('code', code)
      .single();

    const { data: syncStatus } = await client
      .from('stock_sync_status')
      .select('last_sync_at, last_sync_date')
      .eq('code', code)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single();

    // 查询日线数据的最后日期
    const { data: lastKline } = await client
      .from('stock_kline_data_v2')
      .select('trade_date')
      .eq('code', code)
      .eq('frequency', 'd')
      .order('trade_date', { ascending: false })
      .limit(1)
      .single();

    return {
      code,
      name: stockInfo?.name,
      market: stockInfo?.market,
      industry: stockInfo?.industry,
      listDate: stockInfo?.list_date,
      status: stockInfo?.status,
      lastSyncAt: syncStatus?.last_sync_at || stockInfo?.last_sync_at,
      lastDataDate: lastKline?.trade_date || syncStatus?.last_sync_date,
    };
  }

  /**
   * 更新股票基本信息
   */
  async updateStockInfo(code: string, info: Partial<StockInfo>): Promise<void> {
    const client = getSupabaseClient();
    
    await client
      .from('stock_info')
      .upsert({
        code,
        name: info.name,
        market: info.market,
        industry: info.industry,
        list_date: info.listDate,
        status: info.status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'code' });
  }
}

// 导出单例
export const stockDataService = new StockDataService();
