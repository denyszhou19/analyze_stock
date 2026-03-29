import { NextRequest, NextResponse } from 'next/server';
import { getDataIntegritySnapshot } from '@/lib/stock-data-integrity-service';
import { prepareStockAnalysisBootstrap, type BootstrapStage } from '@/lib/stock-analysis-bootstrap';
import type { Frequency } from '@/services/stock-data.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_FREQUENCIES: Frequency[] = ['w', 'd', '60', '30', '15'];

function normalizeRequestedLevels(levels: unknown): Frequency[] {
  return Array.isArray(levels)
    ? levels.filter((level): level is Frequency => REQUIRED_FREQUENCIES.includes(level as Frequency))
    : [];
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const {
      code,
      forceSync = false,
      maxRetries = 2,
      levels: requestedLevelsRaw = [],
      stream = false,
    } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    const requestedLevels = normalizeRequestedLevels(requestedLevelsRaw);
    const wantsStream = stream === true || request.headers.get('accept')?.includes('text/event-stream');

    if (!wantsStream) {
      const result = await prepareStockAnalysisBootstrap({
        code,
        forceSync,
        maxRetries,
        levels: requestedLevels,
      });

      return NextResponse.json(
        result.success
          ? { success: true, data: result.data }
          : { success: false, error: result.error, data: result.data },
        { status: result.status }
      );
    }

    const sendEvent = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

    const stageToEvent = (stage: BootstrapStage, meta?: Record<string, unknown>) => ({
      type: 'stage',
      stage,
      ...(meta || {}),
    });

    const responseStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(sendEvent({ type: 'connected' }));

        try {
          const result = await prepareStockAnalysisBootstrap({
            code,
            forceSync,
            maxRetries,
            levels: requestedLevels,
            onStage: async (stage, meta) => {
              controller.enqueue(sendEvent(stageToEvent(stage, meta)));
            },
          });

          if (result.success) {
            controller.enqueue(sendEvent({ type: 'result', success: true, data: result.data }));
          } else {
            controller.enqueue(sendEvent({
              type: 'error',
              success: false,
              error: result.error,
              data: result.data,
            }));
          }
        } catch (error) {
          console.error('[Prepare Analysis API] Stream error:', error);
          controller.enqueue(sendEvent({
            type: 'error',
            success: false,
            error: error instanceof Error ? error.message : '准备失败',
          }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[Prepare Analysis API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '准备失败' },
      { status: 500 }
    );
  }
}

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

    const integrity = await getDataIntegritySnapshot(code);

    return NextResponse.json({
      success: true,
      data: {
        ready: integrity.summary.canAnalyze,
        code,
        needsSync: integrity.summary.needsSyncLevels,
        summary: integrity.summary,
        levels: integrity.levels,
        integrity,
      },
    });
  } catch (err) {
    console.error('[Prepare Analysis API] GET Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '检查失败' },
      { status: 500 }
    );
  }
}
