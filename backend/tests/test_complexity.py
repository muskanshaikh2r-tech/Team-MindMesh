import pytest
from app.estimator.complexity import analyze_complexity
from app.estimator.signals import count_tokens, extract_signals

def test_token_counting_rule():
    # Rule: max(1, ceil(len(prompt)/4))
    assert count_tokens("") == 1
    assert count_tokens("abcd") == 1
    assert count_tokens("12345") == 2
    assert count_tokens("Hello world, this is a test prompt.") == 9

def test_easy_prompt_classification():
    prompt = "What is the capital of France and define its currency?"
    res = analyze_complexity(prompt)
    assert res.estimated_complexity in (1, 2)
    assert len(res.signals) > 0
    assert res.estimator_type == "local_rules"

def test_code_and_debugging_classification():
    prompt = """
    Please debug this python code and fix the race condition in the multithreaded queue:
    def worker():
        pass
    """
    res = analyze_complexity(prompt)
    assert res.estimated_complexity in (4, 5)
    assert any("code" in s.lower() for s in res.signals)

def test_conservative_round_up_on_uncertainty():
    """
    SPEC REQUIREMENT:
    'Safety rule: if confidence is low (for example below 0.6) or the top two classes are close,
    round the level up. Never round down because of uncertainty.'
    """
    vague_prompt = "tell me about this system and what to do next"
    res = analyze_complexity(vague_prompt)
    assert res.confidence < 0.70
    if res.confidence < 0.60:
        assert res.rounded_up is True
        assert res.estimated_complexity >= 2
    # Ensure never rounded down below 1 or out of [1, 5] bounds
    assert 1 <= res.estimated_complexity <= 5

def test_manual_override_priority():
    prompt = "Write a one sentence greeting" # Would normally be level 1
    res = analyze_complexity(prompt, manual_override=4)
    assert res.estimated_complexity == 4
    assert res.estimator_type == "manual_override"
    assert res.confidence == 1.0

def test_external_llm_fallback_safely_handled(monkeypatch):
    monkeypatch.setenv("ENABLE_EXTERNAL_LLM_ESTIMATOR", "true")
    res = analyze_complexity("Explain photosynthesis simply")
    assert res.estimated_complexity in (1, 2)
    assert "external_llm_fallback" in res.estimator_type
