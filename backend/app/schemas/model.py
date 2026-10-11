from typing import List, Optional
from pydantic import BaseModel, Field

class ModelConfig(BaseModel):
    id: str = Field(..., description="Unique model identifier, e.g. 'mini', 'small'")
    name: str = Field(..., description="Display name, e.g. 'Mini (Simulated)'")
    provider: str = Field(default="Simulated Engine", description="Provider or simulator name")
    capability: int = Field(..., ge=1, le=5, description="Team-calibrated capability score (1-5)")
    cost_per_1k: float = Field(..., ge=0.0, description="Cost per 1,000 tokens in USD")
    latency_ms: float = Field(..., ge=0.0, description="Expected baseline latency in milliseconds")
    context_window: int = Field(..., ge=1, description="Maximum context window in tokens")
    available: bool = Field(default=True, description="Whether the endpoint is currently available / online")
    failure_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Configurable random failure probability (0.0-1.0)")
    artificial_delay_ms: float = Field(default=0.0, ge=0.0, description="Additional artificial delay injected during execution")
    force_fail: bool = Field(default=False, description="Always-fail toggle for judge testing")
    force_slow: bool = Field(default=False, description="Force-slow toggle (forces attempt to exceed latency cap)")
    description: Optional[str] = Field(default="", description="Description of the model's typical tier & strength")
    supported_tasks: List[str] = Field(default_factory=list, description="Supported task domains or categories")

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    capability: Optional[int] = Field(None, ge=1, le=5)
    cost_per_1k: Optional[float] = Field(None, ge=0.0)
    latency_ms: Optional[float] = Field(None, ge=0.0)
    context_window: Optional[int] = Field(None, ge=1)
    available: Optional[bool] = None
    failure_rate: Optional[float] = Field(None, ge=0.0, le=1.0)
    artificial_delay_ms: Optional[float] = Field(None, ge=0.0)
    force_fail: Optional[bool] = None
    force_slow: Optional[bool] = None
    description: Optional[str] = None
    supported_tasks: Optional[List[str]] = None
