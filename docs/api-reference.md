# API 接口文档

## 概述

本文档梳理系统所有 API 接口，包括接口链接、作用、出入参示例。

---

## 目录

- [一、持仓管理接口](#一持仓管理接口)
- [二、股票数据接口](#二股票数据接口)
- [三、分析相关接口](#三分析相关接口)
- [四、定时任务接口](#四定时任务接口)
- [五、系统配置接口](#五系统配置接口)
- [六、工作流接口](#六工作流接口)

---

## 一、持仓管理接口

### 1.1 获取所有持仓

**接口**: `GET /api/holdings`

**作用**: 获取用户的所有股票持仓列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "300750",
      "name": "宁德时代",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 1.2 添加持仓

**接口**: `POST /api/holdings`

**作用**: 添加新的股票持仓，同时自动同步日线数据

**请求参数**:
```json
{
  "code": "300750",
  "name": "宁德时代"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 股票代码 |
| name | string | 是 | 股票名称 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "300750",
    "name": "宁德时代",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**错误示例**:
```json
{
  "success": false,
  "error": "该股票代码已存在"
}
```

---

### 1.3 更新持仓

**接口**: `PUT /api/holdings/[id]`

**作用**: 更新指定持仓信息

**请求参数**:
```json
{
  "code": "300750",
  "name": "宁德时代新能源"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "300750",
    "name": "宁德时代新能源",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### 1.4 删除持仓

**接口**: `DELETE /api/holdings/[id]`

**作用**: 删除指定持仓

**请求参数**: 无

**响应示例**:
```json
{
  "success": true
}
```

---

### 1.5 批量导入持仓

**接口**: `POST /api/holdings/batch`

**作用**: 批量导入股票持仓

**请求参数**:
```json
{
  "stocks": [
    { "code": "300750", "name": "宁德时代" },
    { "code": "000001", "name": "平安银行" },
    { "code": "600519", "name": "贵州茅台" }
  ]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "added": 3,
    "skipped": 0,
    "items": [
      { "id": 1, "code": "300750", "name": "宁德时代" },
      { "id": 2, "code": "000001", "name": "平安银行" },
      { "id": 3, "code": "600519", "name": "贵州茅台" }
    ]
  }
}
```

---

## 二、股票数据接口

### 2.0 Baostock 数据源接口

本系统通过 Python 脚本 `scripts/stock_data_sync.py` 调用 Baostock API 获取股票数据。以下为脚本返回的原始数据格式。

#### 2.0.1 获取K线数据

**命令**: `python3 scripts/stock_data_sync.py kline <code> <start_date> <end_date> <frequency>`

**参数说明**:
| 参数 | 说明 |
|------|------|
| code | 股票代码（如 300750 或 sz.300750） |
| start_date | 开始日期（格式：YYYY-MM-DD） |
| end_date | 结束日期（格式：YYYY-MM-DD） |
| frequency | 数据周期（d=日线, w=周线, m=月线, 60=60分钟, 30=30分钟, 15=15分钟, 5=5分钟） |

**返回示例（日线）**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "bsCode": "sz.300750",
    "frequency": "d",
    "count": 200,
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "kline": [
      {
        "date": "2023-01-03",
        "open": 100.0,
        "high": 105.0,
        "low": 98.0,
        "close": 103.0,
        "volume": 1000000,
        "amount": 100000000.0,
        "turn": 0.5,
        "pctChg": 2.5,
        "ma5": 100.0,
        "ma10": 99.0,
        "ma20": 98.0,
        "ma55": 95.0,
        "ma233": 90.0,
        "macd": 0.5,
        "macd_signal": 0.4,
        "macd_hist": 0.2,
        "boll_upper": 110.0,
        "boll_middle": 100.0,
        "boll_lower": 90.0
      }
    ]
  }
}
```

**返回示例（分钟线）**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "bsCode": "sz.300750",
    "frequency": "60",
    "count": 800,
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "kline": [
      {
        "date": "2023-01-03 09:30",
        "open": 100.0,
        "high": 101.0,
        "low": 99.5,
        "close": 100.5,
        "volume": 50000,
        "amount": 5000000.0,
        "turn": 0.02,
        "pctChg": 0.5,
        "ma5": 100.2,
        "ma10": 100.0,
        "ma20": 99.8,
        "ma55": 99.5,
        "ma233": null,
        "macd": 0.02,
        "macd_signal": 0.01,
        "macd_hist": 0.02,
        "boll_upper": 101.0,
        "boll_middle": 100.0,
        "boll_lower": 99.0
      }
    ]
  }
}
```

**错误返回**:
```json
{
  "success": false,
  "error": "未查询到数据"
}
```

#### 2.0.2 获取股票基本信息

**命令**: `python3 scripts/stock_data_sync.py info <code>`

**参数说明**:
| 参数 | 说明 |
|------|------|
| code | 股票代码（如 300750 或 sz.300750） |

**返回示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "bsCode": "sz.300750",
    "name": "宁德时代",
    "market": "sz",
    "listDate": "2018-06-11",
    "status": "上市"
  }
}
```

**错误返回**:
```json
{
  "success": false,
  "error": "登录 baostock 失败"
}
```

#### 2.0.3 同步多个周期数据

**命令**: `python3 scripts/stock_data_sync.py sync <code> --freqs <frequencies> --days <days>`

**参数说明**:
| 参数 | 说明 |
|------|------|
| code | 股票代码 |
| --freqs | 周期列表，逗号分隔（如 d,w,60,30,15） |
| --days | 同步天数（默认 1825，分钟级别最大 365） |

**返回示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "frequencies": {
      "w": {
        "success": true,
        "count": 104,
        "error": null
      },
      "d": {
        "success": true,
        "count": 1216,
        "error": null
      },
      "60": {
        "success": true,
        "count": 800,
        "error": null
      },
      "30": {
        "success": true,
        "count": 1600,
        "error": null
      },
      "15": {
        "success": true,
        "count": 3200,
        "error": null
      }
    },
    "info": {
      "code": "300750",
      "bsCode": "sz.300750",
      "name": "宁德时代",
      "market": "sz",
      "listDate": "2018-06-11",
      "status": "上市"
    }
  }
}
```

**部分失败示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "frequencies": {
      "w": {
        "success": true,
        "count": 104,
        "error": null
      },
      "d": {
        "success": false,
        "count": 0,
        "error": "网络超时"
      }
    },
    "info": {
      "code": "300750",
      "bsCode": "sz.300750",
      "name": "宁德时代",
      "market": "sz"
    }
  }
}
```

#### 2.0.4 K线数据字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| date | string | 交易日期（日线：YYYY-MM-DD，分钟线：YYYY-MM-DD HH:MM） |
| open | number | 开盘价 |
| high | number | 最高价 |
| low | number | 最低价 |
| close | number | 收盘价 |
| volume | number | 成交量（股） |
| amount | number | 成交额（元） |
| turn | number/null | 换手率（%） |
| pctChg | number/null | 涨跌幅（%） |
| ma5 | number/null | 5日均线 |
| ma10 | number/null | 10日均线 |
| ma20 | number/null | 20日均线 |
| ma55 | number/null | 55日均线（三位一体分析核心周期） |
| ma233 | number/null | 233日均线（三位一体分析核心周期） |
| macd | number/null | MACD 柱状值（DIF - DEA） |
| macd_signal | number/null | MACD 信号线（DEA） |
| macd_hist | number/null | MACD 柱状值 × 2（(DIF - DEA) × 2） |
| boll_upper | number/null | 布林带上轨 |
| boll_middle | number/null | 布林带中轨 |
| boll_lower | number/null | 布林带下轨 |

---

### 2.1 获取K线数据

**接口**: `GET /api/stock/data`

**作用**: 获取股票K线数据，支持多周期

**请求参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | string | 是 | - | 股票代码 |
| frequency | string | 否 | d | 数据周期（d/w/m/60/30/15/5） |
| start_date | string | 否 | - | 开始日期 |
| end_date | string | 否 | - | 结束日期 |
| force_refresh | boolean | 否 | false | 是否强制刷新 |

**请求示例**:
```
GET /api/stock/data?code=300750&frequency=d&force_refresh=false
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "frequency": "d",
    "count": 1216,
    "source": "database",
    "isLatest": true,
    "lastSyncAt": "2024-01-01T00:00:00Z",
    "kline": [
      {
        "date": "2024-01-01",
        "open": 100.0,
        "high": 105.0,
        "low": 98.0,
        "close": 103.0,
        "volume": 1000000,
        "amount": 100000000,
        "turn": 0.5,
        "pctChg": 2.5,
        "ma5": 100.0,
        "ma10": 99.0,
        "ma20": 98.0,
        "ma55": 95.0,
        "ma233": 90.0,
        "macd": 0.5,
        "macd_signal": 0.4,
        "macd_hist": 0.1,
        "boll_upper": 110.0,
        "boll_middle": 100.0,
        "boll_lower": 90.0
      }
    ]
  }
}
```

---

### 2.2 获取股票信息

**接口**: `GET /api/stock/info`

**作用**: 获取股票基本信息

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 股票代码 |

**请求示例**:
```
GET /api/stock/info?code=300750
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "name": "宁德时代",
    "market": "sz",
    "industry": "电池",
    "listDate": "2018-06-11",
    "status": "上市",
    "lastSyncAt": "2024-01-01T00:00:00Z",
    "lastDataDate": "2024-01-01"
  }
}
```

---

### 2.3 同步股票数据

**接口**: `POST /api/stock/sync`

**作用**: 同步股票K线数据

**请求参数**:
```json
{
  "code": "300750",
  "frequencies": ["w", "d", "60", "30", "15"],
  "days": 1825,
  "mode": "auto"
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | string | 是 | - | 股票代码 |
| frequencies | string[] | 否 | ["d"] | 周期列表 |
| days | number | 否 | 1825 | 同步天数 |
| mode | string | 否 | auto | 同步模式（auto/full/inc） |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "results": [
      {
        "frequency": "w",
        "success": true,
        "count": 104,
        "newRecords": 0,
        "message": "数据已是最新"
      },
      {
        "frequency": "d",
        "success": true,
        "count": 200,
        "newRecords": 200,
        "message": "同步完成，新增 200 条记录"
      }
    ],
    "summary": {
      "totalFrequencies": 5,
      "successCount": 5,
      "totalRecords": 5000,
      "newRecords": 500
    },
    "info": {
      "code": "300750",
      "name": "宁德时代"
    }
  }
}
```

---

### 2.4 获取同步状态

**接口**: `GET /api/stock/sync`

**作用**: 获取股票数据同步状态

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 股票代码 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "syncStatus": [
      {
        "frequency": "w",
        "sync_status": "success",
        "last_sync_date": "2024-01-01",
        "last_sync_at": "2024-01-01T00:00:00Z"
      }
    ],
    "recordCounts": {
      "w": 104,
      "d": 1216,
      "60": 800,
      "30": 1600,
      "15": 3200
    }
  }
}
```

