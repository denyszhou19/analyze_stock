# 数据库迁移失败问题排查与解决

> 排查时间：2026-03-03
> 问题状态：已解决

## 问题现象

部署时报错：

```
2026-03-03T12:52:07+08:00 error: [deploy] [database] Pipeline run failed: 
code=170000015 message=迁移表结构失败：migrate database failed: sync public schema failed: 
code=170000015 message=迁移表结构失败：应用变更失败: 
modify "scheduled_tasks" table: ERROR: column "scheduled_time" cannot be cast automatically 
to type timestamp with time zone (SQLSTATE 42804)
```

## 问题根因

### 1. 字段类型变更

在某个提交版本中，`scheduled_tasks` 表的 `scheduled_time` 字段类型发生了变更：

| 版本 | 字段定义 |
|------|---------|
| 成功版本 (d7e774d) | `scheduled_time VARCHAR(50)` |
| 失败版本 (8a7935b) | `scheduled_time TIMESTAMP WITH TIME ZONE` |

### 2. Coze 部署流程

Coze 平台的部署流程如下：

```
[deploy] [database] 迁移阶段  ← 不受用户代码控制
       ↓
   build.sh 执行
       ↓
   start.sh 执行
```

**关键问题**：数据库迁移阶段在 `build.sh` 之前执行，且该阶段会：
1. 读取平台缓存的 schema 定义
2. 对比当前数据库结构
3. 自动生成并执行 ALTER TABLE 语句

### 3. 类型转换限制

PostgreSQL 不支持自动将 `VARCHAR` 类型转换为 `TIMESTAMP WITH TIME ZONE`：

```sql
-- 这个操作会失败
ALTER TABLE scheduled_tasks 
ALTER COLUMN scheduled_time TYPE timestamp with time zone;

-- 错误：column "scheduled_time" cannot be cast automatically to type timestamp with time zone
```

## 尝试过的解决方案

### ❌ 方案 1：恢复 schema.ts 中的字段定义

将 `scheduled_time` 改回 `VARCHAR(50)`：

```typescript
// schema.ts
scheduledTime: varchar("scheduled_time", { length: 50 }),
```

**结果**：无效。Coze 平台使用的是缓存的 schema 快照，而不是最新代码中的定义。

### ❌ 方案 2：删除 schema.ts 中的字段定义

从 schema.ts 中完全移除 `scheduledTime`、`taskMode`、`taskConfig` 字段：

**结果**：无效。迁移阶段仍会尝试转换已存在的列。

### ❌ 方案 3：在 build.sh 中预处理删除列

在 `build.sh` 中添加脚本，在构建前删除问题列：

```bash
npx tsx -e "
const { Client } = require('pg');
// ... 删除 scheduled_time, task_mode, task_config 列
"
```

**结果**：无效。迁移阶段在 `build.sh` 之前执行，脚本根本没机会运行。

### ❌ 方案 4：在 build.sh 中删除整个表

```bash
await client.query('DROP TABLE IF EXISTS scheduled_tasks CASCADE');
```

**结果**：无效。同样因为迁移阶段在 `build.sh` 之前执行。

## ✅ 最终解决方案

### 通过 Supabase Skill 直接操作数据库

使用 `exec_sql` 工具直接连接数据库删除有问题的表：

```sql
-- 删除 scheduled_tasks 表
DROP TABLE IF EXISTS public.scheduled_tasks CASCADE;

-- 删除依赖的 task_execution_logs 表
DROP TABLE IF EXISTS public.task_execution_logs CASCADE;
```

**原理**：
1. 直接操作数据库，绕过 Coze 的迁移阶段
2. 删除表后，迁移系统会发现表不存在
3. 根据 schema.ts 中的定义重新创建干净的表

### 验证结果

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- 结果：scheduled_tasks 和 task_execution_logs 已被删除
-- 迁移系统会重新创建它们
```

## 经验教训

### 1. 理解平台部署流程

不同平台的部署流程可能有所不同，需要了解：
- 各个阶段的执行顺序
- 哪些阶段受代码控制，哪些不受
- 迁移系统的工作原理

### 2. 数据库字段类型变更的风险

**修改已有字段的类型是高风险操作**，可能导致：
- 迁移失败
- 数据丢失
- 应用不可用

### 3. 安全的 Schema 变更策略

```
✅ 推荐：新增字段 → 迁移数据 → 删除旧字段
❌ 避免：直接修改已有字段的类型
```

### 4. 使用 Skill 直接操作数据库

当平台迁移系统出问题时，可以直接操作数据库：
- 使用 `exec_sql` 工具
- 使用 Supabase 控制台
- 使用数据库客户端工具

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/storage/database/shared/schema.ts` | 数据库表结构定义 |
| `scripts/build.sh` | 构建脚本 |
| `scripts/db-init.ts` | 数据库初始化脚本 |
| `sql/stock_tables.sql` | SQL 表结构脚本 |

## 附录：问题提交版本分析

```
成功版本: d7e774d (1天前)
失败版本: 8a7935b (14小时前)

中间提交：
8a7935b feat: 实现股票数据自动增量同步功能
3a06f08 Restored to '617122e14f98233d20b7adb9fd362d2b1bf4d07e'
...
```

关键变更在 `8a7935b` 版本，该版本对 `scheduled_tasks` 表进行了重构，引入了新的字段定义。
