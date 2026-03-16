# 股票数据同步问题深度分析报告

> 分析日期：2026-03-15
> 分析范围：`scripts/`、`src/services/stock-data.service.ts`、`src/app/api/stock/`、`src/app/stock/[code]/`

---

## 一、问题清单总览

| # | 问题描述 | 严重程度 | 根本原因类型 |
|---|---------|---------|-------------|
| 1 | 数据未加载完成就开始分析 | 🔴 高 | 流程控制缺陷 |
| 2 | 无用数据加载过多、各级别数据"最新"判断有误 | 🔴 高 | 逻辑错误 + 缺少缓存 |
| 3 | Loading 状态与实际加载不一致 | 🟡 中 | 状态管理混乱 |
| 4 | 每次首次加载股票数据必然数据不完整 | 🔴 高 | 竞态条件 + 流程设计缺陷 |

---

## 二、问题一：数据未加载完成就开始分析

### 2.1 问题现象

用户进入分析页面后，页面有时会使用**旧数据**或**不完整数据**进行分析，而不是等待同步完成。

### 2.2 代码定位

**文件**：`src/app/api/stock/analysis/route.ts`（第 194–211 行）

```typescript
// 1. 从数据库获取数据
let dbData = await getKlineDataFromDB(code, levels);

// 2. 检查哪些周期缺少数据，需要从远程获取
const missingLevels = levels.filter(level => !dbData[level] || dbData[level].length === 0);

if (missingLevels.length > 0 || forceRefresh) {
  // 同步缺失的周期数据
  const freqsToSync = missingLevels.map(l => LEVEL_TO_FREQUENCY[l]).filter(Boolean);
  if (freqsToSync.length > 0) {
    await stockDataService.syncStockData(code, freqsToSync as any);
  }
  // 重新获取数据
  dbData = await getKlineDataFromDB(code, levels);
}
```

**问题一（双重同步）**：分析页面 `analysis/page.tsx` 的 `loadAnalysis()` 中，已经 `await` 过一次 `POST /api/stock/sync`，然后才调用 `GET /api/stock/analysis`。而 `analysis/route.ts` 内部**又会再做一次同步判断**，触发第二次同步。这意味着：
- 第一次同步：`analysis/page.tsx` → `POST /api/stock/sync` → 同步5个周期
- 第二次检测：`analysis/route.ts` → 内部检查 `missingLevels`（仅判断 `length === 0`，不判断数据是否过期）

**问题二（判断过于宽松）**：`analysis/route.ts` 中判断是否需要同步，只检查了某个 level 的数组长度是否为 0：

```typescript
const missingLevels = levels.filter(level => !dbData[level] || dbData[level].length === 0);
```

这意味着：如果数据库中存有过期数据（比如3天前的60分钟数据），`dbData['hour60'].length > 0` 为 `true`，分析路由**不会触发同步**，直接用旧数据进行分析。

**问题三（同步失败后仍继续分析）**：在 `analysis/page.tsx` 的 `loadAnalysis()` 中（第 499–521 行）：

```typescript
if (needsSyncLevels.length > 0 && !skipSync) {
  setDataIntegrityStatus(prev => ({ ...prev, isSyncing: true }));

  const syncRes = await fetch('/api/stock/sync', { ... });
  const syncResult = await syncRes.json();

  setDataIntegrityStatus(prev => ({ ...prev, isSyncing: false }));
  // ← 同步结果没有校验！即使 syncResult.success = false，后续依然执行分析
}

// ============ 第二步：执行分析 ============  // ← 无条件执行
const [analysisRes, infoRes] = await Promise.all([
  fetch(`/api/stock/analysis?code=${code}`),
  ...
]);
```

同步失败后，代码并未中断，而是**无条件继续执行分析**。

### 2.3 修复建议

1. **去除 `analysis/route.ts` 内部的自动同步逻辑**——分析路由应只负责分析，数据同步应由专门的同步流程负责。
2. **`loadAnalysis()` 中同步完成后，必须校验结果**：
   ```typescript
   const syncResult = await syncRes.json();
   if (!syncResult.success) {
     setError('数据同步失败，分析可能不准确');
     // 可选：终止分析或提示用户
   }
   ```