---

### 2.5 获取详细同步状态

**接口**: `GET /api/stock/sync-status`

**作用**: 获取详细的同步状态，支持筛选

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 否 | 股票代码，不传返回所有 |
| status | string | 否 | 过滤状态（failed/syncing/success/pending） |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "code": "300750",
      "frequency": "d",
      "lastSyncDate": "2024-01-01",
      "lastSyncAt": "2024-01-01T00:00:00Z",
      "recordCount": 1216,
      "syncType": "inc",
      "syncStatus": "success",
      "lastSyncError": null,
      "retryCount": 0
    }
  ],
  "summary": {
    "total": 5,
    "failed": 0,
    "syncing": 0,
    "success": 5,
    "pending": 0
  },
  "hasErrors": false,
  "errorCodes": []
}
```

---

### 2.6 重置失败状态

**接口**: `POST /api/stock/sync-status`

**作用**: 重置失败的同步状态，允许重新同步

**请求参数**:
```json
{
  "code": "300750",
  "frequency": "d"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "已重置 1 条失败记录"
}
```

---

### 2.7 检查数据完整性

**接口**: `GET /api/stock/data-integrity`

**作用**: 检查股票数据完整性，判断是否可以开始分析

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 股票代码 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "code": "300750",
    "levels": [
      {
        "key": "w",
        "name": "周线",
        "icon": "📊",
        "description": "大级别趋势判断",
        "status": "ok",
        "statusText": "数据最新",
        "lastDate": "2024-01-01",
        "recordCount": 104,
        "expectedRecords": 104,
        "expectedDescription": "约104周（2年）",
        "completeness": 100,
        "minRecords": 50,
        "needsSync": false,
        "issues": []
      },
      {
        "key": "d",
        "name": "日线",
        "icon": "📈",
        "status": "stale",
        "statusText": "过期 (2024-01-01 < 2024-01-02)",
        "lastDate": "2024-01-01",
        "recordCount": 1216,
        "expectedRecords": 250,
        "expectedDescription": "约250个交易日（1年）",
        "completeness": 486,
        "needsSync": true,
        "issues": ["日线数据过期"]
      }
    ],
    "baostockLatestDate": "2024-01-02",
    "currentTime": "2024-01-02",
    "isWeekend": false,
    "summary": {
      "overallStatus": "error",
      "overallText": "日线数据过期",
      "okCount": 4,
      "staleCount": 1,
      "missingCount": 0,
      "errorCount": 0,
      "pendingCount": 0,
      "totalLevels": 5,
      "needsSyncLevels": ["d"],
      "canAnalyze": false,
      "analyzeWarning": "数据不完整，请先同步数据后再分析"
    }
  }
}
```

