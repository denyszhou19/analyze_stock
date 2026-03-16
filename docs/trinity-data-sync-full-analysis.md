# 三位一体股票分析程序数据同步问题完整分析

> 分析日期：2026-03-15
> 分析方式：静态代码审查
> 重点范围：`scripts/`、`src/services/stock-data.service.ts`、`src/app/api/stock/*`、`src/app/stock/[code]/analysis/page.tsx`、`docs/data-sync-logic.md`

## 1. 结论摘要

当前程序的数据同步问题不是单点 bug，而是“同步、校验、分析、UI 状态”四层同时存在不一致：

1. 页面在“同步是否真的完成、数据是否真的可分析”还没被再次确认前，就会继续调用分析。
2. 不同模块各自维护了一套“数据是否最新”的判断标准，导致同一份数据在 A 路由里是最新，在 B 路由里又是过期。
3. 首次加载的同步窗口和分析脚本真实需要的历史长度并不一致，尤其周线 MA233 天然不够。
4. 数据写库流程是“先删后插、失败吞掉、最终仍可能标成功”，这会把“第一次加载一定不完整”放大成稳定复现的问题。

从根因上看，最关键的不是“某一个 if 写错了”，而是系统缺少一个唯一可信的“数据准备完成”状态。

---

## 2. 当前实际链路梳理

### 2.1 分析页入口

入口在 `src/app/stock/[code]/analysis/page.tsx:466-552`。

当前 `loadAnalysis()` 的执行顺序是：

1. 请求 `/api/stock/data-integrity`
2. 如果有缺失级别，则请求 `/api/stock/sync`
3. 不管同步结果是否完整、是否失败，继续请求 `/api/stock/analysis`
4. 拿到结果后直接 `setResult`

这条链路最大的问题是：

- “同步完成”不等于“数据已可分析”
- “同步接口返回 success”不等于“所有需要的级别都完整写入了数据库”
- “分析接口返回 success”也不等于“用的是完整最新数据”

### 2.2 数据完整性检查

入口在 `src/app/api/stock/data-integrity/route.ts:168-320`。

它会逐级别检查：

- 数据条数是否够
- 最后日期是否新
- `stock_sync_status` 是否报错或正在同步

这里的优点是它比别的模块更严格；但问题是这个严格结论没有成为后续分析流程的强制门槛。

### 2.3 同步服务

核心在 `src/services/stock-data.service.ts:243-549`。

流程是：

1. 检查该频率是否已在同步
2. 读取本地最后日期
3. 调用 baostock 获取“最新日期”
4. 决定全量或增量同步
5. 跑 `scripts/stock_data_sync.py`
6. 删除旧数据并重新插入
7. 更新 `stock_sync_status`

这里真正的风险点不在“能否拿到数据”，而在“写库是否完整”和“成功状态是否可信”。

### 2.4 分析接口

入口在 `src/app/api/stock/analysis/route.ts:176-258`。

它会：

1. 从数据库读取每个级别的全部历史数据
2. 只要某级别 `length === 0` 才认为缺失
3. 如缺失，则再触发一次同步
4. 把数据库数据整包喂给 `scripts/stock_analyzer.py`

这意味着分析接口并不真正关心：

- 数据是不是最新
- 数据是不是完整
- 数据量是不是满足分析脚本真实要求

### 2.5 Python 脚本

- 同步脚本：`scripts/stock_data_sync.py`
- 分析脚本：`scripts/stock_analyzer.py`

同步脚本负责生成 MA/MACD/BOLL 并写库，分析脚本优先信任数据库里已有指标值。

这本来可以提升性能，但当前实现有一个很危险的前提：写进库的指标必须先是“足够历史长度下计算出的真值”。目前这个前提并不成立。

---

## 3. 关键问题总表