3. **同步完成后，重新调用 `data-integrity` 二次确认数据完整性**，再执行分析。

---

## 三、问题二：无用数据加载过多，各级别"是否最新"判断有误

### 3.1 问题现象 A：`getBaostockLatestDate` 无缓存，每次同步重复查询 baostock

**文件**：`src/services/stock-data.service.ts`（第 128–145 行）

```typescript
async getBaostockLatestDate(code: string): Promise<string | null> {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await this.fetchFromApi(code, 'd', startDate, endDate);
    // ↑ 每次都运行 Python 脚本！无任何缓存！
    ...
  }
}
```

`syncStockData` 循环同步5个周期，**每个周期都会调用一次 `getBaostockLatestDate`，即运行5次 Python 脚本**仅仅为了获取"最新日期"。

对比：`data-integrity/route.ts` 中有5分钟内存缓存：

```typescript
const baostockCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟
```

而 `stock-data.service.ts` 中的 `getBaostockLatestDate` 完全没有缓存，造成大量重复 baostock 请求。

**影响**：5个周期的同步 = 5次额外的 Python baostock 查询（每次约 3~8 秒），仅为了对比日期。

### 3.2 问题现象 B：分钟级别数据的"是否最新"判断永远返回 true

**文件**：`src/services/stock-data.service.ts`（第 898–919 行）

```typescript
private isLatestData(kline: KlineRecord[], frequency: Frequency): boolean {
  if (kline.length === 0) return false;

  const lastRecord = kline[kline.length - 1];
  const lastDate = lastRecord.date.split(' ')[0];
  const today = new Date().toISOString().split('T')[0];

  if (!MINUTE_FREQUENCIES.includes(frequency)) {
    const diffDays = Math.floor((todayDate - lastDataDate) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;  // 日线/周线：2天内认为是最新
  }

  return true; // ← 🚨 严重Bug：分钟级别数据永远返回"最新"！
}
```

**严重后果**：60分钟、30分钟、15分钟的数据，**无论最后一条数据是何时的**（甚至是一周前的），`getKlineData` 都会认为数据是最新的，直接从缓存返回，跳过同步。这导致 K 线图中的分钟级别数据可能长时间是陈旧数据。

### 3.3 问题现象 C：`isLatestData` 判断过于宽松（日线/周线）

```typescript
return diffDays <= 2;  // 差距在2天内，认为是最新
```

这意味着：如果今天是周三，而最新数据是周一（2天前），会认为是"最新"。但如果周一有新数据（比如周二收盘的），这一判断会让系统跳过同步，显示旧数据。

### 3.4 问题现象 D：`check-sync` 路由中周末判断逻辑有缺陷

**文件**：`src/app/api/stock/check-sync/route.ts`（第 155–175 行）

```typescript
case '60':
case '30':
case '15':
case '5':
  if (lastDateStr === todayStr || lastDateStr === yesterdayStr) {
    needsSync = false;  // ← 仅对比今天和昨天
    reason = '数据最新';
  }
```

**缺陷**：若今天是周一，昨天是周日（非交易日），真正的最后交易日是上周五。`yesterdayStr` 是周日，而数据库中最新数据是周五，所以 `lastDateStr !== todayStr && lastDateStr !== yesterdayStr`，会错误地认为数据过期，触发不必要的同步。

正确做法应当与 `data-integrity/route.ts` 中的 `checkDataFreshness` 一样，对比 baostock 的实际最新日期，而非固定对比今天/昨天。

### 3.5 问题现象 E：存在两套功能重复的 Python 脚本

`scripts/baostock_data.py` 和 `scripts/stock_data_sync.py` 功能高度重叠：

