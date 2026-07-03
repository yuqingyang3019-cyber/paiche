from __future__ import annotations

import json
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from fastapi.testclient import TestClient

from main import app
from wework.callback import build_crypto, decrypt_message
from wework.config import WeWorkSettings
from wework.handler import handle_incoming_xml
from wework.session import append_vehicles, clear_vehicles, format_vehicle_summary, load_vehicles

SAMPLE_TEXT = """车号：蒙L93723
姓名：康有光
电话：15164810755
身份证号：152827197608242172"""

SAMPLE_VEHICLE = {
    "plate": "蒙L93723",
    "name": "康有光",
    "phone": "15164810755",
    "idCard": "152827197608242172",
}

SAMPLE_XML = """<xml>
<ToUserName><![CDATA[wwcorp]]></ToUserName>
<FromUserName><![CDATA[zhangsan]]></FromUserName>
<CreateTime>1348831860</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[{content}]]></Content>
<MsgId>123</MsgId>
<AgentID>1</AgentID>
</xml>"""


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def session_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("WEWORK_SESSION_DIR", str(tmp_path))
    monkeypatch.setenv("LUCHE_SKIP_ENV_LOCAL", "1")
    return tmp_path


@pytest.fixture
def mock_client():
    client = MagicMock()
    client.send_file = MagicMock()
    return client


def test_append_and_list(session_dir) -> None:
    append_vehicles("user1", [SAMPLE_VEHICLE])
    vehicles = load_vehicles("user1")
    assert len(vehicles) == 1
    assert vehicles[0]["plate"] == "蒙L93723"


def test_clear_session(session_dir) -> None:
    append_vehicles("user1", [SAMPLE_VEHICLE])
    clear_vehicles("user1")
    assert load_vehicles("user1") == []


def test_format_summary(session_dir) -> None:
    append_vehicles("user1", [SAMPLE_VEHICLE])
    summary = format_vehicle_summary(load_vehicles("user1"))
    assert "蒙L93723" in summary
    assert "康有光" in summary


def test_handle_vehicle_text(session_dir, mock_client) -> None:
    xml = SAMPLE_XML.format(content=SAMPLE_TEXT)
    reply, active = handle_incoming_xml(xml, mock_client)
    assert active is False
    assert reply
    assert "已添加" in reply
    assert len(load_vehicles("zhangsan")) == 1


def test_handle_help_command(session_dir, mock_client) -> None:
    xml = SAMPLE_XML.format(content="帮助")
    reply, _ = handle_incoming_xml(xml, mock_client)
    assert "转发" in reply


def test_handle_list_command(session_dir, mock_client) -> None:
    append_vehicles("zhangsan", [SAMPLE_VEHICLE])
    xml = SAMPLE_XML.format(content="列表")
    reply, _ = handle_incoming_xml(xml, mock_client)
    assert "蒙L93723" in reply


def test_handle_clear_command(session_dir, mock_client) -> None:
    append_vehicles("zhangsan", [SAMPLE_VEHICLE])
    xml = SAMPLE_XML.format(content="清空")
    reply, _ = handle_incoming_xml(xml, mock_client)
    assert "清空" in reply
    assert load_vehicles("zhangsan") == []


@patch("wework.handler.fill_dispatch_workbook")
def test_handle_generate(mock_fill, session_dir, mock_client) -> None:
    append_vehicles("zhangsan", [SAMPLE_VEHICLE])
    mock_fill.return_value = (b"xlsx-bytes", "乌达君正7.3.xlsx")

    xml = SAMPLE_XML.format(content="生成")
    reply, active = handle_incoming_xml(xml, mock_client)

    assert active is True
    assert "乌达君正7.3.xlsx" in reply
    mock_client.send_file.assert_called_once()


def test_wework_callback_disabled(client) -> None:
    with patch.dict("os.environ", {"LUCHE_SKIP_ENV_LOCAL": "1"}, clear=False):
        response = client.get(
            "/api/wework/callback",
            params={
                "msg_signature": "sig",
                "timestamp": "123",
                "nonce": "nonce",
                "echostr": "echo",
            },
        )
    assert response.status_code == 503


def test_decrypt_post_body_roundtrip() -> None:
    from wechatpy.crypto import _get_signature

    settings = WeWorkSettings(
        corp_id="wwtestcorp",
        agent_id=1,
        agent_secret="secret",
        token="69Ku5OIg",
        encoding_aes_key="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        session_dir="/tmp/wework-test",
    )
    crypto = build_crypto(settings)
    inner_xml = SAMPLE_XML.format(content="列表")
    nonce = "nonce123"
    timestamp = "1234567890"
    encrypted_xml = crypto.encrypt_message(inner_xml, nonce, timestamp)
    encrypt_text = encrypted_xml.split("<Encrypt><![CDATA[")[1].split("]]></Encrypt>")[0]
    signature = _get_signature(settings.token, timestamp, nonce, encrypt_text)

    decrypted = decrypt_message(crypto, signature, timestamp, nonce, encrypted_xml.encode("utf-8"))
    assert "列表" in decrypted
