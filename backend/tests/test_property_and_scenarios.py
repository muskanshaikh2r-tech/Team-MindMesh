import random
import pytest
from app.schemas.model import ModelConfig, ModelUpdate
from app.schemas.request import RouteRequest
from app.core.router import route_request
from app.database import repository

def test_property_chosen_model_never_violates_any_constraint():
    """
    PROPERTY TEST:
    Over 50 randomized catalogues and request configurations,
    whenever a model is successfully selected, it MUST satisfy EVERY constraint:
    1. available == True
    2. capability >= effective_min_capability
    3. expected latency <= max_latency_ms (if specified)
    4. estimated cost <= max_cost (if specified)
    5. context_window >= required_context
    """
    rng = random.Random(1337)
    
    for i in range(50):
        # Generate random catalogue of 3-6 models
        catalogue = []
        for m_idx in range(rng.randint(3, 6)):
            catalogue.append(ModelConfig(
                id=f"m_{m_idx}",
                name=f"Model {m_idx}",
                capability=rng.randint(1, 5),
                cost_per_1k=round(rng.uniform(0.0001, 0.02), 5),
                latency_ms=round(rng.uniform(100, 2500), 1),
                context_window=rng.choice([2048, 4096, 8192, 16384, 32768, 131072]),
                available=rng.choice([True, True, True, False]), # 25% chance offline
                failure_rate=0.0 # Keep clean for constraint check
            ))
            
        req = RouteRequest(
            prompt="Property test prompt " * rng.randint(1, 20),
            max_latency_ms=rng.choice([None, 500.0, 1000.0, 2000.0, 3000.0]),
            max_cost=rng.choice([None, 0.001, 0.005, 0.02, 0.1]),
            min_capability=rng.choice([None, 1, 2, 3, 4, 5]),
            context_override=rng.choice([None, 4000, 10000]),
            preference=rng.choice(["lowest_cost", "lowest_latency", "highest_capability"]),
            test_seed=i
        )
        
        res = route_request(req, catalogue)
        
        if res.success:
            chosen = next(m for m in catalogue if m.id == res.selected_model_id)
            # 1. Must be available
            assert chosen.available is True
            # 2. Must meet capability
            assert chosen.capability >= res.effective_min_capability
            # 3. Expected latency within bound
            if req.max_latency_ms is not None:
                assert chosen.latency_ms <= req.max_latency_ms
            # 4. Context window sufficient
            assert chosen.context_window >= res.token_metrics.required_context
            # 5. Cost within budget
            eval_record = next(e for e in res.all_evaluations if e.model_id == chosen.id)
            if req.max_cost is not None:
                assert eval_record.estimated_cost <= req.max_cost

def test_live_configuration_changes_immediately_affect_outcome():
    """
    SPEC REQUIREMENT:
    'Judges can change a model's latency or availability and see a valid alternative chosen.
     Model settings must be editable live and take effect immediately.'
    """
    repository.init_db()
    repository.reset_models_to_defaults()
    
    req = RouteRequest(
        prompt="Explain basic sorting algorithms",
        min_capability=2,
        max_latency_ms=2500.0,
        preference="lowest_cost"
    )
    
    # Baseline: Small (cap 2, cost $0.0005) wins
    cat_before = repository.get_all_models()
    res_before = route_request(req, cat_before)
    assert res_before.success is True
    assert res_before.selected_model_id == "small"
    
    # Judge takes Small offline (available = False)
    repository.update_model("small", ModelUpdate(available=False))
    
    cat_after = repository.get_all_models()
    res_after = route_request(req, cat_after)
    assert res_after.success is True
    # Small is now rejected; Medium is automatically chosen!
    assert res_after.selected_model_id == "medium"
    small_eval = next(e for e in res_after.all_evaluations if e.model_id == "small")
    assert any("ENDPOINT_UNAVAILABLE" in r for r in small_eval.rejection_reasons)
    
    # Clean up
    repository.reset_models_to_defaults()
