import type {
  AnalysisResultData,
  PeriodAnalysisData,
  StructurePrediction,
  TrinityDecision,
} from '@/lib/stock-structure-types';

export interface AiDecisionPeriodStructureSummary {
  type?: string;
  stage?: string;
  trend?: string;
  description?: string;
  interpretation?: {
    macro_background?: {
      label?: string | null;
      direction?: string | null;
      basis?: string[] | null;
    };
    focus_structure?: {
      focus_mode?: string | null;
      archetype_label?: string | null;
      archetype_family?: string | null;
      standard_qualification?: string | null;
      maturity?: string | null;
      directional_bias?: string | null;
      summary?: string | null;
      start_anchor_source?: string | null;
      explainability_status?: string | null;
      downgrade_reason?: string | null;
      qualification_reason?: string | null;
    };
    current_leg?: {
      label?: string | null;
      direction?: string | null;
      status?: string | null;
    };
    next_confirmation?: {
      label?: string | null;
      type?: string | null;
      trigger?: string | null;
    };
    spacetime_gate?: {
      parent_status?: string | null;
      allowed_child_structures?: string[] | null;
      child_structure_match?: boolean | null;
      resonance_enabled?: boolean | null;
      structure_readiness?: string | null;
      wait_reason?: string | null;
      required_confirmation?: string | null;
    };
    scenario_paths?: unknown[] | null;
  };
  focus_origin_analysis?: {
    selected_origin_kind?: string | null;
    selected_point_index?: number | null;
    explainability_status?: string | null;
    explainability_reason?: string | null;
  };
  raw_classification?: {
    type?: string | null;
    stage?: string | null;
    description?: string | null;
    component_summary?: string[] | null;
  };
  focus_classification?: {
    type?: string | null;
    stage?: string | null;
    description?: string | null;
    archetype_family?: string | null;
    standard_qualification?: string | null;
    qualification_reason?: string | null;
    trend_direction?: string | null;
    component_summary?: string[] | null;
  };
  archetype?: {
    primary?: string | null;
    maturity?: string | null;
    confidence?: string | null;
    reason?: string | null;
    alternatives?: unknown[] | null;
  };
}

export interface AiDecisionPeriodPredictionSummary {
  current_stage?: string;
  next_stage?: string;
  prediction_alert?: string;
  key_price_levels?: StructurePrediction['key_price_levels'];
  confidence?: 'high' | 'medium' | 'low';
  action_hint?: string;
  unstable_point?: StructurePrediction['unstable_point'];
  structure_perfect?: StructurePrediction['structure_perfect'];
}

export interface AiDecisionPeriodSummary {
  macd?: {
    status?: string | null;
    divergence_note?: string | null;
  };
  ma?: {
    ma55?: number | null;
    ma233?: number | null;
    price_vs_ma55?: string | null;
    price_vs_ma233?: string | null;
    ma_status?: string | null;
  };
  structure?: AiDecisionPeriodStructureSummary;
  deterministic_decision?: TrinityDecision;
  execution_phase?: {
    code?: string;
    label?: string;
    bias?: string;
    tradable?: boolean;
    maturity?: string;
    reason?: string;
  };
  execution?: {
    can_trade?: boolean;
    action?: string;
    direction?: string;
    setup_quality?: string;
    rationale?: string;
    timing_timeframe?: string;
    timeframe_cap_ratio?: number;
    trigger?: string[];
    invalidation?: string[];
    confirmation?: string[];
    entry_style?: string;
    position_sizing?: Record<string, unknown>;
    t_trade_rule?: Record<string, unknown>;
    risk_rules?: Record<string, unknown>;
    take_profit_plan?: Record<string, unknown>;
    key_levels?: Array<Record<string, unknown>>;
    risk_flags?: string[];
    wait_reason?: string | null;
  };
  latest_price?: number;
  price_change_pct?: number | null;
  prediction?: AiDecisionPeriodPredictionSummary;
  ma_physics?: {
    support_pressure_status?: string | null;
    ma55_role?: string | null;
    ma55_value?: number | null;
    traction_force?: string | null;
    deviation_ma55_pct?: number | null;
    pullback_expected?: boolean | null;
    resonance_strength?: string | null;
    resonance_zone?: string | null;
    key_signals?: string[] | null;
  };
  breakthrough?: {
    pattern_type?: string | null;
    direction?: string | null;
    target_ma?: string | null;
    is_valid?: boolean | null;
    confidence?: string | null;
    t0_date?: string | null;
    key_signals?: string[] | null;
  };
}

