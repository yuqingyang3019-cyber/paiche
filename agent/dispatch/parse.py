from __future__ import annotations

import os
import re
from typing import Any

PATTERNS = {
    "plate": re.compile(r"车号[：:]\s*(\S+)"),
    "name": re.compile(r"姓名[：:]\s*(\S+)"),
    "phone": re.compile(r"电话[：:]\s*(\d{11})"),
    "idCard": re.compile(r"身份证号[：:]\s*([\dXx]{18})"),
}

REQUIRED_FIELDS = ("plate", "name", "phone", "idCard")


def _extract_block(block: str) -> dict[str, Any]:
    vehicle: dict[str, str] = {}
    warnings: list[str] = []
    for key, pattern in PATTERNS.items():
        match = pattern.search(block)
        if match:
            vehicle[key] = match.group(1).upper() if key == "idCard" else match.group(1)
        elif key in REQUIRED_FIELDS:
            warnings.append(f"缺少{key}")
    return {"vehicle": vehicle, "warnings": warnings}


def parse_dispatch_text(text: str) -> dict[str, Any]:
    if os.getenv("DASHSCOPE_API_KEY", "").strip() or os.getenv("LLM_API_KEY", "").strip():
        try:
            from .llm_parse import parse_dispatch_text_with_llm

            return parse_dispatch_text_with_llm(text)
        except Exception as exc:
            result = _parse_dispatch_text_regex(text)
            if result["vehicles"]:
                return result
            err = str(exc)
            if "invalid_api_key" in err or "401" in err:
                hint = "大模型 API Key 无效，请联系管理员更新 DASHSCOPE_API_KEY"
            else:
                hint = f"大模型识别失败：{exc}"
            warnings = list(result.get("warnings") or [])
            warnings.insert(0, hint)
            return {"vehicles": [], "warnings": warnings}
    return _parse_dispatch_text_regex(text)


def _parse_dispatch_text_regex(text: str) -> dict[str, Any]:
    normalized = (text or "").replace("\r\n", "\n").strip()
    if not normalized:
        return {"vehicles": [], "warnings": ["请输入车信息"]}

    blocks = [part.strip() for part in re.split(r"(?=车号[：:])", normalized) if part.strip()]
    if not blocks:
        blocks = [normalized]

    vehicles: list[dict[str, str]] = []
    warnings: list[str] = []
    for index, block in enumerate(blocks, start=1):
        result = _extract_block(block)
        vehicle = result["vehicle"]
        if len(vehicle) == len(REQUIRED_FIELDS):
            vehicles.append(vehicle)
        else:
            label = vehicle.get("plate") or f"第{index}条"
            warnings.append(f"{label}: " + "、".join(result["warnings"]))

    return {"vehicles": vehicles, "warnings": warnings}
