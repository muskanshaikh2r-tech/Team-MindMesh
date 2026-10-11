from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from ..schemas.model import ModelConfig, ModelUpdate
from ..schemas.request import RouteRequest, RouteResponse, ComplexityAnalysis
from ..database import repository
from ..core.router import route_request
from ..estimator.complexity import analyze_complexity

router = APIRouter(prefix="/api")

@router.get("/models", response_model=List[ModelConfig])
def get_models():
    """Retrieve all models from the catalogue."""
    return repository.get_all_models()

@router.get("/models/{model_id}", response_model=ModelConfig)
def get_model(model_id: str):
    """Retrieve a single model by ID."""
    model = repository.get_model_by_id(model_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")
    return model

@router.put("/models/{model_id}", response_model=ModelConfig)
def update_model(model_id: str, updates: ModelUpdate):
    """Update model settings (latency, cost, availability, force-fail, force-slow, etc.)."""
    updated = repository.update_model(model_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")
    return updated

@router.post("/models/reset", response_model=List[ModelConfig])
def reset_models():
    """Reset all models to factory default values."""
    repository.reset_models_to_defaults()
    return repository.get_all_models()

@router.post("/route", response_model=RouteResponse)
def execute_routing(request: RouteRequest):
    """
    Main routing gateway endpoint:
    Filter -> Rank -> Try with safe failover.
    Persists decision trace to SQLite request history.
    """
    catalogue = repository.get_all_models()
    response = route_request(request, catalogue)
    # Save to persistent history
    repository.save_request_history(response.model_dump())
    return response

@router.post("/estimate", response_model=ComplexityAnalysis)
def preview_complexity(prompt: str = Query(..., min_length=1), manual_override: Optional[int] = None):
    """Quickly estimate prompt complexity and required capability."""
    return analyze_complexity(prompt, manual_override=manual_override)

@router.get("/history")
def get_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    model: Optional[str] = Query(None)
):
    """Fetch persistent request history with optional status or model filtering."""
    return repository.get_history(limit=limit, offset=offset, status_filter=status, model_filter=model)

@router.get("/history/{request_id}")
def get_history_detail(request_id: str):
    """Fetch full audit trace of a specific past request."""
    item = repository.get_request_by_id(request_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Request '{request_id}' not found.")
    return item

@router.get("/dashboard")
def get_dashboard():
    """Fetch aggregated system metrics and cost savings."""
    return repository.get_dashboard_metrics()

@router.get("/scenarios")
def get_demo_scenarios():
    """
    Provides the 7 official judge demo scenarios from ModelRouter A-01 specification.
    Allows 1-click execution in the UI.
    """
    return [
        {
            "id": 1,
            "title": "Scenario 1: Simple question, loose limits",
            "description": "Cheapest capable model is chosen. A simple factual query needs only capability 1.",
            "prompt": "What is the capital of France and what is the official language?",
            "max_latency_ms": 3000.0,
            "max_cost": 0.05,
            "min_capability": None,
            "context_override": None,
            "preference": "lowest_cost",
            "expected_behavior": "Mini (capability 1, cost $0.0001) is chosen as the cheapest valid model."
        },
        {
            "id": 2,
            "title": "Scenario 2: Long contract analysis",
            "description": "High context requirement and high complexity. Only Large satisfies both capability >= 4 and context >= 10K.",
            "prompt": "Review this 40-page commercial vendor master service agreement: Analyze the indemnification covenants, IP ownership transfer, limitation of liability carve-outs, and breach cure period compliance.",
            "max_latency_ms": 5000.0,
            "max_cost": 0.10,
            "min_capability": 4,
            "context_override": 10000,
            "preference": "lowest_cost",
            "expected_behavior": "Only Large passes both context (128K >= 10K) and capability (5 >= 4). Mini, Small, Medium rejected."
        },
        {
            "id": 3,
            "title": "Scenario 3: Tight cost cap on a hard task",
            "description": "Hard task requires high capability, but cost budget is unrealistically tiny. The router must reject all models, never downgrade.",
            "prompt": "Formally verify and debug this multithreaded distributed Raft consensus implementation for race conditions and deadlocks under Byzantine faults.",
            "max_latency_ms": 5000.0,
            "max_cost": 0.00005,
            "min_capability": 4,
            "context_override": None,
            "preference": "lowest_cost",
            "expected_behavior": "Returns explicit 'No valid model can satisfy all the requested constraints' with clear reasons. Never silently downgrades."
        },
        {
            "id": 4,
            "title": "Scenario 4: Judge marks chosen model unavailable",
            "description": "Simulates endpoint outage. If the preferred model is toggled unavailable, router selects the next valid candidate.",
            "prompt": "Explain the difference between optimistic and pessimistic locking in database transactions with pros and cons.",
            "max_latency_ms": 2500.0,
            "max_cost": 0.05,
            "min_capability": 2,
            "context_override": None,
            "preference": "lowest_cost",
            "expected_behavior": "If Small is toggled unavailable, router automatically rejects Small with 'ENDPOINT_UNAVAILABLE' and chooses Medium."
        },
        {
            "id": 5,
            "title": "Scenario 5: Judge forces chosen model slow",
            "description": "Runtime failover demonstration. Chosen model exceeds latency cap at call time; router fails over to next valid model.",
            "prompt": "Write a clean Python function to find all anagrams in a list of words with unit tests.",
            "max_latency_ms": 1200.0,
            "max_cost": 0.05,
            "min_capability": 2,
            "context_override": None,
            "preference": "lowest_cost",
            "expected_behavior": "If Small is forced slow, runtime latency exceeds 1200ms -> fails over to Medium (which finishes within 1200ms)."
        },
        {
            "id": 6,
            "title": "Scenario 6: Ambiguous prompt (Uncertainty rule)",
            "description": "Vague or borderline prompt causes confidence < 0.60. Router safely rounds UP the capability requirement, never down.",
            "prompt": "tell me about this system and what to do next",
            "max_latency_ms": 3000.0,
            "max_cost": 0.05,
            "min_capability": None,
            "context_override": None,
            "preference": "lowest_cost",
            "expected_behavior": "Complexity estimator yields low confidence (<0.60) and rounds required capability UP from 1 to 2 for safety."
        },
        {
            "id": 7,
            "title": "Scenario 7: Switch preference to lowest latency",
            "description": "Changing optimization preference from lowest cost to lowest latency selects a faster model even if slightly more expensive.",
            "prompt": "Generate a concise JSON schema for a customer order record.",
            "max_latency_ms": 3000.0,
            "max_cost": 0.05,
            "min_capability": 1,
            "context_override": None,
            "preference": "lowest_latency",
            "expected_behavior": "Mini wins with 150ms expected latency, beating other models on speed."
        }
    ]
