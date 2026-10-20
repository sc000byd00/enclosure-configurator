"""Builds run in a separate process with a time limit; results are cached on disk by a
hash of the input, so the same board is only built once."""

import hashlib
import json
import multiprocessing as mp
import shutil
import threading
import zipfile
from pathlib import Path

import yaml

GENERATOR_VERSION = "1"  # bump to invalidate the cache after generator changes

# Parts shown in the viewer, in assembly position
MESH_ROLES = {
    "base": "base", "lid": "lid", "button-cap": "lid", "board": "board",
    "components-metal": "components", "components-black": "components",
    "components-led": "components",
}


def cache_key(data):
    raw = json.dumps(data, sort_keys=True, separators=(",", ":")) + GENERATOR_VERSION
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _role(name):
    if name.startswith("light-pipe"):
        return "light-pipe"
    return MESH_ROLES.get(name, "components")


def _work(data, out_dir):
    """Runs in the child process. Writes result.json, meshes and the download zip."""
    from enclosure import build, params_from_dict
    from enclosure.checks import as_dicts, passed, run
    from enclosure.export import outside, write_parts, write_render_meshes, write_report

    out = Path(out_dir)
    try:
        p = params_from_dict(data)
        enc, parts, pcb, bodies, env = build(p)
        res = run(enc, parts, pcb, bodies, env, overhang=False)
        files = out / "files"
        write_parts(parts, files)
        write_report(enc, res, files)
        (files / "board.yaml").write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
        with zipfile.ZipFile(out / "enclosure.zip", "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(files.iterdir()):
                z.write(f, f"{p.name}/{f.name}")
        write_render_meshes(parts, pcb, bodies, out / "mesh")
        result = dict(
            name=p.name, title=p.title, outside=outside(enc), passed=passed(res),
            notes=enc.notes, checks=as_dicts(res),
            parts=[dict(name=f.stem, role=_role(f.stem)) for f in sorted((out / "mesh").glob("*.stl"))],
        )
    except Exception as e:  # reported to the client, the process ends either way
        result = dict(error=f"{type(e).__name__}: {e}")
    (out / "result.json").write_text(json.dumps(result), encoding="utf-8")


class Builder:
    def __init__(self, cache_dir, timeout=90.0, max_parallel=2):
        self.cache = Path(cache_dir)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout
        self.slots = threading.Semaphore(max_parallel)
        self.locks = {}
        self.locks_guard = threading.Lock()

    def _lock(self, key):
        with self.locks_guard:
            return self.locks.setdefault(key, threading.Lock())

    def path(self, key):
        return self.cache / key

    def build(self, data):
        """Return (key, result dict). Blocks until done or timed out."""
        key = cache_key(data)
        out = self.path(key)
        with self._lock(key):
            done = out / "result.json"
            if done.exists():
                return key, json.loads(done.read_text(encoding="utf-8"))
            tmp = self.cache / (key + ".tmp")
            shutil.rmtree(tmp, ignore_errors=True)
            tmp.mkdir()
            with self.slots:
                proc = mp.get_context("spawn").Process(target=_work, args=(data, str(tmp)))
                proc.start()
                proc.join(self.timeout)
                if proc.is_alive():
                    proc.terminate()
                    proc.join(5)
                    shutil.rmtree(tmp, ignore_errors=True)
                    return key, dict(error=f"build took longer than {self.timeout:.0f} s")
            if not (tmp / "result.json").exists():
                shutil.rmtree(tmp, ignore_errors=True)
                return key, dict(error="build failed")
            result = json.loads((tmp / "result.json").read_text(encoding="utf-8"))
            if "error" in result:
                shutil.rmtree(tmp, ignore_errors=True)
                return key, result
            shutil.rmtree(out, ignore_errors=True)
            tmp.rename(out)
            return key, result
