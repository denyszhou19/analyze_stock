import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { 
  checkDataFreshness, 
  getBaostockLatestDate, 
  getCurrentTimeInfo,
  Frequency
} from '@/lib/stock-freshness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 三位一体分析实际使用的级别（不包含5分钟）
// P0修复：minRecords 必须满足 MA233 计算需求（至少 233 条）
const REQUIRED_LEVELS = [
  { key: 'w', name: '周线', icon: '📊', minRecords: 233, description: '大级别趋势判断，需满足MA233' },
  { key: 'd', name: '日线', icon: '📈', minRecords: 233, description: '主要操作级别，需满足MA233' },
  { key: '60', name: '60分钟', icon: '⏱️', minRecords: 233, description: '日内防守级别，需满足MA233' },
  { key: '30', name: '30分钟', icon: '⏰', minRecords: 233, description: '短线交易级别，需满足MA233' },
  { key: '15', name: '15分钟', icon: '⌚', minRecords: 233, description: '微观买卖点，需满足MA233' },
];

// 各周期应有的数据条目配置
// P0修复：tradingDays 必须满足 MA233 计算需求
const EXPECTED_RECORDS_CONFIG: Record<string, { 
  tradingDays: number;
  recordsPerDay: number;
  description: string;
}> = {
  'w': { tradingDays: 233, recordsPerDay: 1, description: '约243周（满足MA233）' },
  'd': { tradingDays: 250, recordsPerDay: 1, description: '约250个交易日（满足MA233）' },
  '60': { tradingDays: 125, recordsPerDay: 4, description: '约500根（满足MA233）' },
  '30': { tradingDays: 125, recordsPerDay: 8, description: '约1000根（满足MA233）' },
  '15': { tradingDays: 62, recordsPerDay: 16, description: '约1000根（满足MA233）' },
};

/**
 * 计算应有数据条目数
 */
function getExpectedRecords(frequency: string): number {
  const config = EXPECTED_RECORDS_CONFIG[frequency];
  if (!config) return 100;
  return Math.round(config.tradingDays * config.recordsPerDay);
}

