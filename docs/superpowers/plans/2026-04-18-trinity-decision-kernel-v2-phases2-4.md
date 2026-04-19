# 三位一体判定内核 v2（Phase 2.0-4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Phase 1 已打通统一 `trinity_decision` 输出的基础上，完成起点标准锁定、结构资格系统、交易资格内核，以及页面与 AI 契约迁移，让页面能够清楚展示三位一体规则链，并把最终操作策略参考统一交给 AI 综合分析。

**Architecture:** 后端继续以 `scripts/stock_analyzer.py` 为唯一确定性判定内核，先锁定三类起点与结构编号语义，再扩展标准/非标准结构家族与交易资格规则。前端和 AI 不重复推导交易结论：TypeScript 只消费后端给出的 `trinity_decision`，AI 在硬门控之上输出综合判断摘要，页面则按“综合判断 → 关键规则链 → 支撑细节”分层展示，并在正式 UI 改造前先完成信息架构确认。

**Tech Stack:** Python 3、`pytest`、Next.js App Router、TypeScript、Node `node:test`、`pnpm`、Codex AI 分析链路、HTTP 回归（默认端口 `5001`）

---

## 范围边界

本计划只覆盖设计文档中的后续阶段：

- `Phase 2.0：起点标准锁定`
- `Phase 2：扩展结构资格系统`
- `Phase 3：交易资格内核`
- `Phase 4：页面与 AI 契约迁移`

不重复实现已完成的 `Phase 1` 内容，但允许在 `Phase 1` 已有契约上补字段、补测试、补判定规则。

**特别门槛：**
- `Phase 4` 的页面交互和布局改造，必须先完成页面信息架构确认，再改 UI 代码。
- 任何改动 `scripts/stock_analyzer.py` 的任务，都必须执行 `CLAUDE.md` 规定的 HTTP 回归。
- 提交信息必须使用中文，准确描述本次改动内容。

## 文件结构

**后端内核**
- 修改：`scripts/stock_analyzer.py`
  - 锁定 `background_origin / focus_origin / execution_origin`
  - 扩展 `focus_classification` / `raw_classification` / `trinity_decision.structure`
  - 落地结构资格、量能门控、交易资格、级别嵌套降级
- 修改：`tests/test_trinity_decision_origins.py`
  - 锁定三类起点优先级、窗口外原点、执行原点语义
- 新建：`tests/test_trinity_decision_structure_qualification.py`
  - 锁定标准 A/B/C/D 与延伸 / 通道 / 大平台 / 未完成 / 复杂结构
- 新建：`tests/test_trinity_decision_trade_qualification.py`
  - 锁定 `standard_node_trade`、`conditional_boundary_trade`、`wait_confirmation`、`risk_control`、`no_trade`
- 修改：`tests/test_trinity_decision_level_nesting.py`
  - 锁定父子一致 / 冲突 / 缺父级别降级
- 修改：`tests/test_stock_analyzer_render_payload.py`
  - 锁定聚合响应中的三类起点、结构类型和窗口外原点语义
- 修改：`tests/test_structure_interpretation_model.py`
  - 锁定解释模型返回的起点来源、结构编号和降级原因
- 修改：`tests/test_structure_phase_execution.py`
  - 锁定结构资格、交易资格、执行计划联动

**TypeScript 契约 / AI 契约**
- 修改：`src/lib/stock-structure-types.ts`
  - 扩展 `TrinityDecision` 的结构资格、边界、节点、量能和 AI 摘要字段
- 修改：`src/lib/ai-analysis-payload.ts`
  - 把后端确定性结论、三类起点、交易资格、量能门控整理成 AI 权威输入
- 修改：`src/app/api/stock/ai-analysis/route.ts`
  - 把提示词迁移到“综合判断优先、不得突破硬门控”的新契约
- 新建：`src/lib/ai-report-contract.ts`
  - 解析 AI 返回的综合判断摘要对象和完整 Markdown 报告
- 修改：`tests/trinity-decision-types.test.ts`
  - 锁定新增结构类型、起点字段和五级别契约
- 修改：`tests/ai-analysis-payload.test.ts`
  - 锁定 payload 中的起点、结构资格、量能、交易资格与 `deterministic_decision`
- 新建：`tests/ai-report-contract.test.ts`
  - 锁定 AI 综合判断摘要解析与硬门控字段保真
- 修改：`tests/codex-strategy-analysis.test.ts`
  - 锁定 AI 结构化摘要 + Markdown 双输出的运行链路

**页面消费层**
- 新建：`docs/superpowers/specs/2026-04-18-trinity-decision-kernel-v2-page-ia.md`
  - 页面信息架构确认稿（先确认，再实施）
- 修改：`src/lib/trinity-decision-view-model.ts`
  - 从“平铺摘要”升级为“综合判断 / 关键规则链 / 支撑细节”三层 view-model
- 新建：`src/lib/ai-summary-view-model.ts`
  - 把 AI 摘要对象映射成页面综合判断区可直接展示的文案与风险/触发条件列表
- 修改：`src/components/stock/TrinityDecisionPanel.tsx`
  - 改造成组合式容器，而不是继续堆平铺卡片
- 新建：`src/components/stock/TrinityDecisionSummaryCard.tsx`
  - 高优先级综合判断区，优先展示 AI 综合判断，旁边保留后端硬门控结论
- 新建：`src/components/stock/TrinityDecisionRuleChain.tsx`
  - 展示结构 / 时空 / 均线 / 量能 / 级别 / 执行的规则链
