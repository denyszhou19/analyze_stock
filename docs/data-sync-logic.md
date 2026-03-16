# 股票数据同步逻辑说明

## 概述

本文档梳理股票数据同步的完整逻辑，包括各级别同步策略、前端 Loading 状态管理、并发控制机制等。

---

## 一、数据级别与周期配置

### 1.1 三位一体分析使用的级别

| 级别 | 标识 | 数据周期 | 预期条目 | 用途 |
|------|------|----------|----------|------|
| 周线 | `w` | 约104周（2年） | 104条 | 大级别趋势判断 |
| 日线 | `d` | 约250个交易日（1年） | 250条 | 主要操作级别 |
| 60分钟 | `60` | 约500根（半年） | 500条 | 日内防守级别 |
| 30分钟 | `30` | 约1000根（半年） | 1000条 | 短线交易级别 |
| 15分钟 | `15` | 约1000根（季度） | 1000条 | 微观买卖点 |

### 1.2 同步天数配置

```typescript
// 各周期默认数据天数
const DEFAULT_DAYS: Record<string, number> = {
  'w': 730,    // 周线：2年
  'd': 365,    // 日线：1年
  '60': 180,   // 60分钟：半年
  '30': 180,   // 30分钟：半年
  '15': 90,    // 15分钟：3个月
};
```

---

## 二、同步流程总览

### 2.1 分析页面加载流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     分析页面加载流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 页面初始化                                                   │
│     └─> isLoading = true, isChecking = true                     │
│                                                                 │
│  2. 检查数据完整性 (GET /api/stock/data-integrity)              │
│     ├─> 查询 baostock 最新日期                                   │
│     ├─> 检查各级别数据状态                                       │
│     └─> 返回 { canAnalyze, needsSyncLevels }                    │
│                                                                 │
│  3. 判断是否需要同步                                             │
│     ├─> needsSyncLevels.length > 0 且 !skipSync                 │
│     │   └─> 触发同步 (POST /api/stock/sync)                     │
│     │       └─> isSyncing = true                                │
│     │                                                           │
│     └─> 数据完整，直接进入分析                                   │
│                                                                 │
│  4. 执行三位一体分析 (GET /api/stock/analysis)                  │
│     └─> 返回分析结果                                             │
│                                                                 │
│  5. 完成                                                         │
│     └─> isLoading = false, isSyncing = false                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 同步触发入口

| 入口 | 触发条件 | 说明 |
|------|----------|------|
| 分析页面加载 | `needsSyncLevels.length > 0` | 自动同步缺失数据 |
| DataIntegrityAlert 组件 | 用户点击"同步数据"按钮 | 手动触发同步 |
| SyncStatusAlert 组件 | 用户点击"重试"按钮 | 重试失败的同步 |
| K线图页面 | 用户点击"刷新数据"按钮 | 强制刷新当前级别 |

---

## 三、单级别同步详细逻辑

### 3.1 同步流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                 syncSingleFrequency(code, frequency)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 步骤1: 并发控制检查                                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  检查 sync_status 是否为 'syncing'                       │   │
│  │  ├─> 是 syncing:                                         │   │
│  │  │   ├─> 检查是否超时 (>5分钟)                            │   │
│  │  │   │   └─> 超时: 重置状态为 'failed'，继续同步          │   │
│  │  │   │   └─> 未超时: 等待2秒后重试 (最多30次)             │   │
│  │  │   │       └─> 超过30次: 返回失败                       │   │
│  │  │   └─> 继续                                            │   │
│  │  └─> 不是 syncing: 继续                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 步骤2: 设置同步状态                                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  更新 sync_status = 'syncing'                            │   │
│  │  更新 updated_at = 当前时间                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 步骤3: 检查数据是否最新                                   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  1. 获取本地最新数据日期 (localLatestDate)               │   │
│  │  2. 获取 baostock 最新日期 (baostockLatestDate)          │   │
│  │  3. 比较: localLatestDate >= baostockLatestDate ?        │   │
│  │     └─> 是: 数据已是最新，跳过同步                        │   │
│  │         更新 sync_status = 'success'                     │   │
│  │         返回 { success: true, message: '数据已是最新' }   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 步骤4: 确定同步类型                                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  if (本地有数据) {                                        │   │
│  │    // 增量同步                                            │   │
│  │    startDate = 今天 - 300天                               │   │
│  │    deleteFromDate = startDate                             │   │
│  │    syncType = 'inc'                                       │   │
│  │  } else {                                                 │   │
│  │    // 全量同步                                            │   │
│  │    startDate = 今天 - defaultDays                         │   │
│  │    deleteFromDate = null                                  │   │
│  │    syncType = 'full'                                      │   │
│  │  }                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 步骤5: 从 baostock 获取数据                               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  调用 Python 脚本获取 K线数据                             │   │
│  │  支持重试 (最多3次，间隔2秒)                              │   │
│  │  计算技术指标: MA5/MA10/MA20/MA55/MA233, MACD, BOLL      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 步骤6: 保存到数据库                                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  1. 删除日期范围内的旧数据                                │   │
│  │     (DELETE FROM stock_kline_data_v2                     │   │
│  │      WHERE trade_date >= minDate AND trade_date <= max)  │   │
│  │  2. 分批插入新数据 (每批500条)                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 步骤7: 更新同步状态                                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  更新 sync_status = 'success'                            │   │
│  │  更新 last_sync_date = 最新数据日期                       │   │
│  │  清空 last_sync_error                                    │   │
│  │  重置 retry_count = 0                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 删除旧数据的原因

