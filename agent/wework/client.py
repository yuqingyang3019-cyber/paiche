from __future__ import annotations

import time
from typing import Any

import httpx

from .config import WeWorkSettings

API_BASE = "https://qyapi.weixin.qq.com/cgi-bin"


class WeWorkClient:
    def __init__(self, settings: WeWorkSettings) -> None:
        self.settings = settings
        self._token = ""
        self._token_expires_at = 0.0

    def get_access_token(self) -> str:
        now = time.time()
        if self._token and now < self._token_expires_at - 60:
            return self._token

        response = httpx.get(
            f"{API_BASE}/gettoken",
            params={"corpid": self.settings.corp_id, "corpsecret": self.settings.agent_secret},
            timeout=15.0,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("errcode") != 0:
            raise RuntimeError(f"获取 access_token 失败：{payload.get('errmsg', payload)}")

        self._token = str(payload["access_token"])
        self._token_expires_at = now + float(payload.get("expires_in", 7200))
        return self._token

    def send_text(self, userid: str, content: str) -> None:
        self._send_message(
            {
                "touser": userid,
                "msgtype": "text",
                "agentid": self.settings.agent_id,
                "text": {"content": content},
                "safe": 0,
            }
        )

    def send_file(self, userid: str, filename: str, content: bytes) -> None:
        media_id = self.upload_file(filename, content)
        self._send_message(
            {
                "touser": userid,
                "msgtype": "file",
                "agentid": self.settings.agent_id,
                "file": {"media_id": media_id},
                "safe": 0,
            }
        )

    def upload_file(self, filename: str, content: bytes) -> str:
        token = self.get_access_token()
        response = httpx.post(
            f"{API_BASE}/media/upload",
            params={"access_token": token, "type": "file"},
            files={"media": (filename, content)},
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("errcode") != 0:
            raise RuntimeError(f"上传文件失败：{payload.get('errmsg', payload)}")
        return str(payload["media_id"])

    def _send_message(self, body: dict[str, Any]) -> None:
        token = self.get_access_token()
        response = httpx.post(
            f"{API_BASE}/message/send",
            params={"access_token": token},
            json=body,
            timeout=15.0,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("errcode") != 0:
            raise RuntimeError(f"发送消息失败：{payload.get('errmsg', payload)}")