- 修改：`src/app/stock/[code]/analysis/page.tsx`
  - 移除当前基于 `dailyData.macd.status` 的硬编码“操作策略参考”块，改为消费新 view-model
- 修改：`tests/trinity-decision-view-model.test.ts`
  - 锁定新三层展示模型
- 修改：`tests/stock-execution-view-model.test.ts`
  - 锁定执行区的触发 / 失效 / 仓位展示
- 修改：`tests/structure-explainability-view-model.test.ts`
  - 锁定三类起点与支撑信息降级展示

---

### 任务 1：锁定三类起点语义与结构编号规则

**文件：**
- 修改：`scripts/stock_analyzer.py`
- 修改：`tests/test_trinity_decision_origins.py`
- 修改：`tests/test_stock_analyzer_render_payload.py`
- 修改：`tests/test_structure_interpretation_model.py`
- 修改：`tests/trinity-decision-types.test.ts`

- [ ] **Step 1: 先写失败的起点与编号测试**

```python
class TrinityDecisionOriginsTest(unittest.TestCase):
    def test_focus_origin_prefers_peak_extreme_then_recent_component_then_macro_origin(self) -> None:
        structure = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': 'C单平台式',
                'trend_direction': '震荡',
                'description': '峰值切片后的右侧聚焦结构',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'C',
                        'standard_qualification': 'standard',
                        'start_anchor': {'point_id': 'p7', 'price': 209.88, 'date': '2025-11-14'},
                        'start_anchor_source': 'peak_extreme',
                    }
                },
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'peak_extreme',
                        'selected_point_index': 7,
                        'explainability_status': 'passed',
                        'explainability_reason': '主峰切片优先',
                    },
                    'raw_classification': {'type': '延伸C类'},
                    'focus_classification': {'type': 'C单平台式', 'standard_qualification': 'standard'},
                    'explainability': {
                        'structure_start_point_id': 'p7',
                        'current_point_id': 'p12',
                        'display_reason': '标准结构从聚焦起点重新编号',
                    },
                },
            }
        )

        self.assertEqual(structure['focus_origin']['source'], 'peak_extreme')
        self.assertEqual(structure['focus_origin']['price'], 209.88)
        self.assertEqual(structure['background_origin']['semantic'], 'background_origin')
        self.assertEqual(structure['execution_origin']['semantic'], 'execution_origin')
        self.assertEqual(structure['type'], 'C单平台式')
        self.assertEqual(structure['explainability']['status'], 'passed')

    def test_background_origin_outside_window_does_not_fall_back_to_first_visible_point(self) -> None:
        payload = self.analyzer._build_trinity_structure_decision(
            {
                'structure_type': '延伸C',
                'description': '窗口截断后的聚焦结构',
                'interpretation': {'focus_structure': {}},
                'structure_details': {
                    'focus_origin_analysis': {
                        'selected_origin_kind': 'macro_origin',
                        'selected_point_index': None,
                        'explainability_status': 'downgraded',
                        'explainability_reason': '宏观原点在窗口外，仅保留来源说明',
                    },
                    'raw_classification': {'type': '延伸C类'},
                    'focus_classification': {'type': '延伸C', 'standard_qualification': 'extended'},
                },
            }
        )

        self.assertIsNone(payload['background_origin'])
        self.assertIn('窗口外', payload['explainability']['reason'])
```

- [ ] **Step 2: 运行起点定向测试并确认先失败**

运行：

```bash
python3 -m pytest \
  tests/test_trinity_decision_origins.py \
  tests/test_stock_analyzer_render_payload.py \
  tests/test_structure_interpretation_model.py -q
```

预期：

```text
FAILED tests/test_trinity_decision_origins.py::TrinityDecisionOriginsTest::test_focus_origin_prefers_peak_extreme_then_recent_component_then_macro_origin
E   AssertionError: ...
```

- [ ] **Step 3: 实现三类起点分层与编号辅助函数**

在 `scripts/stock_analyzer.py` 的 `focus_origin_analysis` 和 `_build_trinity_structure_decision()` 附近补以下辅助层，并确保标准结构重新编号、非标准结构停止标准编号：

```python
def _build_background_origin_anchor(self, raw_classification: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    origin = raw_classification.get('macro_origin') or {}
    if origin.get('outside_window'):
        return None
    return self._normalize_trinity_anchor(origin, source='macro_origin', semantic='background_origin')


def _build_focus_origin_anchor(
    self,
    focus_structure: Dict[str, Any],
    focus_origin_analysis: Dict[str, Any],
    raw_classification: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    priority = ('peak_extreme', 'valley_extreme', 'recent_component', 'macro_origin')
    selected_source = focus_structure.get('start_anchor_source') or focus_origin_analysis.get('selected_origin_kind')
    if selected_source not in priority:
        selected_source = 'macro_origin'
    anchor = focus_structure.get('start_anchor') or raw_classification.get('macro_origin') or {}
    return self._normalize_trinity_anchor(anchor, source=selected_source, semantic='focus_origin')


def _build_numbering_explainability(
    self,
    focus_classification: Dict[str, Any],
    explainability: Dict[str, Any],
) -> Dict[str, Any]:
    qualification = focus_classification.get('standard_qualification') or 'failed'
    if qualification in {'extended', 'unfinished', 'failed'}:
        return {
            'status': 'downgraded',
            'reason': explainability.get('display_reason') or '非标准结构停止标准编号，仅保留解释锚点',
            'evidence': ['停止标准 A/B/C/D 编号'],
        }
    return {
        'status': 'passed',
        'reason': explainability.get('display_reason') or '标准结构从聚焦起点重新编号',
        'evidence': ['聚焦起点已锁定', '结构编号从当前结构起点重新开始'],
    }
```

