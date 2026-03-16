import { NextRequest, NextResponse } from 'next/server';
import { stockDataService, Frequency } from '@/services/stock-data.service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stock/sync - 同步股票数据
 * 
 * 请求体：
 * - code: 股票代码（必填）
 * - frequencies: 周期列表（默认 ['d']）
 * - days: 同步天数（可选，不传则根据周期自动计算合理天数）
 *   - 周线：1700天（约243周，满足MA233需求）
 *   - 日线：500天（满足MA233需求）
 *   - 60/30分钟：180天
 *   - 15分钟：90天
 * - mode: 同步模式（auto/full/inc，默认 auto）
 * 
 * 同步逻辑：
 * - auto: 自动判断，有数据则增量，无数据则全量
 * - full: 强制全量同步
 * - inc: 仅增量同步
 * 
 * P0修复：days 默认为 undefined，由服务层按周期自动计算合理天数
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      code, 
      frequencies = ['d'], 
      days,  // 不设默认值，由服务层按周期自动计算
      mode = 'auto'
    } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    console.log(`[Stock Sync API] 开始同步 ${code}, frequencies: ${frequencies.join(',')}, days: ${days}, mode: ${mode}`);

    // 转换频率格式
    const freqs = frequencies.map((f: string) => {
      const freqMap: Record<string, string> = {
        'd': 'd',
        'w': 'w',
        'm': 'm',
        '60min': '60',
        '30min': '30',
        '15min': '15',
        '5min': '5',
      };
      return freqMap[f] || f;
    }) as Frequency[];

    // P0修复：支持全量同步模式
    // mode: 'full' 强制删除所有数据重新拉取
    // mode: 'auto' 自动判断增量/全量
    const forceFull = mode === 'full';

    // 执行同步
    const results = await stockDataService.syncStockData(code, freqs, days, forceFull);

    // 更新持仓表中的股票名称
    const client = getSupabaseClient();
    const stockInfo = await stockDataService.getStockInfo(code);
    
    if (stockInfo.name) {
      await client
        .from('stock_holdings')
        .update({ name: stockInfo.name })
        .eq('code', code);
    }

    // 统计结果
    const totalRecords = results.reduce((sum, r) => sum + r.count, 0);
    const newRecords = results.reduce((sum, r) => sum + r.newRecords, 0);
    const successCount = results.filter(r => r.success).length;

    console.log(`[Stock Sync API] 同步完成: ${successCount}/${results.length} 成功, 新增 ${newRecords} 条`);

    return NextResponse.json({
      success: successCount > 0,
      data: {
        code,
        results: results.map(r => ({
          frequency: r.frequency,
          success: r.success,
          count: r.count,
          newRecords: r.newRecords,
          message: r.message,
        })),
        summary: {
          totalFrequencies: results.length,
          successCount,
          totalRecords,
          newRecords,
        },
        info: stockInfo,
      }
    });

  } catch (err) {
    console.error('[Stock Sync API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '同步失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stock/sync - 获取同步状态
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

    // 获取各周期的同步状态
    const { data: syncStatus } = await client
      .from('stock_sync_status')
      .select('*')
      .eq('code', code);

    // 获取数据统计
    const { data: stats } = await client
      .from('stock_kline_data_v2')
      .select('frequency')
      .eq('code', code);

    // 统计各周期记录数
    const countByFrequency: Record<string, number> = {};
    if (stats) {
      for (const item of stats) {
        countByFrequency[item.frequency] = (countByFrequency[item.frequency] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        code,
        syncStatus: syncStatus || [],
        recordCounts: countByFrequency,
      }
    });

  } catch (err) {
    console.error('[Stock Sync Status API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '获取状态失败' },
      { status: 500 }
    );
  }
}
