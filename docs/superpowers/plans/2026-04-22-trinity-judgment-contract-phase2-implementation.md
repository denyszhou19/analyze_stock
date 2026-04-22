# 三位一体判断合同第二阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第二阶段 spec 中定义的候选结构、等待状态、零轴强信号、共振判断、背离权重、综合判断、执行预案补进现有 `trinity_decision` 主 payload，并让页面与后续 AI 共享同一套后端判断源。

**Architecture:** 先扩展共享类型和 AI 决策 payload 透传，再用 Python 单元测试锁定 `trinity_decision` 第二阶段合同，随后在 `scripts/stock_analyzer.py` 内新增分块 helper 完成“输入合同 -> 融合判断 -> 执行预案”链路。最后让前端 VM、标签和周期详情优先消费新字段，同时保留对旧字段的回退逻辑。

**Tech Stack:** Python 3、Next.js 16、TypeScript、node:test、`unittest`、`pnpm ts-check`

---

## 文件结构与职责

- `scripts/stock_analyzer.py`
  - 第二阶段后端主入口，负责在 `_build_trinity_decision()` 中补齐新分块，并做小幅判断升级。
- `src/lib/stock-structure-types.ts`
  - 前后端共享的 `TrinityDecision` 类型定义，必须先扩展第二阶段新字段。
- `src/lib/ai-analysis-payload.ts`
  - AI 后续消费的确定性判断透传层；本阶段不重构 AI 输出，但要先把新字段带进 `deterministic_decision`。
- `src/lib/trinity-judgment-display.ts`
  - 页面“综合判断 / 执行预案”最小 helper；第二阶段要优先读 `judgment` 和 `execution_plan`，不再靠旧字段猜。
- `src/lib/trinity-analysis-page-view-model.ts`
  - 分析页核心 VM；第二阶段要接新字段，同时保留旧字段回退。
- `src/lib/trinity-signal-tags.ts`
  - 标签构建器；第二阶段要让零轴强信号、共振、背离权重在现有标签体系内有稳定入口。
- `src/components/stock/AnalysisPeriodDetails.tsx`
  - 周期详情头部当前还直接读 `wait_reason` / `execution`，需要改成“新字段优先，老字段回退”。
- `tests/trinity-decision-types.test.ts`
  - 锁住 `TrinityDecision` TypeScript 合同。
- `tests/ai-analysis-payload.test.ts`
  - 锁住 AI 透传层会带出第二阶段新字段。
- `tests/test_trinity_decision_phase2_contract.py`
  - 新增的 Python 合同测试，专门锁第二阶段各分块。
- `tests/test_trinity_decision_levels.py`
  - 现有 `_build_trinity_decision()` 回归测试，确保第二阶段不破坏 v2 基础合同。
- `tests/trinity-judgment-display.test.ts`
  - 锁 `judgment` / `execution_plan` 优先级。
- `tests/trinity-analysis-page-view-model.test.ts`
  - 锁页面 VM 改成读取第二阶段字段。
- `tests/trinity-signal-tags.test.ts`
  - 锁标签在新字段接入后不丢信号。
- `tests/analysis-page-sections.test.ts`
  - 锁周期详情和页面主视区的最终文案。

## Task 1: 扩展共享类型与 AI 决策透传合同

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/ai-analysis-payload.ts`
- Test: `tests/trinity-decision-types.test.ts`
- Test: `tests/ai-analysis-payload.test.ts`

- [ ] **Step 1: 先写会失败的类型与透传测试**

在 `tests/trinity-decision-types.test.ts` 里追加第二阶段样例判定，并在 `tests/ai-analysis-payload.test.ts` 里断言 `deterministic_decision` 会保留这些新字段：

```ts
const phase2Decision: TrinityDecision = {
  ...sampleDecision,
  candidate_structure: {
    candidate_type: 'A延续',
    candidate_label: 'A延续候选',
    current_leg: 'a3进行中',
    direction: 'up',
    reason: 'live 段仍按上涨原型处理',
    upgrade_condition: '确认 a4 后继续突破前高',
    invalidation: '跌破 a3 起涨低点',
  },
  wait_state: {
    wait_type: '等待回抽确认',
    wait_label: '等待回抽确认',
    current_block: '30分钟尚未给出回抽企稳',
    next_confirmation_action: '观察 30 分钟回抽不破 MA55',
    reason: '当前仍缺少确认回抽',
  },
  zero_axis_signal: {
    formed: true,
    signal_type: 'zero_axis_golden_cross',
    signal_label: '零轴金叉',
    reason: 'DIF 与 DEA 在零轴附近快速金叉',
    impact_on_judgment: 'promote',
  },
  resonance_state: {
    status: 'supportive',
    reason: '时空、结构、均线方向一致',
    impact_on_judgment: 'promote',
    is_hard_constraint: false,
  },
  divergence_weight: {
    status: 'neutral',
    label: '无背离压制',
    reason: '当前未检测到顶底背离',
    impact_on_judgment: 'neutral',
  },
  judgment: {
    level: 'candidate_probe',
    label: '候选可试',
    current_best_action: '轻仓试',
    critical_reason: '父级支持但30分钟仍待确认',
    supporting_factors: ['零轴金叉', 'MA55支撑'],
    limiting_factors: ['30分钟未完成回抽确认'],
  },
  execution_plan: {
    probe_entry: '15分钟止跌后轻仓试',
    confirm_entry: '30分钟回抽确认后加仓',
    invalidation: '跌破15分钟确认低点',
    current_position_action: '轻仓试',
  },
};

