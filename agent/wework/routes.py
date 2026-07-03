from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, Response

from wework.callback import build_crypto, decrypt_message, encrypt_text_reply, verify_url
from wework.client import WeWorkClient
from wework.config import get_settings
from wework.handler import handle_incoming_xml

router = APIRouter(prefix="/api/wework", tags=["wework"])


def _require_settings():
    settings = get_settings()
    if not settings.enabled:
        raise HTTPException(status_code=503, detail="企业微信未配置，请设置 WEWORK_* 环境变量")
    return settings


@router.get("/callback")
def wework_verify(
    msg_signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    echostr: str = Query(...),
) -> PlainTextResponse:
    settings = _require_settings()
    crypto = build_crypto(settings)
    try:
        echo = verify_url(crypto, msg_signature, timestamp, nonce, echostr)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return PlainTextResponse(echo)


@router.post("/callback")
async def wework_callback(
    request: Request,
    msg_signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
) -> Response:
    settings = _require_settings()
    crypto = build_crypto(settings)
    body = await request.body()

    try:
        xml = decrypt_message(crypto, msg_signature, timestamp, nonce, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    client = WeWorkClient(settings)
    reply_text, _ = handle_incoming_xml(xml, client)
    if not reply_text:
        return PlainTextResponse("success")

    message_xml = encrypt_text_reply(
        crypto,
        to_user=_extract_xml_field(xml, "FromUserName"),
        from_user=_extract_xml_field(xml, "ToUserName"),
        content=reply_text,
        nonce=nonce,
        timestamp=timestamp,
    )
    return Response(content=message_xml, media_type="application/xml")


def _extract_xml_field(xml: str, tag: str) -> str:
    open_tag = f"<{tag}><![CDATA["
    close_tag = "]]></" + tag + ">"
    start = xml.find(open_tag)
    if start == -1:
        return ""
    start += len(open_tag)
    end = xml.find(close_tag, start)
    if end == -1:
        return ""
    return xml[start:end]
