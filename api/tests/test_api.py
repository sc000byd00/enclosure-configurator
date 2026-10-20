import io
import zipfile
from pathlib import Path

import pytest

from app.ratelimit import RateLimit

FIXTURES = Path(__file__).parent / "fixtures"


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_presets_in_order(presets):
    assert list(presets) == ["s", "m", "l"]


@pytest.fixture(scope="module")
def built(client, presets):
    r = client.post("/api/build", json=presets["s"])
    assert r.status_code == 200, r.text
    return r.json()


def test_build_returns_checks_and_parts(built):
    assert built["passed"] is True
    assert built["outside"] == pytest.approx([55.4, 39.0, 17.1], abs=0.05)
    names = {p["name"] for p in built["parts"]}
    assert {"base", "lid", "light-pipe-1", "board"} <= names
    assert all(c["ok"] is not False for c in built["checks"])


def test_meshes_and_zip_are_served(client, built):
    lid = next(p for p in built["parts"] if p["name"] == "lid")
    r = client.get(lid["url"])
    assert r.status_code == 200 and len(r.content) > 1000
    z = zipfile.ZipFile(io.BytesIO(client.get(built["download"]).content))
    names = set(z.namelist())
    assert {"s/base.step", "s/lid.stl", "s/base.3mf", "s/report.md", "s/board.yaml"} <= names


def test_same_board_is_cached(client, presets, built):
    r = client.post("/api/build", json=presets["s"])
    assert r.json()["id"] == built["id"]


def test_invalid_board_is_rejected_with_message(client, presets):
    bad = dict(presets["s"], colour="red")
    r = client.post("/api/build", json=bad)
    assert r.status_code == 422 and "colour" in r.json()["detail"]


def test_limits(client, presets):
    big = dict(presets["s"], board=dict(presets["s"]["board"], size=[400, 30]))
    r = client.post("/api/build", json=big)
    assert r.status_code == 422 and "larger than" in r.json()["detail"]


def test_failing_design_still_returns_report(client, presets):
    thin = dict(presets["s"], shell={"wall": 1.2})
    r = client.post("/api/build", json=thin)
    assert r.status_code == 200
    body = r.json()
    assert body["passed"] is False
    assert any(c["id"] == "walls" and c["ok"] is False for c in body["checks"])


def test_file_names_are_checked(client, built):
    assert client.get(f"/api/files/{built['id']}/..%2Fresult.json").status_code == 404
    assert client.get("/api/files/nothex/lid.stl").status_code == 404


def test_kicad_upload(client):
    pcb = (FIXTURES / "esp32-node.kicad_pcb").read_bytes()
    r = client.post("/api/kicad", files={"board": ("node.kicad_pcb", pcb)},
                    data={"overrides": "button: flex\n"})
    assert r.status_code == 200, r.text
    board = r.json()["board"]
    assert board["name"] == "node" and board["board"]["size"] == [70.0, 50.0]
    assert any(c["type"] == "usb-c" for c in board["components"])
    assert board["snap_hooks"]


def test_kicad_rejects_other_files(client):
    r = client.post("/api/kicad", files={"board": ("x.kicad_pcb", b"(kicad_sch (version 1))")})
    assert r.status_code == 422


def test_rate_limit_window():
    t = [0.0]
    rl = RateLimit(2, window=10, clock=lambda: t[0])
    assert rl.allow("a", "build") and rl.allow("a", "build")
    assert not rl.allow("a", "build")
    assert rl.allow("b", "build")
    t[0] = 11
    assert rl.allow("a", "build")
