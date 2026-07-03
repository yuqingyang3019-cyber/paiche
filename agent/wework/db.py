from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

from dispatch.fill import today_cn

from .config import get_settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS vehicle_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userid TEXT NOT NULL,
  record_date TEXT NOT NULL,
  plate TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_card TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_vehicle_user_date ON vehicle_entries(userid, record_date);
"""


def _db_path() -> Path:
    path = Path(get_settings().db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_SCHEMA)
    return conn


def _record_date(day: date | None = None) -> str:
    return (day or today_cn()).isoformat()


def _row_to_vehicle(row: sqlite3.Row) -> dict[str, str]:
    return {
        "plate": row["plate"],
        "name": row["name"],
        "phone": row["phone"],
        "idCard": row["id_card"],
    }


def load_vehicles(userid: str, day: date | None = None) -> list[dict[str, Any]]:
    current = _record_date(day)
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT plate, name, phone, id_card
            FROM vehicle_entries
            WHERE userid = ? AND record_date = ?
            ORDER BY id
            """,
            (userid, current),
        ).fetchall()
    return [_row_to_vehicle(row) for row in rows]


def append_vehicles(userid: str, new_vehicles: list[dict[str, Any]], day: date | None = None) -> list[dict[str, Any]]:
    current = _record_date(day)
    with _connect() as conn:
        for vehicle in new_vehicles:
            conn.execute(
                """
                INSERT INTO vehicle_entries (userid, record_date, plate, name, phone, id_card)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    userid,
                    current,
                    vehicle["plate"],
                    vehicle["name"],
                    vehicle["phone"],
                    vehicle["idCard"],
                ),
            )
        conn.commit()
    return load_vehicles(userid, day=day)


def clear_vehicles(userid: str, day: date | None = None) -> None:
    current = _record_date(day)
    with _connect() as conn:
        conn.execute(
            "DELETE FROM vehicle_entries WHERE userid = ? AND record_date = ?",
            (userid, current),
        )
        conn.commit()


def count_vehicles(userid: str, day: date | None = None) -> int:
    current = _record_date(day)
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS total FROM vehicle_entries WHERE userid = ? AND record_date = ?",
            (userid, current),
        ).fetchone()
    return int(row["total"]) if row else 0
