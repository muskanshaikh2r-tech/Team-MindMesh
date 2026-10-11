import sqlite3
import os
from pathlib import Path

DB_FILE = os.getenv("SQLITE_DB_PATH", str(Path(__file__).parent.parent.parent / "modelrouter.db"))

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Models table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        capability INTEGER NOT NULL,
        cost_per_1k REAL NOT NULL,
        latency_ms REAL NOT NULL,
        context_window INTEGER NOT NULL,
        available INTEGER NOT NULL DEFAULT 1,
        failure_rate REAL NOT NULL DEFAULT 0.0,
        artificial_delay_ms REAL NOT NULL DEFAULT 0.0,
        force_fail INTEGER NOT NULL DEFAULT 0,
        force_slow INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        supported_tasks TEXT
    )
    """)
    
    # Request history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status_code TEXT NOT NULL,
        success INTEGER NOT NULL,
        selected_model_id TEXT,
        total_observed_latency_ms REAL NOT NULL,
        total_estimated_cost REAL NOT NULL,
        cost_savings_vs_large REAL NOT NULL,
        attempts_count INTEGER NOT NULL,
        failover_occurred INTEGER NOT NULL,
        full_response_json TEXT NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()
