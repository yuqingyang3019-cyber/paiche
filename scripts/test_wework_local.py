#!/usr/bin/env python3
"""本地模拟企微指令，使用真实大模型与填表逻辑。"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENT = ROOT / "agent"
sys.path.insert(0, str(AGENT))

os.environ.setdefault("WEWORK_DB_PATH", str(Path(tempfile.mkdtemp()) / "paiche.db"))
os.environ.setdefault("WEWORK_CORP_ID", "local-test")
os.environ.setdefault("WEWORK_AGENT_SECRET", "local-test")
os.environ.setdefault("WEWORK_AGENT_ID", "1")

from logging_config import setup_logging
from main import load_env_local
from wework.handler import handle_incoming_xml

SAMPLE_VEHICLE_TEXT = """车号：蒙L93723
姓名：康有光
电话：15164810755
身份证号：152827197608242172
车皮：15吨
自卸/国六"""

SAMPLE_XML = """<xml>
<ToUserName><![CDATA[wwcorp]]></ToUserName>
<FromUserName><![CDATA[local_tester]]></FromUserName>
<CreateTime>1348831860</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[{content}]]></Content>
<MsgId>123</MsgId>
<AgentID>1</AgentID>
</xml>"""


class ConsoleClient:
    def send_text(self, userid: str, content: str) -> None:
        print(f"\n>>> [主动消息 → {userid}]\n{content}\n")

    def send_file(self, userid: str, filename: str, content: bytes) -> None:
        out = Path(tempfile.gettempdir()) / filename
        out.write_bytes(content)
        print(f"\n>>> [文件 → {userid}] {filename} ({len(content)} bytes)")
        print(f"    已保存: {out}\n")


def run_command(label: str, content: str) -> None:
    print("=" * 60)
    print(f"【{label}】用户发送: {content[:80]}{'…' if len(content) > 80 else ''}")
    xml = SAMPLE_XML.format(content=content)
    passive, via_api = handle_incoming_xml(xml, ConsoleClient())
    if passive:
        print(f"\n<<< [被动回复]\n{passive}\n")
    print(f"(via_api={via_api})")


def main() -> None:
    setup_logging()
    load_env_local()
    if not os.getenv("DASHSCOPE_API_KEY", "").strip():
        print("错误: 请在 .env.local 配置 DASHSCOPE_API_KEY", file=sys.stderr)
        sys.exit(1)
    print(f"大模型: {os.getenv('DASHSCOPE_MODEL', 'glm-5')}")
    print(f"数据库: {os.environ['WEWORK_DB_PATH']}\n")

    run_command("帮助", "帮助")
    run_command("转发车信息(真实LLM)", SAMPLE_VEHICLE_TEXT)
    run_command("列表", "列表")
    run_command("生成Excel", "生成")
    run_command("清空", "清空")
    run_command("列表(清空后)", "列表")
    run_command("未知消息", "你好")

    print("=" * 60)
    print("本地指令测试完成。")


if __name__ == "__main__":
    main()
