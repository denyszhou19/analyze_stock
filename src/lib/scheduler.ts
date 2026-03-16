import * as cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ============== 类型定义 ==============

/** 任务类型 - 可扩展 */
export type TaskType = 'workflow';

/** 任务执行模式 */
export type TaskMode = 'once' | 'daily';

/** 任务状态 */
export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

/** 触发来源 */
export type TriggerSource = 'scheduled' | 'manual';

/** 任务处理器函数 */
export type TaskHandler = (taskId: string) => Promise<{ success: boolean; message: string; data?: unknown }>;

/** 定时任务定义 */
export interface CronJob {
  id: string;
  name: string;
  taskType: TaskType;
  taskMode: TaskMode;
  cronExpr?: string;      // 每日任务的 cron 表达式
  runAt?: string;         // 一次性任务的执行时间
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 任务执行日志 */
export interface JobLog {
  id: string;
  jobId: string;
  jobName: string;
  taskType: TaskType;
  status: TaskStatus;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  result?: string;
  error?: string;
  triggerSource: TriggerSource;
  createdAt: string;
}

/** 任务类型定义 */
export interface TaskTypeDefinition {
  type: TaskType;
  name: string;
  description: string;
  handler?: TaskHandler;
}

// ============== 全局变量（避免热更新导致单例失效） ==============

declare global {
  // eslint-disable-next-line no-var
  var __schedulerInstance: SchedulerService | undefined;
  // eslint-disable-next-line no-var
  var __taskHandlers: Map<TaskType, TaskHandler> | undefined;
}

function getGlobalHandlers(): Map<TaskType, TaskHandler> {
  if (!globalThis.__taskHandlers) {
    globalThis.__taskHandlers = new Map();
  }
  return globalThis.__taskHandlers;
}

// ============== 调度器服务 ==============

class SchedulerService {
  private instanceId = Math.random().toString(36).substring(7);
  private cronJobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();
  private timeoutJobs: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;

  private get taskHandlers(): Map<TaskType, TaskHandler> {
    return getGlobalHandlers();
  }

  /** 注册任务处理器 */
  registerHandler(taskType: TaskType, handler: TaskHandler): void {
    this.taskHandlers.set(taskType, handler);
    console.log(`[Scheduler:${this.instanceId}] Registered handler: ${taskType}`);
  }

  /** 初始化：从数据库加载所有启用的任务 */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[Scheduler] Initializing...');
    
    try {
      const client = getSupabaseClient();
      
      // 加载循环任务（每日执行）
      const { data: dailyJobs, error: dailyError } = await client
        .from('cron_jobs')
        .select('*')
        .eq('enabled', true)
        .is('run_at', null);
      
      if (dailyError) {
        console.error('[Scheduler] Failed to load daily jobs:', dailyError);
      }
      
      if (dailyJobs && dailyJobs.length > 0) {
        for (const job of dailyJobs) {
          await this.scheduleDailyJob({
            id: job.id,
            name: job.name,
            taskType: job.task_type as TaskType,
            taskMode: 'daily',
            cronExpr: job.cron_expr,
            enabled: job.enabled,
          });
        }
        console.log(`[Scheduler] Loaded ${dailyJobs.length} daily jobs`);
      }
      
      // 加载一次性任务
      const { data: onceJobs, error: onceError } = await client
        .from('cron_jobs')
        .select('*')
        .eq('enabled', true)
        .not('run_at', 'is', null);
      
      if (onceError) {
        console.error('[Scheduler] Failed to load once jobs:', onceError);
      }
      
      if (onceJobs && onceJobs.length > 0) {
        for (const job of onceJobs) {
          await this.scheduleOnceJob({
            id: job.id,
            name: job.name,
            taskType: job.task_type as TaskType,
            taskMode: 'once',
            runAt: job.run_at,
            enabled: job.enabled,
          });
        }
        console.log(`[Scheduler] Loaded ${onceJobs.length} once jobs`);
      }
      
      this.initialized = true;
    } catch (err) {
      console.error('[Scheduler] Initialize error:', err);
    }
  }

