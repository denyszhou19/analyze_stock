import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// DELETE /api/holdings/[id] - 删除持仓
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少持仓 ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('stock_holdings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Holdings API] Delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Holdings API] Error:', err);
    return NextResponse.json(
      { success: false, error: '删除持仓失败' },
      { status: 500 }
    );
  }
}

// PUT /api/holdings/[id] - 更新持仓
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少持仓 ID' },
        { status: 400 }
      );
    }

    // 简单验证：只允许更新 code 和 name
    const updateData: { code?: string; name?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    
    if (body.code !== undefined) {
      if (typeof body.code !== 'string' || !body.code.trim()) {
        return NextResponse.json(
          { success: false, error: '股票代码无效' },
          { status: 400 }
        );
      }
      updateData.code = body.code.trim();
    }
    
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { success: false, error: '股票名称无效' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('stock_holdings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Holdings API] Update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[Holdings API] Error:', err);
    return NextResponse.json(
      { success: false, error: '更新持仓失败' },
      { status: 500 }
    );
  }
}
