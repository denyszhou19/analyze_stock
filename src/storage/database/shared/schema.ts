import { pgTable, serial, timestamp, varchar, index, boolean, text, integer, bigint, numeric, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 系统健康检查表（由 Supabase 系统创建，必须保留）
export const healthCheck = pgTable("health_check", {
  id: serial("id").primaryKey(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 股票基本信息表
export const stockInfo = pgTable(
  "stock_info",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    bsCode: varchar("bs_code", { length: 30 }),
    name: varchar("name", { length: 50 }),
    market: varchar("market", { length: 20 }),
    industry: varchar("industry", { length: 50 }),
    listDate: date("list_date"),
    status: varchar("status", { length: 20 }).default('上市'),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  },
  (table) => [
    index("stock_info_code_idx").on(table.code),
  ]
);

// 股票K线数据表（核心表）
export const stockKlineData = pgTable(
  "stock_kline_data_v2",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    code: varchar("code", { length: 20 }).notNull(),
    tradeDate: date("trade_date").notNull(),
    tradeTime: timestamp("trade_time", { withTimezone: true }),
    frequency: varchar("frequency", { length: 10 }).notNull(),
    // OHLCV 基础数据
    open: numeric("open", { precision: 12, scale: 4 }),
    high: numeric("high", { precision: 12, scale: 4 }),
    low: numeric("low", { precision: 12, scale: 4 }),
    close: numeric("close", { precision: 12, scale: 4 }),
    volume: bigint("volume", { mode: "number" }),
    amount: numeric("amount", { precision: 18, scale: 2 }),
    // 辅助指标
    turnoverRate: numeric("turnover_rate", { precision: 8, scale: 4 }),
    pctChg: numeric("pct_chg", { precision: 8, scale: 4 }),
    // 均线指标
    ma5: numeric("ma5", { precision: 12, scale: 4 }),
    ma10: numeric("ma10", { precision: 12, scale: 4 }),
    ma20: numeric("ma20", { precision: 12, scale: 4 }),
    ma55: numeric("ma55", { precision: 12, scale: 4 }),
    ma233: numeric("ma233", { precision: 12, scale: 4 }),
    // MACD 指标
    macd: numeric("macd", { precision: 12, scale: 6 }),
    macdSignal: numeric("macd_signal", { precision: 12, scale: 6 }),
    macdHist: numeric("macd_hist", { precision: 12, scale: 6 }),
    // 布林带指标
    bollUpper: numeric("boll_upper", { precision: 12, scale: 4 }),
    bollMiddle: numeric("boll_middle", { precision: 12, scale: 4 }),
    bollLower: numeric("boll_lower", { precision: 12, scale: 4 }),
    // 系统字段
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_kline_v2_code").on(table.code),
    index("idx_kline_v2_date").on(table.tradeDate),
    index("idx_kline_v2_frequency").on(table.frequency),
    index("idx_kline_v2_code_freq").on(table.code, table.frequency),
    index("idx_kline_v2_code_freq_date").on(table.code, table.frequency, table.tradeDate),
    // 注意：唯一索引使用部分索引，需要在 SQL 中定义，Drizzle ORM 不支持部分索引语法
    // uk_kline_v2_daily_weekly: (code, frequency, trade_date) WHERE trade_time IS NULL
    // uk_kline_v2_minute: (code, frequency, trade_date, trade_time) WHERE trade_time IS NOT NULL
  ]
);

// 数据同步状态表
export const stockSyncStatus = pgTable(
  "stock_sync_status",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    code: varchar("code", { length: 20 }).notNull(),
    frequency: varchar("frequency", { length: 10 }).notNull(),
    lastSyncDate: date("last_sync_date"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    recordCount: integer("record_count").default(0),
    syncType: varchar("sync_type", { length: 20 }).default('full'),
    syncStatus: varchar("sync_status", { length: 20 }).default('pending'),  // pending/syncing/success/failed
    lastSyncError: text("last_sync_error"),
    retryCount: integer("retry_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("stock_sync_status_code_freq_idx").on(table.code, table.frequency),
  ]
);

// 持仓股票表
export const stockHoldings = pgTable(
  "stock_holdings",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("stock_holdings_code_idx").on(table.code),
  ]
);

// 定时任务表（新表名避免与旧表冲突）
export const cronJobs = pgTable(
  "cron_jobs",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    taskType: varchar("task_type", { length: 20 }).default('workflow').notNull(),
    cronExpr: varchar("cron_expr", { length: 100 }),
    runAt: timestamp("run_at", { withTimezone: true }),
    enabled: boolean("enabled").default(true).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastResult: text("last_result"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("cron_jobs_enabled_idx").on(table.enabled),
    index("cron_jobs_type_idx").on(table.taskType),
  ]
);

// 任务执行日志表
export const jobLogs = pgTable(
  "job_logs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    jobId: varchar("job_id", { length: 100 }).notNull(),
    jobName: varchar("job_name", { length: 200 }).notNull(),
    taskType: varchar("task_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).default('pending').notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    duration: integer("duration"),
    result: text("result"),
    error: text("error"),
    triggerSource: varchar("trigger_source", { length: 20 }).default('scheduled').notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("job_logs_job_id_idx").on(table.jobId),
    index("job_logs_status_idx").on(table.status),
    index("job_logs_created_at_idx").on(table.createdAt),
  ]
);

// Zod schemas
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

export const insertStockHoldingSchema = createCoercedInsertSchema(stockHoldings).pick({
  code: true,
  name: true,
});

export const updateStockHoldingSchema = createCoercedInsertSchema(stockHoldings)
  .pick({
    code: true,
    name: true,
  })
  .partial();

export const insertCronJobSchema = createCoercedInsertSchema(cronJobs).pick({
  id: true,
  name: true,
  cronExpr: true,
  runAt: true,
  enabled: true,
  taskType: true,
});

export const updateCronJobSchema = createCoercedInsertSchema(cronJobs)
  .pick({
    name: true,
    enabled: true,
    lastRunAt: true,
    nextRunAt: true,
    lastResult: true,
  })
  .partial();

export const insertJobLogSchema = createCoercedInsertSchema(jobLogs).pick({
  jobId: true,
  jobName: true,
  taskType: true,
  status: true,
  triggerSource: true,
});

export const updateJobLogSchema = createCoercedInsertSchema(jobLogs)
  .pick({
    status: true,
    startedAt: true,
    finishedAt: true,
    duration: true,
    result: true,
    error: true,
  })
  .partial();

// TypeScript types
export type StockHolding = typeof stockHoldings.$inferSelect;
export type InsertStockHolding = z.infer<typeof insertStockHoldingSchema>;
export type UpdateStockHolding = z.infer<typeof updateStockHoldingSchema>;
export type StockInfo = typeof stockInfo.$inferSelect;
export type StockKlineData = typeof stockKlineData.$inferSelect;
export type StockSyncStatus = typeof stockSyncStatus.$inferSelect;
export type CronJob = typeof cronJobs.$inferSelect;
export type InsertCronJob = z.infer<typeof insertCronJobSchema>;
export type UpdateCronJob = z.infer<typeof updateCronJobSchema>;
export type JobLog = typeof jobLogs.$inferSelect;
export type InsertJobLog = z.infer<typeof insertJobLogSchema>;
export type UpdateJobLog = z.infer<typeof updateJobLogSchema>;

// 任务类型枚举
export type TaskTypeEnum = 'workflow';
export type TaskModeEnum = 'once' | 'daily';