export interface AiDecisionLevelNestingSummary {
  summary?: string;
  spacetime_confirmation?: {
    space_confirmed?: unknown;
    time_confirmed?: unknown;
    spacetime_resonance?: unknown;
    analysis?: unknown;
    space_analysis?: unknown;
    time_analysis?: unknown;
  };
  trading_decision?: {
    decision_type?: unknown;
    t_type?: unknown;
    analysis?: unknown;
    action_hint?: unknown;
    analysis_order?: unknown;
    execution_order?: unknown;
    core_questions?: unknown;
  };
}

export interface AiDecisionDimensionOperation {
  major_level?: unknown;
  major_level_name?: unknown;
  major_status?: unknown;
  minor_level?: unknown;
  minor_level_name?: unknown;
  minor_structure?: unknown;
  minor_trend?: unknown;
  advice?: {
    operation_advice?: unknown;
    structure_match?: unknown;
    structure_direction?: unknown;
    explanation?: unknown;
  };
}

export interface AiDecisionPayload {
  stock_code?: string;
  stock_name?: string;
  analysis_time?: string;
  periods: Record<string, AiDecisionPeriodSummary>;
  level_nesting?: AiDecisionLevelNestingSummary;
  multi_dimension_operation?: Record<string, AiDecisionDimensionOperation>;
  key_alerts: string[] | null;
}

function compactRecord<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

