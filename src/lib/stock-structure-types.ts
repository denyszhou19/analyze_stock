import type {
  StructureExplainabilityData,
  StructureRenderPayload,
} from '@/components/stock/StructureTopologySvg';

export interface StructureArchetypeAlternative {
  type?: string | null;
  confidence?: number | null;
  reason?: string | null;
}

export interface StructureInterpretationMacroBackground {
  label?: string | null;
  direction?: string | null;
  confidence?: string | null;
  basis?: string[] | null;
}

export interface StructureInterpretationAnchor {
  point_id?: string | null;
  price?: number | null;
  date?: string | null;
  semantic?: string | null;
}

export interface StructureInterpretationFocusStructure {
  focus_mode?: string | null;
  archetype_family?: string | null;
  archetype_label?: string | null;
  standard_qualification?: string | null;
  maturity?: string | null;
  directional_bias?: string | null;
  summary?: string | null;
  start_anchor?: StructureInterpretationAnchor | null;
  reference_origin?: StructureInterpretationAnchor | null;
  start_anchor_source?: string | null;
  explainability_status?: string | null;
  downgrade_reason?: string | null;
  qualification_reason?: string | null;
  display_reason?: string | null;
}

export interface StructureInterpretationCurrentLeg {
  last_confirmed_point_id?: string | null;
  live_point_id?: string | null;
  from_point_id?: string | null;
  to_point_id?: string | null;
  label?: string | null;
  direction?: string | null;
  status?: string | null;
}

export interface StructureInterpretationNextConfirmation {
  label?: string | null;
  type?: string | null;
  trigger?: string | null;
  target_point_id?: string | null;
}

export interface StructureInterpretationScenarioPath {
  code?: string | null;
  label?: string | null;
  trigger?: string | null;
  effect?: string | null;
}

export interface StructureInterpretationSpacetimeGate {
  parent_status?: string | null;
  allowed_child_structures?: string[] | null;
  child_structure_family?: string | null;
  standard_qualification?: string | null;
  child_structure_match?: boolean | null;
  resonance_enabled?: boolean | null;
  structure_readiness?: string | null;
  wait_reason?: string | null;
  required_confirmation?: string | null;
  explanation?: string | null;
}

export interface StructureInterpretation {
  macro_background?: StructureInterpretationMacroBackground | null;
  focus_structure?: StructureInterpretationFocusStructure | null;
  current_leg?: StructureInterpretationCurrentLeg | null;
  next_confirmation?: StructureInterpretationNextConfirmation | null;
  scenario_paths?: StructureInterpretationScenarioPath[] | null;
  spacetime_gate?: StructureInterpretationSpacetimeGate | null;
}

export interface StructureArchetype {
  primary?: string | null;
  maturity?: string | null;
  confidence?: string | null;
  reason?: string | null;
  alternatives?: StructureArchetypeAlternative[] | null;
}

export interface StructureExecutionPhase {
  code?: string;
  label?: string;
  bias?: string;
  tradable?: boolean;
  maturity?: string;
  reason?: string;
}

export interface StructureExecution {
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
  key_levels?: Array<{
    price: number;
    type: string;
    note?: string;
  }>;
  risk_flags?: string[];
  wait_reason?: string | null;
}

export interface StructureFractalPoint {
  index: number;
  date: string;
  high?: number;
  low?: number;
}

export interface StructureStroke {
  from_date: string;
  to_date: string;
  from_price: number;
  to_price: number;
  direction: string;
  length: number;
  from_type: string;
  to_type: string;
  is_current?: boolean;
}

