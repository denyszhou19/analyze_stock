# 三位一体前瞻结构候选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前“回看分类器”升级成“前瞻候选器”，让三位一体先输出时空允许候选集合，再基于最新走势主语选择 `A / B / C / D` 主候选，并把候选阶段、防抖、方向锁、异常中断接进交易层与展示层。

**Architecture:** 后端新增 `trinity_decision.structure_prediction` 结构化合同，保留原始全局结构用于解释与回溯；预测结构只负责“当前最可能正在演化成什么”。交易层继续以后端为准，但从“已完成结构”切到“主候选 × 候选阶段 × 时空许可 × 方向锁”的执行闸门。前端不重做布局，只把综合判断、交易总线、周期详情、AI payload 的数据源切到新合同，并保持中文、显式主语、低重复。

**Tech Stack:** Python 3、`unittest`、Next.js App Router、React 19、TypeScript、node:test、pnpm、HTTP regression via local Next API (`5001`)。

---

## UI 归属与显示边界

本计划虽然以策略合同为主，但实现时必须遵守 `skills/trinity-analysis-ui-design/SKILL.md` 的页面职责边界：

1. `AnalysisSummaryPanel`
   - 只讲页级综合结论、页级阻塞、页级风险提醒
   - 不复述组合级动作
   - 不展开单级别结构证据

2. `TradingCycleBus`
   - 只讲组合级动作、组合级约束、组合级风险
   - `primary_candidate / candidate stage / direction_lock` 只用来说明“这条组合现在能做到什么程度”
   - 不再复述页级结论和周期详情证据

3. `AnalysisPeriodDetails`
   - 只讲该级别结构证据、父级约束、下一确认、失效边界
   - 不再输出执行动作、仓位约束、买卖指令
   - 首屏证据优先级固定为：`结构匹配状态 -> 当前段 -> 下一确认`
   - `均线背景 / 结构方向 / 均线关键位` 只能作为次级支撑证据

## 中文映射硬规则

`structure_prediction`、`direction_lock`、`exception_interrupt` 的内部字段名和枚举值，不允许直接进入用户可见 UI、AI 正文、AI 追问、badge 或 hover。

实现时必须经过统一中文映射，至少包括：

- `debouncing / candidate / strengthening / blocked / exception`
- `direction_lock / exception_interrupt / narrative_switch`
- `macd_zero_axis_break / parent_not_released` 等 trigger signal 枚举

## 当前工作区前置条件

当前工作区已经有未提交 UI / AI / 周期详情改动：

- `src/app/api/stock/ai-analysis/route.ts`
- `src/app/stock/[code]/analysis/page.tsx`
- `src/components/stock/AnalysisPeriodDetails.tsx`
- `src/components/stock/AnalysisSummaryPanel.tsx`
- `src/components/stock/StructureExplainabilityPanel.tsx`
- `src/components/stock/TradingCycleBus.tsx`
- `src/lib/ai-report-contract.ts`
- `src/lib/trinity-analysis-page-view-model.ts`
- `src/lib/trinity-decision-labels.ts`
- 多个前端测试文件

执行本计划时必须遵守：

1. 只 stage 本任务相关文件。
2. 不回退用户已有改动。
3. 每个任务单独验证后再提交。

## 文件结构与职责

- Modify: `scripts/stock_analyzer.py`
  - 新增时空候选集合、主语判断、防抖切换、预测候选、方向锁、异常中断 helper。
  - 在 `trinity_decision` 中写入 `structure_prediction`、`direction_lock`、`exception_interrupt`。
  - 让 `_build_trinity_trade_qualification()` 消费新合同。
- Create: `tests/test_trinity_predictive_structure_candidates.py`
  - 锁定前瞻候选合同、A 候选切换、防抖、D 降级、D 异常。
- Modify: `tests/test_trinity_decision_trade_qualification.py`
  - 锁定方向锁和异常中断对交易资格的强制降级。
- Modify: `src/lib/stock-structure-types.ts`
  - 扩展 `TrinityDecision` 相关 TS 类型。
- Modify: `src/lib/ai-analysis-payload.ts`
  - 把预测结构合同送给 AI 分析链。
- Modify: `src/app/api/stock/ai-analysis/route.ts`
  - 让 AI 提示词消费主候选 / 候选阶段 / 方向锁 / 异常中断，并继续要求中文。
- Modify: `src/lib/trinity-judgment-display.ts`
  - 增加 `debouncing / exception / direction_lock` 的中文显示。
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
  - 综合判断、交易总线、周期详情优先消费 `structure_prediction`。
  - 维持“页级结论 / 组合动作 / 周期证据”三层显示归属，避免同义重复。
- Modify: `src/lib/structure-explainability-view-model.ts`
  - 结构说明区输出“结构匹配状态 / 当前段 / 下一确认 / 均线背景 / 结构方向”。
- Modify: `src/components/stock/AnalysisSummaryPanel.tsx`
  - 用主候选与候选阶段替换旧的静态结构摘要。
  - 只显示页级综合结论，不展开组合级动作。
- Modify: `src/components/stock/TradingCycleBus.tsx`
  - 交易总线保持当前布局，但结构标签 / 说明优先来自主候选合同。
  - 只显示组合级动作与组合级约束，不复述页级结论和周期证据。
- Modify: `src/components/stock/AnalysisPeriodDetails.tsx`
  - 概览只显示最终判定 / 父级约束 / 当前结构；结构说明改用新合同。
  - 首屏证据固定为 `结构匹配状态 / 当前段 / 下一确认`。
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
  - 周期详情证据区不再展示执行动作，改展示结构匹配状态、方向锁、均线关键位。
  - `均线背景 / 结构方向 / 均线关键位` 只作为次级支撑证据。
