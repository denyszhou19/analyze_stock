# 工程规则

> 项目级默认协作规范见 `AGENTS.md`。
> 本文件只补充 `stock_analyzer.py`、结构识别与分析链路相关的专项强约束；若与 `AGENTS.md` 不冲突，两者同时适用。

## 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **数据库**：Supabase (PostgreSQL)
- **分析引擎**：Python 3（scripts/stock_analyzer.py）
- **包管理**：pnpm
- **开发端口**：5000（若被系统占用，HTTP 回归验证统一改用 `5001`）

---

## 强制规则：每次修改 Python 脚本后必须测试验证

**任何对 `scripts/stock_analyzer.py` 的修改，都必须在修改后立即通过 HTTP API 验证结果，不允许仅依赖代码审查。**

### 标准测试命令

```bash
# 测试 300274（阳光电源）周线结构识别（基准测试用例）
# 若 5000 被系统占用，回归验证改用 5001
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly" | python3 -c "
import json,sys
r=json.load(sys.stdin)
w=r['data']['periods'].get('weekly',{})
s=w.get('structure',{})
d=s.get('structure_details',{})
focus=((w.get('trinity_decision') or {}).get('structure') or {}).get('focus_origin') or {}
print('聚焦结构:', s.get('structure_type'))
print('聚焦笔数:', s.get('segment_count'))
print('原始结构:', (d.get('raw_classification') or {}).get('type'))
print('聚焦起点来源:', (d.get('focus_origin_analysis') or {}).get('selected_origin_kind'))
print('顶分型包含209.88:', 209.88 in [f['high'] for f in d.get('top_fractals',[])])
print('聚焦起点:', focus)
print('底分型:', [f['low'] for f in d.get('bottom_fractals',[])[-3:]])
"
```

### 必须验证的回归指标（300274 周线基准）

| 检查项 | 期望值 | 说明 |
|--------|--------|------|
| 聚焦起点来源 | `peak_extreme` | 当前规范采用 focus-origin 语义，必须从主峰切片开始解释右侧结构 |
| 聚焦起点价格 | `209.88`（2025-11-14） | `trinity_decision.structure.focus_origin` 必须锁定该峰值 |
| 顶分型列表包含 209.88 | `True` | 209.88 不能在分型识别链路中丢失，但不再要求出现在最后 3 个顶分型里 |
| 聚焦结构类型 | `C单平台式` | 表层 `structure_type` 现表示峰值切片后的聚焦结构，而非全局宏观结构 |
| 原始结构类型 | `延伸C类` | `raw_classification.type` 仍应保留宏观结构视角，避免聚焦语义覆盖掉原始判定 |

> 说明：`segment_count` 现表示**聚焦起点之后的右侧结构笔数**，不再等价于旧规范中的全局周线笔数，因此不再使用“≥ 12”作为强制回归指标。

### 测试其他股票

```bash
# 完整五周期分析
curl -s "http://localhost:5001/api/stock/analysis?code={股票代码}&levels=weekly,daily,hour60,hour30,hour15"
```

---

## Python 分析脚本核心规则

### 缠论包含处理（stock_analyzer.py: process_containment）

**规则：上涨趋势取高，下跌趋势取低**

```
上涨（前K线高点 >= 前前K线高点）：merged_high = max, merged_low = max
下跌（前K线高点 <  前前K线高点）：merged_high = min, merged_low = min
```

**禁止**无方向判断直接取 prev 或 curr 的值。

### 结构分类规则（_classify_structure_by_macro_components）

Platform + Directional 组合判断时，**必须检查 Platform 笔数**：

| Platform 笔数 | 识别类型 | 依据 |
|:---:|---|---|
| ≤ 5 笔 | A五段式（中继平台） | 正常中继中枢 |
| ≥ 6 笔 | C单平台式（超大C类） | 缠论中枢延伸/升级，属于高级别盘整 |

---

## 已知修复记录

### 2026-03-17 包含处理方向 Bug

- **问题**：`process_containment` 无方向判断，导致上涨中合并 low 取 min（应取 max），超级K线吞噬后续所有K线
- **影响**：300274 周线 2025-11-07 顶分型（H=209.88）无法识别，整段 51.76→182 被误识为一笔
- **修复**：加入前两根K线方向判断，上涨取 high=max/low=max，下跌取 high=min/low=min

### 2026-03-17 A五段式过宽判断 Bug

- **问题**：`Platform(任意笔数) + Directional` 无差别识别为 A五段式
- **影响**：10 笔大中枢（4年震荡）+ 1 笔突破被误识为 A五段式
- **修复**：加入 Platform 笔数判断，≥6 笔识别为「超大C类突破启动」

### 2026-03-17 相邻异类分型被错误替换 Bug

- **问题**：`build_strokes_iterative` 在 gap < 3 且不同类型时，错误地用新分型替换旧分型（`current['low'] < last['low']` 几乎恒成立 → 底分型替换顶分型）
- **根本原因**：top(idx=139, H=209.88) 和 bottom(idx=140, L=164.38) 相邻（gap=1），算法将 209.88 顶分型替换为 164.38 底分型，进而引发级联替换，导致 2025-04-18 之后的所有分型全部丢失
- **影响**：12 笔结构中最后一笔错误延伸至当前价格，高点显示 ~182 而非实际高点 209.88
- **修复**：gap < 3 且不同类型时，直接跳过新分型（`pass`），保留已确认的旧分型
- **验证**：修复后笔数从 12 增至 15，结构从「延伸A类」变为「B双平台式」，209.88 正确作为笔13终点

---

## 开发服务器

```bash
# 启动（默认 5000；若被系统占用可切到 5001）
PORT=5000 npx next dev --webpack --port 5000
PORT=5001 npx next dev --webpack --port 5001

# 日志查看
tail -f /tmp/nextjs-dev.log
```

## 数据库

- 生产 Supabase URL 在 `.env.local` 中
- 核心表：`stock_kline_data_v2`、`stock_info`、`stock_sync_status`、`stock_holdings`、`scheduled_tasks`、`task_execution_logs`
- SQL 建表脚本：`sql/stock_tables.sql`
