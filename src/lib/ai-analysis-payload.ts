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
    }),
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
