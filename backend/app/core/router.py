import uuid
from datetime import datetime, timezone
from typing import List, Optional
from ..schemas.model import ModelConfig
from ..schemas.request import (
    RouteRequest, RouteResponse, TokenMetrics,
    ExecutionAttempt, ComplexityAnalysis
)
from ..estimator.signals import count_tokens
from ..estimator.complexity import analyze_complexity
from .filters import filter_all_models
from .ranking import rank_valid_models
from ..simulator.endpoints import execute_model_call

def build_audio_explanation(
    success: bool,
    status_code: str,
    selected_model: Optional[ModelConfig],
    complexity: ComplexityAnalysis,
    attempts: List[ExecutionAttempt],
    failover_occurred: bool,
    all_models_count: int,
    valid_count: int
) -> str:
    """
    Constructs an articulate, natural conversational script explaining the routing decision.
    Ideal for ElevenLabs-style speech synthesis / voice playground.
    """
    if not success:
        if status_code == "NO_VALID_MODEL":
            return (
                f"ModelRouter evaluated your request across all {all_models_count} available AI models. "
                f"However, none of the models could satisfy all your required constraints for latency, capability, context, or budget. "
                f"As per strict safety rules, no compromised fallback was dispatched."
            )
        else: # ALL_VALID_MODELS_FAILED
            return (
                f"ModelRouter identified {valid_count} models that satisfied your constraints. "
                f"However, all {len(attempts)} attempted candidate endpoints experienced runtime failure or exceeded latency limits. "
                f"To maintain integrity, the system halted rather than downgrading to an invalid model."
            )

    model_name = selected_model.name if selected_model else "the selected model"
    failover_text = ""
    if failover_occurred:
        failed_names = [att.model_name for att in attempts if not att.success]
        failover_text = f"Notice: An initial attempt on {', '.join(failed_names)} encountered an issue, so ModelRouter immediately failed over to {model_name} without violating any constraints. "

    return (
        f"Here's why ModelRouter selected {model_name}: "
        f"Your question was classified as a level {complexity.estimated_complexity} task. "
        f"{model_name} satisfies your minimum capability threshold and delivers the lowest cost with acceptable response time. "
        f"{failover_text}"
        f"All hard constraints have been completely verified."
    )

