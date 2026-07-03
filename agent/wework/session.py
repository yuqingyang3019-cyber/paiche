from __future__ import annotations

from typing import Any

from dispatch.fill import date_label_cn

from .db import append_vehicles as _append_vehicles
from .db import clear_vehicles as _clear_vehicles
from .db import load_vehicles as _load_vehicles


def load_vehicles(userid: str) -> list[dict[str, Any]]:
    return _load_vehicles(userid)


def append_vehicles(userid: str, new_vehicles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return _append_vehicles(userid, new_vehicles)


def clear_vehicles(userid: str) -> None:
    _clear_vehicles(userid)


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
