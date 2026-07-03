from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
CHECK_WHEELHOUSE_SCRIPT = ROOT / "scripts" / "check_wheelhouse.sh"
CHECK_VENDOR_SCRIPT = ROOT / "scripts" / "check_python_vendor.sh"
WHEELHOUSE = ROOT / "agent" / "wheelhouse"
PYTHON_VENDOR = ROOT / "agent" / "python"


@pytest.mark.skipif(
    os.getenv("LUCHE_SKIP_WHEELHOUSE") == "1",
    reason="跳过 wheelhouse 离线检查",
)
def test_wheelhouse_offline_install() -> None:
    if not CHECK_WHEELHOUSE_SCRIPT.is_file():
        pytest.fail(f"缺少检查脚本: {CHECK_WHEELHOUSE_SCRIPT}")
    if not WHEELHOUSE.is_dir() or not any(WHEELHOUSE.glob("*.whl")):
        pytest.fail(
            "wheelhouse 缺失或为空；CI 应先构建 wheelhouse，本地请执行 scripts/build_wheelhouse.sh"
        )
    subprocess.run(["bash", str(CHECK_WHEELHOUSE_SCRIPT)], cwd=ROOT, check=True)


@pytest.mark.skipif(
    os.getenv("LUCHE_SKIP_WHEELHOUSE") == "1",
    reason="跳过离线运行时依赖检查",
)
def test_python_vendor_ready_for_fc() -> None:
    if not CHECK_VENDOR_SCRIPT.is_file():
        pytest.fail(f"缺少检查脚本: {CHECK_VENDOR_SCRIPT}")
    if not PYTHON_VENDOR.is_dir():
        pytest.fail("agent/python 缺失；CI 应先执行 scripts/build_python_vendor.sh")
    subprocess.run(["bash", str(CHECK_VENDOR_SCRIPT)], cwd=ROOT, check=True)
