export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  capability: number; // 1-5
  cost_per_1k: number;
  latency_ms: number;
  context_window: number;
  available: boolean;
  failure_rate: number;
  artificial_delay_ms: number;
  force_fail: boolean;
  force_slow: boolean;
  description: string;
  supported_tasks: string[];
}

export interface ModelUpdate {
  name?: string;
  provider?: string;
  capability?: number;
  cost_per_1k?: number;
  latency_ms?: number;
  context_window?: number;
  available?: boolean;
  failure_rate?: number;
  artificial_delay_ms?: number;
  force_fail?: boolean;
  force_slow?: boolean;
  description?: string;
}

export type PreferenceType = 'lowest_cost' | 'lowest_latency' | 'highest_capability';

export interface RouteRequest {
  prompt: string;
  max_latency_ms?: number | null;
  max_cost?: number | null;
  min_capability?: number | null;
  context_override?: number | null;
  expected_output_tokens?: number;
  preference: PreferenceType;
  test_seed?: number | null;
}

export interface ComplexityAnalysis {
  estimated_complexity: number;
  confidence: number;
  signals: string[];
  explanation: string;
  rounded_up: boolean;
  estimator_type: string;
  raw_scores?: Record<string, number>;
}

export interface TokenMetrics {
  estimated_input_tokens: number;
  expected_output_tokens: number;
  required_context: number;
}

export interface ModelEvaluation {
  model_id: string;
  model_name: string;
  is_valid: boolean;
  rejection_reasons: string[];
  estimated_cost: number;
  expected_latency_ms: number;
  capability: number;
  context_window: number;
  rank?: number | null;
  ranking_rationale?: string | null;
}

export interface ExecutionAttempt {
  model_id: string;
  model_name: string;
  attempt_number: number;
  start_time: string;
  end_time: string;
  observed_latency_ms: number;
  success: boolean;
  error_reason?: string | null;
  estimated_attempt_cost: number;
}

export interface RouteResponse {
  request_id: string;
  timestamp: string;
  prompt: string;
  success: boolean;
  status_code: 'SUCCESS' | 'NO_VALID_MODEL' | 'ALL_VALID_MODELS_FAILED';
  message: string;
  selected_model_id?: string | null;
  selected_model_name?: string | null;
  response_text?: string | null;
  token_metrics: TokenMetrics;
  complexity_analysis: ComplexityAnalysis;
  effective_min_capability: number;
  all_evaluations: ModelEvaluation[];
  valid_candidates_ranked: string[];
  winning_reason?: string | null;
  execution_trace: ExecutionAttempt[];
  total_observed_latency_ms: number;
  total_estimated_cost: number;
  cost_savings_vs_large: number;
  cost_savings_percent: number;
  failover_occurred: boolean;
  audio_script: string;
}

export interface RequestHistoryItem {
  id: string;
  timestamp: string;
  prompt: string;
  status_code: string;
  success: boolean;
  selected_model_id?: string | null;
  total_observed_latency_ms: number;
  total_estimated_cost: number;
  cost_savings_vs_large: number;
  attempts_count: number;
  failover_occurred: boolean;
  full_response: RouteResponse;
}

export interface DashboardMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate_percent: number;
  avg_latency_ms: number;
  total_estimated_cost: number;
  total_savings_vs_large: number;
  savings_percent: number;
  model_usage: Record<string, number>;
  model_failure_counts: Record<string, number>;
}

export interface DemoScenario {
  id: number;
  title: string;
  description: string;
  prompt: string;
  max_latency_ms?: number | null;
  max_cost?: number | null;
  min_capability?: number | null;
  context_override?: number | null;
  preference: PreferenceType;
  expected_behavior: string;
}