  /** 调度每日循环任务 */
  private async scheduleDailyJob(job: CronJob): Promise<void> {
    this.stopJob(job.id);
    
    if (!job.enabled || !job.cronExpr) return;
    
    if (!cron.validate(job.cronExpr)) {
      console.error(`[Scheduler] Invalid cron: ${job.cronExpr}`);
      return;
    }
    
    const cronJob = cron.schedule(job.cronExpr, async () => {
      // 异步执行，不等待
      this.executeJobAsync(job.id, job.name, job.taskType, 'scheduled');
    }, {
      timezone: 'Asia/Shanghai',
    });
    
    this.cronJobs.set(job.id, cronJob);
    console.log(`[Scheduler] Daily job ${job.id} scheduled: ${job.cronExpr}`);
    
    await this.updateNextRunTime(job.id, job.cronExpr);
  }

  /** 调度一次性任务 */
  private async scheduleOnceJob(job: CronJob): Promise<void> {
    this.stopJob(job.id);
    
    if (!job.enabled || !job.runAt) return;
    
    const scheduledDate = new Date(job.runAt);
    const now = new Date();
    
    if (scheduledDate <= now) {
      console.log(`[Scheduler] Once job ${job.id} time passed, executing now`);
      this.executeJobAsync(job.id, job.name, job.taskType, 'scheduled');
      await this.deleteJob(job.id);
      return;
    }
    
    // 使用 setTimeout 实现一次性任务调度
    const delay = scheduledDate.getTime() - now.getTime();
    const timer = setTimeout(async () => {
      this.executeJobAsync(job.id, job.name, job.taskType, 'scheduled');
      await this.deleteJob(job.id);
    }, delay);
    
    // 将 timer 存储以便取消
    this.timeoutJobs.set(job.id, timer);
    console.log(`[Scheduler] Once job ${job.id} scheduled at: ${job.runAt}`);
    
    // 更新下次执行时间
    const client = getSupabaseClient();
    await client
      .from('cron_jobs')
      .update({
        next_run_at: scheduledDate.toISOString(),
        cron_expr: `once:${scheduledDate.toISOString()}`,
      })
      .eq('id', job.id);
  }

  /** 停止任务 */
  private stopJob(jobId: string): void {
    // 停止 cron 任务
    const cronJob = this.cronJobs.get(jobId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(jobId);
    }
    
    // 停止 timeout 任务
    const timeoutJob = this.timeoutJobs.get(jobId);
    if (timeoutJob) {
      clearTimeout(timeoutJob);
      this.timeoutJobs.delete(jobId);
    }
  }

  /** 异步执行任务（不等待结果） */
  private async executeJobAsync(
    jobId: string,
    jobName: string,
    taskType: TaskType,
    triggerSource: TriggerSource
  ): Promise<void> {
    // 不等待执行结果
    this.executeJob(jobId, jobName, taskType, triggerSource).catch(err => {
      console.error(`[Scheduler] Job ${jobId} execution error:`, err);
    });
  }