function summarizePeriod(periodData: PeriodAnalysisData, level: string): AiDecisionPeriodSummary {
  const summary: AiDecisionPeriodSummary = compactRecord({
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
      type: periodData.structure?.structure_type,
      stage: periodData.structure?.structure_stage,
      trend: periodData.structure?.trend_direction,
      description: periodData.structure?.description,
      interpretation: periodData.structure?.interpretation
        ? compactRecord({
            macro_background: compactRecord({
              label: periodData.structure.interpretation.macro_background?.label,
              direction: periodData.structure.interpretation.macro_background?.direction,
              basis: periodData.structure.interpretation.macro_background?.basis,
            }),
            focus_structure: compactRecord({
              focus_mode: periodData.structure.interpretation.focus_structure?.focus_mode,
              archetype_label:
                periodData.structure.interpretation.focus_structure?.archetype_label,
              archetype_family:
                periodData.structure.interpretation.focus_structure?.archetype_family,
              standard_qualification:
                periodData.structure.interpretation.focus_structure?.standard_qualification,
              maturity: periodData.structure.interpretation.focus_structure?.maturity,
              directional_bias:
                periodData.structure.interpretation.focus_structure?.directional_bias,
              summary: periodData.structure.interpretation.focus_structure?.summary,
              start_anchor_source:
                periodData.structure.interpretation.focus_structure?.start_anchor_source,
              explainability_status:
                periodData.structure.interpretation.focus_structure?.explainability_status,
              downgrade_reason:
                periodData.structure.interpretation.focus_structure?.downgrade_reason,
              qualification_reason:
                periodData.structure.interpretation.focus_structure?.qualification_reason,
            }),
            current_leg: compactRecord({
              label: periodData.structure.interpretation.current_leg?.label,
              direction: periodData.structure.interpretation.current_leg?.direction,
              status: periodData.structure.interpretation.current_leg?.status,
            }),
            next_confirmation: periodData.structure.interpretation.next_confirmation
              ? compactRecord({
                  label: periodData.structure.interpretation.next_confirmation.label,
                  type: periodData.structure.interpretation.next_confirmation.type,
                  trigger: periodData.structure.interpretation.next_confirmation.trigger,
                })
              : undefined,
            spacetime_gate: periodData.structure.interpretation.spacetime_gate
              ? compactRecord({
                  parent_status: periodData.structure.interpretation.spacetime_gate.parent_status,
                  allowed_child_structures:
                    periodData.structure.interpretation.spacetime_gate.allowed_child_structures,
                  child_structure_match:
                    periodData.structure.interpretation.spacetime_gate.child_structure_match,
                  resonance_enabled:
                    periodData.structure.interpretation.spacetime_gate.resonance_enabled,
                  structure_readiness:
                    periodData.structure.interpretation.spacetime_gate.structure_readiness,
                  wait_reason: periodData.structure.interpretation.spacetime_gate.wait_reason,
                  required_confirmation:
                    periodData.structure.interpretation.spacetime_gate.required_confirmation,
                })
              : undefined,
            scenario_paths: periodData.structure.interpretation.scenario_paths,
          })
        : undefined,
      focus_origin_analysis: periodData.structure?.structure_details?.focus_origin_analysis
        ? compactRecord({
            selected_origin_kind:
              periodData.structure.structure_details.focus_origin_analysis.selected_origin_kind,
            selected_point_index:
              periodData.structure.structure_details.focus_origin_analysis.selected_point_index,
            explainability_status:
              periodData.structure.structure_details.focus_origin_analysis.explainability_status,
            explainability_reason:
              periodData.structure.structure_details.focus_origin_analysis.explainability_reason,
          })
        : undefined,
      raw_classification: periodData.structure?.structure_details?.raw_classification
        ? compactRecord({
            type: periodData.structure.structure_details.raw_classification.type,
            stage: periodData.structure.structure_details.raw_classification.stage,
            description: periodData.structure.structure_details.raw_classification.description,
            component_summary:
              periodData.structure.structure_details.raw_classification.component_summary,
          })
        : undefined,
      focus_classification: periodData.structure?.structure_details?.focus_classification
        ? compactRecord({
            type: periodData.structure.structure_details.focus_classification.type,
            stage: periodData.structure.structure_details.focus_classification.stage,
            description: periodData.structure.structure_details.focus_classification.description,
            archetype_family:
              periodData.structure.structure_details.focus_classification.archetype_family,
            standard_qualification:
              periodData.structure.structure_details.focus_classification.standard_qualification,
            qualification_reason:
              periodData.structure.structure_details.focus_classification.qualification_reason,
            trend_direction:
              periodData.structure.structure_details.focus_classification.trend_direction,
            component_summary:
              periodData.structure.structure_details.focus_classification.component_summary,
          })
        : undefined,
      archetype: periodData.structure?.archetype
        ? compactRecord({
            primary: periodData.structure.archetype.primary,
            maturity: periodData.structure.archetype.maturity,
            confidence: periodData.structure.archetype.confidence,
            reason: periodData.structure.archetype.reason,
            alternatives: periodData.structure.archetype.alternatives,
          })
        : undefined,
    }),
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
          judgment_criteria: periodData.trinity_decision.judgment_criteria,
          ai_summary_facts: periodData.trinity_decision.ai_summary_facts,
        })
      : undefined,
    execution_phase: periodData.structure?.execution_phase
      ? compactRecord({
          code: periodData.structure.execution_phase.code,
          label: periodData.structure.execution_phase.label,
          bias: periodData.structure.execution_phase.bias,
          tradable: periodData.structure.execution_phase.tradable,
          maturity: periodData.structure.execution_phase.maturity,
          reason: periodData.structure.execution_phase.reason,
        })
      : undefined,
    execution: periodData.structure?.execution
      ? compactRecord({
          can_trade: periodData.structure.execution.can_trade,
          action: periodData.structure.execution.action,
          direction: periodData.structure.execution.direction,
          setup_quality: periodData.structure.execution.setup_quality,
          rationale: periodData.structure.execution.rationale,
          timing_timeframe: periodData.structure.execution.timing_timeframe,
          timeframe_cap_ratio: periodData.structure.execution.timeframe_cap_ratio,
          trigger: periodData.structure.execution.trigger,
          invalidation: periodData.structure.execution.invalidation,
          confirmation: periodData.structure.execution.confirmation,
          entry_style: periodData.structure.execution.entry_style,
          position_sizing: periodData.structure.execution.position_sizing,
          t_trade_rule: periodData.structure.execution.t_trade_rule,
          risk_rules: periodData.structure.execution.risk_rules,
          take_profit_plan: periodData.structure.execution.take_profit_plan,
          key_levels: periodData.structure.execution.key_levels,
          risk_flags: periodData.structure.execution.risk_flags,
          wait_reason: periodData.structure.execution.wait_reason,
        })
      : undefined,
    latest_price: periodData.latest_price,
    price_change_pct: periodData.price_change_pct,
  });

  const prediction = periodData.structure?.structure_details?.prediction;
  if (level === 'daily' || level === 'hour30') {
    summary.prediction = compactRecord({
      current_stage: prediction?.current_stage,
      next_stage: prediction?.next_stage,
      prediction_alert: prediction?.prediction_alert,
      key_price_levels: prediction?.key_price_levels,
      confidence: prediction?.confidence,
      action_hint: prediction?.action_hint,
      unstable_point: prediction?.unstable_point,
      structure_perfect: prediction?.structure_perfect,
    });
  }

  if (level === 'daily') {
    summary.ma_physics = compactRecord({
      support_pressure_status: periodData.ma_physics?.support_pressure?.status,
      ma55_role: periodData.ma_physics?.support_pressure?.ma55_role,
      ma55_value: periodData.ma_physics?.support_pressure?.ma55_value,
      traction_force: periodData.ma_physics?.traction?.traction_force,
      deviation_ma55_pct: periodData.ma_physics?.traction?.deviation_ma55_pct,
      pullback_expected: periodData.ma_physics?.traction?.pullback_expected,
      resonance_strength: periodData.ma_physics?.resonance?.convergence_strength,
      resonance_zone: periodData.ma_physics?.resonance?.resonance_zone,
      key_signals: periodData.ma_physics?.key_signals,
    });

    summary.breakthrough = compactRecord({
      pattern_type: periodData.breakthrough?.pattern_type,
      direction: periodData.breakthrough?.direction,
      target_ma: periodData.breakthrough?.target_ma,
      is_valid: periodData.breakthrough?.is_valid,
      confidence: periodData.breakthrough?.confidence,
      t0_date: periodData.breakthrough?.t0_date,
      key_signals: periodData.breakthrough?.key_signals,
    });
  }

  return summary;
}

