import pytest
from app.schemas.model import ModelConfig
from app.schemas.request import TokenMetrics
from app.core.filters import evaluate_model_constraints, filter_all_models

def test_model_satisfies_all_constraints():
    model = ModelConfig(
        id="test-model",
        name="Test Model",
        capability=3,
        cost_per_1k=0.002,
        latency_ms=500.0,
        context_window=16000,
        available=True
    )
    tokens = TokenMetrics(
        estimated_input_tokens=100,
        expected_output_tokens=400,
        required_context=100
    )
    res = evaluate_model_constraints(
        model=model,
        token_metrics=tokens,
        required_capability=2,
        max_latency_ms=1000.0,
        max_cost=0.01
    )
    assert res.is_valid is True
    assert len(res.rejection_reasons) == 0

def test_single_constraint_rejections():
    tokens = TokenMetrics(
        estimated_input_tokens=100,
        expected_output_tokens=400,
        required_context=100
    )
    
    # 1. Unavailable
    m1 = ModelConfig(id="m1", name="M1", capability=3, cost_per_1k=0.001, latency_ms=100, context_window=8000, available=False)
    r1 = evaluate_model_constraints(m1, tokens, required_capability=2, max_latency_ms=500, max_cost=0.01)
    assert r1.is_valid is False
    assert any("ENDPOINT_UNAVAILABLE" in reason for reason in r1.rejection_reasons)

    # 2. Capability too low
    m2 = ModelConfig(id="m2", name="M2", capability=1, cost_per_1k=0.001, latency_ms=100, context_window=8000, available=True)
    r2 = evaluate_model_constraints(m2, tokens, required_capability=3, max_latency_ms=500, max_cost=0.01)
    assert r2.is_valid is False
    assert any("CAPABILITY_TOO_LOW" in reason for reason in r2.rejection_reasons)

    # 3. Latency limit exceeded
    m3 = ModelConfig(id="m3", name="M3", capability=3, cost_per_1k=0.001, latency_ms=800, context_window=8000, available=True)
    r3 = evaluate_model_constraints(m3, tokens, required_capability=2, max_latency_ms=500, max_cost=0.01)
    assert r3.is_valid is False
    assert any("LATENCY_LIMIT_EXCEEDED" in reason for reason in r3.rejection_reasons)

    # 4. Cost limit exceeded
    # Total tokens = 500. 500 / 1000 * 0.05 = $0.025 > $0.005
    m4 = ModelConfig(id="m4", name="M4", capability=3, cost_per_1k=0.05, latency_ms=100, context_window=8000, available=True)
    r4 = evaluate_model_constraints(m4, tokens, required_capability=2, max_latency_ms=500, max_cost=0.005)
    assert r4.is_valid is False
    assert any("COST_LIMIT_EXCEEDED" in reason for reason in r4.rejection_reasons)

    # 5. Context window too small
    tokens_big = TokenMetrics(estimated_input_tokens=5000, expected_output_tokens=500, required_context=12000)
    m5 = ModelConfig(id="m5", name="M5", capability=3, cost_per_1k=0.001, latency_ms=100, context_window=8000, available=True)
    r5 = evaluate_model_constraints(m5, tokens_big, required_capability=2, max_latency_ms=500, max_cost=0.01)
    assert r5.is_valid is False
    assert any("CONTEXT_WINDOW_TOO_SMALL" in reason for reason in r5.rejection_reasons)

def test_multiple_violations_recorded_together():
    """
    CRITICAL SPEC REQUIREMENT:
    'For every rejected model, record every applicable rejection reason. Never stop at the first violation.'
    """
    m = ModelConfig(
        id="broken",
        name="Broken",
        capability=1, # Violates cap (needs 4)
        cost_per_1k=0.05, # Violates cost (needs <= 0.001)
        latency_ms=2500, # Violates latency (needs <= 500)
        context_window=2000, # Violates context (needs 10000)
        available=False # Violates availability
    )
    tokens = TokenMetrics(estimated_input_tokens=1000, expected_output_tokens=500, required_context=10000)
    eval_res = evaluate_model_constraints(
        model=m,
        token_metrics=tokens,
        required_capability=4,
        max_latency_ms=500.0,
        max_cost=0.001
    )
    assert eval_res.is_valid is False
    assert len(eval_res.rejection_reasons) == 5
    codes = [r.split(":")[0] for r in eval_res.rejection_reasons]
    assert "ENDPOINT_UNAVAILABLE" in codes
    assert "CAPABILITY_TOO_LOW" in codes
    assert "LATENCY_LIMIT_EXCEEDED" in codes
    assert "COST_LIMIT_EXCEEDED" in codes
    assert "CONTEXT_WINDOW_TOO_SMALL" in codes
