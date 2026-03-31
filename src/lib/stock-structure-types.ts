import type {
  StructureExplainabilityData,
  StructureRenderPayload,
} from '@/components/stock/StructureTopologySvg';

export interface StructureArchetypeAlternative {
  type?: string | null;
  confidence?: number | null;
  reason?: string | null;
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

export interface StructureDetails {
  top_fractals: StructureFractalPoint[];
  bottom_fractals: StructureFractalPoint[];
  strokes: StructureStroke[];
  render_payload?: StructureRenderPayload;
  explainability?: StructureExplainabilityData | null;
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
  archetype?: StructureArchetype | null;
  execution_phase?: StructureExecutionPhase | null;
  execution?: StructureExecution | null;
  structure_details?: StructureDetails | null;
}