| # | 问题 | 代码位置 | 直接影响 |
|---|---|---|---|
| 1 | 同步后不复检，直接开始分析 | `src/app/stock/[code]/analysis/page.tsx:499-545` | 数据未准备好就分析 |
| 2 | 同步结果失败或部分失败也继续分析 | `src/app/stock/[code]/analysis/page.tsx:507-521` | 首次加载容易拿到残缺结果 |
| 3 | 自动同步后 `canAnalyze` 不刷新 | `src/app/stock/[code]/analysis/page.tsx:491-497`、`950-952` | 实际已同步但 UI 仍判定“不能分析” |
| 4 | `/api/stock/sync` 默认把所有周期都按 1825 天同步 | `src/app/api/stock/sync/route.ts:24-30`、`55-56` | 首次加载数据量过大、分钟级别严重超配 |
| 5 | 分析接口只按“是否有数据”判断，不按“是否完整/最新”判断 | `src/app/api/stock/analysis/route.ts:194-210` | 旧数据、残缺数据也会被分析 |
| 6 | 三套 freshness 逻辑互相不一致 | `data-integrity`、`check-sync`、`stock-data.service.ts:isLatestData` | 同步判定混乱、重复同步/漏同步并存 |
| 7 | 分钟级别在 `isLatestData()` 中永远返回最新 | `src/services/stock-data.service.ts:895-919` | 分钟图可能长期不刷新 |
| 8 | 首次同步窗口不足以支撑周线 MA233 | `src/services/stock-data.service.ts:226-240`、`docs/data-sync-logic.md:21-31` | 首次分析天然失真 |
| 9 | 同步脚本用 `min_periods=1` 生成“伪完整”均线 | `scripts/stock_data_sync.py:237-255` | 指标看起来有值，实际上历史不够 |
| 10 | 分析脚本优先信任已有 MA，不会纠正伪完整指标 | `scripts/stock_analyzer.py:746-767` | 错误 MA 被长期沿用 |
| 11 | 写库是“先删后插”，失败被吞掉，仍可能标 success | `src/services/stock-data.service.ts:829-891`、`476-502` | 数据库可能半成品但状态显示成功 |
| 12 | 每次同步每个频率都重复查一次 baostock 最新日期 | `src/services/stock-data.service.ts:351-355` | 无用远程请求偏多 |
| 13 | 分析接口每个级别都全量读库 | `src/app/api/stock/analysis/route.ts:79-166` | 无用数据加载多，慢且耗内存 |
| 14 | Loading 进度完全按时间假设，不反映真实阶段 | `src/components/ui/smart-loading.tsx:14-149` | loading 与实际状态不一致 |
| 15 | 数据完整性组件只在挂载时检查一次 | `src/components/stock/DataIntegrityAlert.tsx:67-88` | 同步后 UI 不自动更新 |
| 16 | “同步缺失数据”按钮实际找不到目标按钮 | `src/app/stock/[code]/analysis/page.tsx:912-920` | 用户无法从错误态一键恢复 |

---

## 4. 对应你提出的四类问题

## 4.1 问题一：数据未加载完成就开始分析

### 根因 1：同步完成后没有二次确认

`loadAnalysis()` 在第一次 `data-integrity` 返回 `needsSyncLevels` 后，会直接调 `/api/stock/sync`，然后马上进入 `/api/stock/analysis`，中间没有再次校验：

- 同步是否全部成功
- 同步后各级别是否都达到 `canAnalyze`
- 是否仍有 `needsSyncLevels`

代码位置：

- `src/app/stock/[code]/analysis/page.tsx:499-521`
- `src/app/stock/[code]/analysis/page.tsx:524-545`

这意味着当前的真实流程是：

`检查一次 -> 同步一次 -> 无条件分析`

而不是应该有的：

`检查 -> 同步 -> 再检查 -> 满足条件后分析`

### 根因 2：同步失败不会阻断分析

当前同步结果只 `console.log`，没有进入强约束：

- 即使 `syncResult.success === false`
- 即使只有部分频率成功
- 即使部分频率仍然是缺失/过期

页面仍会继续请求 `/api/stock/analysis`。

### 根因 3：分析接口本身也不是“准备态守门员”

`/api/stock/analysis` 只看某级别有没有数组，不看数组是不是：

- 最新的
- 足够长的
- 符合三位一体分析的最低要求

代码位置：

- `src/app/api/stock/analysis/route.ts:197-210`

只要数据库里残留了旧数据或半截数据，它就会继续分析。

### 结论

“数据未加载完成就开始分析”并不是偶发，而是当前流程设计的默认行为。

---

## 4.2 问题二：无用数据加载较多，各级别判断是否数据最新有问题

### 根因 1：同步窗口被 `/api/stock/sync` 默认值强制放大

`stockDataService.syncStockData()` 明明支持“不传 days 时按频率自动决定”：