| 功能 | baostock_data.py | stock_data_sync.py |
|------|-----------------|-------------------|
| 获取 K 线数据 | ✅ | ✅ |
| 获取股票信息 | ✅ | ✅ |
| 同步多周期数据 | ✅（sync_stock_data 仅日线） | ✅（支持多周期） |
| 计算技术指标 | ✅ | ✅ |
| 支持 adjustflag | `'3'`（不复权） | `'2'`（前复权） |

两个脚本**复权设置不同**（`baostock_data.py` 默认不复权，`stock_data_sync.py` 默认前复权），如果某处误用，会导致技术指标计算结果不一致。

另外两脚本的均线计算 `min_periods` 设置不同：
- `baostock_data.py`：`min_periods=5/20/55/233`（数据不够直接 NaN）
- `stock_data_sync.py`：`min_periods=1`（数据不够用实际数量计算，会得到失真的均值）

### 3.6 修复建议

1. **为 `getBaostockLatestDate` 添加内存缓存**（参考 `data-integrity/route.ts` 的实现）：
   ```typescript
   private baostockDateCache: Map<string, { date: string | null; ts: number }> = new Map();
   private readonly CACHE_TTL = 5 * 60 * 1000;

   async getBaostockLatestDate(code: string): Promise<string | null> {
     const cached = this.baostockDateCache.get(code);
     if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.date;
     // ... 正常查询
     this.baostockDateCache.set(code, { date: latestDate, ts: Date.now() });
   }
   ```
2. **修复 `isLatestData` 分钟级别判断**：分钟数据不能直接返回 `true`，应与日线一样对比最后日期与最新交易日（或使用 baostock 最新日期）。
3. **统一使用 `stock_data_sync.py`，废弃 `baostock_data.py`**，消除重复脚本和不一致的复权设置。
4. **`check-sync` 路由中分钟级别判断改用 baostock 最新日期对比**，而非硬编码"今天/昨天"。

---

## 四、问题三：Loading 状态与实际加载不一致

### 4.1 K 线图页面（`src/app/stock/[code]/page.tsx`）

#### 4.1.1 加载状态判断条件使用了过期闭包

**文件**：`page.tsx`（第 126–130 行）

```typescript
const loadStockData = useCallback(async (freq: string, forceRefresh = false) => {
  ...
  // 根据是否是初始加载设置不同状态
  if (freq === frequency && klineData.length === 0) {  // ← klineData 是闭包捕获的旧值！
    setIsInitialLoading(true);
  } else {
    setIsLevelLoading(true);
  }
}, [code, frequency, klineData.length, getFromCache, saveToCache]);
```

`klineData` 在 `useCallback` 依赖数组中，每次 `klineData` 变化都会重新创建回调。但在切换频率时，`klineData` 可能还有上一个频率的数据（`length > 0`），导致即使是首次加载新频率，也会错误地触发 `setIsLevelLoading(true)` 而不是 `setIsInitialLoading(true)`。用户看到的是"局部加载中"而不是"全屏加载"。

#### 4.1.2 `init()` 函数中 `isInitialLoading` 被多处重复设置

```typescript
const init = async () => {
  setIsInitialLoading(true);           // ① 设置为 true

  await checkAndSyncData();            // 同步期间保持 true

  await Promise.all([
    loadStockData(frequency),          // ② loadStockData 内部 finally 会设置 false
    loadStockInfo(),
  ]);

  setIsInitialLoading(false);          // ③ init 也设置 false（重复）
};
```

`loadStockData` 在 `finally` 中调用 `setIsInitialLoading(false)`，导致 loading 可能在 `loadStockInfo()` 还未完成时就结束了，出现 UI 闪烁。

#### 4.1.3 加载状态在级别切换时提前结束

**文件**：`page.tsx`（第 286–298 行）

```typescript
const handleFrequencyChange = useCallback((newFreq: string) => {
  if (newFreq === frequency) return;
  setFrequency(newFreq);

  const cached = getFromCache(newFreq);
  if (cached && cached.length > 0) {
    setKlineData(cached);  // ← 直接设置数据，但没有设置任何 loading 状态
  } else {
    loadStockData(newFreq);  // ← 异步，但调用前也没有设置 loading
  }
}, [frequency, getFromCache, loadStockData]);
```

