import { NextRequest, NextResponse } from 'next/server';
import { runStockAnalysis } from '@/lib/stock-analysis-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const levelsParam = searchParams.get('levels') || 'weekly,daily,hour60,hour30,hour15';
    const forceRefresh = searchParams.get('force_refresh') === 'true';
    const skipIntegrityCheck = searchParams.get('skip_integrity_check') === 'true';
    const levels = levelsParam.split(',').map(level => level.trim());

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    const result = await runStockAnalysis({
      code,
      levels,
      forceRefresh,
      skipIntegrityCheck,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          integrityCheck: result.integrityCheck,
          code: result.code,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (err) {
    console.error('[Stock Analysis] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '分析失败' },
      { status: 500 }
    );
  }
}