**为什么增量同步要删除旧数据再插入？**

技术指标（MA、MACD、BOLL）需要基于历史数据计算：

```
示例：MA55（55日均线）
┌──────────────────────────────────────────────────────────────┐
│ 旧数据: [Day1 ... Day55] → MA55_Day55 = avg(Day1~Day55)      │
│                                                              │
│ 新数据: [Day56 ... Day60]                                    │
│                                                              │
│ 如果只是追加:                                                │
│   [Day1 ... Day55, Day56 ... Day60]                         │
│   → MA55_Day60 = avg(Day6~Day60)  ← 正确                    │
│   → 但 MA55_Day55 没更新，仍是旧的！                         │
│                                                              │
│ 所以需要删除最近300天数据，重新计算所有技术指标               │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 周线特殊处理

周线数据每周更新一次，判断逻辑不同：

```typescript
// 周线判断逻辑
if (frequency === 'w') {
  // 计算上周五的日期
  const today = new Date();
  const dayOfWeek = today.getDay();
  let daysToLastFriday;
  
  if (dayOfWeek === 0) daysToLastFriday = 2;      // 周日 → 2天前是周五
  else if (dayOfWeek === 6) daysToLastFriday = 1; // 周六 → 1天前是周五
  else daysToLastFriday = dayOfWeek + 2;          // 周一~周五 → 上周五
  
  const lastFriday = today - daysToLastFriday;
  
  // 周线日期 >= 上周五，就是正常的
  if (周线数据日期 >= lastFriday) {
    return { isStale: false };
  }
}
```

---

## 四、并发控制机制

### 4.1 等待重试机制

```typescript
const MAX_WAIT_RETRIES = 30;  // 最多等待30次
const WAIT_INTERVAL = 2000;   // 每次等待2秒
const SYNC_TIMEOUT = 5 * 60 * 1000;  // 同步超时：5分钟

for (let retry = 0; retry <= MAX_WAIT_RETRIES; retry++) {
  // 检查同步状态
  if (sync_status !== 'syncing') {
    break;  // 可以继续同步
  }
  
  // 检查是否超时
  if (Date.now() - updated_at > SYNC_TIMEOUT) {
    // 重置状态，允许后续同步
    sync_status = 'failed';
    break;
  }
  
  // 等待后重试
  await sleep(WAIT_INTERVAL);
}

// 等待超时，返回失败
if (retry > MAX_WAIT_RETRIES) {
  return { success: false, message: '同步繁忙，请稍后重试' };
}
```

### 4.2 并发场景示例

```
时间线:
────────────────────────────────────────────────────────────────>
T1: 用户打开分析页面
    └─> 触发同步请求 A: w, d, 60, 30, 15
        └─> 15分钟: sync_status = 'syncing'

T2 (2秒后): 页面刷新或其他组件触发
    └─> 触发同步请求 B: d, 60, 30, 15
        └─> 15分钟: 发现 sync_status = 'syncing'
            └─> 进入等待重试循环
            └─> 等待 2秒 × 30次 = 60秒

T3 (请求A完成):
    └─> 15分钟: sync_status = 'success'
        └─> 请求B 检测到非 syncing，开始同步
            └─> 发现数据已是最新，跳过
```

---

## 五、前端 Loading 状态管理

### 5.1 分析页面状态定义

```typescript
// 主加载状态
const [isLoading, setIsLoading] = useState(true);

