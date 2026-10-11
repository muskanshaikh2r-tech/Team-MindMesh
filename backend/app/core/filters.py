from typing import List, Optional, Tuple
from ..schemas.model import ModelConfig
from ..schemas.request import ModelEvaluation, TokenMetrics

def evaluate_model_constraints(
    model: ModelConfig,
    token_metrics: TokenMetrics,
    required_capability: int,
    max_latency_ms: Optional[float],
    max_cost: Optional[float]
) -> ModelEvaluation:
    """
    Evaluates every hard constraint against the model.
    CRITICAL RULE: Collects ALL rejection reasons. Never stops at the first violation.
    Does not trade off constraints.
    """
    reasons: List[str] = []
    
    # Calculate estimated request cost
    total_tokens = token_metrics.estimated_input_tokens + token_metrics.expected_output_tokens
    estimated_cost = round((total_tokens / 1000.0) * model.cost_per_1k, 6)
    
    # 1. Availability constraint
    if not model.available:
        reasons.append("ENDPOINT_UNAVAILABLE: Model endpoint is marked offline or unavailable.")

    # 2. Capability constraint
    if model.capability < required_capability:
        reasons.append(
            f"CAPABILITY_TOO_LOW: Model capability ({model.capability}) is below required minimum ({required_capability})."
        )

    # 3. Latency constraint
    if max_latency_ms is not None and model.latency_ms > max_latency_ms:
        reasons.append(
            f"LATENCY_LIMIT_EXCEEDED: Expected latency ({model.latency_ms:.0f}ms) exceeds maximum permitted ({max_latency_ms:.0f}ms)."
        )

    # 4. Cost constraint
    if max_cost is not None and estimated_cost > max_cost:
        reasons.append(
            f"COST_LIMIT_EXCEEDED: Estimated cost (${estimated_cost:.6f}) exceeds maximum budget (${max_cost:.6f})."
        )

    # 5. Context window constraint
    if model.context_window < token_metrics.required_context:
        reasons.append(
            f"CONTEXT_WINDOW_TOO_SMALL: Context window ({model.context_window:,} tokens) is smaller than required context ({token_metrics.required_context:,} tokens)."
        )

    is_valid = len(reasons) == 0

    return ModelEvaluation(
        model_id=model.id,
        model_name=model.name,
        is_valid=is_valid,
        rejection_reasons=reasons,
        estimated_cost=estimated_cost,
        expected_latency_ms=model.latency_ms,
        capability=model.capability,
        context_window=model.context_window,
        rank=None,
        ranking_rationale=None
    )

def filter_all_models(
    models: List[ModelConfig],
    token_metrics: TokenMetrics,
    required_capability: int,
    max_latency_ms: Optional[float],
    max_cost: Optional[float]
) -> Tuple[List[ModelConfig], List[ModelEvaluation]]:
    """
    Filters all catalogue models against constraints.
    Returns:
      - valid_models: list of ModelConfig that passed every constraint
      - all_evaluations: list of ModelEvaluation for every candidate model
    """
    valid_models: List[ModelConfig] = []
    evaluations: List[ModelEvaluation] = []
    model_map = {m.id: m for m in models}

    for model in models:
        eval_result = evaluate_model_constraints(
            model=model,
            token_metrics=token_metrics,
            required_capability=required_capability,
            max_latency_ms=max_latency_ms,
            max_cost=max_cost
        )
        evaluations.append(eval_result)
        if eval_result.is_valid:
            valid_models.append(model)

    return valid_models, evaluations
