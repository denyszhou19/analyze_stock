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

function resolveAlternativeLabel(item: any): string | null {
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

function buildFallbackText(prediction: any): string | null {
  const current = prediction?.current_stage;
  const next = prediction?.next_stage;
  if (!current && !next) {
    return '暂无 explainability 标注';
  }
  return `prediction 回退: ${current ?? '未知'} / ${next ?? '未知'}`;
}

export function buildStructureExplainabilityViewModel(
  structure?: any
): StructureExplainabilityViewModel {
  const explainability = structure?.structure_details?.explainability;
  const prediction = structure?.structure_details?.prediction;
  const archetype = structure?.archetype;

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
      primaryLabel: archetype?.primary ?? structure?.structure_type ?? null,
      alternativeLabels: Array.isArray(archetype?.alternatives)
        ? archetype.alternatives
            .map(resolveAlternativeLabel)
            .filter((label: string | null): label is string => Boolean(label))
        : [],
      reason: archetype?.reason ?? null,
    },
  };
}