当切换到未缓存的频率时，`loadStockData(newFreq)` 被调用，而 loading 状态在 `loadStockData` 内部才设置。中间存在一个 `setFrequency` 已更新但 loading 还未开始的空窗期，图表可能显示旧数据（上一个频率的 klineData 还未清空）。

### 4.2 分析页面（`src/app/stock/[code]/analysis/page.tsx`）

#### 4.2.1 同步成功但不会刷新数据完整性状态

`loadAnalysis()` 中同步完成后（第 520 行），代码将 `isSyncing` 设为 `false`，但 `dataIntegrityStatus.canAnalyze` 并未更新。用户可能仍然看到"数据不完整"的警告，即使同步已成功。

#### 4.2.2 SmartLoading 与实际流程不匹配

文档（`docs/data-sync-logic.md`，第 5.3 节）描述的 Loading 条件与代码实际行为存在差异：

文档中描述的顺序：
1. `isChecking` → 显示"检查数据完整性"
2. `isSyncing` → 显示"正在同步"
3. 分析中 → `isLoading`

而实际 `loadAnalysis()` 中：**`isLoading` 在整个流程开始时就设为 `true`**，并在最后 `finally` 里才设为 `false`。这意味着 `SmartLoading`（显示"加载中..."）会覆盖更精细的"检查数据完整性"、"正在同步"状态提示，用户看不到具体进度。

### 4.3 修复建议

1. **`loadStockData` 不应内部管理 `isInitialLoading`**，应由调用方统一管理。
2. **`init()` 中使用单一的 loading 状态变量**：整个 `init` 期间保持 loading，init 完成后才关闭。
3. **`handleFrequencyChange` 中应先清空 `klineData` 再加载**，避免显示旧数据。
4. **分析页面中，`isLoading` 状态应当细化**：
   - 检查完整性时：`isLoading = false`，仅显示检查状态
   - 同步时：显示同步进度
   - 最终分析时：才显示全屏 loading

---

## 五、问题四：每次首次加载股票数据必然数据不完整

### 5.1 根本原因：`syncSingleFrequency` 中存在竞态条件（TOCTOU）

**文件**：`src/services/stock-data.service.ts`（第 279–338 行）

```typescript
// Step 1: 检查是否正在同步中
for (let retry = 0; retry <= MAX_WAIT_RETRIES; retry++) {
  const { data: currentStatus } = await client
    .from('stock_sync_status')
    .select('sync_status, updated_at')
    ...
  if (currentStatus?.sync_status !== 'syncing') {
    break;  // ← 认为可以开始同步
  }
  ...
}

// Step 2: 设置同步状态为 syncing（非原子操作！）
await client.from('stock_sync_status').upsert({
  code, frequency, sync_status: 'syncing', ...
});
```

"检查状态"和"设置状态"之间存在时间窗口。如果两个请求同时到达，都通过了"不是syncing"的检查，然后**同时将状态设为 syncing**，会发生两个并发同步，导致数据被重复删除和写入，最终结果不可预期。

### 5.2 首次加载流程存在不合理的串行化

首次加载一支新股票时，需要同步 5 个周期的数据：

```
周线 → 日线 → 60分钟 → 30分钟 → 15分钟（串行）
```

每个周期执行：
1. 查询 baostock 最新日期（运行 Python 脚本，3~8 秒）
2. 运行主数据获取脚本（5~30 秒，取决于数据量）
3. 写入数据库

5个周期合计时间可能达到 **1~3 分钟**，在此期间 `checkAndSyncData()` 保持阻塞，前端一直显示 loading，用户体验极差。

### 5.3 `check-sync` 路由中跳过"正在同步"状态导致数据不完整

**文件**：`src/app/api/stock/check-sync/route.ts`（第 56–64 行）

```typescript
// 如果正在同步中，跳过
if (syncStatus?.sync_status === 'syncing') {
  results.push({
    level: freq,
    needsSync: false,  // ← 跳过！认为不需要同步
    reason: '正在同步中',
  });
  continue;
}
```

