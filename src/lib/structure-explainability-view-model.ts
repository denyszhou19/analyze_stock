export interface StructureExplainabilityViewModel {
  topology: {
    hasExplainability: boolean;
    startLabel: string | null;
    startMetaLabel: string | null;
    currentLabel: string | null;
    lastConfirmedLabel: string | null;
    liveLabel: string | null;
    currentSegmentLabel: string | null;
    nextSegmentLabel: string | null;
    displayReason: string | null;
    fallbackText: string | null;
  };
  interpretation: {
    backgroundLabel: string | null;
    archetypeLabel: string | null;
    maturityLabel: string | null;
    currentLegLabel: string | null;
    nextConfirmationLabel: string | null;
    executionStateLabel: string | null;
    waitReason: string | null;
    requiredConfirmation: string | null;
    scenarioPathLabels: string[];
    displayReason: string | null;
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

interface StructureInterpretationSummary {
  macro_background?: {
    label?: string | null;
  } | null;
  focus_structure?: {
    archetype_label?: string | null;
    maturity?: string | null;
    start_anchor?: {
      point_id?: string | null;
      price?: number | null;
      date?: string | null;
    } | null;
    reference_origin?: {
      point_id?: string | null;
      price?: number | null;
      date?: string | null;
    } | null;
    display_reason?: string | null;
  } | null;
  current_leg?: {
    label?: string | null;
    from_point_id?: string | null;
    to_point_id?: string | null;
  } | null;
  next_confirmation?: {
    label?: string | null;
  } | null;
  spacetime_gate?: {
    child_structure_match?: boolean | null;
    resonance_enabled?: boolean | null;
    wait_reason?: string | null;
    required_confirmation?: string | null;
  } | null;
  scenario_paths?: Array<{
    label?: string | null;
    trigger?: string | null;
  }> | null;
}

interface ArchetypeSummary {
  primary?: string | null;
  reason?: string | null;
  alternatives?: unknown[] | null;
}

interface StructureExplainabilityInput {
  structure_type?: string | null;
  description?: string | null;
  interpretation?: StructureInterpretationSummary | null;
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

function mapMaturityToChineseLabel(maturity?: string | null): string | null {
  if (!maturity) {
    return null;
  }
  const mapping: Record<string, string> = {
    candidate: '候选',
    developing: '开展中',
    confirmed: '已确认',
    completed: '已完成',
    invalidated: '已失效',
  };
  return mapping[maturity] ?? maturity;
}

function formatPrice(price?: number | null): string | null {
  if (typeof price !== 'number' || Number.isNaN(price)) {
    return null;
  }
  return price.toFixed(2);
}

function formatAnchorLabel(anchor?: {
  point_id?: string | null;
  price?: number | null;
  date?: string | null;
} | null): string | null {
  if (!anchor) {
    return null;
  }
  const priceLabel = formatPrice(anchor.price);
  if (anchor.point_id && priceLabel) {
    return `${anchor.point_id} @ ${priceLabel}`;
  }
  if (anchor.point_id) {
    return anchor.point_id;
  }
  if (anchor.date && priceLabel) {
    return `${anchor.date.slice(0, 10)} @ ${priceLabel}`;
  }
  return anchor.date?.slice(0, 10) ?? priceLabel;
}

function formatReferenceOriginLabel(anchor?: {
  point_id?: string | null;
  price?: number | null;
  date?: string | null;
} | null): string | null {
  const anchorLabel = formatAnchorLabel(anchor);
  if (!anchorLabel) {
    return null;
  }
  return `参考原点 ${anchorLabel}`;
}

function formatScenarioPathLabel(path?: {
  label?: string | null;
  trigger?: string | null;
} | null): string | null {
  if (!path?.label) {
    return null;
  }
  if (path.trigger) {
    return `${path.label}：${path.trigger}`;
  }
  return path.label;
}

function inferLiveLabel(currentLeg?: {
  label?: string | null;
  to_point_id?: string | null;
} | null): string | null {
  if (currentLeg?.to_point_id) {
    return currentLeg.to_point_id;
  }
  if ((currentLeg?.label ?? '').includes('live')) {
    return 'live';
  }
  return null;
}

export function buildStructureExplainabilityViewModel(
  structure?: StructureExplainabilityInput
): StructureExplainabilityViewModel {
  const explainability = structure?.structure_details?.explainability;
  const prediction = structure?.structure_details?.prediction;
  const interpretation = structure?.interpretation;
  const startAnchorLabel = formatAnchorLabel(interpretation?.focus_structure?.start_anchor);
  const referenceOriginLabel = formatReferenceOriginLabel(
    interpretation?.focus_structure?.reference_origin
  );
  const interpretationDisplayReason = interpretation?.focus_structure?.display_reason ?? null;
  const interpretationCurrentLegLabel = interpretation?.current_leg?.label ?? null;
  const interpretationNextConfirmationLabel = interpretation?.next_confirmation?.label ?? null;
  const interpretationGate = interpretation?.spacetime_gate ?? null;
  const scenarioPathLabels = Array.isArray(interpretation?.scenario_paths)
    ? interpretation.scenario_paths
        .map((path) => formatScenarioPathLabel(path))
        .filter((label): label is string => Boolean(label))
    : [];
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
      startLabel: startAnchorLabel ?? explainability?.structure_start_point_id ?? null,
      startMetaLabel: referenceOriginLabel,
      currentLabel: explainability?.current_point_id ?? null,
      lastConfirmedLabel:
        interpretation?.current_leg?.from_point_id ?? explainability?.current_point_id ?? null,
      liveLabel: inferLiveLabel(interpretation?.current_leg),
      currentSegmentLabel:
        interpretationCurrentLegLabel ?? explainability?.current_segment?.label ?? null,
      nextSegmentLabel:
        interpretationNextConfirmationLabel ?? explainability?.next_segment_preview?.label ?? null,
      displayReason: interpretationDisplayReason ?? explainability?.display_reason ?? null,
      fallbackText: explainability ? null : buildFallbackText(prediction),
    },
    interpretation: {
      backgroundLabel: interpretation?.macro_background?.label ?? null,
      archetypeLabel: interpretation?.focus_structure?.archetype_label ?? null,
      maturityLabel: mapMaturityToChineseLabel(interpretation?.focus_structure?.maturity),
      currentLegLabel: interpretationCurrentLegLabel,
      nextConfirmationLabel: interpretationNextConfirmationLabel,
      executionStateLabel:
        interpretationGate?.resonance_enabled === null || interpretationGate?.resonance_enabled === undefined
          ? null
          : interpretationGate.resonance_enabled
            ? '结构共振已成立'
            : '当前级别暂不操作',
      waitReason: interpretationGate?.wait_reason ?? null,
      requiredConfirmation: interpretationGate?.required_confirmation ?? null,
      scenarioPathLabels,
      displayReason: interpretationDisplayReason,
    },
    archetype: {
      primaryLabel,
      alternativeLabels,
      reason: archetype?.reason ?? structure?.description ?? null,
    },
  };
}
