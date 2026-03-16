import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 同步状态响应类型
 */
interface SyncStatusItem {
  code: string;
  frequency: string;
  lastSyncDate: string | null;
  lastSyncAt: string | null;
  recordCount: number;
  syncType: string;
  syncStatus: string;
  lastSyncError: string | null;
  retryCount: number;
}

// 周期列表
const FREQUENCIES = ['w', 'd', '60', '30', '15', '5'];

/**
 * GET /api/stock/sync-status - 获取股票同步状态
 * 
 * 查询参数：
 * - code: 股票代码（可选，不传则返回所有股票的同步状态）
 * - status: 过滤状态（可选：failed/syncing/success/pending）
 * 
 * 返回：
 * - success: 是否成功
 * - data: 同步状态列表
 * - hasErrors: 是否有错误
 * - errorCodes: 有错误的股票代码列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const status = searchParams.get('status');

    const client = getSupabaseClient();
    
    // 构建查询
    let query = client
      .from('stock_sync_status')
      .select('*');
    
    if (code) {
      query = query.eq('code', code);
    }
    
    if (status) {
      query = query.eq('sync_status', status);
    }
    
    // 按更新时间倒序
    query = query.order('updated_at', { ascending: false });
    
    const { data, error } = await query;

    if (error) {
      console.error('[Sync Status API] Query error:', error);
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    // 处理数据
    // 如果指定了股票代码，优先从 K 线数据表获取实际日期（确保数据一致性）
    let syncStatusList: SyncStatusItem[] = [];
    
    if (code) {
      // 对于指定股票，从 K 线数据表获取实际的最新日期
      for (const freq of FREQUENCIES) {
        // 从 K 线数据表查询该周期的最新数据
        const { data: klineData, error: klineError } = await client
          .from('stock_kline_data_v2')
          .select('trade_date')
          .eq('code', code)
          .eq('frequency', freq)
          .order('trade_date', { ascending: false })
          .limit(1);
        
        // 查询该周期的总记录数
        const { count } = await client
          .from('stock_kline_data_v2')
          .select('*', { count: 'exact', head: true })
          .eq('code', code)
          .eq('frequency', freq);
        
        // 查找同步状态表中的记录
        const syncRecord = (data || []).find((item: any) => item.frequency === freq);
        
        // 处理日期格式 - 优先使用 K 线数据表的实际日期
        let lastDateStr: string | null = null;
        if (!klineError && klineData && klineData.length > 0) {
          const lastDate = klineData[0].trade_date;
          lastDateStr = typeof lastDate === 'string' 
            ? lastDate.split('T')[0] 
            : new Date(lastDate).toISOString().split('T')[0];
        }
        
        syncStatusList.push({
          code,
          frequency: freq,
          lastSyncDate: lastDateStr, // 使用 K 线数据表的实际日期
          lastSyncAt: syncRecord?.last_sync_at || null,
          recordCount: count || 0,
          syncType: syncRecord?.sync_type || 'unknown',
          syncStatus: syncRecord?.sync_status || 'pending',
          lastSyncError: syncRecord?.last_sync_error || null,
          retryCount: syncRecord?.retry_count || 0,
        });
      }
    } else {
      // 未指定股票代码时，使用同步状态表的数据
      syncStatusList = (data || []).map((item: any) => ({
        code: item.code,
        frequency: item.frequency,
        lastSyncDate: item.last_sync_date ? item.last_sync_date.split('T')[0] : null,
        lastSyncAt: item.last_sync_at,
        recordCount: item.record_count || 0,
        syncType: item.sync_type || 'full',
        syncStatus: item.sync_status || 'pending',
        lastSyncError: item.last_sync_error,
        retryCount: item.retry_count || 0,
      }));
    }

    // 筛选有错误的股票代码（去重）
    const errorCodes = [...new Set(
      syncStatusList
        .filter(item => item.syncStatus === 'failed')
        .map(item => item.code)
    )];

    return NextResponse.json({
      success: true,
      data: syncStatusList,
      summary: {
        total: syncStatusList.length,
        failed: syncStatusList.filter(i => i.syncStatus === 'failed').length,
        syncing: syncStatusList.filter(i => i.syncStatus === 'syncing').length,
        success: syncStatusList.filter(i => i.syncStatus === 'success').length,
        pending: syncStatusList.filter(i => i.syncStatus === 'pending').length,
      },
      hasErrors: errorCodes.length > 0,
      errorCodes,
    });

  } catch (err) {
    console.error('[Sync Status API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stock/sync-status - 重试失败的同步
 * 
 * 请求体：
 * - code: 股票代码（可选，不传则重试所有失败的）
 * - frequency: 周期（可选）
 * 
 * 返回：
 * - success: 是否成功
 * - message: 操作结果消息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, frequency } = body;

    const client = getSupabaseClient();
    
    // 构建查询条件：只重置失败状态
    let query = client
      .from('stock_sync_status')
      .update({
        sync_status: 'pending',
        retry_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('sync_status', 'failed');
    
    if (code) {
      query = query.eq('code', code);
    }
    
    if (frequency) {
      query = query.eq('frequency', frequency);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('[Sync Status API] Reset error:', error);
      return NextResponse.json(
        { success: false, error: '重置失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `已重置 ${data?.length || 0} 条失败的同步状态，可重新触发同步`,
      resetCount: data?.length || 0,
    });

  } catch (err) {
    console.error('[Sync Status API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '操作失败' },
      { status: 500 }
    );
  }
}