- Modify: `tests/ai-analysis-payload.test.ts`
  - 锁定新 payload 字段。
- Modify: `tests/ai-analysis-follow-up-route.test.ts`
  - 锁定 AI route prompt 对新合同字段的引用。
- Modify: `tests/trinity-judgment-display.test.ts`
  - 锁定新中文短句。
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
  - 锁定 summary / bus / period details 消费新合同。
- Modify: `tests/analysis-page-sections.test.ts`
  - 锁定页面组件中文化与低重复边界。
- Modify: `tests/structure-explainability-panel.test.ts`
  - 锁定周期详情证据模式的新内容。

## Task 0: 工作区边界与基线验证

**Files:**
- No source changes.

- [ ] **Step 1: 查看当前脏工作区**

Run:

```bash
git status --short
git diff --stat
```

Expected: 看到本计划前已有的 UI / AI 相关改动；不要自动回退任何文件。

- [ ] **Step 2: 记录本计划将触达的文件集合**

Run:

```bash
printf '%s\n' \
  scripts/stock_analyzer.py \
  tests/test_trinity_predictive_structure_candidates.py \
  tests/test_trinity_decision_trade_qualification.py \
  src/lib/stock-structure-types.ts \
  src/lib/ai-analysis-payload.ts \
  src/app/api/stock/ai-analysis/route.ts \
  src/lib/trinity-judgment-display.ts \
  src/lib/trinity-analysis-page-view-model.ts \
  src/lib/structure-explainability-view-model.ts \
  src/components/stock/AnalysisSummaryPanel.tsx \
  src/components/stock/TradingCycleBus.tsx \
  src/components/stock/AnalysisPeriodDetails.tsx \
  src/components/stock/StructureExplainabilityPanel.tsx \
  tests/ai-analysis-payload.test.ts \
  tests/ai-analysis-follow-up-route.test.ts \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/structure-explainability-panel.test.ts
```

Expected: 执行期只 stage 上述文件，避免把无关 WIP 混进提交。

- [ ] **Step 3: 跑一轮当前前端基线测试**

Run:

```bash
node --test tests/analysis-page-sections.test.ts tests/trinity-analysis-page-view-model.test.ts
pnpm exec tsc --noEmit
```

Expected: 两条命令 exit 0；若当前基线已失败，先记录失败点，再继续按计划只解决相关失败。

## Task 1: 先用失败测试锁定前瞻候选合同

**Files:**
- Create: `tests/test_trinity_predictive_structure_candidates.py`
- Modify: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 新建预测候选测试文件骨架**

在 `tests/test_trinity_predictive_structure_candidates.py` 写入：

```python
import unittest

from scripts.stock_analyzer import StockAnalyzer


class TrinityPredictiveStructureCandidatesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = StockAnalyzer()

    def _period_payload(
        self,
        *,
        spacetime_status='强',
        structure_type='B双平台式',
        direction='up',
        qualification='standard',
        macd_status='中偏强',
        current_leg='b5→live 下行形成中',
        ma55=132.59,
        ma233=145.92,
        close=129.10,
    ):
        return {
            'macd': {'status': macd_status},
            'ma55': ma55,
            'ma233': ma233,
            'close': close,
            'trinity_decision': {
                'spacetime': {'status': spacetime_status},
                'structure': {
                    'type': structure_type,
                    'standard_candidate': structure_type,
                    'qualification': qualification,
                    'direction': direction,
                    'current_leg': current_leg,
                },
            },
            'structure': {
                'structure_type': structure_type,
                'trend_direction': '上涨' if direction == 'up' else '下跌',
                'structure_details': {
                    'raw_classification': {'type': '延伸C类'},
                },
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': structure_type[:1],
                        'standard_qualification': qualification,
                        'directional_bias': direction,
                    }
                },
            },
        }
```

- [ ] **Step 2: 锁定“推进主语优先切到 A候选”测试**

追加测试：

```python
    def test_progressive_narrative_promotes_a_candidate_when_scope_allows(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour30',
            normalized_results={
                'daily': self._period_payload(spacetime_status='极强', structure_type='B双平台式', direction='up'),
                'hour30': self._period_payload(
                    spacetime_status='中偏强',
                    structure_type='B双平台式',
                    direction='up',
                    current_leg='a4→live 上行推进中',
                    close=151.8,
                    ma55=149.1,
                    ma233=129.8,
                ),
            },
            raw_level_nesting={'summary': '测试推进主语切换'},
        )

        prediction = decision['structure_prediction']
        self.assertEqual(prediction['spacetime_scope']['allowed_candidates'], ['A', 'B'])
        self.assertEqual(prediction['dominant_narrative'], '推进主导')
        self.assertEqual(prediction['primary_candidate']['family'], 'A')
        self.assertEqual(prediction['secondary_candidate']['family'], 'B')
```

- [ ] **Step 3: 锁定“单次爆发只停在 debouncing / 分歧”测试**

追加测试：

```python
    def test_single_spike_keeps_a_candidate_in_debouncing_state(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour30',
            normalized_results={
                'daily': self._period_payload(spacetime_status='极强', structure_type='B双平台式', direction='up'),
                'hour30': self._period_payload(
                    spacetime_status='中偏强',
                    structure_type='B双平台式',
                    direction='up',
                    current_leg='b5→live 单根拉升尝试',
                    close=150.2,
                    ma55=150.0,
                    ma233=129.8,
                ),
            },
            raw_level_nesting={'summary': '测试防抖'},
        )

        prediction = decision['structure_prediction']
        self.assertEqual(prediction['primary_candidate']['family'], 'A')
        self.assertEqual(prediction['primary_candidate']['stage'], 'debouncing')
        self.assertFalse(prediction['narrative_switch']['passed'])
```

- [ ] **Step 4: 锁定“D 只作降级，D异常单独中断”测试**

