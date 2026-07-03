from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, Response

from dispatch.fill import fill_dispatch_workbook
from dispatch.parse import parse_dispatch_text
from wework.routes import router as wework_router

ROOT_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = Path(os.getenv("H5_STATIC_DIR") or Path(__file__).resolve().parent / "static")


def normalize_base_path(raw: str) -> str:
    value = (raw or "").strip()
    if not value or value == "/":
        return ""
    if not value.startswith("/"):
        value = f"/{value}"
    return value.rstrip("/")


def load_env_local() -> None:
    if os.getenv("LUCHE_SKIP_ENV_LOCAL") == "1":
        return
    env_path = ROOT_DIR / ".env.local"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def create_api() -> FastAPI:
    api = FastAPI(title="乌达派车填表助手")
    api.include_router(wework_router)

    @api.on_event("startup")
    def on_startup() -> None:
        load_env_local()

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"ok": "true"}

    @api.post("/api/dispatch/parse")
    def parse_dispatch(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
        text = str(payload.get("text") or "")
        try:
            result = parse_dispatch_text(text)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"大模型解析失败：{exc}") from exc
        return {"ok": True, **result}

    @api.post("/api/dispatch/generate")
    def generate_dispatch(payload: dict[str, Any] = Body(...)) -> Response:
        vehicles = payload.get("vehicles")
        if not isinstance(vehicles, list) or not vehicles:
            raise HTTPException(status_code=400, detail="vehicles 不能为空")

        try:
            content, filename = fill_dispatch_workbook(vehicles)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        encoded = quote(filename)
        headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"}
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    @api.get("/{path:path}")
    def serve_frontend(path: str) -> FileResponse:
        if not STATIC_DIR.exists():
            raise HTTPException(status_code=404, detail="H5 静态资源未构建，请先执行 frontend/build.mjs")

        relative = "index.html" if path in {"", "h5"} else path
        candidate = (STATIC_DIR / relative).resolve()
        static_root = STATIC_DIR.resolve()
        if static_root not in candidate.parents and candidate != static_root:
            raise HTTPException(status_code=404, detail="资源不存在")
        if not candidate.is_file():
            candidate = static_root / "index.html"
        if not candidate.is_file():
            raise HTTPException(status_code=404, detail="资源不存在")
        return FileResponse(candidate)

    return api


def build_app() -> FastAPI:
    base_path = normalize_base_path(os.getenv("BASE_PATH", ""))
    api = create_api()
    if not base_path:
        return api

    root = FastAPI()
    root.mount(base_path, api)
    return root


app = build_app()


if __name__ == "__main__":
    import uvicorn

    load_env_local()
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "9000")))
