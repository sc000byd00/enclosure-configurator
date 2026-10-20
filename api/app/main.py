"""HTTP API for the enclosure configurator.

    GET  /api/health
    GET  /api/presets                 example boards
    POST /api/build                   board (JSON, board-file format) -> checks, part list
    GET  /api/files/{id}/{part}.stl   part mesh in assembly position, for the viewer
    GET  /api/files/{id}/enclosure.zip   STEP, STL, 3MF, report
    POST /api/kicad                   .kicad_pcb upload (+ optional overrides) -> board
"""

import os
import re
import tempfile
from pathlib import Path

import yaml
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool

from enclosure import ConfigError, params_from_dict

from .builder import Builder
from .ratelimit import RateLimit

PRESETS = Path(__file__).parent / "presets"
MAX_BODY = 64 * 1024
MAX_UPLOAD = 2 * 1024 * 1024
LIMITS = dict(board_mm=300.0, components=60, holes=16, vent_slots=40, hooks=12)

app = FastAPI(title="Enclosure configurator API", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
builder = Builder(os.environ.get("CACHE_DIR", Path(tempfile.gettempdir()) / "enclosure-cache"),
                  timeout=float(os.environ.get("BUILD_TIMEOUT", "90")))
limit = RateLimit(int(os.environ.get("RATE_LIMIT", "30")), window=600)


def client_ip(request: Request):
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def check_limits(data):
    """Bounds that keep a single build cheap. Format errors are left to the generator."""
    board = data.get("board") or {}
    size = board.get("size") or [0, 0]
    if any(isinstance(v, (int, float)) and v > LIMITS["board_mm"] for v in size):
        raise ConfigError(f"board larger than {LIMITS['board_mm']:g} mm")
    if len(data.get("components") or []) > LIMITS["components"]:
        raise ConfigError(f"more than {LIMITS['components']} components")
    if len(board.get("holes") or []) > LIMITS["holes"]:
        raise ConfigError(f"more than {LIMITS['holes']} mounting holes")
    for c in data.get("components") or []:
        if isinstance(c, dict) and isinstance(c.get("n"), int) and c["n"] > LIMITS["vent_slots"]:
            raise ConfigError(f"more than {LIMITS['vent_slots']} vent slots")
    hooks = data.get("snap_hooks") or {}
    if isinstance(hooks, dict) and sum(len(v or []) for v in hooks.values()) > LIMITS["hooks"]:
        raise ConfigError(f"more than {LIMITS['hooks']} snap hooks")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/presets")
def presets():
    out = []
    for f in sorted(PRESETS.glob("*.yaml")):
        out.append(yaml.safe_load(f.read_text(encoding="utf-8")))
    order = {"s": 0, "m": 1, "l": 2}
    return sorted(out, key=lambda d: order.get(d.get("name"), 9))


@app.post("/api/build")
async def build(request: Request):
    if not limit.allow(client_ip(request), "build"):
        raise HTTPException(429, "too many builds, try again in a few minutes")
    body = await request.body()
    if len(body) > MAX_BODY:
        raise HTTPException(413, "request too large")
    try:
        data = yaml.safe_load(body) if body else None  # JSON is valid YAML
        if not isinstance(data, dict):
            raise ConfigError("expected a board description")
        check_limits(data)
        params_from_dict(data)  # validate before spending a process on it
    except (ConfigError, yaml.YAMLError) as e:
        raise HTTPException(422, str(e))
    key, result = await run_in_threadpool(builder.build, data)
    if "error" in result:
        raise HTTPException(500, result["error"])
    base = f"/api/files/{key}"
    return {
        "id": key, **{k: v for k, v in result.items() if k != "parts"},
        "parts": [dict(p, url=f"{base}/{p['name']}.stl") for p in result["parts"]],
        "download": f"{base}/enclosure.zip",
    }


@app.get("/api/files/{key}/{name}")
def files(key: str, name: str):
    if not re.fullmatch(r"[0-9a-f]{24}", key) or not re.fullmatch(r"[a-z0-9-]+\.(stl|zip)", name):
        raise HTTPException(404)
    root = builder.path(key)
    f = root / "enclosure.zip" if name == "enclosure.zip" else root / "mesh" / name
    if not f.is_file():
        raise HTTPException(404)
    media = "application/zip" if name.endswith(".zip") else "model/stl"
    headers = {"Cache-Control": "public, max-age=86400, immutable"}
    return FileResponse(f, media_type=media, headers=headers,
                        filename=name if name.endswith(".zip") else None)


@app.post("/api/kicad")
async def kicad(request: Request, board: UploadFile = File(...), overrides: str = Form("")):
    if not limit.allow(client_ip(request), "kicad"):
        raise HTTPException(429, "too many uploads, try again in a few minutes")
    from enclosure.kicad import KicadError, apply_overrides, auto_layout, read_board

    raw = await board.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "board file larger than 2 MB")
    name = re.sub(r"[^A-Za-z0-9_-]+", "-", Path(board.filename or "board").stem)[:40] or "board"
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / f"{name}.kicad_pcb"
        f.write_bytes(raw)
        try:
            data, warnings, _ = read_board(f, name=name)
            if overrides.strip():
                ov = yaml.safe_load(overrides)
                if not isinstance(ov, dict):
                    raise KicadError("overrides must be a mapping")
                apply_overrides(data, ov)
            auto_layout(data)
            check_limits(data)
            params_from_dict(data)
        except UnicodeDecodeError:
            raise HTTPException(422, "not a text file")
        except (KicadError, ConfigError, yaml.YAMLError, ValueError) as e:
            raise HTTPException(422, str(e))
    return {"board": data, "warnings": warnings}
