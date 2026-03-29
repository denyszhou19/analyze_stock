import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  checkDataFreshness,
  getBaostockLatestDate,
  getCurrentTimeInfo,
  type Frequency,
} from '@/lib/stock-freshness';
import {
  type DataIntegrityLevelStatus,
  type DataIntegritySnapshot,
  evaluateIntegrityLevelStatus,
} from '@/lib/stock-data-integrity';

const REQUIRED_LEVELS = [
  { key: 'w', name: '周线', icon: '📊', minRecords: 233, description: '大级别趋势判断，需满足MA233' },
  { key: 'd', name: '日线', icon: '📈', minRecords: 233, description: '主要操作级别，需满足MA233' },
  { key: '60', name: '60分钟', icon: '⏱️', minRecords: 233, description: '日内防守级别，需满足MA233' },
  { key: '30', name: '30分钟', icon: '⏰', minRecords: 233, description: '短线交易级别，需满足MA233' },
  { key: '15', name: '15分钟', icon: '⌚', minRecords: 233, description: '微观买卖点，需满足MA233' },
] as const;

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

function getExpectedRecords(frequency: string): number {
  const config = EXPECTED_RECORDS_CONFIG[frequency];
  if (!config) return 100;
  return Math.round(config.tradingDays * config.recordsPerDay);
}

export async function getDataIntegritySnapshot(code: string): Promise<DataIntegritySnapshot> {
  const client = getSupabaseClient();
  const timeInfo = getCurrentTimeInfo();
  const baostockLatestDate = await getBaostockLatestDate(code);

  const levels: DataIntegrityLevelStatus[] = await Promise.all(REQUIRED_LEVELS.map(async (level) => {
    const expectedRecords = getExpectedRecords(level.key);
    const expectedConfig = EXPECTED_RECORDS_CONFIG[level.key];

    const [countResult, lastRecordResult, syncStatusResult] = await Promise.all([
      client
        .from('stock_kline_data_v2')
        .select('*', { count: 'exact', head: true })
        .eq('code', code)
        .eq('frequency', level.key),
      client
        .from('stock_kline_data_v2')
        .select('trade_date')
        .eq('code', code)
        .eq('frequency', level.key)
        .order('trade_date', { ascending: false })
        .limit(1)
        .single(),
      client
        .from('stock_sync_status')
        .select('last_sync_date, sync_status, last_sync_error')
        .eq('code', code)
        .eq('frequency', level.key)
        .maybeSingle(),
    ]);

    const recordCount = countResult.count || 0;
    const lastRecord = lastRecordResult.data;
    const syncStatus = syncStatusResult.data;

    const lastDateStr = lastRecord?.trade_date
      ? (typeof lastRecord.trade_date === 'string'
          ? lastRecord.trade_date.split('T')[0]
          : new Date(lastRecord.trade_date).toISOString().split('T')[0])
      : null;

    const freshnessResult = checkDataFreshness(
      level.key as Frequency,
      lastDateStr,
      baostockLatestDate,
      timeInfo
    );

    const {
      status,
      statusText,
      needsSync,
      issues,
    } = evaluateIntegrityLevelStatus({
      level,
      recordCount,
      expectedRecords,
      lastDateStr,
      freshnessResult,
      syncStatus,
    });

    return {
      key: level.key,
      name: level.name,
      icon: level.icon,
      description: level.description,
      status,
      statusText,
      lastDate: lastDateStr,
      recordCount,
      expectedRecords,
      expectedDescription: expectedConfig.description,
      completeness: recordCount ? Math.round((recordCount / expectedRecords) * 100) : 0,
      minRecords: level.minRecords,
      needsSync,
      issues,
    };
  }));

  const okCount = levels.filter(level => level.status === 'ok').length;
  const staleCount = levels.filter(level => level.status === 'stale').length;
  const missingCount = levels.filter(level => level.status === 'missing').length;
  const errorCount = levels.filter(level => level.status === 'error').length;
  const pendingCount = levels.filter(level => level.status === 'pending').length;

  let overallStatus: DataIntegritySnapshot['summary']['overallStatus'] = 'ok';
  let overallText = '数据完整，可以分析';

  if (pendingCount > 0) {
    overallStatus = 'syncing';
    overallText = '数据同步中...';
  } else if (errorCount > 0) {
    overallStatus = 'error';
    overallText = `${levels.filter(level => level.status === 'error').map(level => level.name).join('、')}同步错误`;
  } else if (missingCount > 0) {
    overallStatus = 'error';
    overallText = `${levels.filter(level => level.status === 'missing').map(level => level.name).join('、')}无数据`;
  } else if (staleCount > 0) {
    overallStatus = 'error';
    overallText = `${levels.filter(level => level.status === 'stale').map(level => level.name).join('、')}数据过期`;
  }

  const canAnalyze = levels.every(level => level.status === 'ok');

  return {
    code,
    levels,
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
      needsSyncLevels: levels.filter(level => level.needsSync).map(level => level.key),
      canAnalyze,
      analyzeWarning: canAnalyze ? null : '数据不完整，请先同步数据后再分析',
    },
  };
}