- 周线 730 天
- 日线 365 天
- 60/30 分钟 180 天
- 15 分钟 90 天

见 `src/services/stock-data.service.ts:226-253`。

但页面真正调用的 `/api/stock/sync` 却写死了：

```ts
days = 1825
```

见 `src/app/api/stock/sync/route.ts:24-30`。

这样一来，只要前端不显式传 `days`，所有周期都会按 1825 天执行，包括分钟线。

这会直接导致：

- 首次同步分钟数据远超分析所需
- Python 脚本输出巨大
- 写库压力大
- 更容易触发超时、插入失败、半成功

### 根因 2：分析接口每次把整段历史全读出来

`getKlineDataFromDB()` 会把每个级别整表分页读完，而不是只取分析真正需要的窗口。

代码位置：

- `src/app/api/stock/analysis/route.ts:79-166`

但分析脚本实际需求并没有这么大：

- 结构分析默认 `lookback=200`，见 `scripts/stock_analyzer.py:1966-2000`
- MACD 状态最低只要求 50 根，见 `scripts/stock_analyzer.py:803-827`
- 结构识别最低要求 60 根，见 `scripts/stock_analyzer.py:1995-2000`

也就是说，现在数据库可能读了几千条，但真正参与判断的主要还是最近一小段。

### 根因 3：同一个股票会重复查多次“源端最新日期”

当前至少有三处会为同一股票查询“最新日期”：

1. `data-integrity/route.ts` 自己查一次，且只在该路由内部做了缓存
2. `stockDataService.syncSingleFrequency()` 每个频率又查一次
3. 页面里 `loadAnalysis()` 与 `DataIntegrityAlert` 组件都会发起完整性检查

相关位置：

- `src/app/api/stock/data-integrity/route.ts:75-106`
- `src/services/stock-data.service.ts:125-145`
- `src/components/stock/DataIntegrityAlert.tsx:67-88`
- `src/app/stock/[code]/analysis/page.tsx:475-476`

这就是典型的“无用数据加载较多”和“无用远程请求较多”。

### 根因 4：freshness 判定标准有三套

#### A. `data-integrity` 的标准

`src/app/api/stock/data-integrity/route.ts:115-163`

- 周线：按上周五
- 其他：按 baostock 最新日期
- 还叠加 `completeness >= 0.8`

这是目前最严格的一套。

#### B. `check-sync` 的标准

`src/app/api/stock/check-sync/route.ts:31-188`

- 周线：看本周是否同步
- 日线/分钟：主要按今天/昨天判断
- 不依赖源端最新交易日

这会在周末、节假日、盘中等场景下误判。

#### C. `stockDataService.isLatestData()` 的标准

`src/services/stock-data.service.ts:895-919`

- 日线/周线：差 2 天以内算最新
- 分钟线：直接永远返回 `true`

这套是最宽松、也最危险的一套。

### 结论

“无用数据加载多”和“是否最新判断有问题”本质上是同一个问题：系统没有统一的新鲜度标准，也没有统一的数据窗口策略。

---

## 4.3 问题三：loading 与实际加载不一致

### 根因 1：前端只有一个混合 loading 概念

分析页实际上有三个阶段：

1. 完整性检查
2. 数据同步
3. Python 分析

但页面最终只把它们混成：

```tsx
isLoading || dataIntegrityStatus.isChecking || dataIntegrityStatus.isSyncing
```

位置：

- `src/app/stock/[code]/analysis/page.tsx:927-936`

这会导致：

- 页面可能已经在分析，但 UI 还显示“正在同步”
- 页面已经同步结束，但 `canAnalyze` 没刷新，UI 仍然像没准备好
- 用户无法分辨现在卡在哪一步

### 根因 2：`SmartLoading` 完全按时间推进，不按真实事件推进

`src/components/ui/smart-loading.tsx:14-149`

它的进度来源不是后端事件，而是纯前端定时器：

- 2 秒显示“获取股票历史数据”
- 5 秒显示“处理 K 线数据”
- 8 秒显示“计算技术指标”

即使这时候实际还停留在“等待数据库写入”，UI 也会继续往后演。

更关键的是，组件的 `slowLoadingText` 只在初始化时赋值，之后会被 `LOADING_STAGES` 覆盖，所以页面传入的真实上下文说明并没有持续生效。

### 根因 3：完整性组件和页面主流程状态分离

