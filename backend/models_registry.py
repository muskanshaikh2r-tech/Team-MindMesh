"""Model registry: metadata the routing engine uses. Prices are per 1K tokens (simulated)."""
import copy
import threading
from dataclasses import dataclass, field, asdict


@dataclass
class ModelSpec:
    id: str
    name: str
    tagline: str
    tasks: list            # task categories this model is configured for
    cost_in: float         # USD per 1K input tokens
    cost_out: float        # USD per 1K output tokens
    latency_ms: int        # expected response time
    capability: int        # 1-5
    context_tokens: int
    availability: float = 1.0   # 0-1 reliability estimate
    status: str = "available"   # available | limited | unavailable
    specialties: list = field(default_factory=list)
    badges: list = field(default_factory=list)
    failure_rate: float = 0.0   # random failure chance when invoked (mock only)

    def to_dict(self):
        return asdict(self)


ALL_TASKS = ["general", "summarization", "coding", "reasoning"]

DEFAULT_MODELS = [
    ModelSpec("model-a", "Model A", "Fast & Affordable", ["general", "summarization"],
              0.001, 0.002, 200, 2, 4_000, 0.99, "available", [], ["Fast", "Low Cost"], 0.01),
    ModelSpec("model-b", "Model B", "Balanced Performance", ["general", "summarization", "coding", "reasoning"],
              0.003, 0.006, 700, 4, 8_000, 0.98, "available", ["coding"], ["Balanced"], 0.02),
    ModelSpec("model-c", "Model C", "Highest Quality", ALL_TASKS,
              0.010, 0.020, 1500, 5, 32_000, 0.98, "available", ["reasoning"], ["Best Quality", "High Cost"], 0.02),
    ModelSpec("model-d", "Model D", "Specialized Model", ["coding"],
              0.005, 0.010, 1800, 3, 16_000, 0.95, "available", ["coding"], ["High Latency"], 0.05),
    ModelSpec("model-e", "Model E", "Experimental", ["general", "summarization", "reasoning"],
              0.002, 0.004, 1200, 3, 16_000, 0.60, "limited", [], ["Limited Availability"], 0.30),
]


class Registry:
    """Holds the models plus runtime overrides used for failure simulation.

    override keys per model id:  unavailable (bool), fail (bool), latency_ms (int)
    """

    def __init__(self, models=None):
        self._models = {m.id: m for m in (models or copy.deepcopy(DEFAULT_MODELS))}
        self.overrides = {}
        self._lock = threading.Lock()

    def ids(self):
        return list(self._models)

    def get(self, model_id):
        return self._models[model_id]

    def set_override(self, model_id, mode):
        if model_id not in self._models:
            raise KeyError(model_id)
        with self._lock:
            ov = self.overrides.setdefault(model_id, {})
            if mode == "unavailable":
                ov["unavailable"] = True
            elif mode == "fail":
                ov["fail"] = True
            elif mode == "slow":
                ov["latency_ms"] = 2500
            elif mode == "clear":
                self.overrides.pop(model_id, None)
            else:
                raise ValueError(f"unknown mode: {mode}")

    def clear_overrides(self):
        with self._lock:
            self.overrides.clear()

    def effective(self, extra=None):
        """Models with global + request-level overrides applied. Returns (models, merged_overrides)."""
        merged = {k: dict(v) for k, v in self.overrides.items()}
        for k, v in (extra or {}).items():
            merged.setdefault(k, {}).update(v)
        out = []
        for m in self._models.values():
            m = copy.copy(m)
            ov = merged.get(m.id, {})
            if ov.get("unavailable"):
                m.status = "unavailable"
                m.badges = [b for b in m.badges if b != "Limited Availability"] + ["Unavailable"]
            if ov.get("latency_ms"):
                m.latency_ms = ov["latency_ms"]
                m.badges = [b for b in m.badges if b not in ("Fast", "High Latency")] + ["High Latency"]
            out.append(m)
        return out, merged


registry = Registry()
