import os
from typing import Optional, Dict
from ..schemas.request import ComplexityAnalysis
from .signals import extract_signals, count_tokens

def analyze_complexity(prompt: str, manual_override: Optional[int] = None) -> ComplexityAnalysis:
    """
    Estimates the minimum required capability (1 to 5) for a prompt.
    Applies the core safety rule:
      - If confidence < 0.60 or ambiguous, round UP, never down.
      - User manual override takes precedence if supplied.
    """
    if manual_override is not None:
        return ComplexityAnalysis(
            estimated_complexity=manual_override,
            confidence=1.0,
            signals=[f"Manual user override specified: Capability {manual_override}"],
            explanation=f"User manually specified capability level {manual_override}. Bypassed automatic estimation.",
            rounded_up=False,
            estimator_type="manual_override"
        )

    # Check for optional external LLM estimator flag
    use_external_llm = os.getenv("ENABLE_EXTERNAL_LLM_ESTIMATOR", "false").lower() in ("true", "1", "yes")
    if use_external_llm:
        try:
            # External LLM adapter placeholder (e.g. mock or external service call)
            # If external fails or is not configured, fall through to local fallback
            raise NotImplementedError("External LLM not configured in offline mode.")
        except Exception:
            # Clean fallback to local estimator as mandated by spec
            local_result = _run_local_rules_estimator(prompt)
            local_result.estimator_type = "local_rules (external_llm_fallback)"
            local_result.signals.append("External LLM unavailable/disabled: Safely fell back to local rules engine")
            return local_result

    return _run_local_rules_estimator(prompt)

def _run_local_rules_estimator(prompt: str) -> ComplexityAnalysis:
    extracted = extract_signals(prompt)
    signals = extracted["signals_detected"]
    matches = extracted["level_matches"]
    has_code = extracted["has_code"]
    has_math = extracted["has_math"]
    tokens = extracted["tokens"]
    question_count = extracted["question_count"]
    multi_step = extracted["multi_step"]

    # Base score per level
    scores: Dict[int, float] = {1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.1}

    # Keyword contributions
    for kw in matches[1]:
        scores[1] += 2.0
    for kw in matches[2]:
        scores[2] += 2.2
    for kw in matches[3]:
        scores[3] += 2.5
    for kw in matches[4]:
        scores[4] += 3.0
    for kw in matches[5]:
        scores[5] += 4.0

    # Structural feature adjustments
    if has_code:
        # Code with debug/fix/troubleshoot points to level 4; general code points to 3
        if matches[4] or any(w in prompt.lower() for w in ["debug", "error", "traceback", "fix", "memory", "race"]):
            scores[4] += 3.5
            scores[3] += 1.0
        else:
            scores[3] += 3.0

    if has_math:
        scores[4] += 2.5
        scores[5] += 1.5

    if multi_step or question_count > 1:
        scores[3] += 1.0
        scores[4] += 1.5

    # Context length influence
    if tokens > 600:
        scores[4] += 2.0
        scores[5] += 1.5
    elif tokens > 200:
        scores[3] += 1.0

    # If completely neutral/ambiguous (e.g. very few keywords)
    total_score = sum(scores.values())
    sorted_levels = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_level, top_score = sorted_levels[0]
    second_level, second_score = sorted_levels[1]

    # Calculate confidence based on score dominance and signal abundance
    signal_count = len(signals)
    if total_score > 1.5:
        dominance = (top_score - second_score) / max(0.1, top_score)
        # Normalize confidence to [0.3, 0.95]
        confidence = min(0.95, max(0.35, 0.45 + (dominance * 0.40) + (min(signal_count, 4) * 0.05)))
    else:
        # Ambiguous prompt with very little signal
        confidence = 0.45

    confidence = round(confidence, 2)
    rounded_up = False
    effective_level = top_level

    # Safety Rule: If confidence < 0.60 or top two levels are very close (< 0.5 diff),
    # conservatively round UP, never down. Enforce within [1, 5].
    is_close_call = (top_score - second_score) < 0.8 and top_score > 0.5
    if confidence < 0.60 or is_close_call:
        if effective_level < 5:
            # Round up to safer level
            effective_level = min(5, max(effective_level, second_level) if is_close_call else effective_level + 1)
            rounded_up = True
            signals.append(f"Uncertainty safety rule applied: Confidence {confidence} (threshold 0.60). Rounded capability UP to {effective_level}.")

    # Explanations
    level_descriptions = {
        1: "Simple direct query (definition, translation, or basic extraction)",
        2: "Moderate explanation or text transformation requiring coherent structure",
        3: "Standard programming, data query, or structured multi-step synthesis",
        4: "Advanced reasoning, code debugging, mathematical derivation, or legal analysis",
        5: "Expert-level complex synthesis, formal verification, or architecture design"
    }

    explanation = (
        f"Assigned level {effective_level} ({level_descriptions.get(effective_level, 'Custom')}). "
        f"Signals detected: {len(signals)}. "
        f"{'Conservatively promoted UP due to uncertainty safety rule. ' if rounded_up else ''}"
        f"Confidence: {int(confidence * 100)}%."
    )

    return ComplexityAnalysis(
        estimated_complexity=effective_level,
        confidence=confidence,
        signals=signals,
        explanation=explanation,
        rounded_up=rounded_up,
        estimator_type="local_rules",
        raw_scores={f"level_{lvl}": round(sc, 2) for lvl, sc in scores.items()}
    )