**场景**：用户打开 K 线图页面 → 触发 `check-sync` → 开始同步（设置 `syncing`）→ 用户刷新页面 → 再次触发 `check-sync` → 发现状态为 `syncing` → 直接返回"不需要同步" → 前端认为数据完整 → 调用 `getKlineData` → 从数据库取到**未完成同步的不完整数据** → 展示不完整 K 线图。

这是"**每次首次加载必然数据不完整**"的核心原因：

1. 用户首次打开某股票 → 触发同步（同步中途用户刷新）
2. 同步进行到一半，刷新页面
3. 新页面认为"正在同步中，不需要同步" → 但同步实际还没完成
4. 前端直接获取未完成的数据

### 5.4 分析路由中 `getKlineDataFromDB` 分钟数据排序不稳定

**文件**：`src/app/api/stock/analysis/route.ts`（第 96–116 行）

```typescript
let query = client
  .from('stock_kline_data_v2')
  .select('*')
  .eq('code', code)
  .eq('frequency', freq)
  .order('trade_date', { ascending: true });  // 先按日期排序

// 分钟级别数据需要按时间排序
if (isMinuteLevel) {
  query = query.order('trade_time', { ascending: true });  // 再按时间排序
}
```

Supabase 的 `.order()` 链式调用顺序即为 `ORDER BY trade_date ASC, trade_time ASC`，但实际上**分钟数据的 `trade_date` 加 `trade_time` 才能唯一确定顺序**。如果两个分页请求之间数据库有新写入（同步还在进行），分页结果可能包含重复或缺失数据。

### 5.5 修复建议

1. **首次加载应并行同步所有周期**（而非串行）：
   ```typescript
   // 改为并行执行，大幅减少总等待时间
   const results = await Promise.all(
     frequencies.map(freq => this.syncSingleFrequency(code, freq, days))
   );
   ```
   注意：需要确保每个周期的并发锁互不影响。

2. **`check-sync` 对"正在同步"状态应等待而非跳过**：
   - 如果检测到 `syncing` 状态，应轮询等待直到完成（可以复用 `syncSingleFrequency` 的等待逻辑）
   - 或者前端在 `check-sync` 返回 `syncing` 后，主动轮询同步状态，直到完成再加载数据。

3. **同步状态管理使用乐观锁或数据库事务**，避免 TOCTOU 竞态：
   ```sql
   -- 使用 UPDATE ... WHERE sync_status != 'syncing' 的原子更新
   UPDATE stock_sync_status
   SET sync_status = 'syncing', updated_at = NOW()
   WHERE code = $1 AND frequency = $2 AND sync_status != 'syncing'
   ```
   若更新行数为 0，说明已有其他进程在同步，直接等待。

4. **首次进入某股票时，前端应有明确提示**："正在首次同步全量数据，约需 1~3 分钟"，而不是显示通用 loading，避免用户以为页面卡死。

---

## 六、综合问题：流程设计冗余与职责不清

### 6.1 数据新鲜度判断逻辑分散在3个地方，逻辑不统一

| 位置 | 判断逻辑 | 差异 |
|------|---------|------|
| `stock-data.service.ts::isLatestData` | 日线 ≤2天/分钟永远true | 分钟始终为真（BUG） |
| `check-sync/route.ts::checkDataFreshness` | 日线对比今天/昨天 | 周末判断有误 |
| `data-integrity/route.ts::checkDataFreshness` | 对比 baostock 实际最新日期 | 最准确 |

三套逻辑不一致，应该统一为：**以 baostock 实际最新交易日为基准**。

### 6.2 同步触发入口过多，难以管理

当前存在以下同步入口：

1. K 线图页面初始化 → `checkAndSyncData()` → `POST /api/stock/check-sync`
2. 分析页面初始化 → `loadAnalysis()` → `POST /api/stock/sync`
3. 分析路由内部 → `GET /api/stock/analysis` 内部调用 `syncStockData()`
4. 手动刷新按钮 → `syncStockData()` → `POST /api/stock/sync`
5. `DataIntegrityAlert` 组件 → 用户点击触发同步

