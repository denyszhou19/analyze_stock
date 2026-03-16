import { NextRequest, NextResponse } from 'next/server';
import { scheduler, TaskType, TaskMode } from '@/lib/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 可用的任务类型定义
const AVAILABLE_TASK_TYPES: Array<{
  type: TaskType;
  name: string;
  description: string;
}> = [
  {
    type: 'workflow',
    name: '早报分析',
    description: '获取路透早报并分析对持仓的影响',
  },
  // 未来可扩展其他任务类型
];

// GET /api/scheduler - 获取所有定时任务和执行日志
export async function GET(request: NextRequest) {
  try {
    await scheduler.initialize();
    
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    const jobs = await scheduler.getAllJobs();
    const logs = await scheduler.getJobLogs(jobId || undefined, 50);
    
    return NextResponse.json({
      success: true,
      data: {
        jobs,
        logs,
        availableTaskTypes: AVAILABLE_TASK_TYPES,
      }
    });
  } catch (err) {
    console.error('[Scheduler API] Error:', err);
    return NextResponse.json(
      { success: false, error: '获取定时任务失败' },
      { status: 500 }
    );
  }
}

// POST /api/scheduler - 创建定时任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      name, 
      taskType = 'workflow',
      taskMode = 'daily',
      cronExpr,       // 每日任务的 cron 表达式
      runAt,          // 一次性任务的执行时间
      enabled = true,
    } = body;

    // 验证任务类型
    const taskTypeDef = AVAILABLE_TASK_TYPES.find(t => t.type === taskType);
    if (!taskTypeDef) {
      return NextResponse.json(
        { success: false, error: `不支持的任务类型: ${taskType}` },
        { status: 400 }
      );
    }

    // 验证必要参数
    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: '缺少任务 ID 或名称' },
        { status: 400 }
      );
    }

    // 验证任务模式参数
    if (taskMode === 'daily') {
      if (!cronExpr) {
        return NextResponse.json(
          { success: false, error: '每日任务需要提供 cron 表达式' },
          { status: 400 }
        );
      }
    } else if (taskMode === 'once') {
      if (!runAt) {
        return NextResponse.json(
          { success: false, error: '一次性任务需要提供执行时间' },
          { status: 400 }
        );
      }
    }

    const result = await scheduler.addJob({
      id,
      name,
      taskType,
      taskMode,
      cronExpr,
      runAt,
      enabled,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '创建失败' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.job,
      message: taskMode === 'daily' 
        ? '定时任务创建成功，将按计划自动执行' 
        : '一次性任务创建成功，将在指定时间执行后自动删除',
    });
  } catch (err) {
    console.error('[Scheduler API] Error:', err);
    return NextResponse.json(
      { success: false, error: '创建定时任务失败' },
      { status: 500 }
    );
  }
}