追加测试：

```python
    def test_d_candidate_is_only_used_as_fallback_when_abc_fail(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour15',
            normalized_results={
                'hour60': self._period_payload(spacetime_status='中偏弱', structure_type='复杂结构', direction='down'),
                'hour15': self._period_payload(
                    spacetime_status='中偏弱',
                    structure_type='复杂结构',
                    direction='down',
                    current_leg='live 急跌单边推进',
                    close=118.6,
                    ma55=126.1,
                    ma233=134.4,
                ),
            },
            raw_level_nesting={'summary': '测试 D 降级'},
        )

        prediction = decision['structure_prediction']
        self.assertEqual(prediction['fallback_candidate']['family'], 'D')
        self.assertFalse(prediction['exception_interrupt']['enabled'])

    def test_extreme_v_reversal_turns_into_exception_interrupt(self) -> None:
        decision = self.analyzer._build_trinity_level_nesting_decision(
            level='hour15',
            normalized_results={
                'hour60': self._period_payload(spacetime_status='极弱', structure_type='复杂结构', direction='down'),
                'hour15': self._period_payload(
                    spacetime_status='极弱',
                    structure_type='复杂结构',
                    direction='up',
                    current_leg='live V反极速反抽',
                    close=137.5,
                    ma55=126.1,
                    ma233=134.4,
                ),
            },
            raw_level_nesting={'summary': '测试 D 异常'},
        )

        prediction = decision['structure_prediction']
        self.assertTrue(prediction['exception_interrupt']['enabled'])
        self.assertEqual(prediction['primary_candidate']['stage'], 'exception')
```

- [ ] **Step 5: 锁定方向锁强制降级交易资格**

在 `tests/test_trinity_decision_trade_qualification.py` 追加：

```python
    def test_direction_lock_blocks_light_probe_even_when_candidate_strengthens(self) -> None:
        decision = self.analyzer._build_trinity_trade_qualification(
            level='hour60',
            structure_payload={
                'structure_prediction': {
                    'primary_candidate': {'family': 'A', 'stage': 'strengthening', 'label': 'A候选'},
                    'exception_interrupt': {'enabled': False},
                },
                'direction_lock': {
                    'status': 'locked',
                    'reason': 'MA233 头顶压制'
                },
            },
            level_nesting_decision={
                'resonance': 'aligned',
                'execution_strength': 'normal',
                'permission': {'allow_position_increase': True},
            },
            ma_gate={'status': 'ma55_support'},
            volume_gate={'status': 'confirmed'},
        )

        self.assertEqual(decision['action'], 'wait_confirmation')
        self.assertEqual(decision['position_permission'], 'no_position')
        self.assertIn('MA233', decision['reason'])
```

- [ ] **Step 6: 跑失败测试确认缺口真实存在**

Run:

```bash
python3 -m unittest tests/test_trinity_predictive_structure_candidates.py tests/test_trinity_decision_trade_qualification.py
```

Expected: FAIL，错误集中在 `structure_prediction`、`direction_lock`、`exception_interrupt` 未实现。

- [ ] **Step 7: 提交失败测试**

```bash
git add tests/test_trinity_predictive_structure_candidates.py tests/test_trinity_decision_trade_qualification.py
git commit -m "测试：锁定前瞻结构候选合同"
```

## Task 2: 实现后端时空候选集合与预测结构合同

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `tests/test_trinity_predictive_structure_candidates.py`

- [ ] **Step 1: 在 `stock_analyzer.py` 增加预测结构常量**

在 helper 常量区追加：

```python
PREDICTIVE_STAGE_PRIORITY = (
    'debouncing',
    'candidate',
    'strengthening',
    'standard_confirmed',
    'degraded',
    'blocked',
    'exception',
)

HARD_TRIGGER_SIGNALS = {
    'macd_zero_axis_break',
    'macd_strength_new_high',
    'ma55_effective_break',
    'ma233_effective_break',
    'volume_breakout_confirmed',
    'parent_release_confirmed',
}

SOFT_TRIGGER_SIGNALS = {
    'lower_high_lower_low_sequence',
    'higher_high_higher_low_sequence',
    'platform_edge_reclaim',
    'current_leg_extension',
}

BLOCKING_SIGNALS = {
    'ma55_direct_resistance',
    'ma233_direct_resistance',
    'parent_not_released',
    'volume_not_confirmed',
}
```

- [ ] **Step 2: 增加时空候选集合 helper**

在 `_build_trinity_level_nesting_decision()` 上方新增：

```python
    def _build_spacetime_candidate_scope(
        self,
        *,
        parent_status: Optional[str],
        child_direction: Optional[str],
    ) -> Dict[str, List[str]]:
        if parent_status in {'极强', '强'} and child_direction == 'up':
            return {'allowed_candidates': ['A', 'B'], 'degraded_candidates': ['C'], 'blocked_candidates': ['D']}
        if parent_status in {'极弱', '弱'} and child_direction == 'down':
            return {'allowed_candidates': ['A', 'B'], 'degraded_candidates': ['C'], 'blocked_candidates': ['D']}
        if parent_status in {'中偏强', '中偏弱'}:
            return {'allowed_candidates': ['C'], 'degraded_candidates': ['A', 'B'], 'blocked_candidates': ['D']}
        return {'allowed_candidates': [], 'degraded_candidates': ['A', 'B', 'C'], 'blocked_candidates': ['D']}
```

- [ ] **Step 3: 增加主语、防抖、候选选择 helper**

追加 4 个 helper：

