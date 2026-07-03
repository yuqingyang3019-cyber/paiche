from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from .config import get_settings


from dispatch.fill import date_label_cn, today_cn


def _session_path(userid: str, day: date | None = None) -> Path:
    current = day or today_cn()
    root = Path(get_settings().session_dir)
    root.mkdir(parents=True, exist_ok=True)
    safe_user = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in userid)
    return root / f"{safe_user}_{current.isoformat()}.json"


def load_vehicles(userid: str) -> list[dict[str, Any]]:
    path = _session_path(userid)
    if not path.is_file():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    vehicles = payload.get("vehicles")
    return vehicles if isinstance(vehicles, list) else []


def save_vehicles(userid: str, vehicles: list[dict[str, Any]]) -> None:
    path = _session_path(userid)
    path.write_text(json.dumps({"vehicles": vehicles}, ensure_ascii=False, indent=2), encoding="utf-8")


def append_vehicles(userid: str, new_vehicles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    vehicles = load_vehicles(userid)
    vehicles.extend(new_vehicles)
    save_vehicles(userid, vehicles)
    return vehicles


def clear_vehicles(userid: str) -> None:
    path = _session_path(userid)
    if path.is_file():
        path.unlink()


def format_vehicle_summary(vehicles: list[dict[str, Any]]) -> str:
    label = date_label_cn()
    if not vehicles:
        return f"{label}列表为空。"
    lines = [f"{label}共 {len(vehicles)} 辆："]
    for index, vehicle in enumerate(vehicles, start=1):
        plate = vehicle.get("plate", "?")
        name = vehicle.get("name", "?")
        lines.append(f"{index}. {plate} · {name}")
    return "\n".join(lines)
