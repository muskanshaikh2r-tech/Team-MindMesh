# VORTEXA 3.0 · ModernRouter

Intelligent AI model routing: classify a request, pick the best eligible model (task fit, cost, latency,
capability, context, availability), fall back safely on failure, explain the decision, and keep history.
Backend: FastAPI + SQLite. Frontend: vanilla JS served by the same server (no build step).

## Run
    # Windows: double-click run.bat      macOS/Linux: ./run.sh
    # or manually:
    cd backend
    pip install -r ../requirements.txt
    uvicorn main:app --reload --port 8000
Open http://127.0.0.1:8000 and log in with the seeded demo account `demo@vortexa.ai` / `demo1234`,
or sign up (the OTP appears on the verify screen in dev mode and in the server console).
Interactive API docs: http://127.0.0.1:8000/docs

## Tests
    python tests/test_core.py        # routing, fallback, OTP, history (stdlib only)

## Layout
    backend/main.py              FastAPI app + endpoints
    backend/request_analyzer.py  keyword task classifier (coding / summarization / reasoning / general)
    backend/models_registry.py   model metadata + failure-injection overrides
    backend/routing_engine.py    eligibility filter + weighted scoring + explanation
    backend/fallback.py          bounded retry across ranked models
    backend/mock_models.py       simulated models (swap for real provider adapters)
    backend/service.py           orchestration: analyse > route > execute > record
    backend/auth.py, database.py users/OTP/sessions, history, analytics
    backend/tts.py               optional ElevenLabs proxy
    frontend/                    index.html, styles.css, app.js (all 9 screens)

## API
| Endpoint | Auth | Purpose |
|---|---|---|
| GET /health | no | status, voice provider |
| GET /models | no | model metadata + active overrides |
| POST /auth/signup, /auth/resend-otp, /auth/verify-otp, /auth/login, /auth/logout; GET /auth/me | – | accounts + OTP |
| POST /route | yes | `{prompt, preferences}` → selected model, response, reasons, candidates, attempts |
| POST /simulate | yes | what-if comparison (normal vs scenario), not saved |
| POST /simulate-failure | yes | persistent failure injection (`unavailable`/`slow`/`fail`/`clear`); disabled in production |
| GET/DELETE /history, GET /analytics | yes | history and KPIs |
| POST /tts | yes | ElevenLabs audio (501 if no key) |

## What is simulated / not done
- Models are mocks: responses, prices, and latencies are simulated. Add real adapters next to `mock_models.py`.
- "Continue with Google" and "Forgot password" are UI placeholders (need OAuth credentials / reset flow).
- Without SMTP the OTP is shown in dev mode instead of emailed.