def route_request(request: RouteRequest, catalogue: List[ModelConfig]) -> RouteResponse:
    request_id = f"req_{uuid.uuid4().hex[:10]}"
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # ----------------------------------------------------
    # Step A: Estimate token requirements
    # ----------------------------------------------------
    input_tokens = count_tokens(request.prompt)
    output_tokens = request.expected_output_tokens
    explicit_context = request.context_override or 0
    required_context = max(explicit_context, input_tokens)
    
    token_metrics = TokenMetrics(
        estimated_input_tokens=input_tokens,
        expected_output_tokens=output_tokens,
        required_context=required_context
    )

    # ----------------------------------------------------
    # Step B: Estimate task complexity
    # ----------------------------------------------------
    complexity = analyze_complexity(request.prompt, manual_override=request.min_capability)
    effective_min_capability = complexity.estimated_complexity

    # ----------------------------------------------------
    # Step C: Filter every model against hard constraints
    # ----------------------------------------------------
    valid_models, all_evaluations = filter_all_models(
        models=catalogue,
        token_metrics=token_metrics,
        required_capability=effective_min_capability,
        max_latency_ms=request.max_latency_ms,
        max_cost=request.max_cost
    )

    # Calculate Large Model benchmark cost for savings comparison
    large_model = next((m for m in catalogue if m.id == "large"), None)
    if not large_model:
        large_model = max(catalogue, key=lambda m: m.capability) if catalogue else None
        
    benchmark_large_cost = 0.0
    if large_model:
        benchmark_large_cost = round(((input_tokens + output_tokens) / 1000.0) * large_model.cost_per_1k, 6)

    # Case 1: No model passes the filter (Section 4 Step E)
    if not valid_models:
        audio_text = build_audio_explanation(
            success=False,
            status_code="NO_VALID_MODEL",
            selected_model=None,
            complexity=complexity,
            attempts=[],
            failover_occurred=False,
            all_models_count=len(catalogue),
            valid_count=0
        )
        return RouteResponse(
            request_id=request_id,
            timestamp=timestamp,
            prompt=request.prompt,
            success=False,
            status_code="NO_VALID_MODEL",
            message="No valid model can satisfy all the requested constraints.",
            selected_model_id=None,
            selected_model_name=None,
            response_text=None,
            token_metrics=token_metrics,
            complexity_analysis=complexity,
            effective_min_capability=effective_min_capability,
            all_evaluations=all_evaluations,
            valid_candidates_ranked=[],
            winning_reason=None,
            execution_trace=[],
            total_observed_latency_ms=0.0,
            total_estimated_cost=0.0,
            cost_savings_vs_large=0.0,
            cost_savings_percent=0.0,
            failover_occurred=False,
            audio_script=audio_text
        )

    # ----------------------------------------------------
    # Step D: Rank valid models
    # ----------------------------------------------------
    ranked_models, ranking_details = rank_valid_models(
        valid_models=valid_models,
        evaluations=all_evaluations,
        preference=request.preference,
        token_metrics=token_metrics
    )
    ranked_ids = [m.id for m in ranked_models]
    winning_reason = ranking_details.get(ranked_ids[0], (1, "Top candidate based on selected preference"))[1]

    # ----------------------------------------------------
    # Step E & F: Execute with safe failover
    # ----------------------------------------------------
    execution_trace: List[ExecutionAttempt] = []
    successful_model: Optional[ModelConfig] = None
    final_response_text: Optional[str] = None
    total_cost_accumulated = 0.0
    total_latency_accumulated = 0.0

    eval_map = {e.model_id: e for e in all_evaluations}

    for attempt_idx, candidate in enumerate(ranked_models, start=1):
        candidate_eval = eval_map[candidate.id]
        attempt_cost = candidate_eval.estimated_cost
        total_cost_accumulated += attempt_cost

        attempt, res_text = execute_model_call(
            model=candidate,
            prompt=request.prompt,
            max_latency_ms=request.max_latency_ms,
            estimated_attempt_cost=attempt_cost,
            attempt_number=attempt_idx,
            test_seed=request.test_seed
        )
        execution_trace.append(attempt)
        total_latency_accumulated += attempt.observed_latency_ms

        if attempt.success:
            successful_model = candidate
            final_response_text = res_text
            break
        # If attempt failed, loop continues to the NEXT candidate in the SAME pre-filtered list

    # Check outcome
    failover_occurred = len(execution_trace) > 1

    if successful_model is not None:
        savings = max(0.0, benchmark_large_cost - total_cost_accumulated)
        savings_pct = round((savings / benchmark_large_cost) * 100, 1) if benchmark_large_cost > 0 else 0.0
        
        audio_text = build_audio_explanation(
            success=True,
            status_code="SUCCESS",
            selected_model=successful_model,
            complexity=complexity,
            attempts=execution_trace,
            failover_occurred=failover_occurred,
            all_models_count=len(catalogue),
            valid_count=len(ranked_models)
        )

        return RouteResponse(
            request_id=request_id,
            timestamp=timestamp,
            prompt=request.prompt,
            success=True,
            status_code="SUCCESS",
            message=f"Request successfully routed to {successful_model.name}." + (" (Failover occurred)" if failover_occurred else ""),
            selected_model_id=successful_model.id,
            selected_model_name=successful_model.name,
            response_text=final_response_text,
            token_metrics=token_metrics,
            complexity_analysis=complexity,
            effective_min_capability=effective_min_capability,
            all_evaluations=all_evaluations,
            valid_candidates_ranked=ranked_ids,
            winning_reason=winning_reason,
            execution_trace=execution_trace,
            total_observed_latency_ms=round(total_latency_accumulated, 1),
            total_estimated_cost=round(total_cost_accumulated, 6),
            cost_savings_vs_large=round(savings, 6),
            cost_savings_percent=savings_pct,
            failover_occurred=failover_occurred,
            audio_script=audio_text
        )
    else:
        # Case 2: All valid models failed at call time (Section 4 Step E)
        savings = 0.0
        audio_text = build_audio_explanation(
            success=False,
            status_code="ALL_VALID_MODELS_FAILED",
            selected_model=None,
            complexity=complexity,
            attempts=execution_trace,
            failover_occurred=failover_occurred,
            all_models_count=len(catalogue),
            valid_count=len(ranked_models)
        )

        return RouteResponse(
            request_id=request_id,
            timestamp=timestamp,
            prompt=request.prompt,
            success=False,
            status_code="ALL_VALID_MODELS_FAILED",
            message="All models that satisfied the request constraints failed during execution.",
            selected_model_id=None,
            selected_model_name=None,
            response_text=None,
            token_metrics=token_metrics,
            complexity_analysis=complexity,
            effective_min_capability=effective_min_capability,
            all_evaluations=all_evaluations,
            valid_candidates_ranked=ranked_ids,
            winning_reason=winning_reason,
            execution_trace=execution_trace,
            total_observed_latency_ms=round(total_latency_accumulated, 1),
            total_estimated_cost=round(total_cost_accumulated, 6),
            cost_savings_vs_large=0.0,
            cost_savings_percent=0.0,
            failover_occurred=failover_occurred,
            audio_script=audio_text
        )
