"""SQLite storage: users, OTPs, sessions, routing history."""
import sqlite3
import time
from contextlib import contextmanager

import config


@contextmanager
def db():
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS users(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                verified INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS otps(
                email TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                expires_at REAL NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sessions(
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS history(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                prompt TEXT NOT NULL,
                category TEXT,
                selected_model TEXT,
                status TEXT NOT NULL,
                fallback_used INTEGER NOT NULL DEFAULT 0,
                est_cost REAL NOT NULL DEFAULT 0,
                latency_ms REAL NOT NULL DEFAULT 0,
                reason TEXT,
                attempts_json TEXT,
                created_at REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, created_at);
            """
        )


def record_history(user_id, prompt, category, selected_model, status, fallback_used,
                   est_cost, latency_ms, reason, attempts_json) -> int:
    with db() as c:
        cur = c.execute(
            "INSERT INTO history(user_id,prompt,category,selected_model,status,fallback_used,"
            "est_cost,latency_ms,reason,attempts_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (user_id, prompt, category, selected_model, status, int(fallback_used),
             est_cost, latency_ms, reason, attempts_json, time.time()),
        )
        return cur.lastrowid


def list_history(user_id, limit=50):
    with db() as c:
        rows = c.execute(
            "SELECT * FROM history WHERE user_id=? ORDER BY id DESC LIMIT ?", (user_id, limit)
        ).fetchall()
    return [dict(r) for r in rows]


def clear_history(user_id) -> None:
    with db() as c:
        c.execute("DELETE FROM history WHERE user_id=?", (user_id,))


def analytics(user_id, hours=24):
    now = time.time()
    since = now - hours * 3600
    with db() as c:
        tot = c.execute(
            "SELECT COUNT(*) n, COALESCE(SUM(est_cost),0) cost, "
            "COALESCE(AVG(CASE WHEN status='success' THEN latency_ms END),0) lat, "
            "COALESCE(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END),0) ok, "
            "COALESCE(SUM(fallback_used),0) fb FROM history WHERE user_id=?", (user_id,)
        ).fetchone()
        usage = c.execute(
            "SELECT selected_model m, COUNT(*) n FROM history WHERE user_id=? AND status='success' "
            "GROUP BY selected_model ORDER BY n DESC", (user_id,)
        ).fetchall()
        rows = c.execute(
            "SELECT created_at FROM history WHERE user_id=? AND created_at>=?", (user_id, since)
        ).fetchall()
    buckets = [0] * hours
    for r in rows:
        idx = hours - 1 - int((now - r["created_at"]) // 3600)
        if 0 <= idx < hours:
            buckets[idx] += 1
    n = tot["n"]
    return {
        "total_requests": n,
        "total_cost_usd": round(tot["cost"], 6),
        "avg_latency_ms": round(tot["lat"], 2),
        "success_rate": round(100 * tot["ok"] / n, 1) if n else 0.0,
        "fallbacks": tot["fb"],
        "model_usage": [{"model": r["m"], "count": r["n"]} for r in usage],
        "requests_over_time": buckets,
        "window_hours": hours,
    }
