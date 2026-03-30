# Structure Phase Execution Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the spec so the analyzer keeps `ABCD` as a structure archetype, adds stable `execution_phase` and `execution` outputs, upgrades top-level trading decisions, and makes AI/UI consume the new decision-first model.

**Architecture:** Extend `scripts/stock_analyzer.py` with three new backend helpers that produce `archetype`, `execution_phase`, and `execution` per timeframe, then upgrade `level_nesting.trading_decision` into a stable execution bus. Propagate the new fields into the AI payload and prompt, and finally reweight the analysis page so “当前阶段 + 执行建议” are primary while `ABCD` is shown as “结构原型”.

**Tech Stack:** Python 3, pandas, unittest, TypeScript, Next.js App Router, Node test runner, pnpm

---

## File Map

- `scripts/stock_analyzer.py`
  - Add `_build_structure_archetype()`, `_detect_execution_phase()`, `_build_period_execution()`.
  - Wire new fields into `analyze_single_period()`.
  - Upgrade `analyze_trading_decision()` to emit stable execution fields.
  - Fix `spacetime_confirmation` handoff so top-level decision logic can actually read it.
- `tests/test_structure_phase_execution.py`
  - New backend contract tests for `archetype`, `execution_phase`, `execution`, and upgraded `trading_decision`.
- `src/lib/ai-analysis-payload.ts`
  - Include the new execution-first fields in the compact AI payload.
- `src/app/api/stock/ai-analysis/route.ts`
  - Update prompt instructions so AI uses `execution`/`execution_phase` first and treats `ABCD` as archetype only.
- `tests/ai-analysis-payload.test.ts`
  - Extend payload tests for the new fields and prompt-facing contract.
- `src/lib/stock-execution-view-model.ts`
  - New pure helper for frontend labels, caps, and card rows derived from `execution`/`execution_phase`.
- `tests/stock-execution-view-model.test.ts`
  - New Node tests for the view-model helper.
- `src/app/stock/[code]/analysis/page.tsx`
  - Render `当前阶段`, `执行建议`, and `结构原型` in that order.
  - Preserve old fields for compatibility during rollout.

## Task 1: Add backend contract tests for per-period `archetype`, `execution_phase`, and `execution`

