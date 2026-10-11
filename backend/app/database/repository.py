import json
import sqlite3
from typing import List, Optional, Dict, Any
from .connection import get_db_connection, init_db
from ..schemas.model import ModelConfig, ModelUpdate

DEFAULT_MODELS: List[ModelConfig] = [
    ModelConfig(
        id="mini",
        name="Mini",
        provider="Simulator (Flash Tier)",
        capability=1,
        cost_per_1k=0.0001,
        latency_ms=150.0,
        context_window=4096,
        available=True,
        failure_rate=0.0,
        artificial_delay_ms=0.0,
        force_fail=False,
        force_slow=False,
        description="Ultra-fast, lowest-cost model for simple lookups, classification, and translations.",
        supported_tasks=["lookup", "classification", "translation", "short_summary"]
    ),
    ModelConfig(
        id="small",
        name="Small",
        provider="Simulator (Mini Tier)",
        capability=2,
        cost_per_1k=0.0005,
        latency_ms=300.0,
        context_window=8192,
        available=True,
        failure_rate=0.0,
        artificial_delay_ms=0.0,
        force_fail=False,
        force_slow=False,
        description="Efficient general-purpose model for concise explanations and structured formats.",
        supported_tasks=["explanations", "conversion", "rewriting", "structured_output"]
    ),
    ModelConfig(
        id="medium",
        name="Medium",
        provider="Simulator (Sonnet Tier)",
        capability=3,
        cost_per_1k=0.003,
        latency_ms=800.0,
        context_window=32768,
        available=True,
        failure_rate=0.0,
        artificial_delay_ms=0.0,
        force_fail=False,
        force_slow=False,
        description="High capability coding and multi-turn reasoning engine with strong balance.",
        supported_tasks=["coding", "analysis", "sql", "algorithms", "multi_turn"]
    ),
    ModelConfig(
        id="large",
        name="Large",
        provider="Simulator (Opus / Omni Tier)",
        capability=5,
        cost_per_1k=0.015,
        latency_ms=2000.0,
        context_window=131072,
        available=True,
        failure_rate=0.0,
        artificial_delay_ms=0.0,
        force_fail=False,
        force_slow=False,
        description="Frontier reasoning engine with massive context for legal, audit, and complex synthesis.",
        supported_tasks=["contracts", "formal_reasoning", "complex_synthesis", "deep_debugging"]
    )
]

def seed_default_models_if_empty():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM models")
    count = cursor.fetchone()[0]
    if count == 0:
        for m in DEFAULT_MODELS:
            cursor.execute("""
            INSERT INTO models (
                id, name, provider, capability, cost_per_1k, latency_ms,
                context_window, available, failure_rate, artificial_delay_ms,
                force_fail, force_slow, description, supported_tasks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                m.id, m.name, m.provider, m.capability, m.cost_per_1k, m.latency_ms,
                m.context_window, int(m.available), m.failure_rate, m.artificial_delay_ms,
                int(m.force_fail), int(m.force_slow), m.description, json.dumps(m.supported_tasks)
            ))
        conn.commit()
    conn.close()

def get_all_models() -> List[ModelConfig]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM models ORDER BY capability ASC, cost_per_1k ASC")
    rows = cursor.fetchall()
    conn.close()
    
    models = []
    for row in rows:
        tasks = []
        try:
            tasks = json.loads(row["supported_tasks"]) if row["supported_tasks"] else []
        except Exception:
            tasks = []
        models.append(ModelConfig(
            id=row["id"],
            name=row["name"],
            provider=row["provider"],
            capability=row["capability"],
            cost_per_1k=row["cost_per_1k"],
            latency_ms=row["latency_ms"],
            context_window=row["context_window"],
            available=bool(row["available"]),
            failure_rate=row["failure_rate"],
            artificial_delay_ms=row["artificial_delay_ms"],
            force_fail=bool(row["force_fail"]),
            force_slow=bool(row["force_slow"]),
            description=row["description"] or "",
            supported_tasks=tasks
        ))
    return models

def get_model_by_id(model_id: str) -> Optional[ModelConfig]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM models WHERE id = ?", (model_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    try:
        tasks = json.loads(row["supported_tasks"]) if row["supported_tasks"] else []
    except Exception:
        tasks = []
    return ModelConfig(
        id=row["id"],
        name=row["name"],
        provider=row["provider"],
        capability=row["capability"],
        cost_per_1k=row["cost_per_1k"],
        latency_ms=row["latency_ms"],
        context_window=row["context_window"],
        available=bool(row["available"]),
        failure_rate=row["failure_rate"],
        artificial_delay_ms=row["artificial_delay_ms"],
        force_fail=bool(row["force_fail"]),
        force_slow=bool(row["force_slow"]),
        description=row["description"] or "",
        supported_tasks=tasks
    )

def update_model(model_id: str, updates: ModelUpdate) -> Optional[ModelConfig]:
    existing = get_model_by_id(model_id)
    if not existing:
        return None
    
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        return existing
        
    set_clauses = []
    params = []
    for k, v in update_data.items():
        if k == "supported_tasks" and v is not None:
            set_clauses.append("supported_tasks = ?")
            params.append(json.dumps(v))
        elif isinstance(v, bool):
            set_clauses.append(f"{k} = ?")
            params.append(int(v))
        else:
            set_clauses.append(f"{k} = ?")
            params.append(v)
            
    params.append(model_id)
    query = f"UPDATE models SET {', '.join(set_clauses)} WHERE id = ?"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()
    
    return get_model_by_id(model_id)

def reset_models_to_defaults():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM models")
    for m in DEFAULT_MODELS:
        cursor.execute("""
        INSERT INTO models (
            id, name, provider, capability, cost_per_1k, latency_ms,
            context_window, available, failure_rate, artificial_delay_ms,
            force_fail, force_slow, description, supported_tasks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            m.id, m.name, m.provider, m.capability, m.cost_per_1k, m.latency_ms,
            m.context_window, int(m.available), m.failure_rate, m.artificial_delay_ms,
            int(m.force_fail), int(m.force_slow), m.description, json.dumps(m.supported_tasks)
        ))
    conn.commit()
    conn.close()

