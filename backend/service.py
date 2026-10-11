"""Orchestration: analyse -> evaluate -> execute (with fallback) -> explain -> record."""
import json

import database
from fallback import execute_with_fallback
from models_registry import registry
from request_analyzer import analyze
from routing_engine import Preferences, evaluate, explain, BUDGET_LABELS


def _fmt_model(c):
    d = c.model.to_dict()
    d.update(eligible=c.eligible, score=c.score, est_cost_usd=c.est_cost,
             reasons_rejected=c.reasons_rejected)
    return d


def route_request(user_id, prompt, prefs: Preferences, scenario=None, record=True, rng=None):
    analysis = analyze(prompt)
    models, overrides = registry.effective(scenario)
    ranked, candidates, need_cap = evaluate(models, analysis, prefs)

    result = {
        "prompt": prompt,
        "category": analysis.category,
        "complexity": analysis.complexity,
        "input_tokens": analysis.input_tokens,
        "signals": analysis.signals,
        "preferences": prefs.__dict__.copy(),
        "required_capability": need_cap,
        "candidates": [_fmt_model(c) for c in candidates],
        "eligible_count": len(ranked),
        "rejected_count": len(candidates) - len(ranked),
        "selected_model": None, "response": None, "fallback_used": False,
        "attempts": [], "reasons": [], "explanation": "", "estimated": None,
        "actual_latency_ms": 0, "simulated": True,
    }

    if not ranked:
        result["status"] = "no_eligible_model"
        result["message"] = ("No model meets all of your requirements. "
                             "Try a higher latency limit, a lower minimum capability or a smaller context length.")
        result["explanation"] = result["message"]
    else:
        used, resp, attempts = execute_with_fallback(ranked, prompt, analysis.category, overrides, rng=rng)
        result["attempts"] = attempts
        if used is None:
            result["status"] = "failed"
            tried = ", ".join(a["model"] for a in attempts)
            result["message"] = f"All eligible models failed ({tried}). No further fallback is permitted."
            result["explanation"] = result["message"]
        else:
            result["status"] = "success"
            result["selected_model"] = used.model.to_dict()
            result["response"] = resp.text
            result["actual_latency_ms"] = resp.latency_ms
            result["fallback_used"] = used is not ranked[0]
            top = ranked[0]
            reasons = explain(used, analysis, prefs, need_cap, len(ranked))
            if result["fallback_used"]:
                reasons.insert(0, f"Fallback: {top.model.name} failed, so {used.model.name} took over")
            result["reasons"] = reasons
            result["estimated"] = {"cost_usd": used.est_cost, "latency_ms": used.model.latency_ms,
                                   "quality": f"{used.model.capability}/5"}
            result["explanation"] = (
                f"I selected {used.model.name} for this {analysis.category} request. "
                + " ".join(r + "." for r in reasons[:4]))
            result["message"] = f"Routing completed. Selected model: {used.model.name}."

    if record:
        sel = result["selected_model"]
        result["id"] = database.record_history(
            user_id, prompt, analysis.category, sel["name"] if sel else None, result["status"],
            result["fallback_used"], result["estimated"]["cost_usd"] if result["estimated"] else 0.0,
            result["actual_latency_ms"], "; ".join(result["reasons"][:3]) or result["message"],
            json.dumps(result["attempts"]))
    return result


def simulate(prompt, prefs: Preferences, scenario):
    """What-if: compare normal routing with routing under the scenario. Nothing is saved."""
    base = route_request(None, prompt, prefs, scenario=None, record=False)
    scen = route_request(None, prompt, prefs, scenario=scenario, record=False)
    notes = []
    for mid, ov in (scenario or {}).items():
        name = registry.get(mid).name
        if ov.get("unavailable"):
            notes.append(f"{name} is now unavailable.")
        if ov.get("latency_ms"):
            notes.append(f"{name} is now slower ({ov['latency_ms'] / 1000:g}s).")
        if ov.get("fail"):
            notes.append(f"{name} now fails on every call.")
    b = base["selected_model"]["name"] if base["selected_model"] else None
    s = scen["selected_model"]["name"] if scen["selected_model"] else None
    if s is None:
        notes.append("No eligible model remains under these conditions.")
    elif s != b:
        notes.append(f"System selected {s} as fallback." if b else f"System selected {s}.")
    else:
        notes.append(f"No change: {s} is still the best choice.")
    return {"before": base, "after": scen, "message": " ".join(notes),
            "changed": b != s}