export interface StructurePrediction {
  current_stage: string;
  next_stage: string;
  prediction_alert: string;
  key_price_levels: Array<{
    price: number;
    type: string;
    note: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  action_hint: string;
  unstable_point?: {
    is_unstable: boolean;
    type?: string | null;
  } | null;
  structure_perfect?: {
    is_perfect: boolean;
  } | null;
}

export interface StructurePeakAnalysis {
  is_peak_structure: boolean;
  peak_type: 'mountain_peak' | 'valley_bottom' | null;
  peak_price: number | null;
  peak_index: number | null;
  left_structure: string | null;
  right_structure: string | null;
  left_components: Array<{ type: string; strokes: unknown[] }>;
  right_components: Array<{ type: string; strokes: unknown[] }>;
  description: string;
}

export interface StructureLeftStructureWarning {
  type: 'mountain_peak_left' | 'valley_bottom_left';
  title: string;
  left_structure: string;
  peak_price?: number;
  valley_price?: number;
  warning?: string;
  opportunity?: string;
  risk_description?: string;
  opportunity_description?: string;
  key_defense?: string;
  key_resistance?: string;
  action_hint: string;
}

export interface StructureFocusOriginAnalysis {
  macro_origin?: {
    point_index?: number | null;
    price?: number | null;
    date?: string | null;
    source?: string | null;
  } | null;
  candidates?: Array<{
    kind?: string | null;
    point_index?: number | null;
    price?: number | null;
    date?: string | null;
    reason?: string | null;
    selected?: boolean | null;
  }> | null;
  selected_origin_kind?: string | null;
  selected_point_index?: number | null;
  explainability_status?: string | null;
  explainability_reason?: string | null;
}

export interface StructureRawClassification {
  type?: string | null;
  stage?: string | null;
  description?: string | null;
  component_summary?: string[] | null;
}

export interface StructureFocusClassification {
  type?: string | null;
  stage?: string | null;
  description?: string | null;
  archetype_family?: string | null;
  standard_qualification?: string | null;
  qualification_reason?: string | null;
  trend_direction?: string | null;
  component_summary?: string[] | null;
}

export interface StructureDetails {
  top_fractals: StructureFractalPoint[];
  bottom_fractals: StructureFractalPoint[];
  strokes: StructureStroke[];
  render_payload?: StructureRenderPayload;
  explainability?: StructureExplainabilityData | null;
  focus_origin_analysis?: StructureFocusOriginAnalysis | null;
  raw_classification?: StructureRawClassification | null;
  focus_classification?: StructureFocusClassification | null;
  judgment_criteria: string;
  prediction?: StructurePrediction | null;
  peak_analysis?: StructurePeakAnalysis | null;
  left_structure_warning?: StructureLeftStructureWarning | null;
}

export interface StructureData {
  structure_type: string;
  structure_stage: string;
  trend_direction: string;
  inflection_points: number;
  segment_count: number;
  description: string;
  interpretation?: StructureInterpretation | null;
  archetype?: StructureArchetype | null;
  execution_phase?: StructureExecutionPhase | null;
  execution?: StructureExecution | null;
  structure_details?: StructureDetails | null;
}

export interface MovingAveragesData {
  MA55?: number | null;
  MA233?: number | null;
  price_vs_ma55?: string | null;
  price_vs_ma233?: string | null;
  ma_status?: string | null;
  [key: string]: unknown;
}

export interface MacdData {
  status?: string | null;
  description?: string | null;
  divergence_note?: string | null;
  [key: string]: unknown;
}

export interface MaPhysicsData {
  support_pressure?: {
    status?: string | null;
    ma55_role?: string | null;
    ma55_value?: number | null;
  } | null;
  traction?: {
    deviation_ma55_pct?: number | null;
    traction_force?: string | null;
    pullback_expected?: boolean | null;
  } | null;
  resonance?: {
    convergence_strength?: string | null;
    resonance_zone?: string | null;
  } | null;
  key_signals?: string[] | null;
  [key: string]: unknown;
}

export interface BreakthroughData {
  pattern_type?: string | null;
  direction?: string | null;
  target_ma?: string | null;
  is_valid?: boolean | null;
  confidence?: string | null;
  t0_date?: string | null;
  key_signals?: string[] | null;
  [key: string]: unknown;
}

export interface StructureValidRange {
  start_date?: string | null;
  end_date?: string | null;
  start_price?: number | null;
  end_price?: number | null;
  origin_type?: string | null;
  break_type?: string | null;
}

export interface StructurePipelineDebug {
  analysis_kline_count?: number | null;
  processed_kline_count?: number | null;
  valid_range_applied?: boolean | null;
  render_window_size?: number | null;
}

export interface PeriodStructureDetailsData {
  prediction?: StructurePrediction | null;
  top_fractals?: Array<Partial<StructureFractalPoint>> | null;
  bottom_fractals?: Array<Partial<StructureFractalPoint>> | null;
  strokes?: Array<Partial<StructureStroke>> | null;
  render_payload?: Record<string, unknown> | null;
  explainability?: StructureExplainabilityData | null;
  focus_origin_analysis?: StructureFocusOriginAnalysis | null;
  raw_classification?: StructureRawClassification | null;
  focus_classification?: StructureFocusClassification | null;
  valid_range?: StructureValidRange | null;
  pipeline_debug?: StructurePipelineDebug | null;
  [key: string]: unknown;
}

export interface PeriodStructureData {
  structure_type?: string;
  structure_stage?: string;
  trend_direction?: string;
  inflection_points?: number;
  segment_count?: number;
  description?: string;
  interpretation?: Partial<StructureInterpretation> | null;
  archetype?: Partial<StructureArchetype> | null;
  execution_phase?: Partial<StructureExecutionPhase> | null;
  execution?: Partial<StructureExecution> | null;
  structure_details?: PeriodStructureDetailsData | null;
  [key: string]: unknown;
}

export interface PeriodAnalysisData {
  period?: string;
  error?: string;
  analysis_date?: string | null;
  latest_price?: number;
  price_change_pct?: number | null;
  volume?: number | null;
  moving_averages?: MovingAveragesData;
  ma_physics?: MaPhysicsData | null;
  breakthrough?: BreakthroughData | null;
  macd?: MacdData;
  structure?: PeriodStructureData | null;
  key_levels?: Record<string, unknown> | null;
  key_alerts?: string[] | null;
  trinity_decision?: TrinityDecision | null;
}

export interface AnalysisResultData {
  stock_code?: string;
  stock_name?: string;
  analysis_time?: string;
  periods: Record<string, PeriodAnalysisData>;
  level_nesting?: Record<string, unknown> | null;
  multi_dimension_operation?: Record<string, unknown> | null;
}

export interface TrinityAnchor {
  point_id?: string | null;
  price?: number | null;
  date?: string | null;
  source?: string | null;
  semantic?: string | null;
}

export type TrinityDecisionAction =
  | 'buy'
  | 'add'
  | 'hold'
  | 'reduce'
  | 'sell'
  | 't_trade'
  | 'wait'
  | 'avoid';

export type TrinityDecisionBias = 'bullish' | 'bearish' | 'neutral';

export type TrinityDecisionConfidence = 'high' | 'medium' | 'low';

export interface TrinityStructureBoundaries {
  upper?: number | null;
  lower?: number | null;
  mid?: number | null;
  breakout_trigger?: number | null;
  breakdown_trigger?: number | null;
  stop_loss?: number | null;
}

export type TrinityStructureNodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | Array<unknown>;

export type TrinityStructureNodeMap = Record<string, TrinityStructureNodeValue>;

export interface AiSummaryCard {
  headline: string;
  action: TrinityDecisionAction;
  bias: TrinityDecisionBias;
  primary_reason: string;
  triggers: string[];
  risks: string[];
  guardrail: string;
}

export interface TrinityConclusion {
  action: TrinityDecisionAction;
  action_label: string;
  bias: TrinityDecisionBias;
  confidence: TrinityDecisionConfidence;
  can_trade: boolean;
  wait_reason?: string | null;
}

export interface TrinityStructureDecision {
  background_origin?: TrinityAnchor | null;
  focus_origin?: TrinityAnchor | null;
  execution_origin?: TrinityAnchor | null;
  family: 'standard' | 'extended' | 'channel' | 'range' | 'unfinished' | 'complex';
  type:
    | 'A五段式'
    | 'B双平台式'
    | 'C单平台式'
    | 'D三段式'
    | '延伸A'
    | '延伸B'
    | '延伸C'
    | '延伸D'
    | '上升通道'
    | '下降通道'
    | '大平台震荡'
    | '未完成结构'
    | '复杂结构';
  standard_candidate?: 'A五段式' | 'B双平台式' | 'C单平台式' | 'D三段式' | null;
  qualification: 'standard' | 'extended' | 'over_limit' | 'unfinished' | 'failed';
  direction: 'up' | 'down' | 'neutral';
  boundaries: TrinityStructureBoundaries;
  node_map: TrinityStructureNodeMap;
  can_trade_by_structure_nodes: boolean;
  can_trade_by_boundaries: boolean;
  explainability: {
    status: 'passed' | 'downgraded' | 'failed';
    reason: string;
    evidence: string[];
  };
}

export interface TrinitySpacetimeDecision {
  status: string;
  direction_bias: 'bullish' | 'bearish' | 'neutral';
  expected_structures: { up: string[]; down: string[] };
  structure_match: boolean;
  mismatch_reason?: string | null;
  divergence_policy: {
    top_divergence_valid: boolean;
    bottom_divergence_valid: boolean;
    reason: string;
  };
}

export interface TrinityMovingAverageDecision {
  ma55_role: 'support' | 'resistance' | 'neutral';
  ma233_role: 'support' | 'resistance' | 'neutral';
  price_position: {
    above_ma55: boolean;
    above_ma233: boolean;
    deviation_ma55_pct?: number | null;
    deviation_ma233_pct?: number | null;
  };
  breakthrough_state:
    | 'none'
    | 'breakout_pending'
    | 'valid_breakout'
    | 'pullback_confirmed'
    | 'false_breakout'
    | 'breakdown_pending'
    | 'valid_breakdown'
    | 'pullback_breakdown_confirmed'
    | 'false_breakdown';
  ma_gate: {
    allow_long: boolean;
    allow_short: boolean;
    reason: string;
  };
}

export interface TrinityVolumeConfirmationDecision {
  volume_ratio_5?: number | null;
  volume_ratio_20?: number | null;
  amount_ratio_20?: number | null;
  turnover_rate?: number | null;
  volume_state: 'shrinking' | 'normal' | 'expanding' | 'climax' | 'unknown';
  breakout_volume: 'confirmed' | 'weak' | 'climax_risk' | 'not_applicable';
  breakdown_volume: 'confirmed' | 'weak' | 'climax_risk' | 'not_applicable';
  pullback_volume: 'healthy_shrink' | 'danger_expand' | 'normal' | 'not_applicable';
  volume_gate: {
    supports_breakout: boolean;
    supports_breakdown: boolean;
    supports_pullback_confirmation: boolean;
    confidence_adjustment: 'upgrade' | 'neutral' | 'downgrade';
    reason: string;
  };
}

export interface TrinityLevelNestingDecision {
  parent_level?: string | null;
  child_level?: string | null;
  parent_bias: 'bullish' | 'bearish' | 'neutral';
  child_signal: 'long' | 'short' | 'wait';
  resonance: 'aligned' | 'conflict' | 'child_countertrend' | 'parent_unclear';
  permission: {
    allow_position_increase: boolean;
    allow_t_trade: boolean;
    allow_only_light_probe: boolean;
    reason: string;
  };
}

export interface TrinityTradeQualification {
  trade_mode:
    | 'standard_node_trade'
    | 'conditional_boundary_trade'
    | 'wait_confirmation'
    | 'risk_control'
    | 'no_trade';
  position_permission:
    | 'full_signal'
    | 'half_position'
    | 'light_probe'
    | 't_trade_only'
    | 'reduce_only'
    | 'no_position';
  confidence: 'high' | 'medium' | 'low';
  reason: string[];
}

export interface TrinityExecutionDecision {
  entry_style: 'node' | 'boundary' | 'pullback' | 'breakout' | 't_trade' | 'none';
  triggers: string[];
  invalidation: string[];
  confirmation: string[];
  position_sizing: {
    max_ratio?: number | null;
    reason: string;
    upgrade_condition?: string | null;
    downgrade_condition?: string | null;
  };
  risk_flags: string[];
}

export interface TrinityJudgmentCriterion {
  category: 'structure' | 'spacetime' | 'moving_average' | 'volume' | 'level_nesting' | 'execution';
  label: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  detail: string;
}

export interface TrinityDecision {
  version: 'v2';
  level: 'weekly' | 'daily' | 'hour60' | 'hour30' | 'hour15';
  conclusion: TrinityConclusion;
  structure: TrinityStructureDecision;
  spacetime: TrinitySpacetimeDecision;
  moving_average: TrinityMovingAverageDecision;
  volume_confirmation: TrinityVolumeConfirmationDecision;
  level_nesting?: TrinityLevelNestingDecision;
  trade_qualification: TrinityTradeQualification;
  execution: TrinityExecutionDecision;
  judgment_criteria: TrinityJudgmentCriterion[];
  ai_summary_facts: string[];
}
