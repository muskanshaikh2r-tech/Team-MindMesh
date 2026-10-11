"""Mock model adapters. Everything here is SIMULATED: no real AI model is called.

To go real, implement another adapter with the same `invoke()` signature that calls a provider API
and raise ModelUnavailableError / ModelTimeoutError on failures.
"""
import random
import time
from dataclasses import dataclass

import config


class MockModelError(Exception):
    pass


class ModelUnavailableError(MockModelError):
    pass


class ModelTimeoutError(MockModelError):
    pass


@dataclass
class ModelResponse:
    text: str
    latency_ms: int
    simulated: bool = True


POINTERS = (
    "A pointer is a variable that stores a memory address. Declare one with `int* p;` and point it at "
    "a variable using the address-of operator: `int x = 5; int* p = &x;`. Dereference with `*p` to read "
    "or write the value at that address (`*p = 10;` changes x). Pointers enable dynamic memory "
    "(`new`/`delete`), arrays, and passing large data without copying. Prefer smart pointers "
    "(`std::unique_ptr`, `std::shared_ptr`) in modern C++ and always avoid dereferencing `nullptr`."
)

TEMPLATES = {
    "general": "Here is a concise answer to your question: {p}",
    "summarization": "Summary: the text centres on {p}. Key points are extracted and condensed.",
    "coding": "Here is a code-oriented answer for: {p}\n\n```\n// simulated solution skeleton\n```",
    "reasoning": "Let's reason step by step about: {p}\n1. Define the problem.\n2. Compare the options.\n3. Conclude.",
}


def _compose(model, prompt: str, category: str) -> str:
    if "pointer" in prompt.lower() and ("c++" in prompt.lower() or "cpp" in prompt.lower() or "c " in prompt.lower()):
        body = POINTERS
    else:
        short = prompt.strip().replace("\n", " ")
        body = TEMPLATES.get(category, TEMPLATES["general"]).format(p=f"\"{short[:140]}\"")
    if model.capability >= 5:
        body += "\n\n(Extended detail: edge cases, trade-offs and examples included.)"
    return f"{body}\n\n[Simulated response from {model.name}: mock output, not a real LLM.]"


def invoke(model, prompt: str, category: str, *, force_fail=False, latency_ms=None,
           timeout_ms=None, rng=random) -> ModelResponse:
    timeout_ms = timeout_ms or config.MODEL_TIMEOUT_MS
    if force_fail:
        raise ModelUnavailableError(f"{model.name} is not responding")
    base = latency_ms or model.latency_ms
    simulated = int(base * rng.uniform(0.9, 1.1))
    if simulated > timeout_ms:
        time.sleep(timeout_ms / 1000 * config.MOCK_TIME_SCALE)
        raise ModelTimeoutError(f"{model.name} timed out after {timeout_ms} ms")
    time.sleep(simulated / 1000 * config.MOCK_TIME_SCALE)
    if rng.random() < model.failure_rate:
        raise ModelUnavailableError(f"{model.name} returned a transient error")
    return ModelResponse(_compose(model, prompt, category), simulated)
