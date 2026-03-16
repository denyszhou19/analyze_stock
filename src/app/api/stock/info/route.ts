import { NextRequest, NextResponse } from 'next/server';
import { stockDataService } from '@/services/stock-data.service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stock/info - 获取股票信息
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

    // 使用统一数据服务获取信息
    const info = await stockDataService.getStockInfo(code);

    // 如果没有名称，尝试从持仓表获取
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

    return NextResponse.json({
      success: true,
      data: info,
    });

  } catch (err) {
    console.error('[Stock Info API] Error:', err);
    return NextResponse.json(
      { success: true, data: {} }, // 即使失败也返回空数据
      { status: 200 }
    );
  }
}
