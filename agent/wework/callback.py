from __future__ import annotations

import time

from wechatpy.enterprise.crypto import WeChatCrypto
from wechatpy.exceptions import InvalidSignatureException

from .config import WeWorkSettings


def build_crypto(settings: WeWorkSettings) -> WeChatCrypto:
    return WeChatCrypto(settings.token, settings.encoding_aes_key, settings.corp_id)


def verify_url(crypto: WeChatCrypto, msg_signature: str, timestamp: str, nonce: str, echostr: str) -> str:
    try:
        return crypto.check_signature(msg_signature, timestamp, nonce, echostr)
    except InvalidSignatureException as exc:
        raise ValueError("签名校验失败") from exc


def decrypt_message(
    crypto: WeChatCrypto,
    msg_signature: str,
    timestamp: str,
    nonce: str,
    body: bytes,
) -> str:
    # wechatpy 需要完整的 <xml><Encrypt>...</Encrypt></xml> 报文，不能只传密文字符串
    try:
        return crypto.decrypt_message(body.decode("utf-8"), msg_signature, timestamp, nonce)
    except InvalidSignatureException as exc:
        raise ValueError("消息签名校验失败") from exc
    except Exception as exc:
        raise ValueError(f"消息解密失败：{exc}") from exc


def encrypt_text_reply(
    crypto: WeChatCrypto,
    to_user: str,
    from_user: str,
    content: str,
    nonce: str,
    timestamp: str | None = None,
) -> str:
    current_ts = timestamp or str(int(time.time()))
    xml = (
        "<xml>"
        f"<ToUserName><![CDATA[{to_user}]]></ToUserName>"
        f"<FromUserName><![CDATA[{from_user}]]></FromUserName>"
        f"<CreateTime>{current_ts}</CreateTime>"
        "<MsgType><![CDATA[text]]></MsgType>"
        f"<Content><![CDATA[{content}]]></Content>"
        "</xml>"
    )
    return crypto.encrypt_message(xml, nonce, current_ts)
