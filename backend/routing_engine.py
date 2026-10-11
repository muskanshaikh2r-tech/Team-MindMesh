"""Eligibility filtering + weighted scoring. Pure functions, easy to unit test."""
from dataclasses import dataclass, field

BUDGET_WEIGHTS = {  # cost, latency, capability, reliability
    "low_cost":     (0.50, 0.20, 0.20, 0.10),
    "balanced":     (0.30, 0.25, 0.30, 0.15),
    "high_quality": (0.10, 0.15, 0.65, 0.10),
}
BUDGET_LABELS = {"low_cost": "Low Cost", "balanced": "Balanced", "high_quality": "High Quality"}
SPECIALTY_BONUS = 0.08


@dataclass
class Preferences:
    budget: str = "low_cost"
    max_latency_ms: int = 1000
    min_capability: int = 1
    context_tokens: int = 8000


@dataclass
class Candidate:
    model: object
    eligible: bool
    score: float = 0.0
    est_cost: float = 0.0
    reasons_rejected: list = field(default_factory=list)


def estimate_cost(model, input_tokens, output_tokens):
    return round(input_tokens / 1000 * model.cost_in + output_tokens / 1000 * model.cost_out, 6)


def evaluate(models, analysis, prefs: Preferences):
    """Returns (ranked_eligible, all_candidates_in_registry_order)."""
    weights = BUDGET_WEIGHTS.get(prefs.budget, BUDGET_WEIGHTS["balanced"])
    need_cap = max(prefs.min_capability, analysis.min_capability)
    max_cost = max(m.cost_in + m.cost_out for m in models) or 1
    max_lat = max(m.latency_ms for m in models) or 1

    candidates = []
    for m in models:
        why = []
        if m.status == "unavailable":
            why.append("Currently unavailable")
        elif m.status != "available":
            why.append("Limited availability")
        if analysis.category not in m.tasks:
            why.append(f"Not configured for {analysis.category} tasks")
        if m.capability < need_cap:
            why.append(f"Capability {m.capability}/5 is below the required {need_cap}/5")
        if m.latency_ms > prefs.max_latency_ms:
            why.append(f"Latency {m.latency_ms} ms exceeds your {prefs.max_latency_ms} ms limit")
        if m.context_tokens < prefs.context_tokens:
            why.append(f"Context {m.context_tokens // 1000}K is below the requested {prefs.context_tokens // 1000}K")
        if m.context_tokens < analysis.input_tokens:
            why.append("Prompt does not fit in the context window")

        est = estimate_cost(m, analysis.input_tokens, analysis.est_output_tokens)
        cand = Candidate(m, not why, 0.0, est, why)
        if cand.eligible:
            cost_s = 1 - (m.cost_in + m.cost_out) / max_cost
            lat_s = 1 - m.latency_ms / max_lat
            cap_s = m.capability / 5
            rel_s = m.availability
            cand.score = round(
                weights[0] * cost_s + weights[1] * lat_s + weights[2] * cap_s + weights[3] * rel_s
                + (SPECIALTY_BONUS if analysis.category in m.specialties else 0), 4)
        candidates.append(cand)

    ranked = sorted((c for c in candidates if c.eligible), key=lambda c: (-c.score, c.est_cost))
    return ranked, candidates, need_cap


def explain(chosen: Candidate, analysis, prefs: Preferences, need_cap: int, n_eligible: int):
    m = chosen.model
    lat = f"{m.latency_ms / 1000:.1f}s" if m.latency_ms >= 1000 else f"{m.latency_ms} ms"
    limit = f"{prefs.max_latency_ms / 1000:g}s"
    reasons = [
        f"Meets your quality requirement ({m.capability}/5, needed {need_cap}/5)",
        f"Fits your {BUDGET_LABELS.get(prefs.budget, prefs.budget)} budget preference (about ${chosen.est_cost:.4f} for this request)",
        f"Latency is under {limit} ({lat})",
        f"Context length ({m.context_tokens // 1000}K) is sufficient for {prefs.context_tokens // 1000}K tokens",
    ]
    if analysis.category in m.tasks:
        reasons.append(f"Supports {analysis.category} tasks" + (" (specialty)" if analysis.category in m.specialties else ""))
    reasons.append(f"Highest routing score ({chosen.score}) among {n_eligible} eligible model(s)")
    return reasons