---

### 2.8 检查并同步数据

**接口**: `POST /api/stock/check-sync`

**作用**: 检查数据新鲜度并可选自动同步

**请求参数**:
```json
{
  "code": "300750",
  "frequencies": ["w", "d", "60", "30", "15"],
  "autoSync": true
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": [
      {
        "level": "d",
        "needsSync": false,
        "lastDate": "2024-01-01",
        "reason": "数据最新"
      }
    ],
    "syncResults": []
  }
}
```

---

## 三、分析相关接口

### 3.1 获取三位一体分析

**接口**: `GET /api/stock/analysis`

**作用**: 获取股票三位一体技术分析结果

**请求参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | string | 是 | - | 股票代码 |
| levels | string | 否 | weekly,daily,hour60,hour30,hour15 | 分析周期 |
| force_refresh | boolean | 否 | false | 是否强制刷新 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "stock_code": "300750",
    "stock_name": "宁德时代",
    "analysis_time": "2024-01-01T00:00:00Z",
    "analyzed_levels": ["weekly", "daily", "hour60", "hour30", "hour15"],
    "periods": {
      "daily": {
        "period": "daily",
        "analysis_date": "2024-01-01",
        "latest_price": 100.0,
        "price_change_pct": 2.5,
        "volume": 1000000,
        "moving_averages": {
          "MA55": 95.0,
          "MA233": 90.0,
          "price_vs_ma55": "above",
          "price_vs_ma233": "above",
          "distance_ma55_pct": 5.26,
          "distance_ma233_pct": 11.11,
          "ma_status": "多头排列"
        },
        "macd": {
          "DIF": 0.5,
          "DEA": 0.4,
          "MACD": 0.1,
          "status": "强",
          "description": "DIF/DEA均在零轴上方，多头主导",
          "top_divergence": false,
          "bottom_divergence": false,
          "divergence_note": ""
        },
        "structure": {
          "structure_type": "B双平台式",
          "structure_stage": "b7",
          "trend_direction": "上涨",
          "inflection_points": 10,
          "segment_count": 9,
          "description": "双平台整理，当前处于第二平台高位派发期"
        },
        "key_levels": {
          "support_levels": [
            { "level": 95.0, "type": "MA55", "strength": "强" }
          ],
          "resistance_levels": [
            { "level": 110.0, "type": "前高", "strength": "中" }
          ],
          "ma55": 95.0,
          "ma233": 90.0
        },
        "key_alerts": [
          "日线MACD处于强状态，D类下跌结构是买入机会"
        ]
      }
    },
    "level_nesting": {
      "dimension1": {
        "weekly_status": "强",
        "weekly_structure": "B双平台式",
        "daily_status": "强",
        "daily_structure": "A五段式",
        "daily_ma55_position": "上方",
        "hour60_status": "中偏强",
        "analysis": "周线日线共振向上，60分钟级别处于转强阶段"
      },
      "summary": "大级别趋势向上，小级别配合，整体偏多"
    },
    "multi_dimension_operation": {
      "dimension1": {
        "major_level": "w",
        "major_level_name": "周线",
        "major_status": "强",
        "minor_level": "d",
        "minor_level_name": "日线",
        "minor_structure": "A五段式",
        "minor_trend": "上涨",
        "advice": {
          "operation_advice": "周线强状态，日线A类上涨，建议持有为主",
          "structure_match": true
        }
      }
    }
  }
}
```

---

### 3.2 AI智能分析

**接口**: `POST /api/stock/ai-analysis`

**作用**: 调用AI生成智能分析报告（流式输出）

**请求参数**:
```json
{
  "code": "300750",
  "analysisData": {
    // 完整的分析结果数据
  }
}
```

**响应**: SSE 流式响应

**事件格式**:
```
data: {"type":"connected","timestamp":1704067200000}

