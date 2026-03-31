const ACTION_LABELS: Record<string, string> = {
  buy: '买入',
  add: '加仓',
  hold: '持有',
  wait: '等待',
  reduce: '减仓',
  sell: '卖出',
};

const KNOWN_CAP_LABELS: Array<[number, string]> = [
  [0.25, '1/4'],
  [1 / 3, '1/3'],
  [0.5, '1/2'],
  [2 / 3, '2/3'],
  [0.75, '3/4'],
  [1, '1'],
];

interface ExecutionPhaseData {
  label?: string | null;
  reason?: string | null;
}

interface ExecutionData {
  action?: string | null;
  setup_quality?: string | null;
  timeframe_cap_ratio?: number | null;
  rationale?: string | null;
  wait_reason?: string | null;
}

interface ArchetypeData {
  primary?: string | null;
  reason?: string | null;
}

interface ExecutionSummaryInput {
  structure?: {
    structure_type?: string | null;
    execution_phase?: ExecutionPhaseData | null;
    execution?: ExecutionData | null;
    archetype?: ArchetypeData | null;
  } | null;
}

export interface ExecutionSummary {
  phaseLabel: string | null;
  phaseReason: string | null;
  actionLabel: string | null;
  setupQuality: string | null;
  timeframeCapLabel: string | null;
  executionReason: string | null;
  archetypeLabel: string | null;
  archetypeReason: string | null;
}

export function formatTimeframeCap(value?: number | null): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const knownCap = KNOWN_CAP_LABELS.find(([candidate]) => Math.abs(candidate - value) < 1e-6);
  if (knownCap) {
    return `最多补仓 ${knownCap[1]}`;
  }

  const percentage = Number.isInteger(value * 100) ? `${value * 100}` : `${(value * 100).toFixed(0)}`;
  return `最多补仓 ${percentage}%`;
}

export function buildExecutionSummary(periodData?: ExecutionSummaryInput | null): ExecutionSummary {
  const structure = periodData?.structure;
  const execution = structure?.execution;
  const archetype = structure?.archetype;

  return {
    phaseLabel: structure?.execution_phase?.label ?? null,
    phaseReason: structure?.execution_phase?.reason ?? null,
    actionLabel: execution?.action ? (ACTION_LABELS[execution.action] ?? execution.action) : null,
    setupQuality: execution?.setup_quality ?? null,
    timeframeCapLabel: formatTimeframeCap(execution?.timeframe_cap_ratio),
    executionReason: execution?.wait_reason ?? execution?.rationale ?? null,
    archetypeLabel: archetype?.primary ?? structure?.structure_type ?? null,
    archetypeReason: archetype?.reason ?? null,
  };
}