`DataIntegrityAlert` 自己在挂载时又请求一次 `/api/stock/data-integrity`，并把结果通过 `onIntegrityCheck` 回传父组件。

位置：

- `src/components/stock/DataIntegrityAlert.tsx:67-88`

这意味着页面主流程和组件内部可能拿到两次不同时间点的结果，容易出现：

- 组件显示“可分析”
- 页面状态还停在“不可分析”

或者反过来。

### 结论

当前 loading 不准确，不是文案问题，而是“前端没有用真实阶段驱动 UI”。

---

## 4.4 问题四：每次第一次加载股票数据，一定会数据不完整

这是当前最核心、也是最容易稳定复现的问题，原因是多因素叠加。

### 根因 1：首次同步窗口配置本身就不匹配分析需求

`getDaysForFrequency()` 给周线只拉 730 天，约 104 周：

- `src/services/stock-data.service.ts:226-240`

但分析脚本使用了 `MA233`：

- `scripts/stock_analyzer.py:746-767`

周线要计算 233 周 MA，至少需要 233 周历史，大约要 1631 天以上的自然日数据。当前周线首次同步只给 730 天，本来就不够。

也就是说，即使同步成功，周线 MA233 也天然不可靠。

### 根因 2：同步脚本会用不够长的历史计算“看起来完整”的均线

`scripts/stock_data_sync.py` 中：

```python
df['ma55'] = df['close'].rolling(window=55, min_periods=1).mean()
df['ma233'] = df['close'].rolling(window=233, min_periods=1).mean()
```

位置：

- `scripts/stock_data_sync.py:237-255`

这会产生一个非常隐蔽的问题：

- 数据明明不够 233 根
- 但 `ma233` 仍然不是 `null`
- 后续分析脚本会把它当作“已有正确指标”

### 根因 3：分析脚本默认信任数据库已有 MA 值

位置：

- `scripts/stock_analyzer.py:746-767`

逻辑是：

- 如果已有 `MA55` / `MA233`，就直接保留
- 只在 `NaN` 时才补算

因此首次同步产生的“伪完整 MA233”不会被分析阶段纠正。

### 根因 4：写库流程允许半成功

`saveToDatabase()` 的逻辑是：

1. 先删旧数据
2. 分批插入
3. 某批失败则继续
4. 单条失败也继续
5. 只返回 `savedCount`

位置：

- `src/services/stock-data.service.ts:829-891`

但 `syncSingleFrequency()` 后续并不会验证：

- `savedCount` 是否等于 API 返回总数
- 删除后是否真的恢复完整
- 是否存在批量失败但仍被标记 success

位置：

- `src/services/stock-data.service.ts:476-502`

甚至当 `savedCount === 0` 时，只要没有抛异常，也可能把 `last_sync_date` 写成今天并标记为 success。

这会直接造成：

- 第一次同步后数据库是半成品
- 但状态表显示成功
- 后续逻辑误以为数据已经齐了

### 根因 5：自动同步后页面没有重新拿到“可分析”状态

首次进入页面时，常见序列会变成：

1. 第一次完整性检查：`canAnalyze = false`
2. 自动同步
3. 实际已经拿到部分甚至全部结果
4. 但 `canAnalyze` 还是第一次检查的旧值
5. 页面继续显示“数据不完整，无法分析”

对应位置：

- `src/app/stock/[code]/analysis/page.tsx:491-497`
- `src/app/stock/[code]/analysis/page.tsx:950-952`

### 根因 6：恢复按钮本身也有 bug

黄色提示卡片里点击“同步缺失数据”时，代码去找：

```ts
document.querySelector('[data-sync-missing]')
```

位置：

- `src/app/stock/[code]/analysis/page.tsx:912-920`

但 `DataIntegrityAlert` 里的同步按钮并没有这个属性，见：

- `src/components/stock/DataIntegrityAlert.tsx:188-207`

所以用户在“首次加载不完整”的场景里，连页面提供的一键恢复按钮都不一定能用。

### 结论

“第一次一定不完整”并不是单个接口慢，而是：

- 首次拉取窗口不合理
- 指标提前伪造
- 写库允许半成功
- 页面不同步刷新可分析状态

这四个问题叠加的结果。

---

## 5. 文档与实现不一致

`docs/data-sync-logic.md` 明确写了按频率使用不同同步天数：

