#!/usr/bin/env npx tsx
/**
 * 数据库初始化脚本
 * 在部署时自动创建缺失的表
 */

import * as pg from 'pg';

const Client = pg.Client;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000, // 10秒连接超时
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // 1. 创建 stock_holdings 表
    console.log('Creating stock_holdings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_holdings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) NOT NULL,
        name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_holdings_code ON stock_holdings(code)`);

    // 2. 创建 cron_jobs 表（定时任务）
    console.log('Creating cron_jobs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        task_type VARCHAR(20) NOT NULL DEFAULT 'workflow',
        cron_expr VARCHAR(100),
        run_at TIMESTAMP WITH TIME ZONE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_run_at TIMESTAMP WITH TIME ZONE,
        next_run_at TIMESTAMP WITH TIME ZONE,
        last_result TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS cron_jobs_enabled_idx ON cron_jobs(enabled)`);
    await client.query(`CREATE INDEX IF NOT EXISTS cron_jobs_type_idx ON cron_jobs(task_type)`);

    // 3. 创建 job_logs 表（执行日志）
    console.log('Creating job_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_logs (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id VARCHAR(100) NOT NULL,
        job_name VARCHAR(200) NOT NULL,
        task_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        started_at TIMESTAMP WITH TIME ZONE,
        finished_at TIMESTAMP WITH TIME ZONE,
        duration INTEGER,
        result TEXT,
        error TEXT,
        trigger_source VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS job_logs_job_id_idx ON job_logs(job_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS job_logs_status_idx ON job_logs(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS job_logs_created_at_idx ON job_logs(created_at)`);

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    // 不抛出错误，允许服务继续启动
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('Failed to initialize database:', e);
  process.exit(0); // 不阻止部署
});
