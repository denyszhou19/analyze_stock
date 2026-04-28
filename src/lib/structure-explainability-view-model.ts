import type {
  MovingAveragesData,
  TrinityDecision,
} from './stock-structure-types.ts';

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
    standardQualification: string | null;
    maturityLabel: string | null;
    currentLegLabel: string | null;
    nextConfirmationLabel: string | null;
    executionStateLabel: string | null;
    waitReason: string | null;
    requiredConfirmation: string | null;
    scenarioPathLabels: string[];
    displayReason: string | null;
    startAnchorSource: string | null;
    explainabilityStatus: string | null;
    downgradeReason: string | null;
  };
  archetype: {
    primaryLabel: string | null;
    alternativeLabels: string[];
    reason: string | null;
  };
  periodEvidence: {
    structureMatchSummary: string | null;
    maBackgroundSummary: string | null;
    maBackgroundNote: string | null;
    structureDirectionSummary: string | null;
    ma55Price: string | null;
    ma233Price: string | null;
    maPressureSupportSummary: string | null;
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
    direction?: string | null;
    basis?: string[] | null;
  } | null;
  focus_structure?: {
    archetype_label?: string | null;
    archetype_family?: string | null;
    standard_qualification?: string | null;
    maturity?: string | null;
    start_anchor_source?: string | null;
    explainability_status?: string | null;
    downgrade_reason?: string | null;
    qualification_reason?: string | null;
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
    parent_status?: string | null;
    child_structure_family?: string | null;
    child_structure_match?: boolean | null;
    resonance_enabled?: boolean | null;
    structure_readiness?: string | null;
    wait_reason?: string | null;
    required_confirmation?: string | null;
  } | null;
  scenario_paths?: Array<{
    label?: string | null;
    trigger?: string | null;
  }> | null;
}

interface StructureExplainabilityContext {
  decision?: TrinityDecision | null;
  movingAverages?: MovingAveragesData | null;
  levelLabel?: string | null;
}

interface ArchetypeSummary {
  primary?: string | null;
  reason?: string | null;
  alternatives?: unknown[] | null;
}

interface StructureExplainabilityInput {
  structure_type?: string | null;
  trend_direction?: string | null;
  description?: string | null;
  interpretation?: StructureInterpretationSummary | null;
  archetype?: ArchetypeSummary | null;
  structure_details?: {
    explainability?: ExplainabilitySummary | null;
    prediction?: PredictionSummary | null;
    focus_origin_analysis?: {
      selected_origin_kind?: string | null;
      explainability_status?: string | null;
      explainability_reason?: string | null;
    } | null;
    raw_classification?: {
      type?: string | null;
      stage?: string | null;
      description?: string | null;
      component_summary?: string[] | null;
    } | null;
    focus_classification?: {
      type?: string | null;
      stage?: string | null;
      description?: string | null;
      archetype_family?: string | null;
      standard_qualification?: string | null;
      qualification_reason?: string | null;
    } | null;
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
  const current = normalizeStructureDisplayText(prediction?.current_stage);
  const next = normalizeStructureDisplayText(prediction?.next_stage);
  if (!current && !next) {
    return '暂无 explainability 标注';
  }
  return normalizeStructureDisplayText(`预测信息回退：${current ?? '未知'} / ${next ?? '未知'}`);
}

export function normalizeStructureDisplayText(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\bcurrent_stage\b\s*/g, '当前阶段')
    .replace(/\bnext_stage\b\s*/g, '下一阶段')
    .replace(/prediction\s*回退\s*[:：]\s*/g, '预测信息回退：')
    .replace(/当前阶段\s*[:：]\s*/g, '当前阶段：')
    .replace(/下一阶段\s*[:：]\s*/g, '下一阶段：');