- 周线 730 天
- 日线 365 天
- 60/30 分钟 180 天
- 15 分钟 90 天

位置：

- `docs/data-sync-logic.md:21-31`

但真实入口 `/api/stock/sync` 却把 `days` 默认成 1825，并直接传给服务：

- `src/app/api/stock/sync/route.ts:24-30`
- `src/app/api/stock/sync/route.ts:55-56`

这说明当前文档描述的是“理想设计”，而不是“线上真实执行逻辑”。

如果后续继续按旧文档排查，会不断被误导。

---

## 6. 优化建议

## 6.1 P0：必须优先修复

### 1. 把“同步后复检”变成强制流程

目标流程应改成：

1. `GET /api/stock/data-integrity`
2. 如果缺失，则 `POST /api/stock/sync`
3. 再次 `GET /api/stock/data-integrity`
4. 只有 `canAnalyze === true` 才允许 `GET /api/stock/analysis`

如果第二次检查仍不满足，应直接停止分析并返回明确错误。

### 2. `/api/stock/sync` 不要再默认 `days = 1825`

建议：

- `days` 默认设为 `undefined`
- 交给 `stockDataService.syncStockData()` 按频率自动计算
- 只有显式全量补库时才传大窗口

### 3. 写库失败必须让同步整体失败

建议把 `saveToDatabase()` 改成：

- 任何批次插入失败都直接抛错
- 或者至少要求 `savedCount === apiData.kline.length`
- 否则 `sync_status` 必须标记 `failed`

在没有事务的前提下，当前“先删后插”的容错方式风险太高。

### 4. 分析接口必须校验“需要的级别是否都准备好”

`/api/stock/analysis` 不应只检查 `length > 0`，应至少检查：

- 必需级别 `weekly,daily,hour60,hour30,hour15` 是否都存在
- 各级别最后日期是否达标
- 各级别条数是否满足最小要求

不满足时应返回 `409` 或 `412`，而不是继续分析。

### 5. 修正首次历史窗口

建议最少改为：

- 周线：至少 1700~1825 天
- 日线：365~500 天
- 60/30/15 分钟：按实际分析窗口控制在 90~180 天即可

周线是最不能省的，因为 MA233 直接受影响。

### 6. 停止生成“伪完整均线”

`scripts/stock_data_sync.py` 中 MA/BOLL 的 `min_periods` 不应使用 `1`。

建议：

- MA55 用 `min_periods=55`
- MA233 用 `min_periods=233`
- BOLL 用 `min_periods=20`

历史不够时就明确返回 `null`，不要生成看似可用的指标。

## 6.2 P1：强烈建议尽快做

### 7. 统一 freshness 判定逻辑

建议抽出一个唯一模块，例如：

`src/lib/stock-freshness.ts`

统一给以下场景使用：

- `data-integrity`
- `check-sync`
- `stock-data.service.ts`
- `sync-status`

至少统一以下规则：

- 周线按最近有效周线周期
- 日线按源端最新交易日
- 分钟线按“最后交易日 + 最后 bar 时间/应有 bar 数”

### 8. 分析接口只取分析所需窗口

建议读取窗口而不是整表：

- 周线：最近 260 根
- 日线：最近 400 根
- 60/30/15 分钟：最近 400~800 根

这样足够支持：

- MA233
- MACD 状态
- 结构识别 lookback 200

### 9. 一个批次内只查一次 baostock 最新日期

建议在 `syncStockData(code, freqs)` 入口先查一次，再向下传递。

不要每个频率都重复跑一次 `getBaostockLatestDate(code)`。

### 10. 页面状态改成阶段机

建议把前端状态拆成：

- `idle`
- `checking`
- `syncing`
- `verifying`
- `analyzing`
- `ready`
- `failed`

然后 `SmartLoading` 按真实阶段显示，而不是按时间猜进度。

### 11. 同步后刷新 `DataIntegrityAlert`

现在它只在挂载时请求一次。

建议：

- 父组件维护统一的完整性数据
- 子组件只负责展示

或者给组件增加 `refreshKey`，每次同步完成后强制重新请求。

### 12. 修复恢复按钮和手动同步逻辑

需要同时修：

1. 给真正的“同步缺失数据”按钮加上 `data-sync-missing`
2. 去掉 `if (result) return;` 这类阻止用户补救的判断，至少在 `!canAnalyze` 时允许继续同步