// 数据完整性状态
const [dataIntegrityStatus, setDataIntegrityStatus] = useState({
  canAnalyze: boolean,    // 是否可以分析
  isChecking: boolean,    // 是否正在检查数据完整性
  isSyncing: boolean,     // 是否正在同步数据
  summary: string,        // 状态摘要文本
  warning: string | null, // 警告信息
});

// 分析结果
const [result, setResult] = useState<AnalysisResult | null>(null);

// 错误信息
const [error, setError] = useState<string | null>(null);
```

### 5.2 状态流转图

```
┌─────────────────────────────────────────────────────────────────┐
│                     前端状态流转                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  初始状态                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  isLoading = true                                        │   │
│  │  isChecking = true                                       │   │
│  │  isSyncing = false                                       │   │
│  │  canAnalyze = false                                      │   │
│  │  result = null                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  检查数据完整性                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  isChecking = true                                       │   │
│  │  显示: "检查数据完整性..."                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────── 数据完整 ───────────────┐                    │
│  │                                        │                    │
│  │  canAnalyze = true                     │                    │
│  │  isSyncing = false                     │                    │
│  │  直接执行分析                           │                    │
│  │                                        │                    │
│  └────────────────────────────────────────┘                    │
│                          ↓                                      │
│  ┌─────────────── 数据不完整 ─────────────┐                    │
│  │                                        │                    │
│  │  canAnalyze = false                    │                    │
│  │  needsSyncLevels = ['d', '60', ...]    │                    │
│  │                                        │                    │
│  │  ├─> isSyncing = true                  │                    │
│  │  │   显示: "正在同步缺失数据..."        │                    │
│  │  │                                     │                    │
│  │  └─> 同步完成后                        │                    │
│  │      isSyncing = false                 │                    │
│  │      执行分析                          │                    │
│  │                                        │                    │
│  └────────────────────────────────────────┘                    │
│                          ↓                                      │
│  分析完成                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  isLoading = false                                       │   │
│  │  isChecking = false                                      │   │
│  │  isSyncing = false                                       │   │
│  │  result = 分析结果                                       │   │
│  │  显示: 分析内容                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 UI 显示逻辑

```tsx
// 1. 检查数据完整性中
if (dataIntegrityStatus.isChecking) {
  return <SmartLoading message="检查数据完整性..." />;
}

// 2. 正在同步数据
if (dataIntegrityStatus.isSyncing) {
  return <SmartLoading message="正在同步缺失数据，请稍候..." />;
}

// 3. 数据不完整，无法分析
if (!dataIntegrityStatus.canAnalyze && !isLoading) {
  return (
    <Card>
      <AlertTriangle />
      <h3>数据不完整，无法分析</h3>
      <p>请先同步缺失的数据</p>
      <Button onClick={handleSync}>同步数据</Button>
    </Card>
  );
}

// 4. 主加载中
if (isLoading) {
  return <SmartLoading message="正在分析..." />;
}

// 5. 显示分析结果
if (result) {
  return <AnalysisContent result={result} />;
}
```

### 5.4 分析后禁止自动同步

```typescript
// loadAnalysis 函数支持 skipSync 参数
const loadAnalysis = async (skipSync: boolean = false) => {
  // ...
  
  // 如果数据不完整且未跳过同步，先同步数据
  if (needsSyncLevels.length > 0 && !skipSync) {
    // 触发同步
  }
  
  // ...
};

// DataIntegrityAlert 组件中
onSync={(freqs) => {
  // 如果已有分析结果，不再同步（此时同步已无效）
  if (result) {
    console.log('[分析流程] 已有分析结果，跳过同步');
    return;
  }
  
  // 执行同步
  setDataIntegrityStatus(prev => ({ ...prev, isSyncing: true }));
  fetch('/api/stock/sync', { ... }).then(() => {
    loadAnalysis(true);  // skipSync = true
  });
}}
```

---

## 六、数据完整性检查逻辑

### 6.1 检查流程

```
GET /api/stock/data-integrity?code={code}
│
├─> 1. 查询 baostock 最新日期
│       └─> 获取最近10天日线数据，取最后一条的日期
│
├─> 2. 遍历各级别 (w, d, 60, 30, 15)
│       ├─> 查询记录数 (recordCount)
│       ├─> 查询最新日期 (lastDate)
│       ├─> 查询同步状态 (sync_status)
│       └─> 判断数据状态:
│           ├─> 'pending': sync_status === 'syncing'
│           ├─> 'missing': recordCount === 0
│           ├─> 'stale': lastDate < baostockLatestDate
│           └─> 'ok': lastDate >= baostockLatestDate
│
└─> 3. 汇总结果
        ├─> canAnalyze: 所有级别都是 'ok'
        ├─> needsSyncLevels: status 不是 'ok' 的级别
        └─> overallText: 状态摘要
```