并在 `_build_trinity_structure_decision()` 中按如下方式接入：

```python
background_origin = self._build_background_origin_anchor(raw_classification)
focus_origin = self._build_focus_origin_anchor(focus_structure, focus_origin_analysis, raw_classification)
execution_origin = self._build_execution_origin_anchor(structure_payload, focus_origin)
numbering_explainability = self._build_numbering_explainability(focus_classification, explainability)
```

- [ ] **Step 4: 运行起点、类型与 HTTP 回归，确认全部通过**

运行：

```bash
python3 -m pytest \
  tests/test_trinity_decision_origins.py \
  tests/test_stock_analyzer_render_payload.py \
  tests/test_structure_interpretation_model.py -q
node --test tests/trinity-decision-types.test.ts
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly" | python3 -c "import json,sys;r=json.load(sys.stdin);w=r['data']['periods']['weekly'];d=w['structure']['structure_details'];td=w['trinity_decision'];print(d['raw_classification']['type']);print(td['structure']['type']);print(td['structure']['focus_origin'])"
```

预期：

```text
Python 定向测试通过
Node 定向测试通过
延伸C类
C单平台式
{'price': 209.88, ... 'source': 'peak_extreme'}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_origins.py tests/test_stock_analyzer_render_payload.py tests/test_structure_interpretation_model.py tests/trinity-decision-types.test.ts
git commit -m "内核：锁定三位一体起点分层与结构编号语义"
```

### 任务 2：落地标准 / 非标准结构资格内核

**文件：**
- 修改：`scripts/stock_analyzer.py`
- 新建：`tests/test_trinity_decision_structure_qualification.py`
- 修改：`tests/test_structure_interpretation_model.py`
- 修改：`tests/test_structure_phase_execution.py`

- [ ] **Step 1: 先写失败的结构资格矩阵测试**

```python
@pytest.mark.parametrize(
    ('focus_type', 'expected_family', 'expected_qualification', 'expected_standard_candidate'),
    [
        ('A五段式', 'standard', 'standard', 'A五段式'),
        ('延伸A', 'extended', 'extended', 'A五段式'),
        ('B双平台式', 'standard', 'standard', 'B双平台式'),
        ('延伸B', 'extended', 'extended', 'B双平台式'),
        ('C单平台式', 'standard', 'standard', 'C单平台式'),
        ('延伸C', 'extended', 'extended', 'C单平台式'),
        ('上升通道', 'channel', 'over_limit', None),
        ('大平台震荡', 'range', 'over_limit', None),
        ('未完成结构', 'unfinished', 'unfinished', None),
        ('复杂结构', 'complex', 'failed', None),
    ],
)
def test_structure_qualification_family_matrix(focus_type, expected_family, expected_qualification, expected_standard_candidate):
    analyzer = TrinityStockAnalyzer()
    decision = analyzer._build_trinity_structure_decision(
        {
            'structure_type': focus_type,
            'trend_direction': '上涨',
            'description': f'{focus_type} 测试',
            'interpretation': {'focus_structure': {}},
            'structure_details': {
                'focus_classification': {
                    'type': focus_type,
                    'standard_qualification': expected_qualification,
                    'qualification_reason': '测试结构资格',
                    'trend_direction': '上涨',
                }
            },
        }
    )

    assert decision['family'] == expected_family
    assert decision['qualification'] == expected_qualification
    assert decision['standard_candidate'] == expected_standard_candidate
```

- [ ] **Step 2: 运行结构资格测试并确认先失败**

运行：

```bash
python3 -m pytest tests/test_trinity_decision_structure_qualification.py -q
```

预期：

```text
FAILED tests/test_trinity_decision_structure_qualification.py::test_structure_qualification_family_matrix[延伸A-extended-extended-A五段式]
E   AssertionError: assert 'standard' == 'extended'
```

- [ ] **Step 3: 扩展结构资格、边界与节点图构建**

在 `scripts/stock_analyzer.py` 中围绕 `focus_classification` 新增以下判定辅助函数，并把 `structure.boundaries`、`structure.node_map`、`can_trade_by_structure_nodes`、`can_trade_by_boundaries` 统一接到 `TrinityDecision`：

