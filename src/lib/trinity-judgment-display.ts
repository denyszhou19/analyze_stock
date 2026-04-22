import type {
  TrinityDecision,
  TrinityLevelNestingDecision,
} from './stock-structure-types.ts';

export type JudgmentLabel = '严格等待' | '候选可试' | '确认执行';

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

export function resolveRelationLabel(levelNesting?: TrinityLevelNestingDecision): string {
  if (!levelNesting) {
    return '父级未明，子级先看确认';
  }

  if (levelNesting.resonance === 'aligned') {
    return '父级支持，子级顺父级';
  }

  if (
    levelNesting.resonance === 'child_countertrend' ||
    levelNesting.resonance === 'conflict'
  ) {
    return '父级强冲突，子级逆父级';
  }

  return '父级未明，子级先看确认';
}

export function buildExecutionPreview(decision?: TrinityDecision): {
  probeEntry: string;
  confirmEntry: string;
  invalidation: string;
} {
  return {
    probeEntry: decision?.execution_plan?.probe_entry ?? decision?.execution?.triggers[0] ?? '继续等待触发',
    confirmEntry:
      decision?.execution_plan?.confirm_entry ??
      decision?.execution?.confirmation[0] ??
      '等待进一步确认',
    invalidation:
      decision?.execution_plan?.invalidation ??
      decision?.execution?.invalidation[0] ??
      '若条件失效则取消',
  };
}