## 6.3 P2：性能和可维护性优化

### 13. 合并 `check-sync` 与 `data-integrity`

现在两者职责高度重叠，但规则不一致。

建议：

- 保留一个做“分析前检查”的主接口
- 另一个改成薄封装，直接复用同一套判定函数

### 14. 同步频率可以做有限并发

目前 `syncStockData()` 按频率串行执行，首次加载会很慢。

建议在保证单频率锁的前提下，做 2~3 个频率的有限并发。

### 15. 把“分析前准备数据”收敛为单一 API

最理想的方案是新增一个明确语义的接口，例如：

- `/api/stock/prepare-analysis`

它内部完成：

1. 检查
2. 必要同步
3. 复检
4. 返回“已可分析”或“仍不可分析”

这样页面不再自己拼接多个接口。

---

## 7. 推荐改造顺序

建议按下面顺序落地，收益最高：

1. 修 `/api/stock/sync` 默认 1825 天的问题。
2. 修“同步后必须复检，不通过就禁止分析”。
3. 修写库半成功仍标 success 的问题。
4. 修 `min_periods=1` 和周线历史长度不足的问题。
5. 统一 freshness 规则。
6. 把分析接口的读库范围收窄到真正需要的窗口。
7. 最后再重构 loading 和组件状态流。

---

## 8. 建议的目标状态

如果要把这个程序的数据同步做稳，建议最终收敛成下面的原则：

1. 同步负责“把数据准备好”，分析负责“只分析已准备好的数据”。
2. 所有模块共享一套 freshness 判定函数，不允许各写各的。
3. 所有指标在历史不足时宁可返回 `null`，也不要返回“伪正确值”。
4. `stock_sync_status.success` 必须意味着“数据库里真的已经是完整可用数据”，不能只是“流程没抛异常”。
5. 前端所有 loading 文案都要由真实阶段驱动，而不是时间驱动。

---

## 9. 本次排查涉及的关键文件

- `src/app/stock/[code]/analysis/page.tsx`
- `src/app/api/stock/data-integrity/route.ts`
- `src/app/api/stock/sync/route.ts`
- `src/app/api/stock/analysis/route.ts`
- `src/app/api/stock/check-sync/route.ts`
- `src/services/stock-data.service.ts`
- `scripts/stock_data_sync.py`
- `scripts/stock_analyzer.py`
- `docs/data-sync-logic.md`

---

## 10. 补充说明

本报告基于静态代码审查得出，没有实际连接 baostock 或数据库执行联调；但从调用链和状态流看，上述问题已经足以解释你提出的四类现象，尤其是：

- 数据未加载完成就分析
- 无用数据加载过多
- loading 不准
- 首次加载必然不完整

如果下一步你愿意，我建议直接按本报告的 P0 顺序开始改，我可以继续帮你把这些问题一项一项落到代码里。

---

## 11. 优化后复查补充（2026-03-15）

这次复查针对“已按 P0 / P1 / P2 做过一轮优化后的代码”进行，重点核对数据完整性、准确性、重复同步和用户体验。

结论是：已有一部分修复已经落地，但数据准备链路仍未真正收敛为单一真相源，所以“完整性检查认为缺失”“同步服务认为无需同步”“页面按钮又无法触发有效修复”这三类结论仍然会同时出现。

### 11.1 已确认的高优先级剩余问题

#### 1. 周线“日期最新但历史不足”仍会被同步服务直接跳过

这是你提到的 `立讯精密` 周线 `105/233` 的直接根因。

当前 `syncSingleFrequency()` 的跳过条件仍然是：

- 本地最后日期存在
- baostock 最新日期存在
- `localLatestDate >= latestDate`

只要满足上面三条，就直接返回“数据已是最新”，不会再检查：

- 当前记录数是否达到该级别最低要求
- `MA233` 是否有足够历史
- 是否属于“日期新但历史缺失”的修复场景

因此像“周线只有 105 条，但最后一根日期已经到最新周”的股票，会稳定落入“无需同步”，即使完整性检查明确告诉你它缺数据。

相关位置：

- `src/services/stock-data.service.ts:422-449`

#### 2. `data-integrity` 仍未真正按 `minRecords=233` 作为分析门槛