```python
    def _detect_dominant_narrative(self, *, current_leg: Optional[str], structure_type: Optional[str]) -> str:
        leg = current_leg or ''
        if any(token in leg for token in ('上行推进', '下行推进', '连阳推进', '连阴推进')):
            return '推进主导'
        if any(token in leg for token in ('回抽', '反抽', '修复')):
            return '反抽主导'
        if structure_type and any(token in structure_type for token in ('平台', '整理', '中枢')):
            return '整理主导'
        return '分歧混合'

    def _build_narrative_switch(self, *, parent_released: bool, price_above_ma55: bool, current_leg: Optional[str]) -> Dict[str, Any]:
        hard_triggers = ['ma55_effective_break'] if price_above_ma55 else []
        soft_triggers = ['current_leg_extension'] if current_leg and '推进' in current_leg else []
        blocking_signals = [] if parent_released else ['parent_not_released']
        passed = bool(hard_triggers) or (len(soft_triggers) >= 2 and not blocking_signals)
        return {
            'from_family': 'B',
            'to_family': 'A',
            'state': 'candidate' if passed else 'debouncing',
            'hard_triggers': hard_triggers,
            'soft_triggers': soft_triggers,
            'blocking_signals': blocking_signals,
            'passed': passed,
        }

    def _build_exception_interrupt(self, *, current_leg: Optional[str], macd_status: Optional[str]) -> Dict[str, Any]:
        if current_leg and 'V反' in current_leg:
            return {'enabled': True, 'type': 'v_reversal', 'reason': 'V 反级别极速反向，不走常规候选'}
        if macd_status == '极强' and current_leg and '脱框' in current_leg:
            return {'enabled': True, 'type': 'momentum_burst', 'reason': '极端动能脱框，先风控再评估'}
        return {'enabled': False, 'type': None, 'reason': None}

    def _build_structure_prediction(self, *, scope: Dict[str, List[str]], narrative: str, current_leg: Optional[str], structure_type: Optional[str], price_above_ma55: bool, parent_released: bool, macd_status: Optional[str]) -> Dict[str, Any]:
        switch = self._build_narrative_switch(parent_released=parent_released, price_above_ma55=price_above_ma55, current_leg=current_leg)
        exception_interrupt = self._build_exception_interrupt(current_leg=current_leg, macd_status=macd_status)
        primary_family = 'A' if narrative == '推进主导' and 'A' in scope['allowed_candidates'] else (scope['allowed_candidates'][0] if scope['allowed_candidates'] else 'D')
        primary_stage = 'exception' if exception_interrupt['enabled'] else switch['state'] if primary_family == 'A' else 'candidate'
        secondary_family = 'B' if primary_family == 'A' and 'B' in scope['allowed_candidates'] else None
        fallback_enabled = primary_family == 'D' and not exception_interrupt['enabled']
        return {
            'spacetime_scope': scope,
            'dominant_narrative': narrative,
            'narrative_switch': switch,
            'primary_candidate': {
                'family': primary_family,
                'label': f'{primary_family}候选',
                'stage': primary_stage,
                'trigger_signals': switch['hard_triggers'] + switch['soft_triggers'],
                'reason': f'当前主语为{narrative}',
            },
            'secondary_candidate': None if not secondary_family else {
                'family': secondary_family,
                'label': f'{secondary_family}候选',
                'stage': 'candidate',
                'reason': '旧整理背景仍可作为次候选保留',
            },
            'fallback_candidate': {
                'family': 'D',
                'label': 'D候选' if fallback_enabled else None,
                'enabled': fallback_enabled,
                'reason': '更高优先级候选均不支持，只保留最低保真解释',
            },
            'exception_interrupt': exception_interrupt,
        }
```

- [ ] **Step 4: 在线路中写入 `structure_prediction`**

在 `_build_trinity_level_nesting_decision()` 中，生成 `decision` 前插入：

```python
        child_direction = child_structure.get('direction')
        child_leg = child_structure.get('current_leg')
        child_type = child_structure.get('type')
        macd_status = (child_decision.get('spacetime') or {}).get('status')
        scope = self._build_spacetime_candidate_scope(
            parent_status=parent_status,
            child_direction=child_direction,
        )
        prediction = self._build_structure_prediction(
            scope=scope,
            narrative=self._detect_dominant_narrative(current_leg=child_leg, structure_type=child_type),
            current_leg=child_leg,
            structure_type=child_type,
            price_above_ma55=bool(child_close is not None and child_ma55 is not None and child_close >= child_ma55),
            parent_released=resonance == 'aligned',
            macd_status=macd_status,
        )
```

并在返回字典中补：

```python
            'structure_prediction': prediction,
```

- [ ] **Step 5: 跑预测候选测试直到通过**

Run:

```bash
python3 -m unittest tests/test_trinity_predictive_structure_candidates.py
```

Expected: PASS。

- [ ] **Step 6: 提交后端预测候选合同**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_predictive_structure_candidates.py
git commit -m "实现：新增前瞻结构候选合同"
```

## Task 3: 把方向锁和异常中断接进交易资格

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Modify: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 新增方向锁 helper**

在 `_build_trinity_trade_qualification()` 上方增加：

```python
    def _build_direction_lock(self, *, close_price: Optional[float], ma55: Optional[float], ma233: Optional[float], direction: Optional[str]) -> Dict[str, Any]:
        if close_price is None or direction is None:
            return {'status': 'mixed', 'reason': '均线数据不完整'}
        if direction == 'up' and ((ma55 is not None and close_price <= ma55) or (ma233 is not None and close_price <= ma233)):
            return {'status': 'locked', 'reason': '上方均线压制未解除'}
        if direction == 'down' and ((ma55 is not None and close_price >= ma55) or (ma233 is not None and close_price >= ma233)):
            return {'status': 'locked', 'reason': '下方均线支撑未破坏'}
        return {'status': 'released', 'reason': '方向锁未阻断当前候选'}