data: {"type":"chunk","content":"## 技术分析报告\n\n"}

data: {"type":"complete","report":"完整报告内容..."}

data: {"type":"error","error":"分析失败"}
```

---

## 四、定时任务接口

### 4.1 获取定时任务列表

**接口**: `GET /api/scheduler`

**作用**: 获取所有定时任务和执行日志

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| jobId | string | 否 | 过滤指定任务的日志 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "morning-report",
        "name": "每日早报分析",
        "taskType": "workflow",
        "taskMode": "daily",
        "cronExpr": "0 8 * * 1-5",
        "enabled": true,
        "lastRunAt": "2024-01-01T08:00:00Z",
        "nextRunAt": "2024-01-02T08:00:00Z"
      }
    ],
    "logs": [
      {
        "id": "log-1",
        "jobId": "morning-report",
        "status": "success",
        "startedAt": "2024-01-01T08:00:00Z",
        "completedAt": "2024-01-01T08:05:00Z",
        "result": "早报分析完成"
      }
    ],
    "availableTaskTypes": [
      {
        "type": "workflow",
        "name": "早报分析",
        "description": "获取路透早报并分析对持仓的影响"
      }
    ]
  }
}
```

---

### 4.2 创建定时任务

**接口**: `POST /api/scheduler`

**作用**: 创建新的定时任务