```python
STRUCTURE_FAMILY_MAP = {
    'A五段式': ('standard', 'standard', 'A五段式'),
    'B双平台式': ('standard', 'standard', 'B双平台式'),
    'C单平台式': ('standard', 'standard', 'C单平台式'),
    'D三段式': ('standard', 'standard', 'D三段式'),
    '延伸A': ('extended', 'extended', 'A五段式'),
    '延伸B': ('extended', 'extended', 'B双平台式'),
    '延伸C': ('extended', 'extended', 'C单平台式'),
    '延伸D': ('extended', 'extended', 'D三段式'),
    '上升通道': ('channel', 'over_limit', None),
    '下降通道': ('channel', 'over_limit', None),
    '大平台震荡': ('range', 'over_limit', None),
    '未完成结构': ('unfinished', 'unfinished', None),
    '复杂结构': ('complex', 'failed', None),
}


def _resolve_trinity_structure_family(self, focus_classification: Dict[str, Any], structure_type: str) -> Tuple[str, str, Optional[str]]:
    return STRUCTURE_FAMILY_MAP.get(
        focus_classification.get('type') or structure_type,
        ('complex', 'failed', None),
    )


def _build_trinity_boundaries(self, structure_payload: Dict[str, Any]) -> Dict[str, Optional[float]]:
    details = structure_payload.get('structure_details') or {}
    boundary = details.get('boundary_levels') or {}
    return {
        'upper': boundary.get('upper'),
        'lower': boundary.get('lower'),
        'mid': boundary.get('mid'),
        'breakout_trigger': boundary.get('breakout_trigger') or boundary.get('upper'),
        'breakdown_trigger': boundary.get('breakdown_trigger') or boundary.get('lower'),
        'stop_loss': boundary.get('stop_loss'),
    }


def _build_trinity_node_map(self, explainability: Dict[str, Any], qualification: str) -> Dict[str, Optional[float]]:
    if qualification not in {'standard'}:
        return {'a4': None, 'b8': None, 'd3': None, 'd4': None, 'last_confirmed': None}
    return {
        'a4': explainability.get('a4_price'),
        'b8': explainability.get('b8_price'),
        'd3': explainability.get('d3_price'),
        'd4': explainability.get('d4_price'),
        'last_confirmed': explainability.get('last_confirmed_price'),
    }
```

- [ ] **Step 4: 运行结构资格、解释模型与执行联动测试**

运行：

```bash
python3 -m pytest \
  tests/test_trinity_decision_structure_qualification.py \
  tests/test_structure_interpretation_model.py \
  tests/test_structure_phase_execution.py -q
```

预期：

```text
12 passed
```

- [ ] **Step 5: Commit**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_structure_qualification.py tests/test_structure_interpretation_model.py tests/test_structure_phase_execution.py
git commit -m "内核：补齐标准与非标准结构资格判定矩阵"
```

### 任务 3：实现量能门控、交易资格与级别降级内核

**文件：**
- 修改：`scripts/stock_analyzer.py`
- 新建：`tests/test_trinity_decision_trade_qualification.py`
- 修改：`tests/test_trinity_decision_level_nesting.py`
- 修改：`tests/test_structure_phase_execution.py`

- [ ] **Step 1: 先写失败的交易资格与级别降级测试**

```python
def test_extended_c_with_breakout_and_ma55_support_becomes_conditional_boundary_trade() -> None:
    analyzer = TrinityStockAnalyzer()
    decision = analyzer._build_trinity_decision(
        level='daily',
        structure_payload={
            'structure_type': '延伸C',
            'trend_direction': '震荡',
            'description': '延伸C 放量突破',
            'interpretation': {'focus_structure': {'archetype_family': 'C'}},
            'structure_details': {'focus_classification': {'type': '延伸C', 'standard_qualification': 'extended'}},
        },
        macd_payload={'status': '中偏强', 'top_divergence': False, 'bottom_divergence': False},
        moving_averages={'price_vs_ma55': 'above', 'price_vs_ma233': 'above', 'ma_status': '多头排列'},
        breakthrough_payload={'direction': 'up', 'is_valid': True, 'pattern_type': 'breakout'},
        execution_payload={
            'action': 'buy',
            'direction': 'long',
            'entry_style': 'boundary',
            'trigger': ['放量突破平台上沿'],
            'invalidation': ['跌回平台下沿'],
            'confirmation': ['回踩不破'],
            'position_sizing': {'initial': 'light_probe'},
            'risk_flags': [],
            'rationale': '延伸结构只允许条件化边界交易',
        },
        level_nesting_payload=None,
        period_payload={'volume_ratio_5': 1.65, 'volume_ratio_20': 1.42, 'amount_ratio_20': 1.30},
    )

    assert decision['trade_qualification']['trade_mode'] == 'conditional_boundary_trade'
    assert decision['trade_qualification']['position_permission'] == 'light_probe'
    assert decision['volume_confirmation']['volume_gate']['supports_breakout'] is True


def test_parent_conflict_forces_child_to_wait_or_light_probe() -> None:
    analyzer = TrinityStockAnalyzer()
    nesting = analyzer._build_trinity_level_nesting_decision(
        level='hour30',
        raw_level_nesting={'summary': '日线偏弱，30分钟反弹'},
        current_period={'macd': {'status': '中偏强'}, 'structure': {'structure_type': 'A五段式'}},
        parent_period={'macd': {'status': '弱'}, 'trinity_decision': {'conclusion': {'bias': 'bearish'}}},
    )

    assert nesting['resonance'] in {'conflict', 'child_countertrend'}
    assert nesting['permission']['allow_position_increase'] is False
```

- [ ] **Step 2: 运行交易资格与级别矩阵测试并确认先失败**

运行：

```bash
python3 -m pytest \
  tests/test_trinity_decision_trade_qualification.py \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_structure_phase_execution.py -q