test('TrinityDecision accepts phase2 judgment blocks', () => {
  assert.equal(phase2Decision.candidate_structure?.candidate_label, 'A延续候选');
  assert.equal(phase2Decision.wait_state?.wait_type, '等待回抽确认');
  assert.equal(phase2Decision.judgment?.label, '候选可试');
});
```

```ts
test('buildAiDecisionPayload keeps phase2 deterministic decision blocks', () => {
  const payload = buildAiDecisionPayload({
    ...sampleAnalysisData,
    periods: {
      ...sampleAnalysisData.periods,
      daily: {
        ...sampleAnalysisData.periods.daily,
        trinity_decision: {
          ...dailyTrinityDecision,
          judgment: {
            level: 'candidate_probe',
            label: '候选可试',
            current_best_action: '轻仓试',
            critical_reason: '父级支持但30分钟仍待确认',
            supporting_factors: ['零轴金叉'],
            limiting_factors: ['等待回抽确认'],
          },
          execution_plan: {
            probe_entry: '15分钟止跌后轻仓试',
            confirm_entry: '30分钟回抽确认后加仓',
            invalidation: '跌破15分钟确认低点',
            current_position_action: '轻仓试',
          },
        },
      },
    },
  });

  assert.equal(
    payload.periods.daily.deterministic_decision?.judgment?.critical_reason,
    '父级支持但30分钟仍待确认'
  );
  assert.equal(
    payload.periods.daily.deterministic_decision?.execution_plan?.confirm_entry,
    '30分钟回抽确认后加仓'
  );
});
```

- [ ] **Step 2: 运行测试，确认现在会失败**

Run:

```bash
pnpm ts-check
node --test tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts
```

Expected:

- `pnpm ts-check` 报 `TrinityDecision` 不认识 `candidate_structure` / `wait_state` / `judgment` / `execution_plan`
- `node --test` 中 AI payload 透传断言失败，因为 `deterministic_decision` 还没带这些字段

- [ ] **Step 3: 补类型定义与 AI payload 透传**

在 `src/lib/stock-structure-types.ts` 新增第二阶段接口，并挂到 `TrinityDecision`；同时在 `src/lib/ai-analysis-payload.ts` 的 `deterministic_decision` 透传对象里补齐这些字段。

```ts
export interface TrinityCandidateStructureDecision {
  candidate_type: string;
  candidate_label: string;
  current_leg: string;
  direction: 'up' | 'down' | 'neutral';
  reason: string;
  upgrade_condition: string;
  invalidation: string;
}

export interface TrinityWaitStateDecision {
  wait_type: string;
  wait_label: string;
  current_block: string;
  next_confirmation_action: string;
  reason: string;
}

export interface TrinityZeroAxisSignalDecision {
  formed: boolean;
  signal_type: string;
  signal_label: string;
  reason: string;
  impact_on_judgment: 'promote' | 'suppress' | 'neutral';
}

export interface TrinityResonanceStateDecision {
  status: 'supportive' | 'conflicting' | 'neutral';
  reason: string;
  impact_on_judgment: 'promote' | 'suppress' | 'neutral';
  is_hard_constraint: boolean;
}

export interface TrinityDivergenceWeightDecision {
  status: 'supportive' | 'suppressive' | 'hard_block' | 'neutral';
  label: string;
  reason: string;
  impact_on_judgment: 'promote' | 'suppress' | 'neutral';
}

export interface TrinityJudgmentDecision {
  level: 'strict_wait' | 'candidate_probe' | 'confirmed_execute';
  label: '严格等待' | '候选可试' | '确认执行';
  current_best_action: string;
  critical_reason: string;
  supporting_factors: string[];
  limiting_factors: string[];
}

export interface TrinityExecutionPlanDecision {
  probe_entry: string;
  confirm_entry: string;
  invalidation: string;
  current_position_action: string;
}
```

```ts
export interface TrinityDecision {
  version: 'v2';
  level: 'weekly' | 'daily' | 'hour60' | 'hour30' | 'hour15';
  conclusion: TrinityConclusion;
  structure: TrinityStructureDecision;
  spacetime: TrinitySpacetimeDecision;
  moving_average: TrinityMovingAverageDecision;
  volume_confirmation: TrinityVolumeConfirmationDecision;
  level_nesting?: TrinityLevelNestingDecision;
  trade_qualification: TrinityTradeQualification;
  execution: TrinityExecutionDecision;
  candidate_structure?: TrinityCandidateStructureDecision;
  wait_state?: TrinityWaitStateDecision;
  zero_axis_signal?: TrinityZeroAxisSignalDecision;
  resonance_state?: TrinityResonanceStateDecision;
  divergence_weight?: TrinityDivergenceWeightDecision;
  judgment?: TrinityJudgmentDecision;
  execution_plan?: TrinityExecutionPlanDecision;
  judgment_criteria: TrinityJudgmentCriterion[];
  ai_summary_facts: string[];
}
```

```ts
deterministic_decision: periodData.trinity_decision
  ? compactRecord({
      version: periodData.trinity_decision.version,
      level: periodData.trinity_decision.level,
      conclusion: periodData.trinity_decision.conclusion,
      structure: periodData.trinity_decision.structure,
      spacetime: periodData.trinity_decision.spacetime,
      moving_average: periodData.trinity_decision.moving_average,
      volume_confirmation: periodData.trinity_decision.volume_confirmation,
      level_nesting: periodData.trinity_decision.level_nesting,
      trade_qualification: periodData.trinity_decision.trade_qualification,
      execution: periodData.trinity_decision.execution,
      candidate_structure: periodData.trinity_decision.candidate_structure,
      wait_state: periodData.trinity_decision.wait_state,
      zero_axis_signal: periodData.trinity_decision.zero_axis_signal,
      resonance_state: periodData.trinity_decision.resonance_state,
      divergence_weight: periodData.trinity_decision.divergence_weight,
      judgment: periodData.trinity_decision.judgment,
      execution_plan: periodData.trinity_decision.execution_plan,
      judgment_criteria: periodData.trinity_decision.judgment_criteria,
      ai_summary_facts: periodData.trinity_decision.ai_summary_facts,
    })
  : undefined,
