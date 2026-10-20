import type { Board } from "./board";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Check = { id: string; ok: boolean | null; message: string };
export type Part = { name: string; role: string; url: string };
export type BuildResult = {
  id: string;
  name: string;
  title: string;
  outside: [number, number, number];
  passed: boolean;
  notes: string[];
  checks: Check[];
  parts: Part[];
  download: string;
};

async function fail(r: Response): Promise<never> {
  let msg = `${r.status} ${r.statusText}`;
  try {
    const body = await r.json();
    if (body?.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
  } catch {
    // not JSON, keep the status text
  }
  throw new Error(msg);
}

export function absolute(path: string): string {
  return path.startsWith("http") ? path : API_URL + path;
}

export async function getPresets(): Promise<Board[]> {
  const r = await fetch(`${API_URL}/api/presets`);
  if (!r.ok) return fail(r);
  return r.json();
}

export async function buildEnclosure(board: Board, signal?: AbortSignal): Promise<BuildResult> {
  const r = await fetch(`${API_URL}/api/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
    signal,
  });
  if (!r.ok) return fail(r);
  return r.json();
}

export async function readKicad(file: File, overrides: string): Promise<{ board: Board; warnings: string[] }> {
  const form = new FormData();
  form.append("board", file);
  form.append("overrides", overrides);
  const r = await fetch(`${API_URL}/api/kicad`, { method: "POST", body: form });
  if (!r.ok) return fail(r);
  return r.json();
}