```

预期：

```text
FAILED tests/test_trinity_decision_trade_qualification.py::test_extended_c_with_breakout_and_ma55_support_becomes_conditional_boundary_trade
E   AssertionError: assert 'wait_confirmation' == 'conditional_boundary_trade'
```

- [ ] **Step 3: 实现量能阈值、交易资格和父子级别降级逻辑**

在 `scripts/stock_analyzer.py` 中最小增量修改现有四个辅助函数：

```python
def _build_trinity_volume_confirmation_decision(self, period_payload: Dict[str, Any], breakthrough_payload: Dict[str, Any]) -> Dict[str, Any]:
    ratio_5 = _safe_float(period_payload.get('volume_ratio_5'))
    ratio_20 = _safe_float(period_payload.get('volume_ratio_20'))
    amount_ratio = _safe_float(period_payload.get('amount_ratio_20'))
    breakout_confirmed = bool((ratio_5 and ratio_5 >= 1.2) or (ratio_20 and ratio_20 >= 1.15))
    pullback_healthy = bool(ratio_5 and ratio_5 <= 0.85)
    return {
        'volume_ratio_5': ratio_5,
        'volume_ratio_20': ratio_20,
        'amount_ratio_20': amount_ratio,
        'volume_state': 'expanding' if breakout_confirmed else 'shrinking' if pullback_healthy else 'normal',
        'breakout_volume': 'confirmed' if breakthrough_payload.get('direction') == 'up' and breakout_confirmed else 'weak',
        'breakdown_volume': 'confirmed' if breakthrough_payload.get('direction') == 'down' and breakout_confirmed else 'not_applicable',
        'pullback_volume': 'healthy_shrink' if pullback_healthy else 'normal',
        'volume_gate': {
            'supports_breakout': breakout_confirmed,
            'supports_breakdown': breakthrough_payload.get('direction') == 'down' and breakout_confirmed,
            'supports_pullback_confirmation': pullback_healthy,
            'confidence_adjustment': 'upgrade' if breakout_confirmed or pullback_healthy else 'downgrade',
            'reason': '放量确认突破，缩量回踩更健康' if breakout_confirmed else '量能未充分确认，需等待二次验证',
        },
    }


def _build_trinity_trade_qualification(self, structure_decision, spacetime_decision, moving_average_decision, volume_decision, execution_payload):
    if structure_decision['family'] == 'unfinished':
        return {'trade_mode': 'wait_confirmation', 'position_permission': 'no_position', 'confidence': 'low', 'reason': ['未完成结构仅等待']}
    if structure_decision['family'] in {'extended', 'channel', 'range'}:
        return {'trade_mode': 'conditional_boundary_trade', 'position_permission': 'light_probe', 'confidence': 'medium', 'reason': ['非标准结构只允许边界条件交易']}
    if execution_payload.get('action') in {'reduce', 'sell', 'avoid'}:
        return {'trade_mode': 'risk_control', 'position_permission': 'reduce_only', 'confidence': 'high', 'reason': ['跌破边界或均线，进入风险控制']}
    return {'trade_mode': 'standard_node_trade', 'position_permission': 'half_position', 'confidence': 'medium', 'reason': ['标准结构节点可交易']}
```

并在 `_build_trinity_level_nesting_decision()` 中补齐：

```python
if parent_bias == 'bearish' and child_signal == 'long':
    resonance = 'child_countertrend'
    permission = {
        'allow_position_increase': False,
        'allow_t_trade': True,
        'allow_only_light_probe': True,
        'reason': '子级别逆父级别，只允许轻仓试探或做T',
    }
```

- [ ] **Step 4: 运行 Python 定向测试与双 HTTP 回归**

运行：

```bash
python3 -m pytest \
  tests/test_trinity_decision_trade_qualification.py \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_structure_phase_execution.py -q
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly" > /tmp/trinity-weekly.json
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15" > /tmp/trinity-all.json
python3 - <<'PY'
import json
for path in ('/tmp/trinity-weekly.json', '/tmp/trinity-all.json'):
    data = json.load(open(path))['data']['periods']
    for level in data:
        td = data[level].get('trinity_decision') or {}
        print(level, td.get('level'), (td.get('trade_qualification') or {}).get('trade_mode'))
PY
```

预期：

```text
... passed
weekly weekly ...
daily daily ...
hour60 hour60 ...
hour30 hour30 ...
hour15 hour15 ...
```

- [ ] **Step 5: Commit**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_trade_qualification.py tests/test_trinity_decision_level_nesting.py tests/test_structure_phase_execution.py
git commit -m "内核：实现量能门控与交易资格降级规则"
```

### 任务 4：迁移 TypeScript 契约、AI payload 与 AI 综合判断摘要契约

**文件：**
- 修改：`src/lib/stock-structure-types.ts`
- 修改：`src/lib/ai-analysis-payload.ts`
- 修改：`src/app/api/stock/ai-analysis/route.ts`
- 新建：`src/lib/ai-report-contract.ts`
- 修改：`tests/trinity-decision-types.test.ts`
- 修改：`tests/ai-analysis-payload.test.ts`
- 新建：`tests/ai-report-contract.test.ts`
- 修改：`tests/codex-strategy-analysis.test.ts`

- [ ] **Step 1: 先写失败的 TS 契约与 AI 摘要测试**

