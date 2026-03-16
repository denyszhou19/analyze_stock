import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/env-config - 获取环境变量配置
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        cozeApiToken: process.env.FIN_API_TOKEN || '',
        rssUrl: process.env.RSS_URL || '',
      }
    });
  } catch (err) {
    console.error('[Env Config API] Error:', err);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 }
    );
  }
}
