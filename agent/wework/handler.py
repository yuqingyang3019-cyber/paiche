from __future__ import annotations

import logging
import re
from typing import Any

from dispatch.fill import date_label_cn, fill_dispatch_workbook
from dispatch.parse import parse_dispatch_text, uses_llm_parse
from wechatpy.enterprise import parse_message

from .client import WeWorkClient
from .session import append_vehicles, clear_vehicles, format_vehicle_summary, load_vehicles

logger = logging.getLogger(__name__)

GENERATE_KEYWORDS = {"生成", "生成今日", "导出", "生成excel"}
LIST_KEYWORDS = {"列表", "今日列表", "查看列表"}
CLEAR_KEYWORDS = {"清空", "清除", "重置"}
HELP_KEYWORDS = {"帮助", "help", "?", "？"}

LLM_WAIT_TEXT = "正在用大模型识别车信息，约 10–20 秒，请稍候…"
GENERATE_WAIT_TEXT = "正在生成 Excel，请稍候…"


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
    返回 (被动回复明文, 是否已通过主动消息 API 回复用户)。
    """
    message = parse_message(xml)
    userid = getattr(message, "source", "") or "unknown"
    logger.info("wework message user=%s type=%s", userid, message.type)

    if message.type != "text" or not getattr(message, "content", None):
        if message.type == "event" and getattr(message, "event", "") == "subscribe":
            logger.info("wework subscribe user=%s", userid)
            return operation_guide(message.source, "欢迎使用乌达派车助手。"), False
        return operation_guide(userid, "暂不支持该类型消息，请按下方说明操作。"), False

    content = str(message.content).strip()
    preview = content.replace("\n", " ")[:120]
    logger.info("wework text user=%s preview=%r", userid, preview)

    if not content:
        return operation_guide(userid, "消息内容为空。"), False

    command = _normalize_command(content)

    if command in {_normalize_command(k) for k in HELP_KEYWORDS}:
        logger.info("wework command user=%s cmd=help", userid)
        return operation_guide(userid), False

    if command in {_normalize_command(k) for k in LIST_KEYWORDS}:
        logger.info("wework command user=%s cmd=list count=%d", userid, len(load_vehicles(userid)))
        return format_vehicle_summary(load_vehicles(userid)), False

    if command in {_normalize_command(k) for k in CLEAR_KEYWORDS}:
        logger.info("wework command user=%s cmd=clear", userid)
        clear_vehicles(userid)
        return f"已清空{date_label_cn()}列表。\n\n" + build_operation_guide(), False

    if command in {_normalize_command(k) for k in GENERATE_KEYWORDS}:
        logger.info("wework command user=%s cmd=generate", userid)
        return _handle_generate(userid, client)

    if not _looks_like_vehicle_text(content):
        logger.info("wework unknown user=%s", userid)
        return operation_guide(userid, "未能识别为车信息或指令。"), False

    return _handle_vehicle_text(userid, content, client)


def _send_active_text(client: WeWorkClient, userid: str, content: str) -> None:
    try:
        client.send_text(userid, content)
        logger.info("wework active reply user=%s chars=%d", userid, len(content))
    except Exception:
        logger.exception("wework active reply failed user=%s", userid)
        raise


def _handle_vehicle_text(userid: str, content: str, client: WeWorkClient) -> tuple[str | None, bool]:
    via_llm = uses_llm_parse()
    if via_llm:
        logger.info("wework parse start user=%s via=llm", userid)
        _send_active_text(client, userid, LLM_WAIT_TEXT)
    else:
        logger.info("wework parse start user=%s via=regex", userid)

    try:
        result = parse_dispatch_text(content)
    except Exception as exc:
        logger.exception("wework parse failed user=%s", userid)
        reply = operation_guide(userid, f"识别失败：{exc}")
        if via_llm:
            _send_active_text(client, userid, reply)
            return None, True
        return reply, False

    vehicles: list[dict[str, Any]] = result.get("vehicles") or []
    warnings: list[str] = result.get("warnings") or []

    if not vehicles:
        note = "；".join(warnings) if warnings else "未能识别为完整车信息。"
        reply = operation_guide(userid, note)
        logger.info("wework parse empty user=%s warnings=%s", userid, warnings)
        if via_llm:
            _send_active_text(client, userid, reply)
            return None, True
        return reply, False

    all_vehicles = append_vehicles(userid, vehicles)
    added = "、".join(f"{v.get('plate', '?')}·{v.get('name', '?')}" for v in vehicles)
    label = date_label_cn()
    lines = [f"已添加 {len(vehicles)} 辆：{added}", f"{label}共 {len(all_vehicles)} 辆。"]
    if warnings:
        lines.append("提示：" + "；".join(warnings))
    lines.append(f"凑齐后发送「生成」获取{label} Excel。")
    reply = "\n".join(lines)
    logger.info("wework parse ok user=%s added=%d total=%d", userid, len(vehicles), len(all_vehicles))

    if via_llm:
        _send_active_text(client, userid, reply)
        return None, True
    return reply, False


def _handle_generate(userid: str, client: WeWorkClient) -> tuple[str | None, bool]:
    vehicles = load_vehicles(userid)
    if not vehicles:
        return operation_guide(userid, f"{date_label_cn()}列表为空，请先转发车信息。"), False

    try:
        _send_active_text(client, userid, GENERATE_WAIT_TEXT)
        content, filename = fill_dispatch_workbook(vehicles)
        logger.info("wework generate user=%s vehicles=%d file=%s bytes=%d", userid, len(vehicles), filename, len(content))
        client.send_file(userid, filename, content)
    except Exception as exc:
        logger.exception("wework generate failed user=%s", userid)
        return operation_guide(userid, f"生成失败：{exc}"), False

    _send_active_text(client, userid, f"已生成 {filename}，请在聊天中查收文件。")
    return None, True