```

- [ ] **Step 4: 重新运行类型与 AI payload 测试**

Run:

```bash
pnpm ts-check
node --test tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts
```

Expected:

- `pnpm ts-check` PASS
- 两个 `node --test` 文件 PASS

- [ ] **Step 5: 提交 Task 1**

```bash
git add src/lib/stock-structure-types.ts src/lib/ai-analysis-payload.ts tests/trinity-decision-types.test.ts tests/ai-analysis-payload.test.ts
git commit -m "类型：补齐第二阶段三位一体判断合同"
```

## Task 2: 用 Python 测试锁住第二阶段后端合同

**Files:**
- Create: `tests/test_trinity_decision_phase2_contract.py`
- Test: `tests/test_trinity_decision_levels.py`

- [ ] **Step 1: 先写会失败的 Python 合同测试**

新建 `tests/test_trinity_decision_phase2_contract.py`，先锁住第二阶段最重要的三个面：候选结构/等待状态、零轴强信号/共振/背离、融合判断/执行预案。

```py
import unittest

from scripts.stock_analyzer import TrinityStockAnalyzer


class TrinityDecisionPhase2ContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.analyzer = TrinityStockAnalyzer()

    def test_build_trinity_decision_emits_candidate_wait_and_execution_plan(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='hour60',
            structure_payload={
                'structure_type': 'A五段式',
                'structure_stage': '上涨修正',
                'trend_direction': '上涨',
                'description': 'live 段仍按上涨原型处理',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'A',
                        'summary': 'A延续候选',
                        'directional_bias': 'up',
                        'maturity': 'developing',
                    },
                    'current_leg': {
                        'label': 'a3→live 上行形成中',
                        'direction': 'up',
                        'status': 'forming',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏强',
                        'child_structure_match': True,
                        'resonance_enabled': True,
                        'structure_readiness': 'developing',
                        'wait_reason': '等待30分钟回抽确认',
                        'required_confirmation': '观察30分钟回抽不破 MA55',
                    },
                },
            },
            macd_payload={
                'status': '中偏强',
                'description': '低位金叉后等待 DIF 上穿零轴',
                'top_divergence': False,
                'bottom_divergence': False,
            },
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={
                'pattern_type': '回抽突破',
                'direction': 'up',
                'is_valid': True,
            },
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'pullback',
                'trigger': ['15分钟止跌后轻仓试'],
                'confirmation': ['30分钟回抽确认后加仓'],
                'invalidation': ['跌破15分钟确认低点'],
                'wait_reason': '等待30分钟回抽确认',
                'rationale': '父级支持，但当前仍需确认',
                'position_sizing': {'reason': '先轻仓，确认后加仓'},
            },
            level_nesting_payload={
                'parent_level': 'daily',
                'child_level': 'hour60',
                'parent_bias': 'bullish',
                'child_signal': 'long',
                'resonance': 'aligned',
                'permission': {
                    'allow_position_increase': True,
                    'allow_t_trade': False,
                    'allow_only_light_probe': False,
                    'reason': '父级支持，子级顺父级',
                },
            },
        )

        self.assertEqual(decision['candidate_structure']['candidate_label'], 'A延续候选')
        self.assertEqual(decision['candidate_structure']['current_leg'], 'a3→live 上行形成中')
        self.assertEqual(decision['wait_state']['wait_type'], '等待回抽确认')
        self.assertEqual(decision['wait_state']['next_confirmation_action'], '观察30分钟回抽不破 MA55')
        self.assertEqual(decision['execution_plan']['probe_entry'], '15分钟止跌后轻仓试')
        self.assertEqual(decision['execution_plan']['confirm_entry'], '30分钟回抽确认后加仓')

    def test_build_trinity_decision_emits_zero_axis_resonance_divergence_and_judgment(self) -> None:
        decision = self.analyzer._build_trinity_decision(
            level='daily',
            structure_payload={
                'structure_type': 'D三段式',
                'structure_stage': '反弹末端',
                'trend_direction': '上涨',
                'description': '上涨反抽接近衰竭',
                'interpretation': {
                    'focus_structure': {
                        'archetype_family': 'D',
                        'summary': 'D候选',
                        'directional_bias': 'up',
                        'maturity': 'developing',
                    },
                    'current_leg': {
                        'label': 'd3→live 上行形成中',
                        'direction': 'up',
                        'status': 'forming',
                    },
                    'spacetime_gate': {
                        'parent_status': '中偏弱',
                        'child_structure_match': False,
                        'resonance_enabled': False,
                        'structure_readiness': 'unmatched',
                        'wait_reason': '父级中偏弱，当前上涨原型不放行',
                        'required_confirmation': '等待重新回到匹配结构',
                    },
                },
            },
            macd_payload={
                'status': '极强',
                'description': '零轴金叉快速形成，强势上涨段',
                'top_divergence': True,
                'bottom_divergence': False,
                'divergence_note': '顶背离仍在压制',
                'zero_axis_signal': {
                    'formed': True,
                    'signal_type': 'zero_axis_golden_cross',
                    'reason': '零轴附近快速金叉',
                },
            },
            moving_averages={
                'price_vs_ma55': 'above',
                'price_vs_ma233': 'above',
                'ma_status': '多头排列',
            },
            breakthrough_payload={
                'pattern_type': '有效突破',
                'direction': 'up',
                'is_valid': True,
            },
            execution_payload={
                'can_trade': True,
                'action': 'buy',
                'direction': 'long',
                'entry_style': 'breakout',
                'trigger': ['突破前高后轻仓试'],
                'confirmation': ['回抽确认后再加仓'],
                'invalidation': ['重新跌回前高下方'],
                'wait_reason': '父级中偏弱，当前上涨原型不放行',
                'rationale': '存在零轴强信号，但父级与背离仍冲突',
                'position_sizing': {'reason': '只允许等待，不直接放大动作'},
            },
            level_nesting_payload={
                'parent_level': 'weekly',
                'child_level': 'daily',
                'parent_bias': 'bearish',
                'child_signal': 'long',
                'resonance': 'child_countertrend',
                'permission': {
                    'allow_position_increase': False,
                    'allow_t_trade': False,
                    'allow_only_light_probe': True,
                    'reason': '父级强冲突，子级逆父级',
                },
            },
        )

        self.assertTrue(decision['zero_axis_signal']['formed'])
        self.assertEqual(decision['zero_axis_signal']['signal_label'], '零轴金叉')
        self.assertEqual(decision['resonance_state']['status'], 'conflicting')
        self.assertTrue(decision['resonance_state']['is_hard_constraint'])
        self.assertEqual(decision['divergence_weight']['status'], 'hard_block')
        self.assertEqual(decision['judgment']['label'], '严格等待')
        self.assertEqual(decision['judgment']['critical_reason'], '父级强冲突，子级逆父级')