### 6.2 判断条件

| 级别 | 正常条件 | 过期条件 |
|------|----------|----------|
| 周线 | 日期 >= 上周五 | 日期 < 上周五 |
| 日线 | 日期 >= baostock最新 | 日期 < baostock最新 |
| 60分钟 | 日期 >= baostock最新 | 日期 < baostock最新 |
| 30分钟 | 日期 >= baostock最新 | 日期 < baostock最新 |
| 15分钟 | 日期 >= baostock最新 | 日期 < baostock最新 |

---

## 七、API 接口汇总

### 7.1 同步相关 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stock/sync` | POST | 同步股票数据 |
| `/api/stock/sync` | GET | 获取同步状态 |
| `/api/stock/sync-status` | GET | 获取详细同步状态 |
| `/api/stock/data-integrity` | GET | 检查数据完整性 |

### 7.2 同步请求参数

```typescript
// POST /api/stock/sync
{
  code: string;           // 股票代码（必填）
  frequencies: string[];  // 周期列表，默认 ['d']
  days: number;           // 同步天数，默认 1825
  mode: 'auto' | 'full' | 'inc';  // 同步模式，默认 'auto'
}
```

### 7.3 同步响应

```typescript
{
  success: boolean;
  data: {
    code: string;
    results: Array<{
      frequency: string;
      success: boolean;
      count: number;
      newRecords: number;
      message: string;
    }>;
    summary: {
      totalFrequencies: number;
      successCount: number;
      totalRecords: number;
      newRecords: number;
    };
  };
}
```

---

## 八、数据库表结构

### 8.1 stock_kline_data_v2 (K线数据表)

| 字段 | 类型 | 说明 |
|------|------|------|
| code | varchar | 股票代码 |
| frequency | varchar | 周期 (w/d/60/30/15) |
| trade_date | date | 交易日期 |
| trade_time | timestamp | 交易时间（分钟数据） |
| open/high/low/close | numeric | OHLC 价格 |
| volume/amount | numeric | 成交量/成交额 |
| ma5/ma10/ma20/ma55/ma233 | numeric | 均线 |
| macd/macd_signal/macd_hist | numeric | MACD指标 |
| boll_upper/boll_middle/boll_lower | numeric | 布林带 |

### 8.2 stock_sync_status (同步状态表)

| 字段 | 类型 | 说明 |
|------|------|------|
| code | varchar | 股票代码 |
| frequency | varchar | 周期 |
| sync_status | varchar | 状态 (syncing/success/failed) |
| last_sync_date | date | 最后同步数据日期 |
| last_sync_at | timestamp | 最后同步时间 |
| last_sync_error | text | 错误信息 |
| retry_count | int | 重试次数 |
| updated_at | timestamp | 更新时间 |

---

## 九、常见问题与解决方案

### 9.1 "正在同步中，等待后重试"

**原因**: 有其他同步请求正在进行

**解决方案**:
1. 等待当前同步完成（最多60秒）
2. 如果超时，自动重置状态

### 9.2 同步状态卡在 'syncing'

**原因**: 进程异常终止，未更新状态

**解决方案**:
- 超时检测：超过5分钟自动重置为 'failed'

### 9.3 数据条目显示异常

**原因**: 预期条目是基于周期配置计算的参考值

**说明**:
- 日线预期250条，实际可能有1000+条（历史数据更久）
- 完整度可能超过100%，这是正常的

### 9.4 删除旧数据的说明

**现象**: 日志显示"删除 xxx 的旧数据"

**原因**: 增量同步设计如此

**说明**:
- 删除最近300天数据，重新计算技术指标
- 确保 MA、MACD、BOLL 指标准确

---

## 十、优化建议

1. **避免并发同步**: 页面加载时只触发一次同步，避免重复请求
2. **合理设置超时**: 5分钟超时适用于大多数情况，可根据实际调整
3. **监控同步状态**: 定期检查 `sync_status` 表，清理异常状态
4. **增量同步优化**: 300天的删除范围可根据实际需求调整

---

*文档版本: 1.0*
*最后更新: 2026-03-11*