```ts
test('buildAiDecisionPayload keeps origin layers and trade qualification for daily period', () => {
  const payload = buildAiDecisionPayload({
    periods: {
      daily: {
        trinity_decision: {
          version: 'v2',
          level: 'daily',
          conclusion: { action: 'wait', action_label: '等待', bias: 'neutral', confidence: 'medium', can_trade: false },
          structure: {
            background_origin: { price: 180.12, source: 'macro_origin', semantic: 'background_origin' },
            focus_origin: { price: 209.88, source: 'peak_extreme', semantic: 'focus_origin' },
            execution_origin: { point_id: 'c4', price: 188.32, source: 'recent_component', semantic: 'execution_origin' },
            family: 'extended',
            type: '延伸C',
            standard_candidate: 'C单平台式',
            qualification: 'extended',
            direction: 'neutral',
            boundaries: { upper: 190.4, lower: 176.2, breakout_trigger: 190.4, breakdown_trigger: 176.2 },
            node_map: { a4: null, b8: null, d3: null, d4: null, last_confirmed: 188.32 },
            can_trade_by_structure_nodes: false,
            can_trade_by_boundaries: true,
            explainability: { status: 'downgraded', reason: '延伸结构停止标准编号', evidence: ['平台超限'] },
          },
          spacetime: { status: '中偏强', direction_bias: 'bullish', expected_structures: { up: ['C单平台式'], down: [] }, structure_match: true, divergence_policy: { top_divergence_valid: false, bottom_divergence_valid: false, reason: '无背离' } },
          moving_average: { ma55_role: 'support', ma233_role: 'support', price_position: { above_ma55: true, above_ma233: true }, breakthrough_state: 'valid_breakout', ma_gate: { allow_long: true, allow_short: false, reason: '站上 MA55' } },
          volume_confirmation: { volume_state: 'expanding', breakout_volume: 'confirmed', breakdown_volume: 'not_applicable', pullback_volume: 'normal', volume_gate: { supports_breakout: true, supports_breakdown: false, supports_pullback_confirmation: false, confidence_adjustment: 'upgrade', reason: '放量确认' } },
          trade_qualification: { trade_mode: 'conditional_boundary_trade', position_permission: 'light_probe', confidence: 'medium', reason: ['延伸结构仅允许边界交易'] },
          execution: { entry_style: 'boundary', triggers: ['放量突破 190.4'], invalidation: ['跌回 190.4 下方'], confirmation: ['回踩不破'], position_sizing: { max_ratio: 0.15, reason: '轻仓试探' }, risk_flags: ['等待二次确认'], notes: ['不允许标准节点交易'] },
          judgment_criteria: [],
          ai_summary_facts: ['延伸C', '放量突破', '仅轻仓试探'],
        },
      },
    },
  } as never);

  assert.equal(payload.periods.daily.deterministic_decision?.structure.type, '延伸C');
  assert.equal(payload.periods.daily.deterministic_decision?.trade_qualification.trade_mode, 'conditional_boundary_trade');
});

test('parseAiReportContract extracts summary card and markdown body', () => {
  const report = [
    '```json',
    '{"headline":"等待放量突破后轻仓试探","action":"wait","bias":"neutral","primary_reason":"延伸C未脱离边界","triggers":["放量突破190.4"],"risks":["跌回平台下沿"],"guardrail":"不得突破后端 wait 硬门控"}',
    '```',
    '',
    '## 详细分析',
    '- ...',
  ].join('\\n');
  const parsed = parseAiReportContract(report);
  assert.equal(parsed.summary.headline, '等待放量突破后轻仓试探');
  assert.match(parsed.markdown, /详细分析/);
});
```

- [ ] **Step 2: 运行 TS 测试并确认先失败**

运行：

```bash
node --test \
  tests/trinity-decision-types.test.ts \
  tests/ai-analysis-payload.test.ts \
  tests/codex-strategy-analysis.test.ts \
  tests/ai-report-contract.test.ts
```

预期：

```text
not ok ... parseAiReportContract is not defined
```

- [ ] **Step 3: 实现 TS 类型、payload 映射和 AI 摘要解析契约**

在 `src/lib/stock-structure-types.ts` 中补齐这些接口片段：

```ts
export interface TrinityStructureDecision {
  background_origin?: TrinityAnchor | null;
  focus_origin?: TrinityAnchor | null;
  execution_origin?: TrinityAnchor | null;
  family: 'standard' | 'extended' | 'channel' | 'range' | 'unfinished' | 'complex';
  type:
    | 'A五段式'
    | 'B双平台式'
    | 'C单平台式'
    | 'D三段式'
    | '延伸A'
    | '延伸B'
    | '延伸C'
    | '延伸D'
    | '上升通道'
    | '下降通道'
    | '大平台震荡'
    | '未完成结构'
    | '复杂结构';
  boundaries: TrinityStructureBoundaries;
  node_map: TrinityStructureNodeMap;
}

export interface AiSummaryCard {
  headline: string;
  action: TrinityConclusion['action'];
  bias: TrinityConclusion['bias'];
  primary_reason: string;
  triggers: string[];
  risks: string[];
  guardrail: string;
}
```

在 `src/lib/ai-report-contract.ts` 中新增：

```ts
export function parseAiReportContract(report: string): { summary: AiSummaryCard; markdown: string } {
  const match = report.match(/^```json\s*([\s\S]*?)```\s*([\s\S]*)$/);
  if (!match) {
    throw new Error('AI 报告缺少 JSON 摘要头部');
  }
  return {
    summary: JSON.parse(match[1]) as AiSummaryCard,
    markdown: match[2].trim(),
  };
}
```

并把 `src/app/api/stock/ai-analysis/route.ts` 的提示词改为先输出 JSON 摘要，再输出 Markdown 正文，且明确强调：

```ts
- “操作策略参考”必须以 deterministic_decision 为硬边界。
- 如果 deterministic_decision.action = wait / avoid，摘要 action 不能升级为 buy / add。
- JSON 摘要字段必须包含 headline / action / bias / primary_reason / triggers / risks / guardrail。
```

- [ ] **Step 4: 运行 TS 定向测试与类型检查**

运行：

```bash
node --test \
  tests/trinity-decision-types.test.ts \
  tests/ai-analysis-payload.test.ts \
  tests/ai-report-contract.test.ts \
  tests/codex-strategy-analysis.test.ts