**请求参数**:
```json
{
  "id": "morning-report",
  "name": "每日早报分析",
  "taskType": "workflow",
  "taskMode": "daily",
  "cronExpr": "0 8 * * 1-5",
  "enabled": true
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 任务唯一标识 |
| name | string | 是 | 任务名称 |
| taskType | string | 否 | 任务类型（默认 workflow） |
| taskMode | string | 否 | 任务模式（daily/once） |
| cronExpr | string | 条件 | 每日任务的 cron 表达式 |
| runAt | string | 条件 | 一次性任务的执行时间 |
| enabled | boolean | 否 | 是否启用（默认 true） |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "morning-report",
    "name": "每日早报分析",
    "taskType": "workflow",
    "taskMode": "daily",
    "cronExpr": "0 8 * * 1-5",
    "enabled": true
  },
  "message": "定时任务创建成功，将按计划自动执行"
}
```

---

### 4.3 删除定时任务

**接口**: `DELETE /api/scheduler/[id]`

**作用**: 删除指定定时任务

**响应示例**:
```json
{
  "success": true
}
```

---

### 4.4 切换任务状态

**接口**: `PATCH /api/scheduler/[id]`

**作用**: 启用/禁用定时任务

**请求参数**:
```json
{
  "enabled": false
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "morning-report",
    "enabled": false
  }
}
```

---

### 4.5 立即执行任务

**接口**: `POST /api/scheduler/[id]`

**作用**: 立即触发定时任务执行

**响应示例**:
```json
{
  "success": true,
  "message": "任务已触发，正在后台执行",
  "logId": "log-123"
}
```

---

## 五、系统配置接口

### 5.1 获取环境配置

**接口**: `GET /api/env-config`

**作用**: 获取系统环境变量配置

**响应示例**:
```json
{
  "success": true,
  "data": {
    "cozeApiToken": "xxx",
    "rssUrl": "https://example.com/rss.xml"
  }
}
```

---

### 5.2 获取RSS内容

**接口**: `GET /api/rss`

**作用**: 获取并解析RSS订阅内容

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | RSS订阅地址 |

