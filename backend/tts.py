"""Optional ElevenLabs text-to-speech proxy (keeps the API key on the server)."""
import json
import urllib.error
import urllib.request

import config


def available() -> bool:
    return bool(config.ELEVENLABS_API_KEY)


def synthesize(text: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{config.ELEVENLABS_VOICE_ID}"
    body = json.dumps({"text": text[:1500], "model_id": config.ELEVENLABS_MODEL_ID}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "xi-api-key": config.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"ElevenLabs error {e.code}") from e