```

- [ ] **Step 2: 在交易资格里消费 `exception_interrupt` 与 `direction_lock`**

在 `_build_trinity_trade_qualification()` 中加入：

```python
        prediction = (structure_payload or {}).get('structure_prediction') or {}
        primary_candidate = prediction.get('primary_candidate') or {}
        exception_interrupt = prediction.get('exception_interrupt') or {}
        direction_lock = (structure_payload or {}).get('direction_lock') or self._build_direction_lock(
            close_price=(structure_payload or {}).get('close'),
            ma55=(structure_payload or {}).get('ma55'),
            ma233=(structure_payload or {}).get('ma233'),
            direction=(primary_candidate or {}).get('family') == 'A' and ((structure_payload or {}).get('direction') or 'up') or (structure_payload or {}).get('direction'),
        )

        if exception_interrupt.get('enabled'):
            return {
                'action': 'risk_control_first',
                'position_permission': 'no_position',
                'reason': exception_interrupt.get('reason') or '极端异常中断',
            }

        if direction_lock.get('status') == 'locked':
            return {
                'action': 'wait_confirmation',
                'position_permission': 'no_position',
                'reason': direction_lock.get('reason') or '方向锁阻断',
            }
```

- [ ] **Step 3: 让 `candidate / strengthening / debouncing` 分别映射到新执行强度**

在现有动作映射分支中补：

```python
        stage = primary_candidate.get('stage')
        if stage == 'debouncing':
            return {
                'action': 'wait_confirmation',
                'position_permission': 'no_position',
                'reason': '主候选仍在防抖确认，先等待',
            }
        if stage == 'candidate':
            return {
                'action': 'light_probe',
                'position_permission': 'light_probe',
                'reason': '主候选已进入候选阶段，可轻仓试探',
            }
        if stage == 'strengthening':
            return {
                'action': 'conditional_boundary_trade',
                'position_permission': 'light_probe',
                'reason': '主候选增强中，等待边界或节点进一步确认',
            }
```

- [ ] **Step 4: 跑交易资格测试**

Run:

```bash
python3 -m unittest tests/test_trinity_decision_trade_qualification.py
```

Expected: PASS。

- [ ] **Step 5: 提交交易闸门改动**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_trade_qualification.py
git commit -m "实现：接入候选阶段方向锁与异常中断"
```

## Task 4: 扩展 TypeScript 类型与 AI payload / prompt

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/ai-analysis-payload.ts`
- Modify: `src/app/api/stock/ai-analysis/route.ts`
- Modify: `tests/ai-analysis-payload.test.ts`
- Modify: `tests/ai-analysis-follow-up-route.test.ts`

- [ ] **Step 1: 给 TS 类型补预测结构合同**

在 `src/lib/stock-structure-types.ts` 补充：

```ts
export interface TrinityNarrativeSwitch {
  from_family?: string | null;
  to_family?: string | null;
  state?: 'debouncing' | 'candidate' | 'strengthening' | 'standard_confirmed' | 'degraded' | 'blocked' | 'exception' | null;
  hard_triggers?: string[];
  soft_triggers?: string[];
  blocking_signals?: string[];
  passed?: boolean | null;
}

export interface TrinityPredictiveCandidate {
  family?: 'A' | 'B' | 'C' | 'D' | null;
  label?: string | null;
  stage?: 'debouncing' | 'candidate' | 'strengthening' | 'standard_confirmed' | 'degraded' | 'blocked' | 'exception' | null;
  trigger_signals?: string[];
  reason?: string | null;
}

export interface TrinityStructurePrediction {
  spacetime_scope?: {
    allowed_candidates?: string[];
    degraded_candidates?: string[];
    blocked_candidates?: string[];
  };
  dominant_narrative?: '推进主导' | '整理主导' | '反抽主导' | '分歧混合' | string | null;
  narrative_switch?: TrinityNarrativeSwitch | null;
  primary_candidate?: TrinityPredictiveCandidate | null;
  secondary_candidate?: TrinityPredictiveCandidate | null;
  fallback_candidate?: {
    family?: 'D' | null;
    label?: string | null;
    enabled?: boolean | null;
    reason?: string | null;
  } | null;
  exception_interrupt?: {
    enabled?: boolean | null;
    type?: string | null;
    reason?: string | null;
  } | null;
}

export interface TrinityDirectionLockDecision {
  status?: 'released' | 'mixed' | 'locked' | null;
  reason?: string | null;
}
```

- [ ] **Step 2: 把 payload 带上新字段**

在 `src/lib/ai-analysis-payload.ts` 的 `deterministic_decision` 映射中增加：

```ts
          structure_prediction: periodData.trinity_decision.structure_prediction,
          direction_lock: periodData.trinity_decision.direction_lock,
```

并在类型定义内增加：

```ts
  structure_prediction?: TrinityStructurePrediction;
  direction_lock?: TrinityDirectionLockDecision;
```

- [ ] **Step 3: 更新 AI route 提示词**

在 `src/app/api/stock/ai-analysis/route.ts` 的 prompt 约束中补：

```ts
  '- 若 deterministic_decision.structure_prediction.primary_candidate 存在，优先用它解释当前结构演化方向，不要把旧的 raw_classification 误写成当前主判断。',
  '- 若 stage = debouncing，必须明确写成“候选正在形成 / 仍待确认”，不得当成已完成标准结构。',
  '- 若 direction_lock.status = locked，必须把交易语气降级为等待确认，不得继续建议试探买卖。',
  '- 若 exception_interrupt.enabled = true，必须优先说明这是异常中断 / 风控优先，而不是普通结构候选。',
  '- 用户可见文案默认中文，不直接输出 execution / wait / no_position / debouncing 这类英文内部词。',
  '- structure_prediction / direction_lock / exception_interrupt / narrative_switch / trigger_signals 这些字段名和枚举值不得原样出现在用户可见内容里。',
