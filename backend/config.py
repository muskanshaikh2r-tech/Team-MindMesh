"""Central configuration. Override anything with environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIR = ROOT_DIR / "frontend"

ENV = os.getenv("VORTEXA_ENV", "development")          # set to "production" to lock down dev features
DEV_MODE = ENV != "production"
DB_PATH = os.getenv("VORTEXA_DB", str(BASE_DIR / "vortexa.db"))

OTP_TTL_SECONDS = 180                                   # matches the 02:54 countdown in the UI
OTP_MAX_ATTEMPTS = 5
SESSION_TTL_SECONDS = 7 * 24 * 3600

MAX_FALLBACK_ATTEMPTS = int(os.getenv("MAX_FALLBACK_ATTEMPTS", "3"))
MODEL_TIMEOUT_MS = int(os.getenv("MODEL_TIMEOUT_MS", "5000"))
# Mock models "sleep" for latency * scale so demos feel real but stay fast. 1.0 = real time.
MOCK_TIME_SCALE = float(os.getenv("MOCK_TIME_SCALE", "0.15"))

# Optional: seeded demo account so you can log in immediately.
DEMO_EMAIL = os.getenv("DEMO_EMAIL", "demo@vortexa.ai")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")
DEMO_NAME = os.getenv("DEMO_NAME", "Demo User")

# Optional: real voice via ElevenLabs. Without a key the browser's built-in voice is used.
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

# Optional: real OTP emails. Without SMTP the OTP is printed in the server console
# (and returned as `dev_otp` in development mode).
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "no-reply@vortexa.ai")