```

- [ ] **Step 2: 运行 Python 测试，确认现在会失败**

Run:

```bash
python3 -m unittest tests.test_trinity_decision_phase2_contract -v
```

Expected:

- 报 `KeyError: 'candidate_structure'`
- 或相近断言失败，说明 `_build_trinity_decision()` 还没输出第二阶段分块

- [ ] **Step 3: 补现有等级测试里的最小覆盖面**

在 `tests/test_trinity_decision_levels.py` 的第一个基础用例里补一组“新字段至少存在且不破坏旧字段”的断言，确保 Task 3 改完后旧测试不只验证 v2 老字段。

```py
self.assertIn('candidate_structure', decision)
self.assertIn('wait_state', decision)
self.assertIn('judgment', decision)
self.assertIn('execution_plan', decision)
self.assertEqual(decision['judgment']['label'], '严格等待')
```

- [ ] **Step 4: 再跑一遍当前 Python 测试，确认失败形态符合预期**

Run:

```bash
python3 -m unittest tests.test_trinity_decision_phase2_contract tests.test_trinity_decision_levels -v
```

Expected:

- 新增的 phase2 测试 FAIL
- 原有 levels 测试也会因为新断言而 FAIL

- [ ] **Step 5: 提交 Task 2**

```bash
git add tests/test_trinity_decision_phase2_contract.py tests/test_trinity_decision_levels.py
git commit -m "测试：锁定第二阶段三位一体判断合同"
```

## Task 3: 在 `stock_analyzer.py` 实现第二阶段合同与小幅判断升级

**Files:**
- Modify: `scripts/stock_analyzer.py`
- Test: `tests/test_trinity_decision_phase2_contract.py`
- Test: `tests/test_trinity_decision_levels.py`
- Test: `tests/test_trinity_decision_trade_qualification.py`

- [ ] **Step 1: 先加第二阶段 helper，保持 `_build_trinity_decision()` 可读**

在 `scripts/stock_analyzer.py` 中新增 7 个小 helper，避免把 `_build_trinity_decision()` 继续塞胖：

```py
def _build_trinity_candidate_structure_decision(
    self,
    structure_payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    interpretation = structure_payload.get('interpretation') or {}
    focus_structure = interpretation.get('focus_structure') or {}
    current_leg = interpretation.get('current_leg') or {}
    family = (focus_structure.get('archetype_family') or '').strip()
    direction = current_leg.get('direction') or focus_structure.get('directional_bias') or 'neutral'

    candidate_label_map = {
        'A': 'A延续候选' if direction == 'up' else 'A修正候选',
        'B': 'B候选',
        'C': 'C候选',
        'D': 'D候选',
    }
    if not family:
        return None

    return {
        'candidate_type': family,
        'candidate_label': candidate_label_map.get(family, f'{family}候选'),
        'current_leg': current_leg.get('label') or '待确认',
        'direction': direction if direction in {'up', 'down'} else 'neutral',
        'reason': focus_structure.get('summary') or structure_payload.get('description') or '候选结构待确认',
        'upgrade_condition': (
            (interpretation.get('next_confirmation') or {}).get('trigger')
            or ((interpretation.get('spacetime_gate') or {}).get('required_confirmation'))
            or '等待下一确认动作'
        ),
        'invalidation': (
            ((structure_payload.get('execution') or {}).get('invalidation') or [None])[0]
            or '若关键边界失效则取消候选'
        ),
    }
```

```py
def _build_trinity_wait_state_decision(
    self,
    *,
    structure_payload: Dict[str, Any],
    execution_payload: Dict[str, Any],
    trade_qualification: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    interpretation = structure_payload.get('interpretation') or {}
    gate = interpretation.get('spacetime_gate') or {}
    wait_reason = execution_payload.get('wait_reason') or gate.get('wait_reason')
    if not wait_reason and trade_qualification.get('trade_mode') != 'wait_confirmation':
        return None

    wait_type = (
        '父级未放行' if '父级' in (wait_reason or '') else
        '等待量能确认' if '量能' in (wait_reason or '') else
        '等待回抽确认' if '回抽' in (wait_reason or '') else
        '等待触发'
    )
    return {
        'wait_type': wait_type,
        'wait_label': wait_type,
        'current_block': wait_reason or '等待下一确认信号',
        'next_confirmation_action': (
            gate.get('required_confirmation')
            or ((interpretation.get('next_confirmation') or {}).get('trigger'))
            or ((execution_payload.get('confirmation') or [None])[0])
            or '继续观察下一确认动作'
        ),
        'reason': wait_reason or '当前仍处于等待状态',
    }
```

```py
def _build_trinity_zero_axis_signal_decision(
    self,
    macd_payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    explicit = macd_payload.get('zero_axis_signal') if isinstance(macd_payload, dict) else None
    description = (macd_payload.get('description') or '') if isinstance(macd_payload, dict) else ''

    signal_type = None
    reason = None
    formed = False
    if isinstance(explicit, dict) and explicit.get('formed'):
        formed = True
        signal_type = explicit.get('signal_type')
        reason = explicit.get('reason')
    elif '零轴金叉' in description:
        formed = True
        signal_type = 'zero_axis_golden_cross'
        reason = description
    elif '零轴死叉' in description:
        formed = True
        signal_type = 'zero_axis_death_cross'
        reason = description
    elif '二次金叉' in description or '二次死叉' in description:
        formed = True
        signal_type = 'secondary_confirmation'
        reason = description
    elif '失败' in description and '零轴' in description:
        signal_type = 'formation_failure'
        reason = description

    if not signal_type:
        return None

    signal_label_map = {
        'zero_axis_golden_cross': '零轴金叉',
        'zero_axis_death_cross': '零轴死叉',
        'secondary_confirmation': '二次确认',
        'formation_failure': '信号失败',
    }
    impact = 'promote' if signal_type in {'zero_axis_golden_cross', 'secondary_confirmation'} else 'suppress'
    return {
        'formed': formed,
        'signal_type': signal_type,
        'signal_label': signal_label_map[signal_type],
        'reason': reason or '零轴强信号已触发',
        'impact_on_judgment': impact,
    }
```

- [ ] **Step 2: 再补共振、背离、融合判断、执行预案 helper，并接回主返回值**

继续在 `scripts/stock_analyzer.py` 内加剩余 helper，并在 `_build_trinity_decision()` 里串起来。

```py
def _build_trinity_resonance_state_decision(
    self,
    *,
    level_nesting_decision: Optional[Dict[str, Any]],
    moving_average_decision: Dict[str, Any],
    volume_decision: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    nesting = level_nesting_decision or {}
    resonance = nesting.get('resonance')
    if resonance == 'aligned':
        return {
            'status': 'supportive',
            'reason': nesting.get('permission', {}).get('reason') or '父级支持，子级顺父级',
            'impact_on_judgment': 'promote',
            'is_hard_constraint': False,
        }
    if resonance in {'child_countertrend', 'conflict'}:
        return {
            'status': 'conflicting',
            'reason': nesting.get('permission', {}).get('reason') or '父级强冲突，子级逆父级',
            'impact_on_judgment': 'suppress',
            'is_hard_constraint': True,
        }

    ma_reason = ((moving_average_decision.get('ma_gate') or {}).get('reason')) or '均线暂未额外放行'
    volume_reason = ((volume_decision.get('volume_gate') or {}).get('reason')) or '量能暂未额外放行'
    return {
        'status': 'neutral',
        'reason': f'{ma_reason}；{volume_reason}',
        'impact_on_judgment': 'neutral',
        'is_hard_constraint': False,
    }
```

```py
def _build_trinity_divergence_weight_decision(
    self,
    *,
    spacetime_decision: Dict[str, Any],
    conclusion_bias: str,
) -> Optional[Dict[str, Any]]:
    divergence = spacetime_decision.get('divergence_policy') or {}
    top = bool(divergence.get('top_divergence_valid'))
    bottom = bool(divergence.get('bottom_divergence_valid'))
    reason = divergence.get('reason') or '沿用现有 MACD 背离字段'

    if conclusion_bias == 'bullish' and top:
        return {
            'status': 'hard_block',
            'label': '顶背离压制',
            'reason': reason,
            'impact_on_judgment': 'suppress',
        }
    if conclusion_bias == 'bearish' and bottom:
        return {
            'status': 'hard_block',
            'label': '底背离压制',
            'reason': reason,
            'impact_on_judgment': 'suppress',
        }
    if bottom:
        return {
            'status': 'supportive',
            'label': '底背离加分',
            'reason': reason,
            'impact_on_judgment': 'promote',
        }
    if top:
        return {
            'status': 'suppressive',
            'label': '顶背离压制',
            'reason': reason,
            'impact_on_judgment': 'suppress',
        }
    return {
        'status': 'neutral',
        'label': '无背离压制',
        'reason': reason,
        'impact_on_judgment': 'neutral',
    }
```

```py
def _build_trinity_judgment_decision(
    self,
    *,
    trade_qualification: Dict[str, Any],
    execution_payload: Dict[str, Any],
    wait_state: Optional[Dict[str, Any]],
    zero_axis_signal: Optional[Dict[str, Any]],
    resonance_state: Optional[Dict[str, Any]],
    divergence_weight: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    critical_reason = (
        (resonance_state or {}).get('reason')
        if (resonance_state or {}).get('is_hard_constraint')
        else (wait_state or {}).get('current_block')
        or ((divergence_weight or {}).get('reason'))
        or execution_payload.get('rationale')
        or '等待下一步确认'
    )
    hard_block = bool((resonance_state or {}).get('is_hard_constraint')) or (
        (divergence_weight or {}).get('status') == 'hard_block'
    )

    if hard_block or trade_qualification.get('trade_mode') in {'wait_confirmation', 'no_trade'}:
        level = 'strict_wait'
        label = '严格等待'
    elif execution_payload.get('can_trade') and not wait_state:
        level = 'confirmed_execute'
        label = '确认执行'
    else:
        level = 'candidate_probe'
        label = '候选可试'

    supporting_factors = [
        item for item in [
            (zero_axis_signal or {}).get('signal_label') if (zero_axis_signal or {}).get('impact_on_judgment') == 'promote' else None,
            (resonance_state or {}).get('reason') if (resonance_state or {}).get('status') == 'supportive' else None,
        ] if item
    ]
    limiting_factors = [
        item for item in [
            (wait_state or {}).get('current_block'),
            (divergence_weight or {}).get('label') if (divergence_weight or {}).get('impact_on_judgment') == 'suppress' else None,
            (resonance_state or {}).get('reason') if (resonance_state or {}).get('status') == 'conflicting' else None,
        ] if item
    ]

    return {
        'level': level,
        'label': label,
        'current_best_action': (
            execution_payload.get('action') if label == '确认执行'
            else '轻仓试' if label == '候选可试'
            else '继续等待'
        ),
        'critical_reason': critical_reason,
        'supporting_factors': supporting_factors,
        'limiting_factors': limiting_factors,
    }
```

```py
def _build_trinity_execution_plan_decision(
    self,
    *,
    execution_payload: Dict[str, Any],
    judgment: Dict[str, Any],
    candidate_structure: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        'probe_entry': ((execution_payload.get('trigger') or [None])[0]) or '继续等待触发',
        'confirm_entry': (
            ((execution_payload.get('confirmation') or [None])[0])
            or (candidate_structure or {}).get('upgrade_condition')
            or '等待进一步确认'
        ),
        'invalidation': ((execution_payload.get('invalidation') or [None])[0]) or '若条件失效则取消',
        'current_position_action': judgment.get('current_best_action') or '继续等待',
    }
```

把它们接回 `_build_trinity_decision()`：

```py
        candidate_structure = self._build_trinity_candidate_structure_decision(structure_payload)
        wait_state = self._build_trinity_wait_state_decision(
            structure_payload=structure_payload,
            execution_payload=execution_payload,
            trade_qualification=trade_qualification,
        )
        zero_axis_signal = self._build_trinity_zero_axis_signal_decision(macd_payload)
        resonance_state = self._build_trinity_resonance_state_decision(
            level_nesting_decision=level_nesting_payload,
            moving_average_decision=moving_average_decision,
            volume_decision=volume_decision,
        )
        divergence_weight = self._build_trinity_divergence_weight_decision(
            spacetime_decision=spacetime_decision,
            conclusion_bias='bullish' if execution_payload.get('direction') == 'long' else 'bearish' if execution_payload.get('direction') == 'short' else 'neutral',
        )
        judgment = self._build_trinity_judgment_decision(
            trade_qualification=trade_qualification,
            execution_payload=execution_payload,
            wait_state=wait_state,
            zero_axis_signal=zero_axis_signal,
            resonance_state=resonance_state,
            divergence_weight=divergence_weight,
        )
        execution_plan = self._build_trinity_execution_plan_decision(
            execution_payload=execution_payload,
            judgment=judgment,
            candidate_structure=candidate_structure,
        )
```

```py
            'candidate_structure': candidate_structure,
            'wait_state': wait_state,
            'zero_axis_signal': zero_axis_signal,
            'resonance_state': resonance_state,
            'divergence_weight': divergence_weight,
            'judgment': judgment,
            'execution_plan': execution_plan,
            'judgment_criteria': [],
            'ai_summary_facts': [
                structure_payload.get('description') or '',
                judgment.get('critical_reason') or '',
                execution_payload.get('rationale') or execution_payload.get('wait_reason') or '',
            ],
```

- [ ] **Step 3: 跑 Python 单测，确认新旧合同一起通过**

Run:

```bash
python3 -m unittest \
  tests.test_trinity_decision_phase2_contract \
  tests.test_trinity_decision_levels \
  tests.test_trinity_decision_trade_qualification -v
```

Expected:

- 三个测试模块 PASS
- `test_trinity_decision_phase2_contract` 中能看到新分块断言全部通过

- [ ] **Step 4: 按 `CLAUDE.md` 做 HTTP API 回归验证**

先确保本地服务跑在 `5001`。若没启动，再起：

```bash
PORT=5001 pnpm next dev --webpack --port 5001
```

然后跑周线基准回归：

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
print('聚焦起点:', focus)
print('第二阶段 judgment:', ((w.get('trinity_decision') or {}).get('judgment') or {}).get('label'))
"
```

Expected:

- `聚焦结构: C单平台式`
- `原始结构: 延伸C类`
- `聚焦起点来源: peak_extreme`
- `聚焦起点` 仍指向 `209.88`
- `第二阶段 judgment` 有值，且不影响原始结构回归

再确认日线能带出新分块：

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=daily" | python3 -c "
import json,sys
r=json.load(sys.stdin)
d=((r.get('data') or {}).get('periods') or {}).get('daily') or {}
t=d.get('trinity_decision') or {}
print('candidate_structure:', t.get('candidate_structure'))
print('wait_state:', t.get('wait_state'))
print('judgment:', t.get('judgment'))
print('execution_plan:', t.get('execution_plan'))
"
```

Expected:

- `candidate_structure` / `wait_state` / `judgment` / `execution_plan` 全部非空字典

- [ ] **Step 5: 提交 Task 3**

```bash
git add scripts/stock_analyzer.py tests/test_trinity_decision_phase2_contract.py tests/test_trinity_decision_levels.py tests/test_trinity_decision_trade_qualification.py
git commit -m "后端：补齐第二阶段三位一体判断合同"
```

## Task 4: 页面与标签优先消费第二阶段字段，保留旧字段回退

**Files:**
- Modify: `src/lib/trinity-judgment-display.ts`
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Modify: `src/lib/trinity-signal-tags.ts`
- Modify: `src/components/stock/AnalysisPeriodDetails.tsx`
- Test: `tests/trinity-judgment-display.test.ts`
- Test: `tests/trinity-analysis-page-view-model.test.ts`
- Test: `tests/trinity-signal-tags.test.ts`
- Test: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 先写会失败的前端消费测试**

先把 helper / VM / 标签 / 周期详情对新字段的期望锁起来。

在 `tests/trinity-judgment-display.test.ts` 追加：

```ts
test('resolveJudgmentLabel prefers backend judgment block', () => {
  const decision = createDecision({
    judgment: {
      level: 'confirmed_execute',
      label: '确认执行',
      current_best_action: '确认后加仓',
      critical_reason: '30分钟回抽确认已经完成',
      supporting_factors: ['父级支持'],
      limiting_factors: [],
    },
  });

  assert.equal(resolveJudgmentLabel(decision), '确认执行');
});

test('buildExecutionPreview prefers execution_plan before legacy execution arrays', () => {
  const decision = createDecision({
    execution_plan: {
      probe_entry: '15分钟止跌后轻仓试',
      confirm_entry: '30分钟回抽确认后加仓',
      invalidation: '跌破15分钟确认低点',
      current_position_action: '轻仓试',
    },
  });

  assert.deepEqual(buildExecutionPreview(decision), {
    probeEntry: '15分钟止跌后轻仓试',
    confirmEntry: '30分钟回抽确认后加仓',
    invalidation: '跌破15分钟确认低点',
  });
});
```

在 `tests/trinity-analysis-page-view-model.test.ts` 追加：

```ts
test('summary prefers backend judgment critical reason and execution plan', () => {
  const result = createAnalysisResult();
  const decision = result.periods.daily.trinity_decision!;
  decision.judgment = {
    level: 'candidate_probe',
    label: '候选可试',
    current_best_action: '轻仓试',
    critical_reason: '父级支持但30分钟仍待确认',
    supporting_factors: ['零轴金叉'],
    limiting_factors: ['等待回抽确认'],
  };
  decision.execution_plan = {
    probe_entry: '15分钟止跌后轻仓试',
    confirm_entry: '30分钟回抽确认后加仓',
    invalidation: '跌破15分钟确认低点',
    current_position_action: '轻仓试',
  };
  decision.wait_state = {
    wait_type: '等待回抽确认',
    wait_label: '等待回抽确认',
    current_block: '30分钟尚未给出回抽企稳',
    next_confirmation_action: '观察30分钟回抽不破 MA55',
    reason: '当前仍缺少确认回抽',
  };

  const vm = buildAnalysisPageViewModel(result, { status: 'idle' }, null);

  assert.equal(vm.summary.judgmentLabel, '候选可试');
  assert.equal(vm.summary.primaryReason, '父级支持但30分钟仍待确认');
  assert.match(vm.summary.executionSummary, /30分钟回抽确认后加仓/);
});
```

在 `tests/trinity-signal-tags.test.ts` 追加：

```ts
test('buildDecisionSignalTags exposes zero-axis and divergence decisions from phase2 blocks', () => {
  const tags = buildDecisionSignalTags(createDecision({
    zero_axis_signal: {
      formed: true,
      signal_type: 'zero_axis_golden_cross',
      signal_label: '零轴金叉',
      reason: '零轴附近快速金叉',
      impact_on_judgment: 'promote',
    },
    divergence_weight: {
      status: 'suppressive',
      label: '顶背离压制',
      reason: '顶背离仍在压制',
      impact_on_judgment: 'suppress',
    },
  }));

  assert.ok(tags.some((tag) => tag.label === '时空｜零轴金叉'));
  assert.ok(tags.some((tag) => tag.label === '背离｜顶背离压制'));
});
```

- [ ] **Step 2: 跑前端相关测试，确认现在会失败**

Run:

```bash
node --test \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/trinity-signal-tags.test.ts \
  tests/analysis-page-sections.test.ts
```

Expected:

- `resolveJudgmentLabel` 仍然读旧逻辑，断言失败
- `buildExecutionPreview` 仍然读旧 `execution` 数组，断言失败
- 标签和 VM 还没用第二阶段字段，相关断言失败

- [ ] **Step 3: 改 helper、VM、标签和周期详情，统一“新字段优先，旧字段回退”**

在 `src/lib/trinity-judgment-display.ts` 改优先级：

```ts
export function resolveJudgmentLabel(decision?: TrinityDecision): JudgmentLabel {
  if (decision?.judgment?.label) {
    return decision.judgment.label;
  }
  if (!decision) {
    return '严格等待';
  }

  const canTrade = decision.conclusion?.can_trade === true;
  const positionPermission = decision.trade_qualification?.position_permission;
  const breakthroughState = decision.moving_average?.breakthrough_state;

  if (canTrade && (positionPermission === 'full_signal' || positionPermission === 'half_position')) {
    return '确认执行';
  }

  if (
    positionPermission === 'light_probe' ||
    positionPermission === 't_trade_only' ||
    breakthroughState === 'breakout_pending' ||
    breakthroughState === 'breakdown_pending'
  ) {
    return '候选可试';
  }

  return '严格等待';
}

export function buildExecutionPreview(decision?: TrinityDecision): {
  probeEntry: string;
  confirmEntry: string;
  invalidation: string;
} {
  return {
    probeEntry: decision?.execution_plan?.probe_entry ?? decision?.execution?.triggers[0] ?? '继续等待触发',
    confirmEntry: decision?.execution_plan?.confirm_entry ?? decision?.execution?.confirmation[0] ?? '等待进一步确认',
    invalidation: decision?.execution_plan?.invalidation ?? decision?.execution?.invalidation[0] ?? '若条件失效则取消',
  };
}
```

在 `src/lib/trinity-analysis-page-view-model.ts` 用新字段重建摘要与 hover：

```ts
const judgment = decision.judgment;
const waitState = decision.wait_state;
const executionPlan = decision.execution_plan;

const primaryReason =
  judgment?.critical_reason ??
  resolveChineseReason(
    [
      waitState?.current_block,
      decision.conclusion.wait_reason,
      decision.trade_qualification.reason?.[0],
    ],
    '等待下一步确认'
  );

const executionSummary = preferChineseText(
  [
    executionPlan?.probe_entry,
    executionPlan?.confirm_entry,
    executionPlan?.invalidation,
  ],
  decision.execution.position_sizing.reason
);
```

在 `src/lib/trinity-signal-tags.ts` 让现有标签体系吃到新字段，而不是新增另一套 key：

```ts
buildTag('spacetime', '时空', decision.zero_axis_signal?.signal_label ?? decision.spacetime.status, (
  decision.zero_axis_signal?.impact_on_judgment === 'promote'
    ? 'bullish'
    : decision.zero_axis_signal?.impact_on_judgment === 'suppress'
    ? 'warning'
    : decision.spacetime.direction_bias
), [
  { label: '说明', value: decision.zero_axis_signal?.reason ?? decision.spacetime.divergence_policy.reason },
]);

buildTag(
  'divergence',
  '背离',
  decision.divergence_weight?.label,
  decision.divergence_weight?.status === 'supportive'
    ? 'bullish'
    : decision.divergence_weight?.status === 'neutral'
    ? 'neutral'
    : 'bearish',
  [{ label: '说明', value: decision.divergence_weight?.reason }]
);
```

在 `src/components/stock/AnalysisPeriodDetails.tsx` 优先显示新等待语义和新执行预案：

```tsx
const waitState = decision?.wait_state;
const executionPlan = decision?.execution_plan;

const structureSummary =
  decision?.candidate_structure?.candidate_label
    ? `${decision.candidate_structure.candidate_label}｜${decision.candidate_structure.current_leg}`
    : section.period?.trinity_decision?.structure.type ?? section.period?.structure?.structure_type ?? null;

const executionSummary =
  executionPlan?.confirm_entry
    ? `${executionPlan.probe_entry}｜${executionPlan.confirm_entry}｜${executionPlan.invalidation}`
    : decision?.execution.position_sizing.reason ?? '继续等待';

const waitingSummary =
  waitState?.current_block
    ? `仍需确认：${waitState.current_block}`
    : `仍需确认：${section.period?.trinity_decision?.conclusion.wait_reason ?? '等待触发级别确认'}`;
```

- [ ] **Step 4: 跑前端回归与类型检查**

Run:

```bash
node --test \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/trinity-signal-tags.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/analysis-summary-panel.test.ts \
  tests/analysis-page-layout-contract.test.ts
pnpm ts-check
```

Expected:

- 以上 `node --test` 全部 PASS
- `pnpm ts-check` PASS

- [ ] **Step 5: 提交 Task 4**

```bash
git add src/lib/trinity-judgment-display.ts src/lib/trinity-analysis-page-view-model.ts src/lib/trinity-signal-tags.ts src/components/stock/AnalysisPeriodDetails.tsx tests/trinity-judgment-display.test.ts tests/trinity-analysis-page-view-model.test.ts tests/trinity-signal-tags.test.ts tests/analysis-page-sections.test.ts tests/analysis-summary-panel.test.ts tests/analysis-page-layout-contract.test.ts
git commit -m "接线：页面优先消费第二阶段三位一体判断字段"
```

## 全量验证清单（所有任务完成后统一执行）

1. 后端回归：

```bash
python3 -m unittest \
  tests.test_trinity_decision_phase2_contract \
  tests.test_trinity_decision_levels \
  tests.test_trinity_decision_trade_qualification \
  tests.test_structure_phase_execution -v
```

预期：以上四个 Python 测试模块 PASS。

2. 前端与 payload 回归：

```bash
node --test \
  tests/trinity-decision-types.test.ts \
  tests/ai-analysis-payload.test.ts \
  tests/trinity-judgment-display.test.ts \
  tests/trinity-analysis-page-view-model.test.ts \
  tests/trinity-signal-tags.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/analysis-summary-panel.test.ts \
  tests/analysis-page-layout-contract.test.ts
pnpm ts-check
```

预期：所有 `node --test` PASS，`pnpm ts-check` PASS。

3. HTTP API 双回归：

```bash
curl -s "http://localhost:5001/api/stock/analysis?code=300274&levels=weekly,daily" | python3 -c "
import json,sys
r=json.load(sys.stdin)
weekly=((r.get('data') or {}).get('periods') or {}).get('weekly') or {}
daily=((r.get('data') or {}).get('periods') or {}).get('daily') or {}
tw=weekly.get('trinity_decision') or {}
td=daily.get('trinity_decision') or {}
print('weekly.focus_origin:', ((tw.get('structure') or {}).get('focus_origin') or {}).get('price'))
print('weekly.structure_type:', ((weekly.get('structure') or {}).get('structure_type')))
print('weekly.raw_type:', (((weekly.get('structure') or {}).get('structure_details') or {}).get('raw_classification') or {}).get('type'))
print('daily.judgment:', (td.get('judgment') or {}).get('label'))
print('daily.wait_state:', (td.get('wait_state') or {}).get('wait_label'))
print('daily.execution_plan:', (td.get('execution_plan') or {}).get('confirm_entry'))
"
```

预期：

- `weekly.focus_origin: 209.88`
- `weekly.structure_type: C单平台式`
- `weekly.raw_type: 延伸C类`
- `daily.judgment` 非空
- `daily.wait_state` 非空
- `daily.execution_plan` 非空
