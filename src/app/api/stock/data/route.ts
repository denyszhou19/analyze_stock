import { NextRequest, NextResponse } from 'next/server';
import { stockDataService, Frequency } from '@/services/stock-data.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 频率映射（前端参数 -> 内部格式）
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

/**
 * GET /api/stock/data - 获取股票K线数据
 * 
 * 查询参数：
 * - code: 股票代码（必填）
 * - frequency: 数据周期（默认 d）
 * - start_date: 开始日期
 * - end_date: 结束日期
 * - force_refresh: 是否强制刷新（默认 false）
 * 
 * 返回逻辑：
 * 1. 如果数据库有当天最新数据，直接返回
 * 2. 如果数据库有数据但不是最新，返回数据库数据
 * 3. 如果数据库无数据，从API获取并保存
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const frequency = searchParams.get('frequency') || 'd';
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const force_refresh = searchParams.get('force_refresh') === 'true';

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    // 转换频率格式
    const freq = FREQUENCY_MAP[frequency] || frequency;

    console.log(`[Stock Data API] ${code} ${freq}, force_refresh: ${force_refresh}`);

    // 使用统一数据服务获取数据
    const data = await stockDataService.getKlineData(code, freq, {
      forceRefresh: force_refresh,
      startDate: start_date || undefined,
      endDate: end_date || undefined,
      saveToDb: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        code: data.code,
        frequency: data.frequency,
        count: data.count,
        source: data.source,
        isLatest: data.isLatest,
        lastSyncAt: data.lastSyncAt,
        kline: data.kline,
      }
    });

  } catch (err) {
    console.error('[Stock Data API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '获取数据失败' },
      { status: 500 }
    );
  }
}
