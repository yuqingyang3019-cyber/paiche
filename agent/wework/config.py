from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class WeWorkSettings:
    corp_id: str
    agent_id: int
    agent_secret: str
    token: str
    encoding_aes_key: str
    session_dir: str

    @property
    def callback_enabled(self) -> bool:
        return bool(self.corp_id and self.token and self.encoding_aes_key)

    @property
    def enabled(self) -> bool:
        return bool(self.callback_enabled and self.agent_secret)

    @classmethod
    def from_env(cls) -> WeWorkSettings:
        agent_id_raw = os.getenv("WEWORK_AGENT_ID", "0").strip()
        return cls(
            corp_id=os.getenv("WEWORK_CORP_ID", "").strip(),
            agent_id=int(agent_id_raw) if agent_id_raw.isdigit() else 0,
            agent_secret=os.getenv("WEWORK_AGENT_SECRET", "").strip(),
            token=os.getenv("WEWORK_TOKEN", "69Ku5OIg").strip(),
            encoding_aes_key=os.getenv(
                "WEWORK_ENCODING_AES_KEY", "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"
            ).strip(),
            session_dir=os.getenv("WEWORK_SESSION_DIR", "/tmp/wework_sessions").strip(),
        )


def get_settings() -> WeWorkSettings:
    return WeWorkSettings.from_env()
