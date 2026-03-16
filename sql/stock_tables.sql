-- 股票数据表结构设计
-- 支持存储近5年的多周期K线数据
-- 注意：所有时间字段使用 TIMESTAMP (without time zone)，与 schema.ts 保持一致

-- 1. 股票基本信息表
CREATE TABLE IF NOT EXISTS stock_info (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,           -- 股票代码（如 000001）
    bs_code VARCHAR(30),                         -- baostock格式代码（如 sz.000001）
    name VARCHAR(50),                            -- 股票名称
    market VARCHAR(20),                          -- 市场类型（sh/sz/hk）
    industry VARCHAR(50),                        -- 所属行业
    list_date DATE,                              -- 上市日期
    status VARCHAR(20) DEFAULT '上市',           -- 状态（上市/退市/停牌）
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_sync_at TIMESTAMP                      -- 最后同步时间
);

-- 2. 股票K线数据表（核心表）- V2版本
-- 注意：旧表 stock_kline_data 已废弃，使用 stock_kline_data_v2
-- 迁移原因：修复唯一索引设计缺陷（NULL值处理）
CREATE TABLE IF NOT EXISTS stock_kline_data_v2 (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,                   -- 股票代码
    trade_date DATE NOT NULL,                    -- 交易日期（日线及以上）
    trade_time TIMESTAMP WITH TIME ZONE,         -- 交易时间（分钟级别使用）
    frequency VARCHAR(10) NOT NULL,              -- 周期（d/w/m/5/15/30/60）
    
    -- OHLCV 基础数据
    open NUMERIC(12, 4),                         -- 开盘价
    high NUMERIC(12, 4),                         -- 最高价
    low NUMERIC(12, 4),                          -- 最低价
    close NUMERIC(12, 4),                        -- 收盘价
    volume BIGINT,                               -- 成交量（股）
    amount NUMERIC(20, 4),                       -- 成交额（元）
    
    -- 辅助指标
    turnover_rate NUMERIC(10, 4),                -- 换手率（%）
    pct_chg NUMERIC(10, 4),                      -- 涨跌幅（%）
    
    -- 均线指标
    ma5 NUMERIC(12, 4),                          -- 5日均线
    ma10 NUMERIC(12, 4),                         -- 10日均线
    ma20 NUMERIC(12, 4),                         -- 20日均线
    ma55 NUMERIC(12, 4),                         -- 55日均线
    ma233 NUMERIC(12, 4),                        -- 233日均线
    
    -- MACD 指标
    macd NUMERIC(12, 6),                         -- DIF
    macd_signal NUMERIC(12, 6),                  -- DEA
    macd_hist NUMERIC(12, 6),                    -- MACD柱状图 (DIF-DEA)*2
    
    -- 布林带指标
    boll_upper NUMERIC(12, 4),                   -- 布林上轨
    boll_middle NUMERIC(12, 4),                  -- 布林中轨
    boll_lower NUMERIC(12, 4),                   -- 布林下轨
    
    -- 系统字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建普通索引
CREATE INDEX IF NOT EXISTS idx_kline_v2_code ON stock_kline_data_v2(code);
CREATE INDEX IF NOT EXISTS idx_kline_v2_date ON stock_kline_data_v2(trade_date);
CREATE INDEX IF NOT EXISTS idx_kline_v2_frequency ON stock_kline_data_v2(frequency);
CREATE INDEX IF NOT EXISTS idx_kline_v2_code_freq ON stock_kline_data_v2(code, frequency);
CREATE INDEX IF NOT EXISTS idx_kline_v2_code_freq_date ON stock_kline_data_v2(code, frequency, trade_date);

-- 唯一约束：使用部分索引分别处理日线/周线和分钟级别
-- 日线/周线级别（trade_time 为 NULL）
CREATE UNIQUE INDEX IF NOT EXISTS uk_kline_v2_daily_weekly
ON stock_kline_data_v2 (code, frequency, trade_date)
WHERE trade_time IS NULL;

-- 分钟级别（trade_time 不为 NULL）
CREATE UNIQUE INDEX IF NOT EXISTS uk_kline_v2_minute
ON stock_kline_data_v2 (code, frequency, trade_date, trade_time)
WHERE trade_time IS NOT NULL;

-- 3. 数据同步状态表
CREATE TABLE IF NOT EXISTS stock_sync_status (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    frequency VARCHAR(10) NOT NULL,
    last_sync_date DATE,                         -- 最后同步的日期
    last_sync_at TIMESTAMP,                      -- 最后同步时间
    record_count INTEGER DEFAULT 0,              -- 当前记录数
    sync_type VARCHAR(20) DEFAULT 'full',        -- 同步类型（full/inc）
    sync_status VARCHAR(20) DEFAULT 'pending',   -- 同步状态（pending/syncing/success/failed）
    last_sync_error TEXT,                        -- 最后同步错误信息
    retry_count INTEGER DEFAULT 0,               -- 重试次数
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT uk_sync_status UNIQUE (code, frequency)
);

-- 4. 持仓股票表
CREATE TABLE IF NOT EXISTS stock_holdings (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holdings_code ON stock_holdings(code);

-- 5. 定时任务表
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    task_type VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_result TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_tasks_enabled_idx ON scheduled_tasks(enabled);
CREATE INDEX IF NOT EXISTS scheduled_tasks_type_idx ON scheduled_tasks(task_type);
CREATE INDEX IF NOT EXISTS scheduled_tasks_next_run_idx ON scheduled_tasks(next_run_at);

-- 6. 任务执行日志表
-- 注意：时间戳字段使用 TIMESTAMPTZ（带时区）
CREATE TABLE IF NOT EXISTS task_execution_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id VARCHAR(100) NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    duration INTEGER,
    result TEXT,
    error TEXT,
    trigger_source VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_execution_logs_task_id_idx ON task_execution_logs(task_id);
CREATE INDEX IF NOT EXISTS task_execution_logs_status_idx ON task_execution_logs(status);
CREATE INDEX IF NOT EXISTS task_execution_logs_created_at_idx ON task_execution_logs(created_at);

-- 7. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为已存在的触发器使用 DROP IF EXISTS + CREATE
DROP TRIGGER IF EXISTS trigger_stock_info_updated ON stock_info;
CREATE TRIGGER trigger_stock_info_updated
    BEFORE UPDATE ON stock_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_stock_kline_updated ON stock_kline_data_v2;
CREATE TRIGGER trigger_stock_kline_updated
    BEFORE UPDATE ON stock_kline_data_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_sync_status_updated ON stock_sync_status;
CREATE TRIGGER trigger_sync_status_updated
    BEFORE UPDATE ON stock_sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_holdings_updated ON stock_holdings;
CREATE TRIGGER trigger_holdings_updated
    BEFORE UPDATE ON stock_holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_scheduled_tasks_updated ON scheduled_tasks;
CREATE TRIGGER trigger_scheduled_tasks_updated
    BEFORE UPDATE ON scheduled_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 8. 注释
COMMENT ON TABLE stock_info IS '股票基本信息表';
COMMENT ON TABLE stock_kline_data_v2 IS '股票K线数据表V2，存储多周期历史数据（修复唯一索引设计）';
COMMENT ON TABLE stock_sync_status IS '数据同步状态表，记录各周期数据的同步情况';
COMMENT ON TABLE stock_holdings IS '持仓股票表';
COMMENT ON TABLE scheduled_tasks IS '定时任务表';
COMMENT ON TABLE task_execution_logs IS '任务执行日志表';

COMMENT ON COLUMN stock_kline_data_v2.frequency IS '数据周期：d=日线，w=周线，m=月线，5=5分钟，15=15分钟，30=30分钟，60=60分钟';
