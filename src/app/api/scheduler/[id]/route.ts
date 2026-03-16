import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/scheduler/[id] - 删除定时任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 动态导入避免循环依赖
    const { scheduler } = await import('@/lib/scheduler');
    const result = await scheduler.deleteJob(id);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '删除失败' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Scheduler API] Error:', err);
    return NextResponse.json(
      { success: false, error: '删除任务失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/scheduler/[id] - 切换任务状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '缺少 enabled 参数' },
        { status: 400 }
      );
    }

    const { scheduler } = await import('@/lib/scheduler');
    const result = await scheduler.toggleJob(id);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '任务不存在或更新失败' },
        { status: 404 }
      );
    }
    
    const jobs = await scheduler.getAllJobs();
    const job = jobs.find(j => j.id === id);
    
    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    console.error('[Scheduler API] Error:', err);
    return NextResponse.json(
      { success: false, error: '更新任务失败' },
      { status: 500 }
    );
  }
}

// POST /api/scheduler/[id] - 立即触发任务（异步执行）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 确保处理器已注册
    try {
      const { registerWorkflowHandler } = await import('@/lib/scheduled-analysis');
      registerWorkflowHandler();
    } catch (err) {
      console.error('[Scheduler API] Failed to register handler:', err);
    }
    
    const { scheduler } = await import('@/lib/scheduler');
    const result = await scheduler.runJobNow(id);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '触发失败' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '任务已触发，正在后台执行，请稍后在执行日志中查看结果',
      logId: result.logId,
    });
  } catch (err) {
    console.error('[Scheduler API] Error:', err);
    return NextResponse.json(
      { success: false, error: '触发任务失败' },
      { status: 500 }
    );
  }
}