def save_request_history(response_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO requests (
        id, timestamp, prompt, status_code, success, selected_model_id,
        total_observed_latency_ms, total_estimated_cost, cost_savings_vs_large,
        attempts_count, failover_occurred, full_response_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        response_data["request_id"],
        response_data["timestamp"],
        response_data["prompt"],
        response_data["status_code"],
        int(response_data["success"]),
        response_data.get("selected_model_id"),
        response_data["total_observed_latency_ms"],
        response_data["total_estimated_cost"],
        response_data.get("cost_savings_vs_large", 0.0),
        len(response_data.get("execution_trace", [])),
        int(response_data.get("failover_occurred", False)),
        json.dumps(response_data)
    ))
    conn.commit()
    conn.close()

def get_history(limit: int = 50, offset: int = 0, status_filter: Optional[str] = None, model_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    where_clauses = []
    params = []
    
    if status_filter:
        where_clauses.append("status_code = ?")
        params.append(status_filter)
    if model_filter:
        where_clauses.append("selected_model_id = ?")
        params.append(model_filter)
        
    where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query = f"SELECT * FROM requests {where_str} ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "prompt": r["prompt"],
            "status_code": r["status_code"],
            "success": bool(r["success"]),
            "selected_model_id": r["selected_model_id"],
            "total_observed_latency_ms": r["total_observed_latency_ms"],
            "total_estimated_cost": r["total_estimated_cost"],
            "cost_savings_vs_large": r["cost_savings_vs_large"],
            "attempts_count": r["attempts_count"],
            "failover_occurred": bool(r["failover_occurred"]),
            "full_response": json.loads(r["full_response_json"])
        })
    return result

def get_request_by_id(request_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT full_response_json FROM requests WHERE id = ?", (request_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["full_response_json"])

def get_dashboard_metrics() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM requests")
    total_requests = cursor.fetchone()[0]
    
    if total_requests == 0:
        conn.close()
        return {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "success_rate_percent": 100.0,
            "avg_latency_ms": 0.0,
            "total_estimated_cost": 0.0,
            "total_savings_vs_large": 0.0,
            "savings_percent": 0.0,
            "model_usage": {},
            "model_failure_counts": {},
            "recent_requests": []
        }
        
    cursor.execute("SELECT COUNT(*) FROM requests WHERE success = 1")
    successful = cursor.fetchone()[0]
    failed = total_requests - successful
    
    cursor.execute("SELECT AVG(total_observed_latency_ms), SUM(total_estimated_cost), SUM(cost_savings_vs_large) FROM requests")
    avg_lat, total_cost, total_savings = cursor.fetchone()
    avg_lat = round(avg_lat or 0.0, 1)
    total_cost = round(total_cost or 0.0, 6)
    total_savings = round(total_savings or 0.0, 6)
    
    # Model distribution
    cursor.execute("SELECT selected_model_id, COUNT(*) FROM requests WHERE selected_model_id IS NOT NULL GROUP BY selected_model_id")
    model_usage = {row[0]: row[1] for row in cursor.fetchall()}
    
    # Failures per model from full_response_json execution traces
    cursor.execute("SELECT full_response_json FROM requests")
    rows = cursor.fetchall()
    model_failures: Dict[str, int] = {}
    
    for row in rows:
        try:
            data = json.loads(row[0])
            for att in data.get("execution_trace", []):
                if not att.get("success"):
                    mid = att.get("model_id", "unknown")
                    model_failures[mid] = model_failures.get(mid, 0) + 1
        except Exception:
            pass
            
    conn.close()
    
    savings_percent = round((total_savings / max(0.000001, (total_cost + total_savings))) * 100, 1) if (total_cost + total_savings) > 0 else 0.0
    
    return {
        "total_requests": total_requests,
        "successful_requests": successful,
        "failed_requests": failed,
        "success_rate_percent": round((successful / total_requests) * 100, 1) if total_requests else 0.0,
        "avg_latency_ms": avg_lat,
        "total_estimated_cost": total_cost,
        "total_savings_vs_large": total_savings,
        "savings_percent": savings_percent,
        "model_usage": model_usage,
        "model_failure_counts": model_failures
    }
