"""Bounded fallback: try ranked candidates in order, never loop forever."""
import time

import config
import mock_models as mm


def execute_with_fallback(ranked, prompt, category, overrides, max_attempts=None, rng=None):
    max_attempts = max_attempts or config.MAX_FALLBACK_ATTEMPTS
    attempts, response, used = [], None, None
    kwargs = {"rng": rng} if rng is not None else {}
    for cand in ranked[:max_attempts]:
        m = cand.model
        ov = overrides.get(m.id, {})
        t0 = time.time()
        try:
            response = mm.invoke(m, prompt, category, force_fail=bool(ov.get("fail")),
                                 latency_ms=ov.get("latency_ms"), **kwargs)
            attempts.append({"model_id": m.id, "model": m.name, "outcome": "success",
                             "error": None, "latency_ms": response.latency_ms})
            used = cand
            break
        except mm.MockModelError as exc:
            attempts.append({"model_id": m.id, "model": m.name, "outcome": "failed",
                             "error": str(exc), "latency_ms": round((time.time() - t0) * 1000)})
    return used, response, attempts
