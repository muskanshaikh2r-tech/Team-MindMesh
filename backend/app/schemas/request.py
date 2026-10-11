from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field

class RouteRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User prompt text")
    max_latency_ms: Optional[float] = Field(default=None, ge=1.0, description="Maximum permitted latency in ms")
    max_cost: Optional[float] = Field(default=None, ge=0.0, description="Maximum permitted cost in USD")
    min_capability: Optional[int] = Field(default=None, ge=1, le=5, description="Manual minimum capability override (1-5)")
    context_override: Optional[int] = Field(default=None, ge=1, description="Optional manual context requirement override")
    expected_output_tokens: int = Field(default=500, ge=1, description="Expected response token count for cost estimation")
    preference: Literal["lowest_cost", "lowest_latency", "highest_capability"] = Field(
        default="lowest_cost", description="Ranking preference for valid models"
    )
    test_seed: Optional[int] = Field(default=None, description="Deterministic test seed for reproducible simulation")

class ComplexityAnalysis(BaseModel):
    estimated_complexity: int = Field(..., ge=1, le=5, description="Calculated task complexity level (1-5)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    signals: List[str] = Field(default_factory=list, description="Specific signals detected in prompt")
    explanation: str = Field(..., description="Human-readable rationale for the complexity estimate")
    rounded_up: bool = Field(default=False, description="True if conservative rounding up was applied due to uncertainty")
    estimator_type: str = Field(default="local_rules", description="local_rules or external_llm_fallback")
    raw_scores: Optional[Dict[str, float]] = Field(default=None, description="Detailed category scores")

class TokenMetrics(BaseModel):
    estimated_input_tokens: int = Field(..., description="Calculated as ceil(len(prompt)/4)")
    expected_output_tokens: int = Field(..., description="Expected output token count")
    required_context: int = Field(..., description="max(context_override or 0, estimated_input_tokens)")

class ModelEvaluation(BaseModel):
    model_id: str
    model_name: str
    is_valid: bool
    rejection_reasons: List[str] = Field(default_factory=list, description="All reasons why model was rejected (empty if valid)")
    estimated_cost: float
    expected_latency_ms: float
    capability: int
    context_window: int
    rank: Optional[int] = None
    ranking_rationale: Optional[str] = None

class ExecutionAttempt(BaseModel):
    model_id: str
    model_name: str
    attempt_number: int
    start_time: str
    end_time: str
    observed_latency_ms: float
    success: bool
    error_reason: Optional[str] = None
    estimated_attempt_cost: float

class RouteResponse(BaseModel):
    request_id: str
    timestamp: str
    prompt: str
    success: bool
    status_code: Literal["SUCCESS", "NO_VALID_MODEL", "ALL_VALID_MODELS_FAILED"]
    message: str
    selected_model_id: Optional[str] = None
    selected_model_name: Optional[str] = None
    response_text: Optional[str] = None
    token_metrics: TokenMetrics
    complexity_analysis: ComplexityAnalysis
    effective_min_capability: int
    all_evaluations: List[ModelEvaluation]
    valid_candidates_ranked: List[str]
    winning_reason: Optional[str] = None
    execution_trace: List[ExecutionAttempt]
    total_observed_latency_ms: float
    total_estimated_cost: float
    cost_savings_vs_large: float
    cost_savings_percent: float
    failover_occurred: bool
    audio_script: str