function summarizeLevelNesting(levelNesting: AnalysisResultData['level_nesting']) {
  if (!levelNesting) {
    return undefined;
  }

  const spacetimeConfirmation = levelNesting['spacetime_confirmation'] as
    | Record<string, unknown>
    | undefined;
  const tradingDecision = levelNesting['trading_decision'] as Record<string, unknown> | undefined;

  return compactRecord({
    summary: typeof levelNesting['summary'] === 'string' ? levelNesting['summary'] : undefined,
    spacetime_confirmation: spacetimeConfirmation
      ? compactRecord({
          space_confirmed: spacetimeConfirmation.space_confirmed,
          time_confirmed: spacetimeConfirmation.time_confirmed,
          spacetime_resonance: spacetimeConfirmation.spacetime_resonance,
          analysis: spacetimeConfirmation.analysis,
          space_analysis: spacetimeConfirmation.space_analysis,
          time_analysis: spacetimeConfirmation.time_analysis,
        })
      : undefined,
    trading_decision: tradingDecision
      ? compactRecord({
          decision_type: tradingDecision.decision_type,
          t_type: tradingDecision.t_type,
          analysis: tradingDecision.analysis,
          action_hint: tradingDecision.action_hint,
          analysis_order: tradingDecision.analysis_order,
          execution_order: tradingDecision.execution_order,
          core_questions: tradingDecision.core_questions,
        })
      : undefined,
  });
}

function summarizeMultiDimensionOperation(operation: AnalysisResultData['multi_dimension_operation']) {
  if (!operation) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(operation)
      .filter(([, value]) => value)
      .map(([dimension, value]) => {
        const item = value as Record<string, unknown>;
        const advice = item.advice as Record<string, unknown> | undefined;
        return [
          dimension,
          compactRecord({
            major_level: item.major_level,
            major_level_name: item.major_level_name,
            major_status: item.major_status,
            minor_level: item.minor_level,
            minor_level_name: item.minor_level_name,
            minor_structure: item.minor_structure,
            minor_trend: item.minor_trend,
            advice: advice
              ? compactRecord({
                  operation_advice: advice.operation_advice,
                  structure_match: advice.structure_match,
                  structure_direction: advice.structure_direction,
                  explanation: advice.explanation,
                })
              : undefined,
          }),
        ];
      })
  ) as Record<string, AiDecisionDimensionOperation>;
}

export function buildAiDecisionPayload(analysisData: AnalysisResultData): AiDecisionPayload {
  const periods: Record<string, AiDecisionPeriodSummary> = {};
  const allAlerts: string[] = [];

  for (const [level, periodData] of Object.entries(analysisData?.periods || {})) {
    const item = periodData as PeriodAnalysisData;
    if (item.error) {
      continue;
    }

    for (const alert of item.key_alerts || []) {
      allAlerts.push(`【${level}】${alert}`);
    }

    periods[level] = summarizePeriod(item, level);
  }

  return {
    stock_code: analysisData?.stock_code,
    stock_name: analysisData?.stock_name,
    analysis_time: analysisData?.analysis_time,
    periods,
    level_nesting: summarizeLevelNesting(analysisData?.level_nesting),
    multi_dimension_operation: summarizeMultiDimensionOperation(analysisData?.multi_dimension_operation),
    key_alerts: allAlerts.length > 0 ? allAlerts : null,
  };
}
