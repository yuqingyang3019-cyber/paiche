import os

import pytest

os.environ["LUCHE_SKIP_ENV_LOCAL"] = "1"


@pytest.fixture
def session_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("WEWORK_DB_PATH", str(tmp_path / "paiche.db"))
    return tmp_path
