from __future__ import annotations

from datetime import date

from wework.db import append_vehicles, clear_vehicles, count_vehicles, load_vehicles

SAMPLE_VEHICLE = {
    "plate": "蒙L93723",
    "name": "康有光",
    "phone": "15164810755",
    "idCard": "152827197608242172",
}


def test_sqlite_persists_by_date(session_dir) -> None:
    append_vehicles("user1", [SAMPLE_VEHICLE], day=date(2026, 7, 3))
    vehicles = load_vehicles("user1", day=date(2026, 7, 3))
    assert len(vehicles) == 1
    assert vehicles[0]["plate"] == "蒙L93723"
    assert count_vehicles("user1", day=date(2026, 7, 3)) == 1
    assert load_vehicles("user1", day=date(2026, 7, 2)) == []


def test_sqlite_clear_only_target_day(session_dir) -> None:
    append_vehicles("user1", [SAMPLE_VEHICLE], day=date(2026, 7, 2))
    append_vehicles("user1", [SAMPLE_VEHICLE], day=date(2026, 7, 3))
    clear_vehicles("user1", day=date(2026, 7, 3))
    assert load_vehicles("user1", day=date(2026, 7, 3)) == []
    assert len(load_vehicles("user1", day=date(2026, 7, 2))) == 1
