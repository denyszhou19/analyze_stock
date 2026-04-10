export interface AiDecisionPayload {
  stock_code?: string;
  stock_name?: string;
  analysis_time?: string;
  periods: Record<string, Record<string, unknown>>;
  level_nesting?: Record<string, unknown>;
  multi_dimension_operation?: Record<string, unknown>;
  key_alerts: string[] | null;
}

function compactRecord<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

function summarizePeriod(periodData: any, level: string) {
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

function summarizeLevelNesting(levelNesting: any) {
  if (!levelNesting) {
    return undefined;
  }

  return compactRecord({
    summary: levelNesting.summary,
    spacetime_confirmation: levelNesting.spacetime_confirmation
      ? compactRecord({
          space_confirmed: levelNesting.spacetime_confirmation.space_confirmed,
          time_confirmed: levelNesting.spacetime_confirmation.time_confirmed,
          spacetime_resonance: levelNesting.spacetime_confirmation.spacetime_resonance,
          analysis: levelNesting.spacetime_confirmation.analysis,
          space_analysis: levelNesting.spacetime_confirmation.space_analysis,
          time_analysis: levelNesting.spacetime_confirmation.time_analysis,
        })
      : undefined,
    trading_decision: levelNesting.trading_decision
      ? compactRecord({
          decision_type: levelNesting.trading_decision.decision_type,
          t_type: levelNesting.trading_decision.t_type,
          analysis: levelNesting.trading_decision.analysis,
          action_hint: levelNesting.trading_decision.action_hint,
          analysis_order: levelNesting.trading_decision.analysis_order,
          execution_order: levelNesting.trading_decision.execution_order,
          core_questions: levelNesting.trading_decision.core_questions,
        })
      : undefined,
  });
}

function summarizeMultiDimensionOperation(operation: any) {
  if (!operation) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(operation)
      .filter(([, value]) => value)
      .map(([dimension, value]) => {
        const item = value as any;
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
            advice: item.advice
              ? compactRecord({
                  operation_advice: item.advice.operation_advice,
                  structure_match: item.advice.structure_match,
                  structure_direction: item.advice.structure_direction,
                  explanation: item.advice.explanation,
                })
              : undefined,
          }),
        ];
      })
  );
}

export function buildAiDecisionPayload(analysisData: any): AiDecisionPayload {
  const periods: Record<string, Record<string, unknown>> = {};
  const allAlerts: string[] = [];

  for (const [level, periodData] of Object.entries(analysisData?.periods || {})) {
    const item = periodData as any;
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
