"""VORTEXA 3.0 / ModernRouter backend. Run:  uvicorn main:app --reload  (from this folder)."""
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import auth
import config
import database
import service
import tts
from models_registry import registry
from routing_engine import Preferences

@asynccontextmanager
async def lifespan(_app):
    database.init_db()
    auth.ensure_demo_user()
    yield


app = FastAPI(title="VORTEXA 3.0 - ModernRouter API", version="3.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- schemas ----------
class SignUp(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str
    password: str = Field(min_length=8, max_length=128)


class Login(BaseModel):
    email: str
    password: str


class EmailOnly(BaseModel):
    email: str


class VerifyOtp(BaseModel):
    email: str
    otp: str = Field(min_length=6, max_length=6)


class Prefs(BaseModel):
    budget: str = Field(default="low_cost", pattern="^(low_cost|balanced|high_quality)$")
    max_latency_ms: int = Field(default=1000, ge=50, le=60000)
    min_capability: int = Field(default=1, ge=1, le=5)
    context_tokens: int = Field(default=8000, ge=256, le=200000)

    def to_engine(self):
        return Preferences(self.budget, self.max_latency_ms, self.min_capability, self.context_tokens)


class RouteRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    preferences: Prefs = Field(default_factory=Prefs)


class ScenarioItem(BaseModel):
    model_id: str
    mode: str = Field(pattern="^(unavailable|slow|fail)$")


class SimulateRequest(RouteRequest):
    scenario: list[ScenarioItem] = Field(default_factory=list)


class FailureRequest(BaseModel):
    model_id: Optional[str] = None
    mode: str = Field(pattern="^(unavailable|slow|fail|clear)$")


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)


# ---------- auth plumbing ----------
def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Log in to continue.")
    user = auth.user_from_token(authorization[7:].strip())
    if not user:
        raise HTTPException(401, "Your session expired. Log in again.")
    return user


def _auth_call(fn, *args):
    try:
        return fn(*args)
    except auth.AuthError as e:
        raise HTTPException(e.status, e.message)


def _scenario_to_overrides(items):
    out = {}
    for it in items:
        if it.model_id not in registry.ids():
            raise HTTPException(404, f"Unknown model: {it.model_id}")
        ov = out.setdefault(it.model_id, {})
        if it.mode == "unavailable":
            ov["unavailable"] = True
        elif it.mode == "slow":
            ov["latency_ms"] = 2500
        elif it.mode == "fail":
            ov["fail"] = True
    return out


# ---------- public endpoints ----------
@app.get("/health")
def health():
    return {"status": "ok", "env": config.ENV, "models": len(registry.ids()),
            "tts": "elevenlabs" if tts.available() else "browser"}


@app.get("/models")
def list_models():
    models, _ = registry.effective()
    return {"models": [m.to_dict() for m in models], "overrides": registry.overrides}


# ---------- auth ----------
@app.post("/auth/signup")
def signup(body: SignUp):
    email = _auth_call(auth.create_user, body.name, body.email, body.password)
    code = _auth_call(auth.issue_otp, email)
    return {"email": email, "otp_ttl_seconds": config.OTP_TTL_SECONDS, "dev_otp": code}


@app.post("/auth/resend-otp")
def resend(body: EmailOnly):
    code = _auth_call(auth.issue_otp, body.email)
    return {"otp_ttl_seconds": config.OTP_TTL_SECONDS, "dev_otp": code}


@app.post("/auth/verify-otp")
def verify(body: VerifyOtp):
    user, token = _auth_call(auth.verify_otp, body.email, body.otp)
    return {"token": token, "user": user}


@app.post("/auth/login")
def login(body: Login):
    user, token = _auth_call(auth.login, body.email, body.password)
    return {"token": token, "user": user}


@app.get("/auth/me")
def me(user=Depends(current_user)):
    return user


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        auth.logout(authorization[7:].strip())
    return {"ok": True}


# ---------- routing ----------
@app.post("/route")
def route(body: RouteRequest, user=Depends(current_user)):
    return service.route_request(user["id"], body.prompt.strip(), body.preferences.to_engine())


@app.post("/simulate")
def simulate(body: SimulateRequest, user=Depends(current_user)):
    return service.simulate(body.prompt.strip(), body.preferences.to_engine(),
                            _scenario_to_overrides(body.scenario))


@app.post("/simulate-failure")
def simulate_failure(body: FailureRequest, user=Depends(current_user)):
    """Persistent failure injection for demos. Disabled when VORTEXA_ENV=production."""
    if not config.DEV_MODE:
        raise HTTPException(403, "Failure simulation is disabled in production.")
    if body.mode == "clear" and not body.model_id:
        registry.clear_overrides()
    else:
        if not body.model_id:
            raise HTTPException(422, "model_id is required.")
        try:
            registry.set_override(body.model_id, body.mode)
        except KeyError:
            raise HTTPException(404, f"Unknown model: {body.model_id}")
    return {"overrides": registry.overrides}


@app.get("/history")
def history(limit: int = 50, user=Depends(current_user)):
    return {"history": database.list_history(user["id"], min(max(limit, 1), 200))}


@app.delete("/history")
def clear_history(user=Depends(current_user)):
    database.clear_history(user["id"])
    return {"ok": True}


@app.get("/analytics")
def analytics(user=Depends(current_user)):
    return database.analytics(user["id"])


@app.post("/tts")
def text_to_speech(body: TtsRequest, user=Depends(current_user)):
    if not tts.available():
        raise HTTPException(501, "ElevenLabs is not configured. The browser voice is used instead.")
    try:
        return Response(tts.synthesize(body.text), media_type="audio/mpeg")
    except RuntimeError as e:
        raise HTTPException(502, str(e))


# ---------- frontend ----------
app.mount("/static", StaticFiles(directory=str(config.FRONTEND_DIR)), name="static")


@app.get("/")
def index():
    return FileResponse(config.FRONTEND_DIR / "index.html")