**请求示例**:
```
GET /api/rss?url=https://example.com/rss.xml
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "title": "路透财经早报",
    "link": "https://example.com",
    "description": "每日财经早报",
    "items": [
      {
        "title": "今日财经要闻",
        "link": "https://example.com/article/1",
        "description": "文章摘要",
        "content": "完整文章内容...",
        "pubDate": "Mon, 01 Jan 2024 08:00:00 GMT"
      }
    ],
    "totalCount": 10
  }
}
```

---

### 5.3 钉钉消息推送

**接口**: `POST /api/dingtalk`

**作用**: 推送消息到钉钉群

**请求参数**:
```json
{
  "webhook": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
  "secret": "SECxxx",
  "title": "今日财经早报分析",
  "content": "报告内容...",
  "articleDate": "2024-01-01",
  "articleUrl": "https://example.com/report"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "已推送至钉钉"
}
```

---

## 六、工作流接口

### 6.1 文章分析（流式）

**接口**: `POST /api/analyze`

**作用**: 分析单篇文章，流式返回结果

**请求参数**:
```json
{
  "cozeToken": "xxx",
  "article": {
    "title": "文章标题",
    "link": "https://example.com/article",
    "description": "文章摘要",
    "content": "完整文章内容"
  },
  "holdings": ["300750", "000001"]
}
```

**响应**: SSE 流式响应

**事件格式**:
```
data: {"type":"connected","timestamp":1704067200000,"message":"已连接到工作流"}

data: {"type":"report_chunk","content":"分析内容片段..."}

data: {"type":"complete","report":"完整分析报告..."}

data: {"type":"error","error":"分析失败","code":"WORKFLOW_ERROR"}
```

---

### 6.2 PDF分析

**接口**: `POST /api/pdf-analysis`

**作用**: 上传PDF文件进行分析

**请求参数**: FormData

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | PDF文件 |
| cozeToken | string | 否 | Coze访问令牌（可选，默认使用环境变量） |

**请求示例**:
```javascript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('cozeToken', 'xxx');
```

**响应示例**:
```json
{
  "success": true,
  "report": "分析报告内容...",
  "fileName": "report.pdf"
}
```

---

### 6.3 工作流执行（流式）

**接口**: `POST /api/workflow`

**作用**: 执行工作流分析，流式返回结果

**请求参数**:
```json
{
  "cozeToken": "xxx",
  "rssUrl": "https://example.com/rss.xml",
  "holdings": ["300750", "000001"]
}
```

**响应**: SSE 流式响应

---

## 附录：错误码说明

| 错误码 | 说明 |
|--------|------|
| MISSING_TOKEN | 缺少访问令牌 |
| MISSING_RSS | 缺少RSS订阅地址 |
| MISSING_HOLDINGS | 缺少持仓股票 |
| MISSING_ARTICLE | 缺少文章内容 |
| NETWORK_ERROR | 网络连接失败 |
| WORKFLOW_ERROR | 工作流接口错误 |
| STREAM_ERROR | 流式响应错误 |

---

## 附录：数据状态说明

### 同步状态（sync_status）

| 状态 | 说明 |
|------|------|
| pending | 等待同步 |
| syncing | 同步中 |
| success | 同步成功 |
| failed | 同步失败 |

### 数据完整性状态（status）

| 状态 | 说明 |
|------|------|
| ok | 数据正常 |
| stale | 数据过期 |
| missing | 数据缺失 |
| error | 同步错误 |
| pending | 正在同步 |

### MACD状态

| 状态 | 说明 |
|------|------|
| 极强 | DIF零轴上、DEA零轴下，上涨动能最充沛 |
| 强 | DIF/DEA均在零轴上、DIF>DEA，持有阶段 |
| 中偏强 | DIF/DEA均在零轴下、DIF>DEA，转强阶段 |
| 中偏弱 | DIF/DEA均在零轴上、DIF<DEA，转弱阶段 |
| 弱 | DIF/DEA均在零轴下、DIF<DEA，空头主导 |
| 极弱 | DIF零轴下、DEA零轴上，下跌动能最充沛 |

### 结构类型

| 类型 | 说明 |
|------|------|
| A五段式 | 5笔6拐点，第三浪是主升/跌浪 |
| B双平台式 | 9笔10拐点，双平台整理 |
| C单平台式 | 5笔6拐点，单平台整理 |
| D三段式 | 3笔4拐点，最小完整结构 |

---

*文档版本: 1.0*
*最后更新: 2024-01-01*