```

- [ ] **Step 4: 写 payload / route 测试**

在 `tests/ai-analysis-payload.test.ts` 增加：

```ts
test('payload includes structure_prediction and direction_lock contracts', () => {
  const payload = buildAiAnalysisPayload(sampleAnalysisResult);
  const hour30 = payload.periods.hour30;
  assert.equal(hour30?.deterministic_decision?.structure_prediction?.primary_candidate?.family, 'A');
  assert.equal(hour30?.deterministic_decision?.direction_lock?.status, 'locked');
});
```

在 `tests/ai-analysis-follow-up-route.test.ts` 增加：

```ts
assert.match(mainRouteSource, /structure_prediction/);
assert.match(mainRouteSource, /direction_lock/);
assert.match(mainRouteSource, /debouncing/);
assert.match(mainRouteSource, /异常中断|风控优先/);
```

- [ ] **Step 5: 跑前端 payload 测试**

Run:

```bash
node --test tests/ai-analysis-payload.test.ts tests/ai-analysis-follow-up-route.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交类型与 AI payload**

```bash
git add src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts src/app/api/stock/ai-analysis/route.ts tests/ai-analysis-payload.test.ts tests/ai-analysis-follow-up-route.test.ts
git commit -m "实现：扩展前瞻候选类型与AI载荷"
```

## Task 5: 切换综合判断与交易总线的数据源

**Files:**
- Modify: `src/lib/trinity-judgment-display.ts`
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Modify: `src/components/stock/AnalysisSummaryPanel.tsx`
- Modify: `src/components/stock/TradingCycleBus.tsx`
- Modify: `tests/trinity-judgment-display.test.ts`
- Modify: `tests/trinity-analysis-page-view-model.test.ts`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 给候选阶段和方向锁补中文短句**

在 `src/lib/trinity-judgment-display.ts` 增加：

```ts
export function resolvePredictiveStageLabel(stage?: string | null): string | null {
  switch (stage) {
    case 'debouncing':
      return '候选防抖中';
    case 'candidate':
      return '候选已进入观察';
    case 'strengthening':
      return '候选增强中';
    case 'standard_confirmed':
      return '标准结构已确认';
    case 'degraded':
      return '仅保留降级解释';
    case 'blocked':
      return '时空未放行';
    case 'exception':
      return '异常中断';
    default:
      return null;
  }
}

export function resolveDirectionLockLabel(lock?: { status?: string | null; reason?: string | null } | null): string | null {
  if (!lock?.status) return null;
  if (lock.status === 'locked') return `方向锁｜${lock.reason ?? '关键均线压制/支撑未解除'}`;
  if (lock.status === 'mixed') return `方向锁｜${lock.reason ?? '方向约束未完全解除'}`;
  return null;
}
```

- [ ] **Step 2: 在 view model 里优先使用 `primary_candidate`**

在 `src/lib/trinity-analysis-page-view-model.ts` 的结构摘要生成逻辑里补：

```ts
const prediction = decision.structure_prediction;
const primaryCandidate = prediction?.primary_candidate;
const predictiveStructureSummary =
  primaryCandidate?.label && primaryCandidate?.stage
    ? `${primaryCandidate.label}｜${resolvePredictiveStageLabel(primaryCandidate.stage) ?? '候选'}`
    : undefined;

const structureSummary = firstMeaningfulText(
  predictiveStructureSummary,
  decision.structure?.summary,
  candidateStructureSummary,
);
```

并在组合信号构建中加：

```ts
const directionLockLabel = resolveDirectionLockLabel(decision.direction_lock);
if (directionLockLabel) {
  supportingFacts.push({
    label: directionLockLabel,
    tone: 'warning',
    category: 'risk',
  });
}
```

- [ ] **Step 3: 让 summary / bus 对 debouncing 与 exception 说人话**

在 `buildSummary()` 和 `buildTradingCombinations()` 里加：

```ts
if (primaryCandidate?.stage === 'debouncing') {
  recommendation = firstMeaningfulText(
    recommendation,
    '主候选正在形成，先等确认，不按已完成结构处理'
  );
}

if (decision.structure_prediction?.exception_interrupt?.enabled) {
  actionSummary = '异常中断｜先风控、再评估，不按常规候选试探';
}
```

- [ ] **Step 3.1: 先补显示归属保护断言**

在 `tests/trinity-analysis-page-view-model.test.ts` 追加：

```ts
test('summary/bus/period details keep distinct responsibilities for predictive contracts', () => {
  const model = buildAnalysisPageViewModel(sampleAnalysisResultWithPredictiveA);
  assert.match(model.summary.structureSummary ?? '', /A候选|B候选/);
  assert.doesNotMatch(model.summary.structureSummary ?? '', /下一确认|当前段/);
  assert.match(model.tradingCombinations[0]?.actionSummary ?? '', /候选|等待|试探|异常中断/);
  assert.doesNotMatch(model.tradingCombinations[0]?.actionSummary ?? '', /结构方向|均线背景/);
});
```

- [ ] **Step 4: 补视图模型与组件测试**

在 `tests/trinity-analysis-page-view-model.test.ts` 增加：

```ts
test('view model prefers predictive primary candidate over legacy candidate copy', () => {
  const model = buildAnalysisPageViewModel(sampleAnalysisResultWithPredictiveA);
  assert.match(model.summary.structureSummary ?? '', /A候选/);
  assert.match(model.summary.structureSummary ?? '', /候选防抖中|候选已进入观察/);
});
```

在 `tests/analysis-page-sections.test.ts` 增加：