虽然接口里已经把各级别 `minRecords` 配成了 `233`，但实际状态判定用的还是：

- freshness 为 true
- `completeness >= 0.8`

也就是说：

- 周线 `187/233` 就可能被判定为 `ok`
- 日线 `200/250` 也可能被判定为 `ok`

但此时 `MA233` 仍然不可靠。

这会造成一个更隐蔽的问题：完整性检查自己可能先放行，而分析结果其实仍建立在历史不足的数据上。

相关位置：

- `src/app/api/stock/data-integrity/route.ts:16-20`
- `src/app/api/stock/data-integrity/route.ts:124-133`
- `src/app/api/stock/data-integrity/route.ts:203-225`

#### 3. 黄色卡片里的“同步缺失数据”按钮仍然找不到真实按钮

分析页下方黄色告警卡片点击后，会去执行：

- `document.querySelector('[data-sync-missing]')`

但 `DataIntegrityAlert` 里的真实按钮并没有这个属性。

结果就是：

- UI 看起来提供了“一键修复”
- 实际上点击后大概率什么都不会发生

这和你反馈的“点击同步缺失数据也无法同步”是完全吻合的。

相关位置：

- `src/app/stock/[code]/analysis/page.tsx:987-996`
- `src/components/stock/DataIntegrityAlert.tsx:342-361`

#### 4. `DataIntegrityAlert` 的手动同步，在已有分析结果时仍会被直接拦截

当前传给 `DataIntegrityAlert` 的 `onSync` 内部有一段：

- 如果 `result` 已存在，直接 `return`

这意味着只要页面上已经残留了一次旧分析结果，用户再点手动同步，逻辑就可能根本不往后走。

所以“同步缺失数据无效”现在至少有两层原因：

1. 黄色卡片按钮没真正点到目标按钮
2. 即使点到了，页面上已有 `result` 时也会被直接短路

相关位置：

- `src/app/stock/[code]/analysis/page.tsx:919-924`

#### 5. 分析页仍未接入 `/api/stock/prepare-analysis`，老的多段拼接流程还在跑

虽然项目里新增了 `prepare-analysis`，但分析页仍然自己串：

1. `GET /api/stock/data-integrity`
2. `POST /api/stock/sync`
3. `GET /api/stock/data-integrity`
4. `GET /api/stock/analysis`

这会带来两个直接问题：

- 页面、`prepare-analysis`、`analysis` 三条准备链并存，规则继续分叉
- 只要页面逻辑有漏判，分析仍可能绕过新的准备接口

相关位置：

- `src/app/stock/[code]/analysis/page.tsx:466-624`
- `src/app/api/stock/prepare-analysis/route.ts:12-207`

#### 6. “正在同步中”这个状态，在分析页里仍可能直接落到分析接口

`data-integrity` 对 `sync_status === 'syncing'` 的级别会标成：

- `pending`
- `needsSync = false`
- `canAnalyze = false`

但分析页自动流程只看 `needsSyncLevels.length > 0` 时才去同步；如果某级别正处于 `pending`，它就不会继续等待，也不会改走统一准备接口，而是继续往下请求分析。

也就是说，“数据还在同步中”这个状态现在仍然可能演变成“分析先跑了”。

相关位置：

- `src/app/api/stock/data-integrity/route.ts:114-119`
- `src/app/stock/[code]/analysis/page.tsx:499-585`

### 11.2 中优先级剩余问题

#### 7. `prepare-analysis` 自己也还修不了“fresh but incomplete”

`prepare-analysis` 虽然存在，但它的 `doSync()` 仍固定调用：

- `forceFull = false`

所以当完整性检查发现某级别“日期最新但条数不足”时，它即使再触发同步，也还是会撞到 `syncSingleFrequency()` 的跳过逻辑。

这意味着即便你后续把页面接到 `prepare-analysis`，如果不顺手修服务层跳过条件，这个问题仍然存在。

相关位置：

- `src/app/api/stock/prepare-analysis/route.ts:83-95`
- `src/app/api/stock/prepare-analysis/route.ts:179-184`

#### 8. `/api/stock/analysis` 的完整性门槛仍弱于 `data-integrity`

分析接口当前最小条数仍是：

- 周线 104
- 日线 250
- 60 分钟 200
- 30 分钟 400
- 15 分钟 600

