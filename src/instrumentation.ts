export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 确保 Homebrew 的 Python 在 PATH 中（macOS 本地开发）
    const HOMEBREW_BIN = '/opt/homebrew/bin';
    if (!process.env.PATH?.includes(HOMEBREW_BIN)) {
      process.env.PATH = `${HOMEBREW_BIN}:${process.env.PATH}`;
    }

    // 导入调度服务
    const { scheduler } = await import('@/lib/scheduler');
    const { registerWorkflowHandler } = await import('@/lib/scheduled-analysis');
    
    // 显式注册工作流处理器
    registerWorkflowHandler();
    
    // 初始化调度服务
    await scheduler.initialize();
    
    console.log('[Instrumentation] Scheduler service initialized');
  }
}