/**
 * GET /api/stock/data-integrity - 检查股票数据完整性
 * 
 * P1修复：使用统一的 stock-freshness 模块判定数据新鲜度
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    
    // P1修复：使用统一的 getCurrentTimeInfo
    const timeInfo = getCurrentTimeInfo();
    
    // P1修复：使用统一的 getBaostockLatestDate
    const baostockLatestDate = await getBaostockLatestDate(code);

    const levelStatuses: any[] = [];

    for (const level of REQUIRED_LEVELS) {
      const expectedRecords = getExpectedRecords(level.key);
      const expectedConfig = EXPECTED_RECORDS_CONFIG[level.key];
      
      // 1. 获取 K 线数据统计
      const { count: recordCount } = await client
        .from('stock_kline_data_v2')
        .select('*', { count: 'exact', head: true })
        .eq('code', code)
        .eq('frequency', level.key);

      // 2. 获取最新数据日期
      const { data: lastRecord } = await client
        .from('stock_kline_data_v2')
        .select('trade_date')
        .eq('code', code)
        .eq('frequency', level.key)
        .order('trade_date', { ascending: false })
        .limit(1)
        .single();

      // 3. 检查同步状态
      const { data: syncStatus } = await client
        .from('stock_sync_status')
        .select('last_sync_date, sync_status, last_sync_error')
        .eq('code', code)
        .eq('frequency', level.key)
        .maybeSingle();

      const lastDateStr = lastRecord?.trade_date 
        ? (typeof lastRecord.trade_date === 'string' 
            ? lastRecord.trade_date.split('T')[0] 
            : new Date(lastRecord.trade_date).toISOString().split('T')[0])
        : null;

      // 4. 判断数据状态
      let status: 'ok' | 'stale' | 'missing' | 'error' | 'pending' = 'missing';
      let statusText = '无数据';
      let needsSync = true;
      let issues: string[] = [];

      // 正在同步中
      if (syncStatus?.sync_status === 'syncing') {
        status = 'pending';
        statusText = '同步中...';
        needsSync = false;
      } else if (recordCount && recordCount > 0) {
        // P1修复：使用统一的 checkDataFreshness
        const freshnessResult = checkDataFreshness(level.key as Frequency, lastDateStr, baostockLatestDate, timeInfo);
        
        // 数据完整度用于展示，分析门槛以 minRecords 为准。
        const currentRecordCount = recordCount || 0;
        const completeness = currentRecordCount / expectedRecords;
        const hasMinimumRecords = currentRecordCount >= level.minRecords;
        
        if (freshnessResult.isFresh && hasMinimumRecords) {
          status = 'ok';
          statusText = freshnessResult.reason;
          needsSync = false;
        } else if (!hasMinimumRecords) {
          status = 'stale';
          statusText = '记录不足';
          issues.push(`记录数不足: ${currentRecordCount}/${level.minRecords}`);
        } else {
          status = 'stale';
          statusText = freshnessResult.reason;
          issues.push(`${level.name}数据过期`);
        }
      }

      // 检查同步错误
      if (syncStatus?.last_sync_error) {
        status = 'error';
        statusText = '同步错误';
        issues.push(syncStatus.last_sync_error);
      }

      // 没有数据记录
      if ((!recordCount || recordCount === 0) && status !== 'pending') {
        status = 'missing';
        statusText = '无数据';
        issues.push('需要同步数据');
      }

      levelStatuses.push({
        key: level.key,
        name: level.name,
        icon: level.icon,
        description: level.description,
        status,
        statusText,
        lastDate: lastDateStr,
        recordCount: recordCount || 0,
        expectedRecords,
        expectedDescription: expectedConfig?.description,
        completeness: recordCount ? Math.round((recordCount / expectedRecords) * 100) : 0,
        minRecords: level.minRecords,
        needsSync,
        issues,
      });
    }

    // 计算整体状态
    const okCount = levelStatuses.filter(l => l.status === 'ok').length;
    const staleCount = levelStatuses.filter(l => l.status === 'stale').length;
    const missingCount = levelStatuses.filter(l => l.status === 'missing').length;
    const errorCount = levelStatuses.filter(l => l.status === 'error').length;
    const pendingCount = levelStatuses.filter(l => l.status === 'pending').length;

    let overallStatus: 'ok' | 'warning' | 'error' | 'syncing' = 'ok';
    let overallText = '数据完整，可以分析';
    
    const missingLevels = levelStatuses.filter(l => l.status === 'missing');
    const staleLevels = levelStatuses.filter(l => l.status === 'stale');
    const errorLevels = levelStatuses.filter(l => l.status === 'error');

    if (pendingCount > 0) {
      overallStatus = 'syncing';
      overallText = '数据同步中...';
    } else if (errorCount > 0) {
      overallStatus = 'error';
      overallText = errorLevels.length > 0 
        ? `${errorLevels.map(l => l.name).join('、')}同步错误`
        : '同步错误';
    } else if (missingCount > 0) {
      overallStatus = 'error';
      overallText = `${missingLevels.map(l => l.name).join('、')}无数据`;
    } else if (staleCount > 0) {
      overallStatus = 'error';
      overallText = `${staleLevels.map(l => l.name).join('、')}数据过期`;
    }

    // 所有级别都必须 OK 才能分析
    const canAnalyze = levelStatuses.every(l => l.status === 'ok');

    return NextResponse.json({
      success: true,
      data: {
        code,
        levels: levelStatuses,
        baostockLatestDate,
        currentTime: timeInfo.todayStr,
        isWeekend: timeInfo.isWeekend,
        summary: {
          overallStatus,
          overallText,
          okCount,
          staleCount,
          missingCount,
          errorCount,
          pendingCount,
          totalLevels: REQUIRED_LEVELS.length,
          needsSyncLevels: levelStatuses.filter(l => l.needsSync).map(l => l.key),
          canAnalyze,
          analyzeWarning: canAnalyze ? null : '数据不完整，请先同步数据后再分析',
        },
      },
    });

  } catch (err) {
    console.error('[Data Integrity API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '检查失败' },
      { status: 500 }
    );
  }
}
