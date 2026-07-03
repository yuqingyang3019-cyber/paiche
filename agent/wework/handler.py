from __future__ import annotations

import re
from typing import Any

from dispatch.fill import date_label_cn, fill_dispatch_workbook
from dispatch.parse import parse_dispatch_text
from wechatpy.enterprise import parse_message

from .client import WeWorkClient
from .session import append_vehicles, clear_vehicles, format_vehicle_summary, load_vehicles

GENERATE_KEYWORDS = {"生成", "生成今日", "导出", "生成excel"}
LIST_KEYWORDS = {"列表", "今日列表", "查看列表"}
CLEAR_KEYWORDS = {"清空", "清除", "重置"}
HELP_KEYWORDS = {"帮助", "help", "?", "？"}


def build_operation_guide() -> str:
    label = date_label_cn()
    return f"""【乌达派车助手 · 操作指南】

添加车辆
从个人微信长按车信息，转发到本应用（需逐条转发，不可合并）

常用指令
列表 — 查看{label}已收录车辆
生成 — 导出{label} Excel 文件
清空 — 清除{label}列表后重新录入
帮助 — 再次查看本说明"""


def operation_guide(userid: str | None = None, note: str | None = None) -> str:
    label = date_label_cn()
    parts: list[str] = []
    if note:
        parts.append(note)
    if userid:
        count = len(load_vehicles(userid))
        if count:
            parts.append(f"{label}已收录 {count} 辆，发送「生成」可导出 Excel。")
    parts.append(build_operation_guide())
    return "\n\n".join(parts)


def _normalize_command(text: str) -> str:
    return re.sub(r"\s+", "", text.strip().lower())


def _looks_like_vehicle_text(text: str) -> bool:
    hints = ("车号", "姓名", "电话", "身份证", "身份证号")
    return any(hint in text for hint in hints)


def handle_incoming_xml(xml: str, client: WeWorkClient) -> tuple[str | None, bool]:
    """
    处理企微回调消息。
    返回 (被动回复明文, 是否已主动发消息)。
    """
    message = parse_message(xml)
    if message.type != "text" or not getattr(message, "content", None):
        if message.type == "event" and getattr(message, "event", "") == "subscribe":
            return operation_guide(message.source, "欢迎使用乌达派车助手。"), False
        userid = getattr(message, "source", None)
        return operation_guide(userid, "暂不支持该类型消息，请按下方说明操作。"), False

    userid = message.source
    content = str(message.content).strip()
    if not content:
        return operation_guide(userid, "消息内容为空。"), False

    command = _normalize_command(content)

    if command in {_normalize_command(k) for k in HELP_KEYWORDS}:
        return operation_guide(userid), False

    if command in {_normalize_command(k) for k in LIST_KEYWORDS}:
        return format_vehicle_summary(load_vehicles(userid)), False

    if command in {_normalize_command(k) for k in CLEAR_KEYWORDS}:
        clear_vehicles(userid)
        return f"已清空{date_label_cn()}列表。\n\n" + build_operation_guide(), False

    if command in {_normalize_command(k) for k in GENERATE_KEYWORDS}:
        return _handle_generate(userid, client)

    if not _looks_like_vehicle_text(content):
        return operation_guide(userid, "未能识别为车信息或指令。"), False

    return _handle_vehicle_text(userid, content)


def _handle_vehicle_text(userid: str, content: str) -> tuple[str, bool]:
    try:
        result = parse_dispatch_text(content)
    except Exception as exc:
        return operation_guide(userid, f"识别失败：{exc}"), False

    vehicles: list[dict[str, Any]] = result.get("vehicles") or []
    warnings: list[str] = result.get("warnings") or []

    if not vehicles:
        note = "；".join(warnings) if warnings else "未能识别为完整车信息。"
        return operation_guide(userid, note), False

    all_vehicles = append_vehicles(userid, vehicles)
    added = "、".join(f"{v.get('plate', '?')}·{v.get('name', '?')}" for v in vehicles)
    label = date_label_cn()
    lines = [f"已添加 {len(vehicles)} 辆：{added}", f"{label}共 {len(all_vehicles)} 辆。"]
    if warnings:
        lines.append("提示：" + "；".join(warnings))
    lines.append(f"凑齐后发送「生成」获取{label} Excel。")
    return "\n".join(lines), False


def _handle_generate(userid: str, client: WeWorkClient) -> tuple[str, bool]:
    vehicles = load_vehicles(userid)
    if not vehicles:
        return operation_guide(userid, f"{date_label_cn()}列表为空，请先转发车信息。"), False

    try:
        content, filename = fill_dispatch_workbook(vehicles)
        client.send_file(userid, filename, content)
    except Exception as exc:
        return operation_guide(userid, f"生成失败：{exc}"), False

    return f"已生成 {filename}，请在聊天中查收文件。", True
