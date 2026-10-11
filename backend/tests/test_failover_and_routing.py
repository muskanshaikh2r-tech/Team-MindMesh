import pytest
from app.schemas.model import ModelConfig
from app.schemas.request import RouteRequest
from app.core.router import route_request

def test_successful_direct_route():
    models = [
        ModelConfig(id="mini", name="Mini", capability=1, cost_per_1k=0.0001, latency_ms=150, context_window=4096),
        ModelConfig(id="small", name="Small", capability=2, cost_per_1k=0.0005, latency_ms=300, context_window=8192),
        ModelConfig(id="large", name="Large", capability=5, cost_per_1k=0.015, latency_ms=2000, context_window=128000),
    ]
    req = RouteRequest(
        prompt="Translate hello to spanish",
        min_capability=1,
        max_latency_ms=1000.0,
        preference="lowest_cost",
        test_seed=42
    )
    res = route_request(req, models)
    assert res.success is True
    assert res.status_code == "SUCCESS"
    assert res.selected_model_id == "mini"
    assert len(res.execution_trace) == 1
    assert res.failover_occurred is False
    assert res.cost_savings_vs_large > 0.0

def test_safe_failover_on_force_fail():
    """
    Mini is cheapest valid model, but force_fail is True.
    System must safely fail over to Small (the next valid model in the list).
    """
    models = [
        ModelConfig(id="mini", name="Mini", capability=1, cost_per_1k=0.0001, latency_ms=150, context_window=4096, force_fail=True),
        ModelConfig(id="small", name="Small", capability=2, cost_per_1k=0.0005, latency_ms=300, context_window=8192),
        ModelConfig(id="large", name="Large", capability=5, cost_per_1k=0.015, latency_ms=2000, context_window=128000),
    ]
    req = RouteRequest(
        prompt="Define quantum computing briefly",
        min_capability=1,
        max_latency_ms=1000.0,
        preference="lowest_cost",
        test_seed=42
    )
    res = route_request(req, models)
    assert res.success is True
    assert res.selected_model_id == "small"
    assert res.failover_occurred is True
    assert len(res.execution_trace) == 2
    assert res.execution_trace[0].model_id == "mini"
    assert res.execution_trace[0].success is False
    assert "FORCE_FAIL" in res.execution_trace[0].error_reason
    assert res.execution_trace[1].model_id == "small"
    assert res.execution_trace[1].success is True

def test_failover_on_runtime_latency_exceeded():
    """
    Mini is valid at filter time (expected 150ms <= 1000ms),
    but force_slow causes it to exceed max_latency at runtime.
    Router must mark it as failed and fail over to Small.
    """
    models = [
        ModelConfig(id="mini", name="Mini", capability=1, cost_per_1k=0.0001, latency_ms=150, context_window=4096, force_slow=True),
        ModelConfig(id="small", name="Small", capability=2, cost_per_1k=0.0005, latency_ms=300, context_window=8192),
    ]
    req = RouteRequest(
        prompt="What is water made of?",
        min_capability=1,
        max_latency_ms=1000.0,
        preference="lowest_cost",
        test_seed=42
    )
    res = route_request(req, models)
    assert res.success is True
    assert res.selected_model_id == "small"
    assert res.failover_occurred is True
    assert "LATENCY_LIMIT_EXCEEDED_AT_RUNTIME" in res.execution_trace[0].error_reason

def test_distinct_no_valid_model_outcome():
    """
    No model satisfies the tight constraints.
    Returns: 'No valid model can satisfy all the requested constraints.'
    """
    models = [
        ModelConfig(id="mini", name="Mini", capability=1, cost_per_1k=0.0001, latency_ms=150, context_window=4096),
        ModelConfig(id="small", name="Small", capability=2, cost_per_1k=0.0005, latency_ms=300, context_window=8192),
    ]
    req = RouteRequest(
        prompt="Perform deep multithreaded debugging",
        min_capability=5, # Both Mini and Small fail capability!
        max_latency_ms=500.0
    )
    res = route_request(req, models)
    assert res.success is False
    assert res.status_code == "NO_VALID_MODEL"
    assert res.message == "No valid model can satisfy all the requested constraints."
    assert len(res.execution_trace) == 0
    assert len(res.valid_candidates_ranked) == 0

def test_distinct_all_valid_models_failed_outcome():
    """
    Models pass filter, but all fail during execution.
    Returns: 'All models that satisfied the request constraints failed during execution.'
    Never falls back to an invalid model!
    """
    models = [
        # Invalid model (rejected at filter stage):
        ModelConfig(id="weak", name="Weak", capability=1, cost_per_1k=0.0001, latency_ms=100, context_window=2000),
        # Valid models that both fail at runtime:
        ModelConfig(id="valid1", name="Valid 1", capability=3, cost_per_1k=0.002, latency_ms=400, context_window=16000, force_fail=True),
        ModelConfig(id="valid2", name="Valid 2", capability=3, cost_per_1k=0.003, latency_ms=500, context_window=16000, force_fail=True),
    ]
    req = RouteRequest(
        prompt="Write a python sorting script",
        min_capability=3, # 'weak' is rejected
        max_latency_ms=1000.0,
        preference="lowest_cost"
    )
    res = route_request(req, models)
    assert res.success is False
    assert res.status_code == "ALL_VALID_MODELS_FAILED"
    assert res.message == "All models that satisfied the request constraints failed during execution."
    # Never attempted 'weak'
    attempted_ids = [att.model_id for att in res.execution_trace]
    assert "weak" not in attempted_ids
    assert attempted_ids == ["valid1", "valid2"]
    # Total costs accumulated during attempts are preserved
    assert res.total_estimated_cost > 0.0