**问题**：入口 1 和 3 在同一次用户操作中可能同时触发（用户进分析页面时，`check-sync` 和 `analysis` 内部都在同步），造成并发混乱。

### 6.3 `baostock_data.py` 脚本冗余

该文件与 `stock_data_sync.py` 功能重复（详见问题二），建议废弃，统一使用 `stock_data_sync.py`。

---

## 七、优化方案总结

### 方案 A（最优）：统一同步门卫 + 并行同步

```
用户进入页面
    │
    ▼
checkAndSyncData()  ← 唯一同步入口
    ├── 检查 baostock 最新日期（有5分钟缓存）
    ├── 并行对比5个周期的本地数据
    └── 需要同步的周期 → 并行同步（而非串行）
            │
            ▼
        同步完成（等待所有周期，不跳过）
            │
            ▼
        getKlineData() / analysis()   ← 数据读取层，不再触发同步
```

### 方案 B（最小改动）：修复关键 Bug

优先级排序：

| 优先级 | 修复项 | 影响 |
|--------|--------|------|
| P0 | 修复 `isLatestData` 分钟数据始终返回 `true` | 分钟级数据永远不刷新 |
| P0 | 修复 `check-sync` 对 `syncing` 状态不等待问题 | 首次加载必然不完整 |
| P1 | 为 `getBaostockLatestDate` 添加缓存 | 减少冗余 baostock 查询 |
| P1 | 同步失败后 `loadAnalysis` 不应继续执行分析 | 分析结果不准确 |
| P1 | `init()` 统一管理 loading 状态，不让子函数各自修改 | Loading 状态混乱 |
| P2 | `check-sync` 分钟级别改用 baostock 最新日期对比 | 周末后误判需要同步 |
| P2 | 将串行周期同步改为并行 | 首次加载速度提升5x |
| P3 | 合并 `baostock_data.py` 和 `stock_data_sync.py` | 消除冗余代码和不一致配置 |
| P3 | 移除 `analysis/route.ts` 内部的自动同步逻辑 | 职责单一化 |

---

## 八、关键代码路径梳理

### 8.1 K 线图页面完整流程（当前实现）

```
page.tsx::useEffect
    └─> init()
         ├─> setIsInitialLoading(true)
         ├─> checkAndSyncData()
         │    └─> POST /api/stock/check-sync
         │         ├─> checkDataFreshness(5个级别)  ← 每个查3次DB
         │         └─> syncStockData(needsSync)
         │              └─> syncSingleFrequency × N  ← 串行！
         │                   ├─> 查DB最新日期
         │                   ├─> getBaostockLatestDate()  ← 运行Python
         │                   ├─> fetchFromApi()  ← 运行Python
         │                   └─> saveToDatabase()
         │
         ├─> loadStockData('d')
         │    └─> GET /api/stock/data
         │         └─> getKlineData()
         │              ├─> getFromDatabase()
         │              └─> isLatestData()  ← 分钟级始终true!
         │
         └─> setIsInitialLoading(false)
```

### 8.2 分析页面完整流程（当前实现）

```
analysis/page.tsx::useEffect
    └─> loadAnalysis()
         ├─> setIsLoading(true)
         ├─> GET /api/stock/data-integrity
         │    ├─> getBaostockLatestDate()  ← 运行Python（有缓存）
         │    └─> 查5个级别状态
         │
         ├─> 若 needsSyncLevels > 0:
         │    └─> POST /api/stock/sync
         │         └─> syncStockData(needsSync)
         │              └─> syncSingleFrequency × N  ← 串行+重复Python查询
         │
         └─> GET /api/stock/analysis  ← 第二次同步入口!
              ├─> getKlineDataFromDB(5个级别)
              ├─> 若某级别无数据 → 再次syncStockData()  ← 双重同步
              └─> executePythonScript(--stdin)  ← 运行stock_analyzer.py
```

---

*文档版本：1.0 | 生成日期：2026-03-15*