pnpm ts-check
```

预期：

```text
# node --test 全部通过
# pnpm ts-check 退出码 0
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts src/app/api/stock/ai-analysis/route.ts src/lib/ai-report-contract.ts tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts tests/ai-report-contract.test.ts tests/codex-strategy-analysis.test.ts
git commit -m "契约：迁移三位一体 AI payload 与综合判断摘要格式"
```

### 任务 5：先产出页面信息架构确认稿，再暂停等待确认

**文件：**
- 新建：`docs/superpowers/specs/2026-04-18-trinity-decision-kernel-v2-page-ia.md`

- [ ] **Step 1: 先写页面信息架构确认稿**

确认稿至少包含以下固定版块，并用一张“页面分区表”说明每区展示什么、为什么存在、哪些内容必须降级：

```md
# 三位一体页面信息架构确认稿

## 1. 综合判断区（最高优先级）
- 主标题：AI 综合判断 headline
- 左侧：AI 操作策略参考 / 主因 / 触发条件 / 风险条件
- 右侧：后端硬门控（action / trade_mode / position_permission / focus structure）

## 2. 关键规则链
- 结构资格
- MACD 时空门控
- MA55 / MA233 门控
- 量能确认
- 级别嵌套权限
- 执行计划

## 3. 支撑细节 / Debug
- 原始结构详情
- 三类起点
- 原始 classification
- scenario paths
```

- [ ] **Step 2: 自检确认稿，确保不直接进入 UI 修改**

运行：

```bash
rg -n "TODO|TBD|待定" docs/superpowers/specs/2026-04-18-trinity-decision-kernel-v2-page-ia.md || true
```

预期：

```text
# 无输出
```

- [ ] **Step 3: 把确认稿发给用户并等待确认**

向用户发送：

```text
页面信息架构确认稿已写到 docs/superpowers/specs/2026-04-18-trinity-decision-kernel-v2-page-ia.md。
请先确认综合判断区、关键规则链和支撑细节三层结构；确认前不进入页面代码修改。
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-18-trinity-decision-kernel-v2-page-ia.md
git commit -m "文档：补充三位一体页面信息架构确认稿"
```

### 任务 6：在页面确认后，重构综合判断区与规则链展示

**文件：**
- 修改：`src/lib/trinity-decision-view-model.ts`
- 新建：`src/lib/ai-summary-view-model.ts`
- 修改：`src/components/stock/TrinityDecisionPanel.tsx`
- 新建：`src/components/stock/TrinityDecisionSummaryCard.tsx`
- 新建：`src/components/stock/TrinityDecisionRuleChain.tsx`
- 修改：`src/app/stock/[code]/analysis/page.tsx`
- 修改：`tests/trinity-decision-view-model.test.ts`
- 修改：`tests/stock-execution-view-model.test.ts`
- 修改：`tests/structure-explainability-view-model.test.ts`

- [ ] **Step 1: 先写失败的页面 view-model 与组件测试**

```ts
test('buildTrinityDecisionViewModel separates summary rule-chain and supporting detail', () => {
  const vm = buildTrinityDecisionViewModel({
    decision: sampleDecision,
    aiSummary: {
      headline: '等待放量突破后轻仓试探',
      action: 'wait',
      bias: 'neutral',
      primary_reason: '延伸C仍处边界内',
      triggers: ['放量突破 190.4'],
      risks: ['跌回 176.2 下方'],
      guardrail: '后端当前仅允许 wait / light_probe',
    },
  });

  assert.equal(vm.summary.title, '等待放量突破后轻仓试探');
  assert.equal(vm.summary.guardrailLabel, '后端硬门控');
  assert.equal(vm.ruleChain.length, 6);
  assert.ok(vm.supportingDetail.some((item) => item.label === '聚焦起点'));
});
```

- [ ] **Step 2: 运行页面相关测试并确认先失败**

运行：

```bash
node --test \
  tests/trinity-decision-view-model.test.ts \
  tests/stock-execution-view-model.test.ts \
  tests/structure-explainability-view-model.test.ts
```

预期：

```text
not ok ... vm.summary is undefined
```

- [ ] **Step 3: 实现新的三层页面模型并替换旧的硬编码操作建议**

在 `src/lib/trinity-decision-view-model.ts` 中输出如下结构：

```ts
export interface TrinityDecisionScreenViewModel {
  summary: {
    title: string;
    actionLabel: string;
    primaryReason: string;
    triggers: string[];
    risks: string[];
    guardrailLabel: string;
    guardrailValue: string;
  };
  ruleChain: Array<{ key: string; label: string; value: string; reason?: string | null }>;
  supportingDetail: Array<{ label: string; value: string; tone: 'default' | 'muted' }>;
}
```

在 `src/app/stock/[code]/analysis/page.tsx` 中删除当前这段基于 `dailyData?.macd.status` 的分支式“操作策略参考”，改为：

```tsx
<TrinityDecisionSummaryCard
  summary={screenVm.summary}
  deterministicDecision={dailyData?.trinity_decision ?? null}
