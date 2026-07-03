from __future__ import annotations

import json
import os
import re
from typing import Any

from openai import OpenAI

SYSTEM_PROMPT = """你是派车信息提取助手。从微信聊天文本中提取车辆信息。
规则：
1. 只输出严格 JSON，不要 Markdown 或其它说明。
2. 输出格式：{"vehicles":[{"plate":"车牌","name":"司机姓名","phone":"11位手机号","idCard":"18位身份证号"}],"warnings":[]}
3. 文本里可能有多辆车，全部提取；字段名可能是车号/车牌、姓名/司机、电话/手机等，按语义识别。
4. 某辆车缺字段时放入 warnings，不要编造。
5. 忽略车皮、自卸、国六等与表格无关的信息。"""


def _api_key() -> str:
    return (os.getenv("DASHSCOPE_API_KEY") or os.getenv("LLM_API_KEY") or "").strip()


def _client() -> OpenAI:
    api_key = _api_key()
    if not api_key:
        raise RuntimeError("缺少环境变量 DASHSCOPE_API_KEY")
    base_url = (
        os.getenv("DASHSCOPE_BASE_URL")
        or os.getenv("LLM_BASE_URL")
        or "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ).strip()
    return OpenAI(api_key=api_key, base_url=base_url)


def _normalize_vehicle(raw: dict[str, Any]) -> dict[str, str] | None:
    plate = str(raw.get("plate") or "").strip()
    name = str(raw.get("name") or "").strip()
    phone = re.sub(r"\D", "", str(raw.get("phone") or ""))
    id_card = str(raw.get("idCard") or "").strip().upper()
    if not (plate and name and re.fullmatch(r"\d{11}", phone) and re.fullmatch(r"[\dX]{18}", id_card)):
        return None
    return {"plate": plate, "name": name, "phone": phone, "idCard": id_card}


def parse_dispatch_text_with_llm(text: str) -> dict[str, Any]:
    normalized = (text or "").replace("\r\n", "\n").strip()
    if not normalized:
        return {"vehicles": [], "warnings": ["请输入车信息"]}

    model = (os.getenv("DASHSCOPE_MODEL") or os.getenv("LLM_MODEL") or "glm-5").strip()
    timeout = float(os.getenv("DASHSCOPE_TIMEOUT_SECONDS") or os.getenv("LLM_TIMEOUT_SECONDS") or "60")
    response = _client().chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        timeout=timeout,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": normalized},
        ],
    )
    content = (response.choices[0].message.content or "{}").strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.IGNORECASE).strip()
    payload = json.loads(content)

    vehicles: list[dict[str, str]] = []
    warnings = [str(item) for item in payload.get("warnings") or []]
    for index, raw in enumerate(payload.get("vehicles") or [], start=1):
        if not isinstance(raw, dict):
            warnings.append(f"第{index}条: 格式无效")
            continue
        vehicle = _normalize_vehicle(raw)
        if vehicle:
            vehicles.append(vehicle)
        else:
            label = str(raw.get("plate") or f"第{index}条")
            warnings.append(f"{label}: 字段不完整")

    if not vehicles and not warnings:
        warnings.append("未识别到完整车信息")
    return {"vehicles": vehicles, "warnings": warnings}
