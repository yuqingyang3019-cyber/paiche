from __future__ import annotations

import re
from typing import Any

from dispatch.fill import fill_dispatch_workbook
from dispatch.parse import parse_dispatch_text
from wechatpy.enterprise import parse_message

from .client import WeWorkClient
from .session import append_vehicles, clear_vehicles, format_vehicle_summary, load_vehicles

GENERATE_KEYWORDS = {"生成", "生成今日", "导出", "生成excel"}
LIST_KEYWORDS = {"列表", "今日列表", "查看列表"}
CLEAR_KEYWORDS = {"清空", "清除", "重置"}
HELP_KEYWORDS = {"帮助", "help", "?", "？"}

HELP_TEXT = """乌达派车助手使用说明：

1. 从个人微信长按车信息，转发到本应用（需逐条转发）
2. 自动识别并加入今日列表
3. 发送「列表」查看今日车辆
4. 发送「生成」获取今日 Excel
5. 发送「清空」清除今日列表

H5 备用入口仍可使用。"""


def _normalize_command(text: str) -> str:
    return re.sub(r"\s+", "", text.strip().lower())


def handle_incoming_xml(xml: str, client: WeWorkClient) -> tuple[str | None, bool]:
    """
    处理企微回调消息。
    返回 (被动回复明文, 是否已主动发消息)。
    若需主动发文件，被动回复可为提示语；文件走 API 发送。
    """
    message = parse_message(xml)
    if message.type != "text" or not getattr(message, "content", None):
        if message.type == "event" and getattr(message, "event", "") == "subscribe":
            return "欢迎使用乌达派车助手。发送「帮助」查看用法。", False
        return None, False

    userid = message.source
    content = str(message.content).strip()
    command = _normalize_command(content)

    if command in {_normalize_command(k) for k in HELP_KEYWORDS}:
        return HELP_TEXT, False

    if command in {_normalize_command(k) for k in LIST_KEYWORDS}:
        return format_vehicle_summary(load_vehicles(userid)), False

    if command in {_normalize_command(k) for k in CLEAR_KEYWORDS}:
        clear_vehicles(userid)
        return "已清空今日列表。", False

    if command in {_normalize_command(k) for k in GENERATE_KEYWORDS}:
        return _handle_generate(userid, client)

    return _handle_vehicle_text(userid, content)


def _handle_vehicle_text(userid: str, content: str) -> tuple[str, bool]:
    try:
        result = parse_dispatch_text(content)
    except Exception as exc:
        return f"识别失败：{exc}", False

    vehicles: list[dict[str, Any]] = result.get("vehicles") or []
    warnings: list[str] = result.get("warnings") or []

    if not vehicles:
        warning_text = "；".join(warnings) if warnings else "未识别到完整车信息，请检查格式或逐条转发。"
        return warning_text, False

    all_vehicles = append_vehicles(userid, vehicles)
    added = "、".join(f"{v.get('plate', '?')}·{v.get('name', '?')}" for v in vehicles)
    lines = [f"已添加 {len(vehicles)} 辆：{added}", f"今日共 {len(all_vehicles)} 辆。"]
    if warnings:
        lines.append("提示：" + "；".join(warnings))
    lines.append("发送「生成」可获取今日 Excel。")
    return "\n".join(lines), False


def _handle_generate(userid: str, client: WeWorkClient) -> tuple[str, bool]:
    vehicles = load_vehicles(userid)
    if not vehicles:
        return "今日列表为空，请先转发车信息。", False

    try:
        content, filename = fill_dispatch_workbook(vehicles)
        client.send_file(userid, filename, content)
    except Exception as exc:
        return f"生成失败：{exc}", False

    return f"已生成 {filename}，请在聊天中查收文件。", True
