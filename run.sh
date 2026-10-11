#!/usr/bin/env sh
cd "$(dirname "$0")/backend" && python3 -m pip install -r ../requirements.txt && python3 -m uvicorn main:app --reload --port 8000