```ts
test('TradingCycleBus renders predictive candidate labels and direction lock in Chinese', async () => {
  const { TradingCycleBus } = await importTsxModule('src/components/stock/TradingCycleBus.tsx');
  const html = renderToStaticMarkup(
    React.createElement(TradingCycleBus, {
      combinations: predictiveBusFixture,
    })
  );
  assert.match(html, /A候选|B候选/);
  assert.match(html, /候选防抖中|候选增强中/);
  assert.match(html, /方向锁/);
  assert.doesNotMatch(html, /debouncing|strengthening|exception_interrupt/);
});
```

- [ ] **Step 5: 跑 summary / bus 测试**

Run:

```bash
node --test tests/trinity-judgment-display.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交综合判断与总线数据源切换**

```bash
git add src/lib/trinity-judgment-display.ts src/lib/trinity-analysis-page-view-model.ts src/components/stock/AnalysisSummaryPanel.tsx src/components/stock/TradingCycleBus.tsx tests/trinity-judgment-display.test.ts tests/trinity-analysis-page-view-model.test.ts tests/analysis-page-sections.test.ts
git commit -m "实现：综合判断切到前瞻结构候选"
```

## Task 6: 收口周期详情为结构证据面板

**Files:**
- Modify: `src/lib/structure-explainability-view-model.ts`
- Modify: `src/components/stock/AnalysisPeriodDetails.tsx`
- Modify: `src/components/stock/StructureExplainabilityPanel.tsx`
- Modify: `tests/analysis-page-sections.test.ts`
- Modify: `tests/structure-explainability-panel.test.ts`

- [ ] **Step 1: 给结构说明模型补显式字段**

在 `src/lib/structure-explainability-view-model.ts` 增加：

```ts
const predictive = decision?.structure_prediction;
const primaryCandidate = predictive?.primary_candidate;

const structureMatchSummary = firstMeaningfulText(
  primaryCandidate?.label && predictive?.dominant_narrative
    ? `${parentLevelLabel}状态与${levelLabel}${primaryCandidate.label.replace('候选', '')}原型匹配已成立，但交易资格仍未完全放行`
    : undefined,
  interpretationGate?.reason,
);

const maBackgroundSummary =
  ma55 && ma233
    ? `${levelLabel}均线背景：${macroBackgroundLabel ?? '混合'}`
    : undefined;

const structureDirectionSummary = trendDirection
  ? `结构方向：${trendDirection === '上涨' ? '上涨骨架' : trendDirection === '下跌' ? '下跌骨架' : '震荡骨架'}`
  : undefined;
```

- [ ] **Step 2: 概览区只保留最终判定 / 父级约束 / 当前结构**

在 `src/components/stock/AnalysisPeriodDetails.tsx` 删掉概览区执行动作与仓位约束，并改父级约束文案：

```tsx
const parentConstraintLabel = parentLevelLabel && currentLevelLabel && relationLabel
  ? `${parentLevelLabel}约束：${currentLevelLabel}${relationLabel.replace(/^父级/, '').replace(/^子级/, '')}`
  : relationLabel;
```

并确保概览结构只渲染：

```tsx
<section>
  <h3>当前判断</h3>
  ...
</section>
<section>
  <h3>父级约束</h3>
  ...
</section>
<section>
  <h3>当前结构</h3>
  ...
</section>
```

- [ ] **Step 3: 证据模式面板改显示“结构匹配状态 / 当前段 / 下一确认 / 均线背景 / 结构方向 / 均线关键位”**

在 `src/components/stock/StructureExplainabilityPanel.tsx` 的 `period_evidence` 分支里改成：

```tsx
{structureMatchSummary ? (
  <EvidenceCard title="结构匹配状态" tone="warn">
    {structureMatchSummary}
  </EvidenceCard>
) : null}

{nextConfirmation ? (
  <EvidenceCard title="下一确认" tone="info">
    {nextConfirmation}
  </EvidenceCard>
) : null}

{/* 首屏主证据到这里结束；以下内容只作为次级支撑证据 */}

{maBackgroundSummary ? (
  <EvidenceCard title="均线背景" tone="neutral">
    {maBackgroundSummary}
  </EvidenceCard>
) : null}

{structureDirectionSummary ? (
  <EvidenceCard title="结构方向" tone="neutral">
    {structureDirectionSummary}
  </EvidenceCard>
) : null}

{ma55Price || ma233Price ? (
  <EvidenceCard title="均线关键位" tone="neutral">
    {`MA55 ${ma55Price ?? '--'}｜MA233 ${ma233Price ?? '--'}｜${maPressureSupportSummary ?? '观察均线相对位置'}`}
  </EvidenceCard>
) : null}
```

并删除：

```tsx
<ExecutionActionPanel ... />
<PositionCapPanel ... />
```

- [ ] **Step 4: 写周期详情测试**

在 `tests/structure-explainability-panel.test.ts` 追加：

```ts
test('StructureExplainabilityPanel evidence mode replaces execution cards with predictive evidence fields', async () => {
  const { StructureExplainabilityPanel } = await importStructureExplainabilityPanel();
  const html = renderToStaticMarkup(
    React.createElement(StructureExplainabilityPanel, {
      mode: 'period_evidence',
      structure: predictiveStructureFixture,
    })
  );
  assert.match(html, /结构匹配状态/);
  assert.match(html, /均线背景/);
  assert.match(html, /结构方向/);
  assert.match(html, /MA55/);
  assert.doesNotMatch(html, /执行动作|仓位约束|买入|卖出/);
});