它只在日志里提示 “`MA233` 可能不准确”，但并不会因为 `<233` 直接拒绝分析。

这会导致：

- `data-integrity` 和分析接口标准不一致
- 一部分“历史不够算 MA233”的数据仍可被分析

相关位置：

- `src/app/api/stock/analysis/route.ts:238-253`
- `src/app/api/stock/analysis/route.ts:268-319`

#### 9. freshness 逻辑仍未完全统一，`stock-data.service.ts` 还保留旧判定

虽然新增了 `src/lib/stock-freshness.ts`，但服务层仍保留自己的：

- `getBaostockLatestDate()`
- `isLatestData()`

而且 `isLatestData()` 对分钟级别仍然直接返回 `true`。

这意味着：

- K 线图和分析接口走 `stockDataService.getKlineData()` 时，分钟数据仍可能长期被当成“最新缓存”
- `data-integrity` 看到的是一套规则，服务层缓存命中又是另一套规则

相关位置：

- `src/services/stock-data.service.ts:128-145`
- `src/services/stock-data.service.ts:984-1005`
- `src/lib/stock-freshness.ts:143-266`

### 11.3 低优先级但值得尽快处理的体验问题

#### 10. `sync-status` 仍可能把“有数据”误显示成“已同步成功”

`sync-status` 在指定股票场景下，如果某周期没有 `stock_sync_status` 记录，但 K 线表里已经有数据，就会把该周期状态兜底成 `success`。

这不等于：

- 数据完整
- 数据最新
- 数据满足分析门槛

因此顶部 `SyncStatusAlert` 有机会显示“数据已同步”，但下方 `DataIntegrityAlert` 仍提示“数据不完整”，用户体验会明显割裂。

相关位置：

- `src/app/api/stock/sync-status/route.ts:107-117`

#### 11. `DataIntegrityAlert` 头部文案没有直接显示真实检查结论

组件头部当前优先显示的是状态机文案，如：

- `等待操作`
- `检查数据完整性`
- `验证同步结果`

而不是 `summary.overallText` 里的真实原因。

所以像“周线记录不足”“某级别过期”这类信息，用户要展开细节才看得清，顶部反馈不够直接。

相关位置：

- `src/components/stock/DataIntegrityAlert.tsx:312-318`

### 11.4 建议的补充修复顺序

#### P0

1. 修 `syncSingleFrequency()` 的跳过条件：只有“日期最新且记录数达标”才能跳过。
2. 对“fresh but incomplete”场景自动升级为该频率的强制补齐同步，至少对 `needsSyncLevels` 中的级别生效。
3. 修复分析页黄色卡片按钮，让它直接调用真实同步处理器，不再依赖 DOM 查询。
4. 去掉 `DataIntegrityAlert onSync` 里 `if (result) return;` 这类硬拦截。
5. 让分析页统一走 `/api/stock/prepare-analysis`，不要再自己拼装四段流程。

#### P1

1. `data-integrity` 直接以 `recordCount >= minRecords` 为 `ok` 门槛，不再用 `0.8` 做放行条件。
2. `analysis/route.ts` 与 `data-integrity` 复用同一套最小条数和 freshness 判定。
3. `prepare-analysis` 在检测到“日期新但条数不足”时，按频率触发 `forceFull` 或“repair mode”。
4. 删除 `stock-data.service.ts` 中旧的 freshness 逻辑，统一走 `stock-freshness.ts`。

#### P2

1. `sync-status` 的成功态改为基于完整性摘要，而不是“有记录就算成功”。
2. `DataIntegrityAlert` 头部直接显示 `overallText` 和首要缺陷原因。
3. 页面内只保留一个“数据准备中”的 loading 来源，避免 `SyncStatusAlert`、`DataIntegrityAlert`、页面本身各自报不同状态。

### 11.5 对你这次现象的直接结论

你遇到的：

- 周线数据量不足（`105/233`）
- 但同步被跳过
- 点击“同步缺失数据”也无法同步

从当前代码看，不是单一 bug，而是下面三件事叠加：

1. `data-integrity` 正确发现“周线记录不足”
2. `syncSingleFrequency()` 只看最后日期，错误地把该级别判成“无需同步”
3. 页面上的手动修复入口本身还有按钮映射和 `result` 短路问题

也就是说，这个现象和你看到的代码现状是完全一致的，根因已经能够闭环解释。
