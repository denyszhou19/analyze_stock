# 数据库操作规范

> ⚠️ **重要**: 所有数据库变更必须遵循此规范，违规操作可能导致生产环境故障或部署失败。

## 禁止事项

### 1. ❌ 禁止在已有表上新增或创建索引

**原因**：
- 大表创建索引可能锁表，影响线上服务
- 可能触发部署流程中的迁移失败
- 索引创建消耗大量资源

**错误示例**：
```sql
-- ❌ 错误：在已有表上创建索引
CREATE INDEX idx_new ON existing_table(column);
CREATE UNIQUE INDEX uk_new ON existing_table(column);
```

**正确做法**：
```sql
-- ✅ 正确：创建新表时定义索引
CREATE TABLE new_table_v2 (
    id BIGSERIAL PRIMARY KEY,
    ...
);
CREATE INDEX idx_new ON new_table_v2(column);
```

---

### 2. ❌ 禁止改变原有字段的类型或长度

**原因**：
- 可能导致数据丢失或截断
- 可能破坏应用兼容性
- 触发隐式类型转换，影响性能

**错误示例**：
```sql
-- ❌ 错误：修改字段类型
ALTER TABLE existing_table ALTER COLUMN field TYPE VARCHAR(100);

-- ❌ 错误：修改字段长度
ALTER TABLE existing_table ALTER COLUMN field TYPE NUMERIC(20, 4);
```

**正确做法**：
```sql
-- ✅ 正确：新增字段，保持旧字段
ALTER TABLE existing_table ADD COLUMN field_new VARCHAR(100);

-- 应用层逐步迁移，确认无问题后再清理旧字段（需评估）
```

---

### 3. ❌ 禁止直接修改线上数据库结构

**原因**：
- 线上数据库变更可能影响正在运行的服务
- 无法回滚，风险极高
- 可能触发部署系统的 schema 同步失败

**正确流程**：
1. 在开发/测试环境验证变更
2. 创建迁移脚本并评审
3. 选择低峰期窗口执行
4. 准备回滚方案

---

## 推荐做法

### 场景一：需要新的表结构

```
1. 创建新表（如 xxx_v2）
2. 迁移数据到新表
3. 更新代码使用新表
4. 验证功能正常
5. （可选）清理旧表
```

**示例**：
```sql
-- 1. 创建新表
CREATE TABLE stock_kline_data_v2 (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    ...
);

-- 2. 定义索引（新表上创建是安全的）
CREATE INDEX idx_v2_code ON stock_kline_data_v2(code);
CREATE UNIQUE INDEX uk_v2_unique ON stock_kline_data_v2(code, trade_date);

-- 3. 迁移数据
INSERT INTO stock_kline_data_v2 SELECT * FROM stock_kline_data;

-- 4. 更新代码引用新表名

-- 5. 确认无问题后删除旧表（需评估时机）
-- DROP TABLE stock_kline_data;
```

---

### 场景二：需要新的索引

**方案 A**：创建新表（推荐）
- 创建带索引的新表，迁移数据

**方案 B**：维护窗口操作
- 评估表大小和索引创建时间
- 选择低峰期执行
- 使用 `CONCURRENTLY` 选项（PostgreSQL）
  ```sql
  CREATE INDEX CONCURRENTLY idx_new ON large_table(column);
  ```

---

### 场景三：字段需要变更

```
1. 新增字段（而非修改）
2. 代码同时支持新旧字段
3. 逐步迁移数据
4. 确认无问题后，旧字段标记废弃
5. （可选）最终清理旧字段
```

---

## 检查清单

每次涉及数据库变更时，请确认：

- [ ] 是否在已有表上创建索引？ → **禁止**
- [ ] 是否修改现有字段类型/长度？ → **禁止**
- [ ] 是否直接操作线上数据库？ → **禁止**
- [ ] 是否创建新表？ → **允许**（推荐）
- [ ] 是否只新增字段？ → **允许**
- [ ] 是否有回滚方案？ → **必须有**

---

## 历史问题记录

| 日期 | 问题 | 原因 | 解决方案 |
|------|------|------|----------|
| 2026-03-06 | 部署失败：创建唯一索引报错 | 在旧表 `stock_kline_data` 上创建唯一索引，因数据重复失败 | 创建新表 `stock_kline_data_v2`，迁移数据后切换 |

---

## 相关文件

- SQL 表定义：`sql/stock_tables.sql`
- Schema 定义：`src/storage/database/shared/schema.ts`

---

*最后更新：2026-03-06*