/>
<TrinityDecisionRuleChain items={screenVm.ruleChain} />
<TrinityDecisionPanel supportingDetail={screenVm.supportingDetail} />
```

要求：
- “操作策略参考”文案优先使用 AI 摘要
- 旁边必须同步展示后端硬门控 `action / trade_mode / position_permission`
- 原始结构字段只能降级到支撑细节区，不再平铺抢占主阅读路径

- [ ] **Step 4: 运行前端测试与类型检查**

运行：

```bash
node --test \
  tests/trinity-decision-view-model.test.ts \
  tests/stock-execution-view-model.test.ts \
  tests/structure-explainability-view-model.test.ts \
  tests/ai-analysis-payload.test.ts
pnpm ts-check
```

预期：

```text
# node --test 全部通过
# pnpm ts-check 退出码 0
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/trinity-decision-view-model.ts src/lib/ai-summary-view-model.ts src/components/stock/TrinityDecisionPanel.tsx src/components/stock/TrinityDecisionSummaryCard.tsx src/components/stock/TrinityDecisionRuleChain.tsx src/app/stock/[code]/analysis/page.tsx tests/trinity-decision-view-model.test.ts tests/stock-execution-view-model.test.ts tests/structure-explainability-view-model.test.ts tests/ai-analysis-payload.test.ts
git commit -m "前端：重构三位一体综合判断区与规则链展示"
```

### 任务 7：做最终整体验证并收口

**文件：**
- 修改：`CLAUDE.md`（仅当基线必须更新且经过确认时）
- 不新增实现文件，专注验证与必要的最小修正

- [ ] **Step 1: 跑完整定向测试矩阵**

运行：

```bash
python3 -m pytest \
  tests/test_trinity_decision_levels.py \
  tests/test_trinity_decision_origins.py \
  tests/test_trinity_decision_structure_qualification.py \
  tests/test_trinity_decision_trade_qualification.py \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_stock_analyzer_render_payload.py \
  tests/test_structure_interpretation_model.py \
  tests/test_structure_phase_execution.py -q
node --test \
  tests/trinity-decision-types.test.ts \
  tests/trinity-decision-view-model.test.ts \
  tests/ai-analysis-payload.test.ts \
  tests/ai-report-contract.test.ts \
  tests/codex-strategy-analysis.test.ts \
  tests/stock-execution-view-model.test.ts \
  tests/structure-explainability-view-model.test.ts
pnpm ts-check
```

预期：

```text
# Python 退出码 0
# Node 退出码 0
# pnpm ts-check 退出码 0
```

- [ ] **Step 2: 执行双 HTTP 回归并记录关键断言**

运行：

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly" | python3 -c "import json,sys;r=json.load(sys.stdin);w=r['data']['periods']['weekly'];td=w['trinity_decision'];print(td['structure']['focus_origin']);print(td['structure']['type']);print(td['trade_qualification']['trade_mode'])"
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly,daily,hour60,hour30,hour15" | python3 -c "import json,sys;r=json.load(sys.stdin)['data']['periods'];print({k:v['trinity_decision']['level'] for k,v in r.items()});print({k:(v['trinity_decision'].get('level_nesting') or {}).get('resonance') for k,v in r.items()})"
```

预期：

```text
{'price': 209.88, ... 'source': 'peak_extreme'}
C单平台式
...
{'weekly': 'weekly', 'daily': 'daily', 'hour60': 'hour60', 'hour30': 'hour30', 'hour15': 'hour15'}
```

- [ ] **Step 3: 如确有规范基线变化，再最小更新 `CLAUDE.md`**

只有在以下条件同时成立时才修改：
- 新语义已经由测试与 HTTP 回归证明稳定
- 旧基线确实不再代表当前规范
- 更新内容是基线，不是“已知修复问题”

修改模板：

```md
| 检查项 | 期望值 | 说明 |
|--------|--------|------|
| 聚焦结构类型 | `C单平台式` | 当前规范采用 focus-origin 聚焦语义 |
```

- [ ] **Step 4: 做最终提交**

```bash
git add scripts/stock_analyzer.py src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts src/lib/ai-report-contract.ts src/lib/trinity-decision-view-model.ts src/lib/ai-summary-view-model.ts src/components/stock/TrinityDecisionPanel.tsx src/components/stock/TrinityDecisionSummaryCard.tsx src/components/stock/TrinityDecisionRuleChain.tsx src/app/stock/[code]/analysis/page.tsx tests docs/superpowers/specs/2026-04-18-trinity-decision-kernel-v2-page-ia.md CLAUDE.md
git commit -m "验收：完成三位一体内核与页面 AI 契约迁移验证"
```

---

## 自检清单

- `Phase 2.0` 是否明确锁定了 `background_origin / focus_origin / execution_origin` 的职责与回退次序。
- `Phase 2` 是否明确区分标准结构与延伸 / 通道 / 大平台 / 未完成 / 复杂结构，并保留 `standard_candidate`。
- `Phase 3` 是否明确把量能、均线、时空、级别嵌套一起落到 `trade_qualification`。
- `Phase 4` 是否先有页面 IA 确认，再进入页面代码修改。
- 页面“操作策略参考”是否明确以 AI 综合判断摘要为准，同时展示后端硬门控。
- 所有 Python 改动是否都配了 HTTP 回归步骤。
- 所有提交信息是否都是中文。

## 执行顺序建议

1. 先完成任务 1～4，确保后端、TS 契约和 AI 摘要链路稳定。
2. 然后只执行任务 5，拿到页面 IA 确认。
3. 用户确认后，再执行任务 6。
4. 最后执行任务 7 做总验收。
