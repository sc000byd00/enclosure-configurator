"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import BoardForm from "@/components/BoardForm";
import Checks from "@/components/Checks";
import { absolute, buildEnclosure, readKicad, type BuildResult } from "@/lib/api";
import { clone, fromYaml, problems, toYaml, type Board } from "@/lib/board";
import { PRESETS } from "@/lib/presets";
import styles from "./page.module.css";

const Viewer = dynamic(() => import("@/components/Viewer"), { ssr: false });

const ROLES = [
  ["lid", "Lid"], ["light-pipe", "Light pipes"], ["components", "Components"], ["board", "Board"],
] as const;

export default function Home() {
  const [board, setBoard] = useState<Board>(() => clone(PRESETS[1]));
  const [result, setResult] = useState<BuildResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [explode, setExplode] = useState(0);
  const [fitToken, setFitToken] = useState(0);
  const refit = () => setFitToken((t) => t + 1);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"form" | "yaml">("form");
  const [yamlText, setYamlText] = useState("");
  const [overrides, setOverrides] = useState("");
  const abort = useRef<AbortController | null>(null);

  const build = useCallback(async (b: Board) => {
    const issues = problems(b);
    if (issues.length) {
      setError(issues.join("; "));
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError("");
    try {
      setResult(await buildEnclosure(b, ctrl.signal));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  }, []);

  useEffect(() => {
    // first preview on load; started from a timer so the effect itself sets no state
    const t = setTimeout(() => build(clone(PRESETS[1])), 0);
    return () => clearTimeout(t);
  }, [build]);

  const loadPreset = (i: number) => {
    const b = clone(PRESETS[i]);
    setBoard(b);
    setWarnings([]);
    build(b);
  };

  const onKicad = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { board: b, warnings: w } = await readKicad(file, overrides);
      setBoard(b);
      setWarnings(w);
      await build(b);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const toggle = (role: string) => {
    const h = new Set(hidden);
    if (h.has(role)) h.delete(role);
    else h.add(role);
    setHidden(h);
    refit();
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>PCB enclosure configurator</h1>
        <p>
          Describe the board, get a checked, 3D-printable enclosure with snap-fit lid, light pipes and
          connector cutouts. Built with{" "}
          <a href="https://github.com/sc000byd00/pcb-enclosure-generator">pcb-enclosure-generator</a>.
        </p>
      </header>

      <section className={styles.panel} aria-label="board">
        <div className={styles.toolbar}>
          <span>Start from</span>
          {PRESETS.map((p, i) => (
            <button key={p.name} type="button" onClick={() => loadPreset(i)}>{p.name.toUpperCase()}</button>
          ))}
          <label className={styles.upload}>
            KiCad file…
            <input type="file" accept=".kicad_pcb" aria-label="KiCad board file"
              onChange={(e) => onKicad(e.target.files?.[0])} />
          </label>
        </div>
        <details className={styles.overrides}>
          <summary>Overrides for the KiCad import (optional)</summary>
          <textarea value={overrides} onChange={(e) => setOverrides(e.target.value)} rows={4}
            placeholder={"button: cap\nadd:\n  - {type: vent, side: right, pos: 25, n: 5, w: 1.6, h: 6, pitch: 3.4}"} />
        </details>
        {warnings.length > 0 && (
          <ul className={styles.warnings}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        )}

        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={tab === "form"} onClick={() => setTab("form")}>Form</button>
          <button role="tab" aria-selected={tab === "yaml"}
            onClick={() => { setYamlText(toYaml(board)); setTab("yaml"); }}>YAML</button>
        </div>
        {tab === "form" ? (
          <BoardForm board={board} onChange={setBoard} />
        ) : (
          <div className={styles.yaml}>
            <textarea value={yamlText} onChange={(e) => setYamlText(e.target.value)} rows={24}
              spellCheck={false} aria-label="board YAML" />
            <button type="button" onClick={() => {
              try {
                setBoard(fromYaml(yamlText));
                setError("");
                setTab("form");
              } catch (e) {
                setError((e as Error).message);
              }
            }}>Apply YAML</button>
          </div>
        )}
        <button type="button" className={styles.build} onClick={() => build(board)} disabled={busy}>
          {busy ? "Building…" : "Build enclosure"}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>

      <section className={styles.view} aria-label="preview">
        <div className={styles.canvas}>
          {result ? (
            <Viewer parts={result.parts} height={result.outside[2]} explode={explode} hidden={hidden}
              fitToken={fitToken} />
          ) : (
            <p className={styles.placeholder}>{busy ? "Building the first enclosure…" : "No preview yet"}</p>
          )}
          {busy && result && <div className={styles.busy}>Building…</div>}
        </div>
        {result && (
          <>
            <div className={styles.controls}>
              <label>
                Explode
                <input type="range" min={0} max={1} step={0.01} value={explode} aria-label="explode"
                  onChange={(e) => setExplode(Number(e.target.value))}
                  onPointerUp={refit} onKeyUp={refit} />
              </label>
              {ROLES.map(([role, label]) => (
                <label key={role}>
                  <input type="checkbox" checked={!hidden.has(role)} onChange={() => toggle(role)} />
                  {label}
                </label>
              ))}
            </div>
            <div className={styles.summary}>
              <div>
                <strong>{result.title || result.name}</strong>
                <span>outside {result.outside.map((v) => v.toFixed(1)).join(" × ")} mm</span>
                <span className={result.passed ? styles.ok : styles.bad}>
                  {result.passed ? "all checks passed" : "some checks failed"}
                </span>
              </div>
              <a className={styles.download} href={absolute(result.download)} download>
                Download STEP, STL, 3MF (zip)
              </a>
            </div>
            <Checks checks={result.checks} notes={result.notes} />
          </>
        )}
      </section>
    </main>
  );
}
