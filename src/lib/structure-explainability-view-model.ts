export interface StructureExplainabilityViewModel {
  topology: {
    hasExplainability: boolean;
    startLabel: string | null;
    currentLabel: string | null;
    currentSegmentLabel: string | null;
    nextSegmentLabel: string | null;
    displayReason: string | null;
    fallbackText: string | null;
  };
  archetype: {
    primaryLabel: string | null;
    alternativeLabels: string[];
    reason: string | null;
  };
}

interface ExplainabilitySummary {
  structure_start_point_id?: string | null;
  current_point_id?: string | null;
  current_segment?: {
    label?: string | null;
  } | null;
  next_segment_preview?: {
    label?: string | null;
  } | null;
  display_reason?: string | null;
}

interface PredictionSummary {
  current_stage?: string | null;
  next_stage?: string | null;
}

interface ArchetypeSummary {
  primary?: string | null;
  reason?: string | null;
  alternatives?: unknown[] | null;
}

interface StructureExplainabilityInput {
  structure_type?: string | null;
  description?: string | null;
  archetype?: ArchetypeSummary | null;
  structure_details?: {
    explainability?: ExplainabilitySummary | null;
    prediction?: PredictionSummary | null;
  } | null;
}

type AlternativeCandidate = string | { type?: string | null; label?: string | null } | null | undefined;

function resolveAlternativeLabel(item: AlternativeCandidate): string | null {
  if (!item) {
    return null;
  }
  if (typeof item === 'string') {
    return item;
  }
  if (typeof item.type === 'string' && item.type) {
    return item.type;
  }
  if (typeof item.label === 'string' && item.label) {
    return item.label;
  }
  return null;
}

function buildFallbackText(prediction?: PredictionSummary | null): string | null {
  const current = prediction?.current_stage;
  const next = prediction?.next_stage;
  if (!current && !next) {
    return '暂无 explainability 标注';
  }
  return `prediction 回退: ${current ?? '未知'} / ${next ?? '未知'}`;
}

export function buildStructureExplainabilityViewModel(
  structure?: StructureExplainabilityInput
): StructureExplainabilityViewModel {
  const explainability = structure?.structure_details?.explainability;
  const prediction = structure?.structure_details?.prediction;
  const archetype = structure?.archetype;
  const primaryLabel = archetype?.primary ?? structure?.structure_type ?? null;
  const alternatives = Array.isArray(archetype?.alternatives)
    ? archetype.alternatives
        .map((item) => resolveAlternativeLabel(item as AlternativeCandidate))
        .filter((label): label is string => Boolean(label))
    : [];
  const alternativeLabels = Array.from(
    new Set(alternatives.filter((label) => label !== primaryLabel))
  );

  return {
    topology: {
      hasExplainability: Boolean(explainability),
      startLabel: explainability?.structure_start_point_id ?? null,
      currentLabel: explainability?.current_point_id ?? null,
      currentSegmentLabel: explainability?.current_segment?.label ?? null,
      nextSegmentLabel: explainability?.next_segment_preview?.label ?? null,
      displayReason: explainability?.display_reason ?? null,
      fallbackText: explainability ? null : buildFallbackText(prediction),
    },
    archetype: {
      primaryLabel,
      alternativeLabels,
      reason: archetype?.reason ?? structure?.description ?? null,
    },
  };
}