test('StructureExplainabilityPanel keeps primary evidence ahead of secondary context fields', async () => {
  const { StructureExplainabilityPanel } = await importStructureExplainabilityPanel();
  const html = renderToStaticMarkup(
    React.createElement(StructureExplainabilityPanel, {
      mode: 'period_evidence',
      structure: predictiveStructureFixture,
    })
  );
  const matchIndex = html.indexOf('结构匹配状态');
  const legIndex = html.indexOf('当前段');
  const nextIndex = html.indexOf('下一确认');
  const maIndex = html.indexOf('均线背景');
  const directionIndex = html.indexOf('结构方向');
  assert.ok(matchIndex >= 0 && legIndex >= 0 && nextIndex >= 0);
  assert.ok(maIndex > nextIndex);
  assert.ok(directionIndex > nextIndex);
});
```

在 `tests/analysis-page-sections.test.ts` 追加：

```ts
test('AnalysisPeriodDetails overview keeps explicit parent-level subject and omits action cards', async () => {
  const { AnalysisPeriodDetails } = await importTsxModule('src/components/stock/AnalysisPeriodDetails.tsx');
  const html = renderToStaticMarkup(
    React.createElement(AnalysisPeriodDetails, {
      periods: predictivePeriodFixture,
      selectedLevel: 'hour60',
    })
  );
  assert.match(html, /日线约束：60分钟/);
  assert.doesNotMatch(html, /执行动作|仓位约束|买入|补仓/);
});
```

- [ ] **Step 5: 跑周期详情测试**

Run:

```bash
node --test tests/structure-explainability-panel.test.ts tests/analysis-page-sections.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交周期详情证据面板收口**

```bash
git add src/lib/structure-explainability-view-model.ts src/components/stock/AnalysisPeriodDetails.tsx src/components/stock/StructureExplainabilityPanel.tsx tests/analysis-page-sections.test.ts tests/structure-explainability-panel.test.ts
git commit -m "实现：周期详情切到前瞻结构证据模式"
```

## Task 7: 全链路回归、HTTP 验证与收口

**Files:**
- Modify only if test fixes are required.

- [ ] **Step 1: 跑后端单测全集**

Run:

```bash
python3 -m unittest \
  tests/test_trinity_predictive_structure_candidates.py \
  tests/test_trinity_decision_trade_qualification.py \
  tests/test_trinity_decision_level_nesting.py \
  tests/test_trinity_decision_phase2_contract.py
```

Expected: PASS。

- [ ] **Step 2: 跑前端相关测试**

Run:

```bash
node --test \
  tests/ai-analysis-payload.test.ts \
  tests/ai-analysis-follow-up-route.test.ts \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/structure-explainability-panel.test.ts \
  tests/analysis-summary-panel.test.ts
pnpm exec tsc --noEmit
```

Expected: 全部 exit 0。

- [ ] **Step 3: 做 300274 周线 HTTP 基准回归**

Run:

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly" | python3 -c "
import json,sys
r=json.load(sys.stdin)
w=r['data']['periods'].get('weekly',{})
s=w.get('structure',{})
d=s.get('structure_details',{})
focus=((w.get('trinity_decision') or {}).get('structure') or {}).get('focus_origin') or {}
print('聚焦结构:', s.get('structure_type'))
print('原始结构:', (d.get('raw_classification') or {}).get('type'))
print('聚焦起点来源:', (d.get('focus_origin_analysis') or {}).get('selected_origin_kind'))
print('顶分型包含209.88:', 209.88 in [f['high'] for f in d.get('top_fractals',[])])
print('聚焦起点:', focus)
"
```

Expected:

```text
聚焦结构: C单平台式
原始结构: 延伸C类
聚焦起点来源: peak_extreme
顶分型包含209.88: True
```

- [ ] **Step 4: 做 300033 五周期 spot check**

Run:

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300033&levels=weekly,daily,hour60,hour30,hour15" | python3 -c "
import json,sys
r=json.load(sys.stdin)
for level in ['daily','hour60','hour30','hour15']:
    decision=((r['data']['periods'].get(level) or {}).get('trinity_decision') or {})
    prediction=decision.get('structure_prediction') or {}
    primary=prediction.get('primary_candidate') or {}
    print(level, primary.get('family'), primary.get('stage'), (decision.get('direction_lock') or {}).get('status'))
"
```

Expected: 输出各级别 `family / stage / direction_lock`，并能肉眼确认 `hour30` 不再只复读旧整理 family。

- [ ] **Step 5: 最终格式检查**

Run:

```bash
git diff --check
```

Expected: 无 trailing whitespace / merge marker / format error。

- [ ] **Step 6: 提交最终收口**

```bash
git add scripts/stock_analyzer.py \
  src/lib/stock-structure-types.ts \
  src/lib/ai-analysis-payload.ts \
  src/app/api/stock/ai-analysis/route.ts \
  src/lib/trinity-judgment-display.ts \
  src/lib/trinity-analysis-page-view-model.ts \
  src/lib/structure-explainability-view-model.ts \
  src/components/stock/AnalysisSummaryPanel.tsx \
  src/components/stock/TradingCycleBus.tsx \
  src/components/stock/AnalysisPeriodDetails.tsx \
  src/components/stock/StructureExplainabilityPanel.tsx \
  tests/test_trinity_predictive_structure_candidates.py \
  tests/test_trinity_decision_trade_qualification.py \
  tests/ai-analysis-payload.test.ts \
  tests/ai-analysis-follow-up-route.test.ts \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/structure-explainability-panel.test.ts
git commit -m "实现：接入三位一体前瞻结构候选链路"
```

## Spec 覆盖自检

- `时空先给 allowed / degraded / blocked candidates`：Task 2。
- `推进主语优先切 A候选`：Task 1 + Task 2。
- `A候选切换防抖`：Task 1 + Task 2。
- `D 仅降级、D异常单独中断`：Task 1 + Task 2 + Task 3。
- `方向锁`：Task 1 + Task 3 + Task 5。
- `AI payload / prompt 使用新合同`：Task 4。
- `综合判断 / 总线 / 周期详情切到新合同`：Task 5 + Task 6。
- `HTTP 基准回归`：Task 7。