  /** 执行任务 */
  async executeJob(
    jobId: string,
    jobName: string,
    taskType: TaskType,
    triggerSource: TriggerSource = 'scheduled'
  ): Promise<JobLog> {
    const startTime = Date.now();
    
    // 任务超时时间（默认 5 分钟）
    const TASK_TIMEOUT = 5 * 60 * 1000;
    
    // 创建执行日志
    const client = getSupabaseClient();
    const { data: logData, error: logError } = await client
      .from('job_logs')
      .insert({
        job_id: jobId,
        job_name: jobName,
        task_type: taskType,
        status: 'running',
        started_at: new Date().toISOString(),
        trigger_source: triggerSource,
      })
      .select()
      .single();
    
    const logId = logData?.id;
    
    if (logError) {
      console.error('[Scheduler] Failed to create execution log:', logError);
    }
    
    console.log(`[Scheduler:${this.instanceId}] Executing job ${jobId}: ${jobName}`);

    let status: TaskStatus = 'success';
    let result = '';
    let error = '';

    try {
      const handler = this.taskHandlers.get(taskType);
      if (!handler) {
        throw new Error(`No handler for task type: ${taskType}`);
      }
      
      // 添加超时包装
      const handlerResult = await Promise.race([
        handler(jobId),
        new Promise<{ success: false; message: string }>((_, reject) => 
          setTimeout(() => reject(new Error('任务执行超时（超过 5 分钟）')), TASK_TIMEOUT)
        ),
      ]) as { success: boolean; message: string };
      
      if (handlerResult.success) {
        status = 'success';
        result = handlerResult.message;
      } else {
        status = 'failed';
        error = handlerResult.message;
      }
      
      await this.updateJobAfterRun(jobId, status === 'success', result || error);
      
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] Job ${jobId} failed:`, error);
      await this.updateJobAfterRun(jobId, false, error);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 更新执行日志
    if (logId) {
      await client
        .from('job_logs')
        .update({
          status,
          finished_at: new Date().toISOString(),
          duration,
          result: result || null,
          error: error || null,
        })
        .eq('id', logId);
    }

    // 更新下次执行时间（仅对循环任务）
    const { data: jobData } = await client
      .from('cron_jobs')
      .select('cron_expr, run_at')
      .eq('id', jobId)
      .single();
    
    if (jobData?.cron_expr && !jobData.run_at) {
      await this.updateNextRunTime(jobId, jobData.cron_expr);
    }

    return {
      id: logId || '',
      jobId,
      jobName,
      taskType,
      status,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date(endTime).toISOString(),
      duration,
      result,
      error,
      triggerSource,
      createdAt: new Date().toISOString(),
    };
  }

  /** 更新任务执行后状态 */
  private async updateJobAfterRun(jobId: string, success: boolean, result: string): Promise<void> {
    try {
      const client = getSupabaseClient();
      await client
        .from('cron_jobs')
        .update({
          last_run_at: new Date().toISOString(),
          last_result: result,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch (err) {
      console.error('[Scheduler] Update job after run error:', err);
    }
  }

  /** 更新下次执行时间 */
  private async updateNextRunTime(jobId: string, cronExpr: string): Promise<void> {
    try {
      const interval = CronExpressionParser.parse(cronExpr, {
        tz: 'Asia/Shanghai',
      });
      const nextRun = interval.next().toDate();
      
      const client = getSupabaseClient();
      await client
        .from('cron_jobs')
        .update({
          next_run_at: nextRun.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch (err) {
      console.error('[Scheduler] Update next run time error:', err);
    }
  }

  /** 添加任务 */
  async addJob(job: {
    id: string;
    name: string;
    taskType: TaskType;
    taskMode: TaskMode;
    cronExpr?: string;   // 每日任务必填
    runAt?: string;      // 一次性任务必填
    enabled?: boolean;
  }): Promise<{ success: boolean; job?: CronJob; error?: string }> {
    try {
      const client = getSupabaseClient();
      
      // 验证参数
      if (job.taskMode === 'daily' && !job.cronExpr) {
        return { success: false, error: '每日任务需要提供 cron 表达式' };
      }
      
      if (job.taskMode === 'once' && !job.runAt) {
        return { success: false, error: '一次性任务需要提供执行时间' };
      }
      
      // 检查是否已存在
      const { data: existing } = await client
        .from('cron_jobs')
        .select('id')
        .eq('id', job.id)
        .single();
      
      const jobData = {
        id: job.id,
        name: job.name,
        task_type: job.taskType,
        cron_expr: job.cronExpr || null,
        run_at: job.runAt || null,
        enabled: job.enabled ?? true,
        updated_at: new Date().toISOString(),
      };
      
      if (existing) {
        // 更新
        const { error: updateError } = await client
          .from('cron_jobs')
          .update(jobData)
          .eq('id', job.id);
        
        if (updateError) {
          return { success: false, error: updateError.message };
        }
        
        const newJob: CronJob = {
          ...job,
          enabled: job.enabled ?? true,
        } as CronJob;
        
        if (newJob.enabled) {
          if (job.taskMode === 'daily') {
            await this.scheduleDailyJob(newJob);
          } else {
            await this.scheduleOnceJob(newJob);
          }
        } else {
          this.stopJob(job.id);
        }
        
        console.log(`[Scheduler] Job ${job.id} updated`);
        return { success: true, job: newJob };
      }
      
      // 创建
      const { error: insertError } = await client
        .from('cron_jobs')
        .insert({
          ...jobData,
          created_at: new Date().toISOString(),
        });
      
      if (insertError) {
        return { success: false, error: insertError.message };
      }
      
      const newJob: CronJob = {
        ...job,
        enabled: job.enabled ?? true,
      } as CronJob;
      
      if (newJob.enabled) {
        if (job.taskMode === 'daily') {
          await this.scheduleDailyJob(newJob);
        } else {
          await this.scheduleOnceJob(newJob);
        }
      }
      
      console.log(`[Scheduler] Job ${job.id} created`);
      return { success: true, job: newJob };
      
    } catch (err) {
      console.error('[Scheduler] Add job error:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** 删除任务 */
  async deleteJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.stopJob(jobId);
      
      const client = getSupabaseClient();
      const { error } = await client
        .from('cron_jobs')
        .delete()
        .eq('id', jobId);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      console.log(`[Scheduler] Job ${jobId} deleted`);
      return { success: true };
    } catch (err) {
      console.error('[Scheduler] Delete job error:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** 切换任务启用状态 */
  async toggleJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = getSupabaseClient();
      const { data: job } = await client
        .from('cron_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (!job) {
        return { success: false, error: '任务不存在' };
      }
      
      const newEnabled = !job.enabled;
      
      await client
        .from('cron_jobs')
        .update({
          enabled: newEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      
      if (newEnabled) {
        const cronJob: CronJob = {
          id: job.id,
          name: job.name,
          taskType: job.task_type as TaskType,
          taskMode: job.run_at ? 'once' : 'daily',
          cronExpr: job.cron_expr || undefined,
          runAt: job.run_at || undefined,
          enabled: true,
        };
        
        if (cronJob.taskMode === 'daily') {
          await this.scheduleDailyJob(cronJob);
        } else {
          await this.scheduleOnceJob(cronJob);
        }
      } else {
        this.stopJob(jobId);
      }
      
      return { success: true };
    } catch (err) {
      console.error('[Scheduler] Toggle job error:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** 立即执行任务（异步，不等待） */
  async runJobNow(jobId: string): Promise<{ success: boolean; logId?: string; error?: string }> {
    try {
      const client = getSupabaseClient();
      const { data: job } = await client
        .from('cron_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (!job) {
        return { success: false, error: '任务不存在' };
      }
      
      // 创建执行日志（立即返回日志ID）
      const { data: logData, error: logError } = await client
        .from('job_logs')
        .insert({
          job_id: jobId,
          job_name: job.name,
          task_type: job.task_type,
          status: 'pending',
          trigger_source: 'manual',
        })
        .select()
        .single();
      
      if (logError || !logData) {
        return { success: false, error: '创建执行日志失败' };
      }
      
      // 异步执行任务（不等待）
      this.executeJob(job.id, job.name, job.task_type as TaskType, 'manual').catch(err => {
        console.error(`[Scheduler] Job ${jobId} execution error:`, err);
      });
      
      return { success: true, logId: logData.id };
    } catch (err) {
      console.error('[Scheduler] Run job now error:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** 获取所有任务 */
  async getAllJobs(): Promise<CronJob[]> {
    try {
      const client = getSupabaseClient();
      const { data: jobs, error } = await client
        .from('cron_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[Scheduler] Get all jobs error:', error);
        return [];
      }
      
      return (jobs || []).map(job => ({
        id: job.id,
        name: job.name,
        taskType: job.task_type as TaskType,
        taskMode: job.run_at ? 'once' : 'daily',
        cronExpr: job.cron_expr || undefined,
        runAt: job.run_at || undefined,
        enabled: job.enabled,
        lastRunAt: job.last_run_at || undefined,
        nextRunAt: job.next_run_at || undefined,
        lastResult: job.last_result || undefined,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      }));
    } catch (err) {
      console.error('[Scheduler] Get all jobs error:', err);
      return [];
    }
  }

  /** 获取任务执行日志 */
  async getJobLogs(jobId?: string, limit: number = 50): Promise<JobLog[]> {
    try {
      const client = getSupabaseClient();
      let query = client
        .from('job_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data: logs, error } = await query;
      
      if (error) {
        console.error('[Scheduler] Get job logs error:', error);
        return [];
      }
      
      return (logs || []).map(log => ({
        id: log.id,
        jobId: log.job_id,
        jobName: log.job_name,
        taskType: log.task_type as TaskType,
        status: log.status as TaskStatus,
        startedAt: log.started_at || undefined,
        finishedAt: log.finished_at || undefined,
        duration: log.duration || undefined,
        result: log.result || undefined,
        error: log.error || undefined,
        triggerSource: log.trigger_source as TriggerSource,
        createdAt: log.created_at,
      }));
    } catch (err) {
      console.error('[Scheduler] Get job logs error:', err);
      return [];
    }
  }
}

// 单例模式 - 每次都返回新实例以确保方法存在（开发模式）
function getScheduler(): SchedulerService {
  // 在开发模式下，总是创建新实例以确保最新代码
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__schedulerInstance = new SchedulerService();
    return globalThis.__schedulerInstance;
  }
  
  if (!globalThis.__schedulerInstance) {
    globalThis.__schedulerInstance = new SchedulerService();
  }
  return globalThis.__schedulerInstance;
}

export const scheduler = getScheduler();