  return normalized.trim() || null;
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

function isInternalPointId(pointId?: string | null): boolean {
  return Boolean(pointId && /^p\d+$/i.test(pointId));
}

function formatAnchorLabel(anchor?: {
  point_id?: string | null;
  price?: number | null;
  date?: string | null;
} | null, options?: {
  hideInternalPointId?: boolean;
}): string | null {
  if (!anchor) {
    return null;
  }
  const priceLabel = formatPrice(anchor.price);
  const hideInternalPointId = Boolean(options?.hideInternalPointId);
  if (anchor.point_id && priceLabel && !(hideInternalPointId && isInternalPointId(anchor.point_id))) {
    return `${anchor.point_id} @ ${priceLabel}`;
  }
  if (anchor.point_id && !(hideInternalPointId && isInternalPointId(anchor.point_id))) {
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
    return normalizeStructureDisplayText(`${path.label}：${path.trigger}`);
  }
  return normalizeStructureDisplayText(path.label);
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

function resolveLevelLabel(level?: string | null) {
  if (!level) {
    return null;
  }

  const mapping: Record<string, string> = {
    weekly: '周线',
    daily: '日线',
    hour60: '60分钟',
    hour30: '30分钟',
    hour15: '15分钟',
  };

  return mapping[level] ?? level;
}

function inferParentLabelFromStatus(status?: string | null) {
  if (!status) {
    return null;
  }

  const matched = status.match(/(周线|日线|60分钟|30分钟|15分钟)/);
  return matched?.[1] ?? null;
}

function resolveArchetypeFamilyLabel(structure?: StructureExplainabilityInput) {
  const family =
    structure?.interpretation?.focus_structure?.archetype_family ??
    structure?.interpretation?.spacetime_gate?.child_structure_family ??
    null;

  if (family === 'A' || family === 'B' || family === 'C' || family === 'D') {
    return `${family}类原型`;
  }

  const structureType = structure?.structure_type ?? '';
  if (structureType.includes('A')) {
    return 'A类原型';
  }
  if (structureType.includes('B')) {
    return 'B类原型';
  }
  if (structureType.includes('C')) {
    return 'C类原型';
  }
  if (structureType.includes('D')) {
    return 'D类原型';
  }

  return normalizeStructureDisplayText(structureType) ?? '当前结构';
}

function resolveStructureDirectionSummary(trendDirection?: string | null) {
  if (!trendDirection) {
    return '方向待确认';
  }

  if (trendDirection.includes('上')) {
    return '上涨骨架';
  }

  if (trendDirection.includes('下')) {
    return '下跌骨架';
  }

  return '震荡骨架';
}

function resolveMovingAverageRoleLabel(line: 'MA55' | 'MA233', role?: string | null) {
  if (role === 'support') {
    return `${line}构成支撑`;
  }

  if (role === 'pressure' || role === 'resistance') {
    return `${line}构成压制`;
  }

  return `${line}暂无明确支撑/压制`;
}

function formatMovingAverageValue(label: 'MA55' | 'MA233', value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return `${label} ${value.toFixed(2)}`;
}

export function buildStructureExplainabilityViewModel(
  structure?: StructureExplainabilityInput,
  context?: StructureExplainabilityContext
): StructureExplainabilityViewModel {
  const explainability = structure?.structure_details?.explainability;
  const prediction = structure?.structure_details?.prediction;
  const interpretation = structure?.interpretation;
  const standardQualification = interpretation?.focus_structure?.standard_qualification ?? null;
  const hideInternalStartPointId = standardQualification !== 'standard';
  const startAnchorLabel = formatAnchorLabel(interpretation?.focus_structure?.start_anchor, {
    hideInternalPointId: hideInternalStartPointId,
  });
  const referenceOriginAnchor = interpretation?.focus_structure?.reference_origin;
  const referenceOriginAnchorLabel = formatAnchorLabel(referenceOriginAnchor);
  const referenceOriginLabel = formatReferenceOriginLabel(referenceOriginAnchor);
  const interpretationDisplayReason = normalizeStructureDisplayText(
    interpretation?.focus_structure?.display_reason
  );
  const interpretationCurrentLegLabel = interpretation?.current_leg?.label ?? null;
  const interpretationNextConfirmationLabel = interpretation?.next_confirmation?.label ?? null;
  const interpretationGate = interpretation?.spacetime_gate ?? null;
  const focusOriginAnalysis = structure?.structure_details?.focus_origin_analysis ?? null;
  const explainabilityStatus =
    interpretation?.focus_structure?.explainability_status ??
    focusOriginAnalysis?.explainability_status ??
    null;
  const startAnchorSource =
    interpretation?.focus_structure?.start_anchor_source ??
    focusOriginAnalysis?.selected_origin_kind ??
    null;
  const macroOriginOutsideWindow =
    startAnchorSource === 'macro_origin' &&
    !startAnchorLabel &&
    !explainability?.structure_start_point_id &&
    Boolean(referenceOriginAnchorLabel);

  const downgradeReason = normalizeStructureDisplayText(
    interpretation?.focus_structure?.downgrade_reason ??
    interpretation?.focus_structure?.qualification_reason ??
    focusOriginAnalysis?.explainability_reason ??
    null
  );
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
  const decision = context?.decision ?? null;
  const movingAverages = context?.movingAverages ?? null;
  const currentLevelLabel =
    context?.levelLabel ?? resolveLevelLabel(decision?.level) ?? '当前级别';
  const parentLevelLabel =
    resolveLevelLabel(decision?.level_nesting?.parent_level) ??
    inferParentLabelFromStatus(interpretationGate?.parent_status) ??
    '父级';
  const archetypeFamilyLabel = resolveArchetypeFamilyLabel(structure);
  const tradeQualificationReleased =
    decision?.trade_qualification?.trade_mode === 'standard_node_trade' ||
    decision?.trade_qualification?.trade_mode === 'conditional_boundary_trade';
  const structureMatchSummary =
    interpretationGate?.resonance_enabled
      ? `${parentLevelLabel}状态与${currentLevelLabel} ${archetypeFamilyLabel}匹配已成立${
          tradeQualificationReleased ? '，交易资格已放行' : '，但交易资格仍未放行'
        }`
      : `${parentLevelLabel}状态与${currentLevelLabel} ${archetypeFamilyLabel}尚未完全匹配，当前仍需等待确认`;
  const maBackgroundNote = normalizeStructureDisplayText(
    interpretation?.macro_background?.basis?.join('；') ?? null
  );
  const maBackgroundSummary =
    normalizeStructureDisplayText(interpretation?.macro_background?.label) ?? '待确认';
  const structureDirectionSummary = resolveStructureDirectionSummary(structure?.trend_direction);
  const ma55Price = formatMovingAverageValue('MA55', movingAverages?.MA55);
  const ma233Price = formatMovingAverageValue('MA233', movingAverages?.MA233);
  const maPressureSupportSummary = normalizeStructureDisplayText(
    [
      resolveMovingAverageRoleLabel('MA55', decision?.moving_average?.ma55_role),
      resolveMovingAverageRoleLabel('MA233', decision?.moving_average?.ma233_role),
    ].join('；')
  );

  return {
    topology: {
      hasExplainability: Boolean(explainability),
      startLabel:
        startAnchorLabel ??
        (macroOriginOutsideWindow ? referenceOriginAnchorLabel : null) ??
        explainability?.structure_start_point_id ??
        null,
      startMetaLabel: macroOriginOutsideWindow ? '当前窗口未包含该原点' : referenceOriginLabel,
      currentLabel: explainability?.current_point_id ?? null,
      lastConfirmedLabel:
        interpretation?.current_leg?.from_point_id ?? explainability?.current_point_id ?? null,
      liveLabel: inferLiveLabel(interpretation?.current_leg),
      currentSegmentLabel:
        interpretationCurrentLegLabel ?? explainability?.current_segment?.label ?? null,
      nextSegmentLabel:
        interpretationNextConfirmationLabel ?? explainability?.next_segment_preview?.label ?? null,
      displayReason:
        interpretationDisplayReason ?? normalizeStructureDisplayText(explainability?.display_reason) ?? null,
      fallbackText: explainability ? null : buildFallbackText(prediction),
    },
    interpretation: {
      backgroundLabel: interpretation?.macro_background?.label ?? null,
      archetypeLabel: interpretation?.focus_structure?.archetype_label ?? null,
      standardQualification,
      maturityLabel: mapMaturityToChineseLabel(interpretation?.focus_structure?.maturity),
      currentLegLabel: interpretationCurrentLegLabel,
      nextConfirmationLabel: interpretationNextConfirmationLabel,
      executionStateLabel:
        interpretationGate?.resonance_enabled === null || interpretationGate?.resonance_enabled === undefined
          ? null
          : interpretationGate.resonance_enabled
            ? '结构共振已成立'
            : interpretationGate?.structure_readiness === 'extended'
              ? '原型匹配但仍需确认'
            : '当前级别暂不操作',
      waitReason: normalizeStructureDisplayText(interpretationGate?.wait_reason),
      requiredConfirmation: normalizeStructureDisplayText(interpretationGate?.required_confirmation),
      scenarioPathLabels,
      displayReason: interpretationDisplayReason,
      startAnchorSource,
      explainabilityStatus,
      downgradeReason,
    },
    archetype: {
      primaryLabel,
      alternativeLabels,
      reason: normalizeStructureDisplayText(archetype?.reason ?? structure?.description ?? null),
    },
    periodEvidence: {
      structureMatchSummary,
      maBackgroundSummary,
      maBackgroundNote,
      structureDirectionSummary,
      ma55Price,
      ma233Price,
      maPressureSupportSummary,
    },
  };
}
