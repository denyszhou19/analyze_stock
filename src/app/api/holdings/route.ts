import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { type StockHolding } from '@/storage/database/shared/schema';
import { stockDataService } from '@/services/stock-data.service';

// GET /api/holdings - 获取所有持仓
export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('stock_holdings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Holdings API] Fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data as StockHolding[] });
  } catch (err) {
    console.error('[Holdings API] Error:', err);
    return NextResponse.json(
      { success: false, error: '获取持仓失败' },
      { status: 500 }
    );
  }
}

// POST /api/holdings - 添加持仓
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 简单验证
    const { code, name } = body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, error: '股票代码不能为空' },
        { status: 400 }
      );
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: '股票名称不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查是否已存在
    const { data: existing } = await client
      .from('stock_holdings')
      .select('id')
      .eq('code', code)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '该股票代码已存在' },
        { status: 400 }
      );
    }

    // 插入新持仓
    const { data, error } = await client
      .from('stock_holdings')
      .insert({ code, name })
      .select()
      .single();

    if (error) {
      console.error('[Holdings API] Insert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 后台同步股票数据（不阻塞响应）
    stockDataService.syncStockData(code, ['d'] as any)
      .then(results => {
        console.log(`[Holdings API] 自动同步 ${code} 完成:`, results);
      })
      .catch(err => {
        console.error(`[Holdings API] 自动同步 ${code} 失败:`, err);
      });

    return NextResponse.json({ success: true, data: data as StockHolding });
  } catch (err) {
    console.error('[Holdings API] Error:', err);
    return NextResponse.json(
      { success: false, error: '添加持仓失败' },
      { status: 500 }
    );
  }
}
