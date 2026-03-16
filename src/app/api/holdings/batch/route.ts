import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { z } from 'zod';

// 单个股票项
const StockItemSchema = z.object({
  code: z.string().min(1, '股票代码不能为空'),
  name: z.string().min(1, '股票名称不能为空'),
});

// 批量导入请求
const BatchImportSchema = z.object({
  stocks: z.array(StockItemSchema).min(1, '股票列表不能为空'),
});

// POST /api/holdings/batch - 批量导入持仓
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证输入
    const result = BatchImportSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: '参数验证失败', details: result.error.issues },
        { status: 400 }
      );
    }

    const { stocks } = result.data;
    const client = getSupabaseClient();

    // 获取已存在的股票代码
    const codes = stocks.map(s => s.code);
    const { data: existing } = await client
      .from('stock_holdings')
      .select('code')
      .in('code', codes);

    const existingCodes = new Set(existing?.map(e => e.code) || []);
    
    // 过滤出不存在的股票
    const newStocks = stocks.filter(s => !existingCodes.has(s.code));
    
    if (newStocks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          added: 0,
          skipped: stocks.length,
          message: '所有股票已存在，无新增',
        }
      });
    }

    // 批量插入
    const { data, error } = await client
      .from('stock_holdings')
      .insert(newStocks)
      .select();

    if (error) {
      console.error('[Batch Import API] Insert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        added: data?.length || 0,
        skipped: existingCodes.size,
        items: data,
      }
    });
  } catch (err) {
    console.error('[Batch Import API] Error:', err);
    return NextResponse.json(
      { success: false, error: '批量导入失败' },
      { status: 500 }
    );
  }
}