**Files:**
- Create: `tests/test_structure_phase_execution.py`
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_structure_phase_execution.py`

- [ ] **Step 1: Write the failing backend contract test**

```python
import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class StructurePhaseExecutionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_structure_archetype_keeps_abcd_as_explanatory_label(self) -> None:
        archetype = self.analyzer._build_structure_archetype(
            structure_type='A五段式',
            structure_stage='趋势启动阶段',
            trend_direction='上涨',
            macro_components=[
                {'type': 'Directional', 'stroke_count': 1},
                {'type': 'Platform', 'stroke_count': 5},
            ],
            inflection_count=5,
            segment_count=4,
            peak_analysis=None,
        )

        self.assertEqual(archetype['primary'], 'A五段式')
        self.assertEqual(archetype['maturity'], 'late')
        self.assertEqual(archetype['confidence'], 'medium')
        self.assertIn('Directional -> Platform', archetype['reason'])
        self.assertIn('alternatives', archetype)

    def test_detect_execution_phase_prefers_pullback_confirm_when_breakthrough_and_support_align(self) -> None:
        phase = self.analyzer._detect_execution_phase(
            macd_status='强',
            trend_direction='上涨',
            moving_averages={'price_vs_ma55': 'above', 'ma_status': '多头排列'},
            ma_physics={
                'support_pressure': {'status': 'MA55支撑有效', 'ma55_role': '支撑'},
                'traction': {'pullback_expected': True, 'traction_force': '中'},
                'resonance': {'convergence_strength': '中'},
            },
            breakthrough={
                'pattern_type': '回抽突破',
                'direction': 'up',
                'is_valid': True,
                'confidence': '高',
            },
            prediction={'current_stage': 'a4拐点', 'confidence': 'medium'},
            divergence_note='',
        )

        self.assertEqual(phase['code'], 'pullback_confirm')
        self.assertEqual(phase['bias'], 'bullish')
        self.assertTrue(phase['tradable'])

    def test_build_period_execution_encodes_timeframe_cap_and_same_timeframe_stop_rules(self) -> None:
        execution = self.analyzer._build_period_execution(
            level='hour30',
            latest_price=163.35,
            macd_status='强',
            moving_averages={'ma_status': '多头排列', 'price_vs_ma55': 'above'},
            ma_physics={
                'support_pressure': {'status': 'MA55支撑有效'},
                'traction': {'pullback_expected': True},
                'resonance': {'convergence_strength': '中'},
            },
            breakthrough={
                'pattern_type': '回抽突破',
                'direction': 'up',
                'is_valid': True,
                'confidence': '高',
            },
            phase={
                'code': 'pullback_confirm',
                'label': '回抽确认',
                'bias': 'bullish',
                'tradable': True,
                'maturity': 'mid',
                'reason': '回抽后支撑有效',
            },
            archetype={'primary': 'A五段式', 'confidence': 'medium', 'reason': 'Directional -> Platform'},
            prediction={
                'key_price_levels': [{'price': 156.9, 'type': 'stop', 'note': '最近确认底分型'}],
            },
            latest_confirmed_levels=[{'price': 156.9, 'type': 'stop', 'note': '最近确认底分型'}],
        )

        self.assertTrue(execution['can_trade'])
        self.assertEqual(execution['action'], 'buy')
        self.assertEqual(execution['timing_timeframe'], 'hour30')
        self.assertAlmostEqual(execution['timeframe_cap_ratio'], 1 / 3, places=3)
        self.assertEqual(execution['t_trade_rule']['mode'], 'positive_only')
        self.assertEqual(execution['risk_rules']['stop_loss_basis'], 'same_timeframe')
        self.assertTrue(execution['risk_rules']['no_left_side_averaging_down'])
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python3 -m unittest tests.test_structure_phase_execution -v`

Expected: `AttributeError` for missing `_build_structure_archetype`, `_detect_execution_phase`, or `_build_period_execution`.

- [ ] **Step 3: Implement the minimal backend helpers and wire them into single-period output**

```python
def _build_structure_archetype(
    self,
    structure_type: str,
    structure_stage: str,
    trend_direction: str,
    macro_components: List[Dict[str, Any]],
    inflection_count: int,
    segment_count: int,
    peak_analysis: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    maturity = 'late' if inflection_count >= 5 else 'mid' if inflection_count >= 3 else 'early'
    component_types = ' -> '.join(component.get('type', 'Unknown') for component in macro_components[:3]) or 'Unknown'
    confidence = 'low' if structure_type in ('复杂结构', '结构未完成') else 'medium'
    if peak_analysis and peak_analysis.get('is_peak_structure'):
        confidence = 'low'

    alternatives: List[Dict[str, Any]] = []
    if structure_type == 'A五段式':
        alternatives.append({'type': 'C单平台式', 'confidence': 0.35, 'reason': '平台段占比仍高'})
    elif structure_type == 'C单平台式':
        alternatives.append({'type': 'A五段式', 'confidence': 0.3, 'reason': '突破后可升级为趋势原型'})

    return {
        'primary': structure_type or '结构未完成',
        'maturity': maturity,
        'confidence': confidence,
        'reason': component_types,
        'alternatives': alternatives,
    }


def _detect_execution_phase(
    self,
    macd_status: str,
    trend_direction: str,
    moving_averages: Dict[str, Any],
    ma_physics: Dict[str, Any],
    breakthrough: Dict[str, Any],
    prediction: Optional[Dict[str, Any]],
    divergence_note: str,
) -> Dict[str, Any]:
    support = (ma_physics or {}).get('support_pressure') or {}
    traction = (ma_physics or {}).get('traction') or {}
    pattern_type = (breakthrough or {}).get('pattern_type')
    direction = (breakthrough or {}).get('direction')

    if divergence_note or traction.get('traction_force') == '强':
        return {'code': 'exhaustion_risk', 'label': '衰竭风险', 'bias': 'neutral', 'tradable': False, 'maturity': 'late', 'reason': divergence_note or '偏离均线过大'}
    if pattern_type in ('回抽突破', '回抽跌破') and support.get('status'):
        bias = 'bullish' if direction == 'up' else 'bearish'
        return {'code': 'pullback_confirm', 'label': '回抽确认', 'bias': bias, 'tradable': True, 'maturity': 'mid', 'reason': support.get('status')}
    if pattern_type in ('有效突破', '有效跌破', '慢速突破', '慢速跌破', '反向突破', '反向跌破'):
        bias = 'bullish' if direction == 'up' else 'bearish'
        tradable = pattern_type in ('有效突破', '有效跌破', '反向突破', '反向跌破')
        return {'code': 'breakout_attempt', 'label': '突破尝试', 'bias': bias, 'tradable': tradable, 'maturity': 'mid', 'reason': pattern_type}
    if trend_direction == '震荡':
        return {'code': 'platform_building', 'label': '平台整理', 'bias': 'neutral', 'tradable': False, 'maturity': 'mid', 'reason': '当前仍在平台边界内'}
    return {'code': 'trend_launch', 'label': '趋势启动', 'bias': 'bullish' if trend_direction == '上涨' else 'bearish', 'tradable': False, 'maturity': 'early', 'reason': macd_status or '趋势刚启动'}


def _build_period_execution(
    self,
    level: str,
    latest_price: float,
    macd_status: str,
    moving_averages: Dict[str, Any],
    ma_physics: Dict[str, Any],
    breakthrough: Dict[str, Any],
    phase: Dict[str, Any],
    archetype: Dict[str, Any],
    prediction: Optional[Dict[str, Any]],
    latest_confirmed_levels: List[Dict[str, Any]],
) -> Dict[str, Any]:
    cap_ratio_map = {'hour15': 0.25, 'hour30': 1 / 3, 'hour60': 0.5, 'daily': 0.5}
    ma_status = (moving_averages or {}).get('ma_status')
    t_mode = 'positive_only' if ma_status == '多头排列' else 'negative_only' if ma_status == '空头排列' else 'disabled'
    can_trade = bool(phase.get('tradable'))
    action = 'buy' if phase.get('code') == 'pullback_confirm' and phase.get('bias') == 'bullish' else 'wait'

    return {
        'can_trade': can_trade,
        'action': action,
        'direction': 'long' if phase.get('bias') == 'bullish' else 'short' if phase.get('bias') == 'bearish' else 'neutral',
        'setup_quality': 'A' if can_trade and breakthrough.get('is_valid') else 'C' if can_trade else 'avoid',
        'rationale': phase.get('reason') or archetype.get('reason') or '',
        'timing_timeframe': level if level in ('daily', 'hour60', 'hour30', 'hour15') else None,
        'timeframe_cap_ratio': cap_ratio_map.get(level),
        'trigger': ['等待确认性触发'],
        'invalidation': ['原建仓级别失效立即退出'],
        'confirmation': ['次级别结构继续共振'],
        'entry_style': 'pullback_confirm' if phase.get('code') == 'pullback_confirm' else 'wait',
        'position_sizing': {
            'starter': '轻仓试探',
            'initial': '20%-30%' if can_trade else '0%',
            'add_on': '仅在浮盈后追加',
            'max': '遵守级别上限',
            'pyramid_rule': {
                'model': 'positive_pyramid',
                'add_step_rules': [
                    '第一次加仓 <= 起手仓位 100%',
                    '第二次加仓 <= 第一次加仓 50%',
                    '第三次加仓 <= 第二次加仓 50%',
                ],
            },
        },
        't_trade_rule': {
            'mode': t_mode,
            'max_quick_take_profit_points': 3,
        },
        'risk_rules': {
            'stop_loss_basis': 'same_timeframe',
            'no_timeframe_upcast_after_break': True,
            'no_left_side_averaging_down': True,
            'right_side_add_only': True,
            'right_side_add_conditions': ['V型反转', '有效突破MA55', '确认的日线底分型'],
        },
        'take_profit_plan': {
            'model': 'none',
            'triggers': [],
            'ladder': [],
            'keep_runner': False,
        },
        'key_levels': (prediction or {}).get('key_price_levels') or latest_confirmed_levels,
        'risk_flags': [] if can_trade else ['当前仅满足观察，不满足执行'],
        'wait_reason': None if can_trade else '等待更明确的回抽确认或突破确认',
    }
```

- [ ] **Step 4: Run backend tests and one existing regression**

Run: `python3 -m unittest tests.test_structure_phase_execution tests.test_stock_analyzer_render_payload -v`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/test_structure_phase_execution.py scripts/stock_analyzer.py
git commit -m "feat: add per-period structure execution fields"
```

## Task 2: Upgrade top-level `trading_decision` into a stable execution bus

**Files:**
- Modify: `tests/test_structure_phase_execution.py`
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_structure_phase_execution.py`

- [ ] **Step 1: Add a failing top-level trading decision test**

```python
    def test_analyze_trading_decision_exposes_orders_caps_and_stop_rules(self) -> None:
        results = {
            'weekly': {'macd': {'status': '强'}},
            'daily': {
                'macd': {'status': '强'},
                'moving_averages': {'price_vs_ma55': 'above', 'ma_status': '多头排列'},
                'structure': {
                    'execution_phase': {'code': 'pullback_confirm', 'label': '回抽确认', 'bias': 'bullish', 'tradable': True, 'maturity': 'mid', 'reason': '日线回抽确认'},
                    'execution': {
                        'can_trade': True,
                        'action': 'buy',
                        'direction': 'long',
                        'setup_quality': 'A',
                        'timing_timeframe': 'hour30',
                        'timeframe_cap_ratio': 1 / 3,
                        'trigger': ['30分钟重新转强'],
                        'invalidation': ['日线跌回MA55下方'],
                        'confirmation': ['15分钟止跌'],
                        'position_sizing': {'starter': '轻仓试探', 'initial': '20%-30%', 'add_on': '仅在浮盈后追加', 'max': '不超过50%', 'pyramid_rule': {'model': 'positive_pyramid', 'add_step_rules': ['第一次加仓 <= 起手仓位 100%']}},
                        't_trade_rule': {'mode': 'positive_only', 'max_quick_take_profit_points': 3},
                        'risk_rules': {'stop_loss_basis': 'same_timeframe', 'no_timeframe_upcast_after_break': True, 'no_left_side_averaging_down': True, 'right_side_add_only': True, 'right_side_add_conditions': ['V型反转']},
                        'take_profit_plan': {'model': 'inverted_pyramid', 'triggers': ['A类末端'], 'ladder': ['首抛50%'], 'keep_runner': True},
                        'key_levels': [{'price': 156.9, 'type': 'stop', 'note': '日线确认低点'}],
                        'risk_flags': [],
                    },
                },
            },
            'hour60': {'moving_averages': {'price_vs_ma55': 'above'}},
            'hour30': {'macd': {'top_divergence': False}},
            'hour15': {'macd': {'top_divergence': False}},
        }
        spacetime_confirmation = {'spacetime_resonance': True}

        decision = self.analyzer.analyze_trading_decision(results, spacetime_confirmation=spacetime_confirmation)

        self.assertTrue(decision['can_trade'])
        self.assertEqual(decision['analysis_order'], 'top_down')
        self.assertEqual(decision['execution_order'], 'bottom_up')
        self.assertEqual(decision['timing_timeframe'], 'hour30')
        self.assertAlmostEqual(decision['timeframe_cap_ratio'], 1 / 3, places=3)
        self.assertEqual(decision['risk_rules']['stop_loss_basis'], 'same_timeframe')
        self.assertEqual(decision['take_profit_plan']['model'], 'inverted_pyramid')
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `python3 -m unittest tests.test_structure_phase_execution.StructurePhaseExecutionTest.test_analyze_trading_decision_exposes_orders_caps_and_stop_rules -v`

Expected: `TypeError` for unexpected `spacetime_confirmation` arg or `KeyError` for missing stable fields.

- [ ] **Step 3: Implement the upgraded top-level decision payload and explicit spacetime handoff**

```python
def analyze_trading_decision(self, results: Dict, spacetime_confirmation: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    decision = {
        'decision_type': '观望',
        't_type': None,
        'core_questions': {},
        'analysis': '',
        'action_hint': '',
        'can_trade': False,
        'action': 'wait',
        'direction': 'neutral',
        'setup_quality': 'avoid',
        'rationale': '',
        'analysis_order': 'top_down',
        'execution_order': 'bottom_up',
        'primary_timeframe': 'daily',
        'timing_timeframe': 'hour30',
        'timeframe_cap_ratio': 1 / 3,
        'trigger': [],
        'invalidation': [],
        'confirmation': [],
        'position_sizing': {
            'starter': '轻仓试探',
            'initial': '0%',
            'add_on': '确认后再加仓',
            'max': '遵守级别上限',
            'pyramid_rule': {
                'model': 'positive_pyramid',
                'add_step_rules': [
                    '第一次加仓 <= 起手仓位 100%',
                    '第二次加仓 <= 第一次加仓 50%',
                    '第三次加仓 <= 第二次加仓 50%',
                ],
            },
        },
        't_trade_rule': {'mode': 'disabled', 'max_quick_take_profit_points': 3},
        'risk_rules': {
            'stop_loss_basis': 'same_timeframe',
            'no_timeframe_upcast_after_break': True,
            'no_left_side_averaging_down': True,
            'right_side_add_only': True,
            'right_side_add_conditions': ['V型反转', '有效突破MA55', '确认的日线底分型'],
        },
        'take_profit_plan': {'model': 'none', 'triggers': [], 'ladder': [], 'keep_runner': False},
        'key_levels': [],
        'risk_flags': [],
        'wait_reason': '等待更明确信号',
    }

    daily_execution = (((results.get('daily') or {}).get('structure') or {}).get('execution')) or {}
    if daily_execution:
        decision.update({
            'can_trade': daily_execution.get('can_trade', False),
            'action': daily_execution.get('action', 'wait'),
            'direction': daily_execution.get('direction', 'neutral'),
            'setup_quality': daily_execution.get('setup_quality', 'avoid'),
            'rationale': daily_execution.get('rationale', ''),
            'timing_timeframe': daily_execution.get('timing_timeframe') or 'hour30',
            'timeframe_cap_ratio': daily_execution.get('timeframe_cap_ratio', 1 / 3),
            'trigger': daily_execution.get('trigger', []),
            'invalidation': daily_execution.get('invalidation', []),
            'confirmation': daily_execution.get('confirmation', []),
            'position_sizing': daily_execution.get('position_sizing', decision['position_sizing']),
            't_trade_rule': daily_execution.get('t_trade_rule', decision['t_trade_rule']),
            'risk_rules': daily_execution.get('risk_rules', decision['risk_rules']),
            'take_profit_plan': daily_execution.get('take_profit_plan', decision['take_profit_plan']),
            'key_levels': daily_execution.get('key_levels', []),
            'risk_flags': daily_execution.get('risk_flags', []),
            'wait_reason': daily_execution.get('wait_reason'),
        })

    if spacetime_confirmation and spacetime_confirmation.get('spacetime_resonance'):
        decision['confirmation'].append('周线与日线满足时空共振')

    if decision['action'] in ('buy', 'add'):
        decision['decision_type'] = '加仓' if decision['action'] == 'add' else '做T'
        decision['analysis'] = decision['rationale'] or '执行条件满足'
        decision['action_hint'] = '按执行级别触发与失效条件管理仓位'
    elif decision['action'] == 'reduce':
        decision['decision_type'] = '做T'
        decision['t_type'] = '反T'
        decision['analysis'] = decision['rationale'] or '进入风险管理阶段'
        decision['action_hint'] = '优先保护浮盈'
    else:
        decision['decision_type'] = '观望'
        decision['analysis'] = decision['wait_reason'] or '当前条件不满足做T或加仓，建议观望。'
        decision['action_hint'] = '等待触发条件出现'

    return decision
```

Also update the nesting caller:

```python
spacetime_confirmation = self.analyze_spacetime_confirmation(results)
nesting_analysis['spacetime_confirmation'] = spacetime_confirmation

trading_decision = self.analyze_trading_decision(
    results,
    spacetime_confirmation=spacetime_confirmation,
)
nesting_analysis['trading_decision'] = trading_decision
```

- [ ] **Step 4: Run backend tests again**

Run: `python3 -m unittest tests.test_structure_phase_execution -v`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/test_structure_phase_execution.py scripts/stock_analyzer.py
git commit -m "feat: upgrade trading decision execution bus"
```

## Task 3: Propagate execution-first fields into the AI payload and prompt

**Files:**
- Modify: `src/lib/ai-analysis-payload.ts`
- Modify: `src/app/api/stock/ai-analysis/route.ts`
- Modify: `tests/ai-analysis-payload.test.ts`
- Test: `tests/ai-analysis-payload.test.ts`

- [ ] **Step 1: Extend the AI payload test with failing assertions**

```ts
test('buildAiDecisionPayload keeps execution-first fields and demotes archetype to context', () => {
  const payload = buildAiDecisionPayload(sampleAnalysisData as any);
  const daily = payload.periods.daily as Record<string, any>;

  assert.deepEqual(daily.structure.archetype, {
    primary: 'A五段式',
    maturity: 'mid',
    confidence: 'medium',
    reason: 'Directional -> Platform',
    alternatives: [{ type: 'C单平台式', confidence: 0.35, reason: '平台段占比仍高' }],
  });
  assert.deepEqual(daily.execution_phase, {
    code: 'pullback_confirm',
    label: '回抽确认',
    bias: 'bullish',
    tradable: true,
    maturity: 'mid',
    reason: 'MA55支撑有效',
  });
  assert.equal(daily.execution.action, 'buy');
  assert.equal(daily.execution.timeframe_cap_ratio, 1 / 3);
  assert.equal(payload.level_nesting?.trading_decision?.analysis_order, 'top_down');
  assert.equal(payload.level_nesting?.trading_decision?.execution_order, 'bottom_up');
});
```

- [ ] **Step 2: Run the Node test to verify it fails**

Run: `node --test tests/ai-analysis-payload.test.ts`

Expected: assertion failures because the payload does not include `structure.archetype`, `execution_phase`, or `execution`.

- [ ] **Step 3: Implement payload extraction and update the AI prompt to prioritize execution**

```ts
function summarizePeriod(periodData: any, level: string) {
  const structure = periodData.structure || {};
  const summary: Record<string, unknown> = compactRecord({
    macd: compactRecord({
      status: periodData.macd?.status,
      divergence_note: periodData.macd?.divergence_note || undefined,
    }),
    ma: compactRecord({
      ma55: periodData.moving_averages?.MA55,
      ma233: periodData.moving_averages?.MA233,
      price_vs_ma55: periodData.moving_averages?.price_vs_ma55,
      price_vs_ma233: periodData.moving_averages?.price_vs_ma233,
      ma_status: periodData.moving_averages?.ma_status,
    }),
    structure: compactRecord({
      type: structure.structure_type,
      stage: structure.structure_stage,
      trend: structure.trend_direction,
      description: structure.description,
      archetype: structure.archetype,
    }),
    execution_phase: structure.execution_phase,
    execution: structure.execution,
    latest_price: periodData.latest_price,
    price_change_pct: periodData.price_change_pct,
  });
```

And update the prompt priorities:

```ts
## 你的任务

请输出一份偏“决策建议”而不是“重新分析”的报告，重点使用：
- `level_nesting.trading_decision`
- 各周期的 `execution / execution_phase`
- 日线的 `ma / ma_physics / breakthrough`
- `level_nesting.summary / spacetime_confirmation`
- `multi_dimension_operation`

注意：
- `ABCD` 是结构原型，不是未来必然完成的事实。
- `archetype` 只用于解释背景，不应单独作为交易开关。
```

- [ ] **Step 4: Run payload tests**

Run: `node --test tests/ai-analysis-payload.test.ts tests/codex-strategy-analysis.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-analysis-payload.ts src/app/api/stock/ai-analysis/route.ts tests/ai-analysis-payload.test.ts
git commit -m "feat: route ai analysis through execution-first payload"
```

## Task 4: Add a frontend view-model helper and reweight the analysis page toward current phase and execution

**Files:**
- Create: `src/lib/stock-execution-view-model.ts`
- Create: `tests/stock-execution-view-model.test.ts`
- Modify: `src/app/stock/[code]/analysis/page.tsx`
- Test: `tests/stock-execution-view-model.test.ts`

- [ ] **Step 1: Write a failing frontend helper test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildExecutionSummary,
  formatTimeframeCap,
} = await import(new URL('../src/lib/stock-execution-view-model.ts', import.meta.url).href);

test('buildExecutionSummary prioritizes execution phase and action over archetype', () => {
  const summary = buildExecutionSummary({
    structure: {
      archetype: { primary: 'A五段式', confidence: 'medium', reason: 'Directional -> Platform' },
      execution_phase: { label: '回抽确认', code: 'pullback_confirm', bias: 'bullish', tradable: true, maturity: 'mid', reason: 'MA55支撑有效' },
      execution: {
        can_trade: true,
        action: 'buy',
        setup_quality: 'A',
        timeframe_cap_ratio: 1 / 3,
        trigger: ['30分钟重新转强'],
        invalidation: ['跌回MA55下方'],
        key_levels: [{ price: 156.9, type: 'stop', note: '最近确认低点' }],
      },
    },
  } as any);

  assert.equal(summary.phaseLabel, '回抽确认');
  assert.equal(summary.actionLabel, '买入');
  assert.equal(summary.setupQuality, 'A');
  assert.equal(summary.archetypeLabel, 'A五段式');
  assert.equal(formatTimeframeCap(1 / 3), '最多补仓 1/3');
});
```

- [ ] **Step 2: Run the Node test to verify it fails**

Run: `node --test tests/stock-execution-view-model.test.ts`

Expected: module-not-found error for `src/lib/stock-execution-view-model.ts`.

- [ ] **Step 3: Implement the helper and wire the analysis page UI**

```ts
// src/lib/stock-execution-view-model.ts
export function formatTimeframeCap(value?: number): string | null {
  if (value === undefined) return null;
  if (Math.abs(value - 0.25) < 0.001) return '最多补仓 1/4';
  if (Math.abs(value - 1 / 3) < 0.001) return '最多补仓 1/3';
  if (Math.abs(value - 0.5) < 0.001) return '最多补仓 1/2';
  return null;
}

export function buildExecutionSummary(periodData: any) {
  const phase = periodData?.structure?.execution_phase || {};
  const execution = periodData?.structure?.execution || {};
  const archetype = periodData?.structure?.archetype || {};

  const actionMap: Record<string, string> = {
    buy: '买入',
    add: '加仓',
    hold: '持有',
    wait: '等待',
    reduce: '减仓',
    sell: '卖出',
  };

  return {
    phaseLabel: phase.label || '阶段未知',
    phaseReason: phase.reason || '',
    actionLabel: actionMap[execution.action] || '等待',
    setupQuality: execution.setup_quality || 'avoid',
    archetypeLabel: archetype.primary || periodData?.structure?.structure_type || '结构未完成',
    archetypeReason: archetype.reason || '',
    timeframeCapLabel: formatTimeframeCap(execution.timeframe_cap_ratio),
    trigger: execution.trigger || [],
    invalidation: execution.invalidation || [],
    keyLevels: execution.key_levels || [],
  };
}
```

Update the page rendering to surface the new sections before the old structure badge:

```tsx
const executionSummary = buildExecutionSummary(periodData);

<div className="space-y-3">
  <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
    <div className="text-xs text-slate-400 mb-1">当前阶段</div>
    <div className="text-sm font-semibold text-white">{executionSummary.phaseLabel}</div>
    <div className="text-xs text-slate-300 mt-1">{executionSummary.phaseReason}</div>
  </div>

  <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
    <div className="text-xs text-slate-400 mb-1">执行建议</div>
    <div className="flex items-center gap-2">
      <Badge>{executionSummary.actionLabel}</Badge>
      <Badge variant="outline">{executionSummary.setupQuality}</Badge>
    </div>
    {executionSummary.timeframeCapLabel && (
      <div className="text-xs text-amber-300 mt-2">{executionSummary.timeframeCapLabel}</div>
    )}
  </div>

  <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
    <div className="text-xs text-slate-400 mb-1">结构原型</div>
    <div className="text-sm font-semibold text-white">{executionSummary.archetypeLabel}</div>
    <div className="text-xs text-slate-300 mt-1">{executionSummary.archetypeReason}</div>
  </div>
</div>
```

- [ ] **Step 4: Run UI helper tests and type-check**

Run: `node --test tests/stock-execution-view-model.test.ts && pnpm ts-check`

Expected: helper tests pass and TypeScript reports `0 errors`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stock-execution-view-model.ts tests/stock-execution-view-model.test.ts src/app/stock/[code]/analysis/page.tsx
git commit -m "feat: show execution phase before structure archetype"
```

## Task 5: Run full verification and manual smoke

**Files:**
- Modify: none unless verification finds issues
- Test: `tests/test_structure_phase_execution.py`, `tests/test_stock_analyzer_render_payload.py`, `tests/ai-analysis-payload.test.ts`, `tests/stock-execution-view-model.test.ts`

- [ ] **Step 1: Run full backend and frontend test suites**

Run:

```bash
python3 -m unittest tests.test_structure_phase_execution tests.test_stock_analyzer_render_payload -v
node --test tests/ai-analysis-payload.test.ts tests/stock-execution-view-model.test.ts tests/codex-strategy-analysis.test.ts
pnpm ts-check
python3 -m py_compile scripts/stock_analyzer.py
```

Expected:

- Python tests: `OK`
- Node tests: all `pass`
- `pnpm ts-check`: no type errors
- `py_compile`: exit `0`

- [ ] **Step 2: Run a manual smoke against a real stock analysis result**

Run:

```bash
curl -s http://localhost:5001/api/stock/prepare-analysis \
  -H 'Content-Type: application/json' \
  -d '{"code":"300274","forceSync":false,"levels":["w","d","60","30","15"]}' \
  > /tmp/prepare-analysis-response.json

python3 - <<'PY'
import json
from pathlib import Path

payload = json.loads(Path('/tmp/prepare-analysis-response.json').read_text())
analysis_data = payload['data']['bootstrap']['analysisData']
daily = analysis_data['periods']['daily']['structure']
decision = analysis_data['level_nesting']['trading_decision']

print(daily['archetype']['primary'])
print(daily['execution_phase']['code'])
print(daily['execution']['action'])
print(decision['analysis_order'], decision['execution_order'])
PY
```

Expected:

- Daily structure prints all three layers.
- Top-level decision prints `top_down bottom_up`.
- If the curl step fails, start the local Next service on port `5001` before retrying this step.

- [ ] **Step 3: Commit the final verified batch**

```bash
git add scripts/stock_analyzer.py tests/test_structure_phase_execution.py src/lib/ai-analysis-payload.ts src/app/api/stock/ai-analysis/route.ts src/lib/stock-execution-view-model.ts tests/ai-analysis-payload.test.ts tests/stock-execution-view-model.test.ts src/app/stock/[code]/analysis/page.tsx
git commit -m "feat: add structure phase execution decision layer"
```

## Self-Review

- Spec coverage:
  - `ABCD` 降级为原型：Task 1, Task 4
  - `execution_phase / execution`：Task 1
  - 顶层 `trading_decision` 稳定总线：Task 2
  - AI payload / prompt：Task 3
  - 前端展示重排：Task 4
  - 级别嵌套、补仓比例、做T方向限制、同级别止损、右侧补仓、倒金字塔止盈：Task 1 and Task 2
- Placeholder scan:
  - No `TODO`, `TBD`, or unspecified fixture-generation steps remain in the plan.
- Type consistency:
  - Backend names use `execution_phase`, `execution`, `timeframe_cap_ratio`, `risk_rules`, and `take_profit_plan` consistently across Python, TypeScript payload, and frontend helper tasks.
