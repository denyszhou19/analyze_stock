import { NextRequest, NextResponse } from 'next/server';
import { getDataIntegritySnapshot } from '@/lib/stock-data-integrity-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const integrityData = await getDataIntegritySnapshot(code);

    return NextResponse.json({
      success: true,
      data: integrityData,
    });

  } catch (err) {
    console.error('[Data Integrity API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '检查失败' },
      { status: 500 }
    );
  }
}
