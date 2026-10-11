import pytest
from app.schemas.model import ModelConfig
from app.schemas.request import TokenMetrics
from app.core.filters import filter_all_models
from app.core.ranking import rank_valid_models

def test_deterministic_ranking_lowest_cost():
    m1 = ModelConfig(id="m-cheap", name="Cheap", capability=2, cost_per_1k=0.001, latency_ms=500, context_window=8000)
    m2 = ModelConfig(id="m-pricier", name="Pricier", capability=3, cost_per_1k=0.003, latency_ms=200, context_window=8000)
    models = [m2, m1] # Unordered
    tokens = TokenMetrics(estimated_input_tokens=100, expected_output_tokens=400, required_context=100)
    
    valid, evals = filter_all_models(models, tokens, required_capability=2, max_latency_ms=1000, max_cost=0.01)
    ranked, details = rank_valid_models(valid, evals, preference="lowest_cost", token_metrics=tokens)
    
    assert [m.id for m in ranked] == ["m-cheap", "m-pricier"]
    assert details["m-cheap"][0] == 1
    assert "Ranked #1" in details["m-cheap"][1]

def test_deterministic_ranking_lowest_latency():
    m1 = ModelConfig(id="m-cheap", name="Cheap", capability=2, cost_per_1k=0.001, latency_ms=500, context_window=8000)
    m2 = ModelConfig(id="m-fast", name="Fast", capability=2, cost_per_1k=0.003, latency_ms=150, context_window=8000)
    models = [m1, m2]
    tokens = TokenMetrics(estimated_input_tokens=100, expected_output_tokens=400, required_context=100)
    
    valid, evals = filter_all_models(models, tokens, required_capability=2, max_latency_ms=1000, max_cost=0.01)
    ranked, details = rank_valid_models(valid, evals, preference="lowest_latency", token_metrics=tokens)
    
    assert [m.id for m in ranked] == ["m-fast", "m-cheap"]
    assert details["m-fast"][0] == 1

def test_deterministic_ranking_highest_capability():
    m1 = ModelConfig(id="m-small", name="Small", capability=2, cost_per_1k=0.001, latency_ms=200, context_window=8000)
    m2 = ModelConfig(id="m-expert", name="Expert", capability=5, cost_per_1k=0.010, latency_ms=800, context_window=32000)
    models = [m1, m2]
    tokens = TokenMetrics(estimated_input_tokens=100, expected_output_tokens=400, required_context=100)
    
    valid, evals = filter_all_models(models, tokens, required_capability=2, max_latency_ms=1000, max_cost=0.05)
    ranked, details = rank_valid_models(valid, evals, preference="highest_capability", token_metrics=tokens)
    
    assert [m.id for m in ranked] == ["m-expert", "m-small"]
    assert details["m-expert"][0] == 1

def test_deterministic_tie_breaking():
    # Identical cost and latency, tie-break by ID
    m_b = ModelConfig(id="b_model", name="B", capability=3, cost_per_1k=0.002, latency_ms=300, context_window=8000)
    m_a = ModelConfig(id="a_model", name="A", capability=3, cost_per_1k=0.002, latency_ms=300, context_window=8000)
    models = [m_b, m_a]
    tokens = TokenMetrics(estimated_input_tokens=100, expected_output_tokens=400, required_context=100)
    
    valid, evals = filter_all_models(models, tokens, required_capability=2, max_latency_ms=1000, max_cost=0.01)
    ranked, _ = rank_valid_models(valid, evals, preference="lowest_cost", token_metrics=tokens)
    
    assert [m.id for m in ranked] == ["a_model", "b_model"]
