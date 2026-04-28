import type {
  TrinityDecision,
  TrinityDirectionLockDecision,
  TrinityLevelNestingDecision,
  TrinityPredictiveCandidate,
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

  if (levelNesting.resonance === 'boundary_probe') {
    return '父级只允许边界试探';
  }

  if (levelNesting.resonance === 'structure_mismatch') {
    return '父级未放行，结构先重配';
  }

  if (levelNesting.resonance === 'blocked') {
    return '父级未放行，当前先等待';
  }

  if (
    levelNesting.resonance === 'child_countertrend' ||
    levelNesting.resonance === 'conflict'
  ) {
    return '父级强冲突，子级逆父级';
  }

  return '父级未明，子级先看确认';
}

export function resolvePredictiveStageLabel(
  candidate?: TrinityPredictiveCandidate | null
): string {
  const familyLabel = candidate?.label?.trim() || (candidate?.family ? `${candidate.family}候选` : '主候选');

  switch (candidate?.stage) {
    case 'debouncing':
      return `${familyLabel}正在形成，先等确认`;
    case 'candidate':
      return `${familyLabel}已出现，先观察确认`;
    case 'strengthening':
      return `${familyLabel}正在增强，确认后再推进`;
    case 'standard_confirmed':
      return `${familyLabel}已确认，可按标准节奏跟踪`;
    case 'degraded':
      return `${familyLabel}解释力下降，先降级观察`;
    case 'blocked':
      return `${familyLabel}暂未放行，先继续等待`;
    case 'exception':
      return '异常中断，先风控再评估';
    default:
      return `${familyLabel}仍待确认`;
  }
}

export function resolveDirectionLockLabel(
  directionLock?: TrinityDirectionLockDecision | null
): string {
  const reason = directionLock?.reason?.trim() || '';

  switch (directionLock?.status) {
    case 'locked':
      return reason ? `方向未放行，先等 ${reason}解除` : '方向未放行，先等关键位确认';
    case 'released':
      return '方向已放行，可继续跟踪确认';
    case 'mixed':
      return '方向待确认，先等均线与结构信号补齐';
    default:
      return '方向待确认，先看关键位是否放行';
  }
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
