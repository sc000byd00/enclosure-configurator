"use client";

import { useState } from "react";
import {
  COMPONENT_FIELDS, COMPONENT_LABELS, SIDES, clone, newComponent,
  type Board, type Component, type ComponentType, type Side,
} from "@/lib/board";
import styles from "./BoardForm.module.css";

type Props = { board: Board; onChange: (b: Board) => void };

function Num({ value, onChange, label, step = 0.1, min, placeholder }: {
  value: number | undefined; onChange: (v: number | undefined) => void; label: string;
  step?: number; min?: number; placeholder?: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    // value changed from outside (preset, YAML, KiCad): show it unless the text already means it
    setPrev(value);
    if (!(text !== "" && Number(text) === value)) setText(value === undefined ? "" : String(value));
  }
  return (
    <label className={styles.num}>
      <span>{label}</span>
      <input
        type="number" inputMode="decimal" step={step} min={min} value={text} aria-label={label}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value === "") onChange(undefined);
          else if (!Number.isNaN(Number(e.target.value))) onChange(Number(e.target.value));
        }}
      />
    </label>
  );
}

function NumList({ value, onChange, label }: {
  value: number[]; onChange: (v: number[]) => void; label: string;
}) {
  const [text, setText] = useState(value.join(", "));
  const [prev, setPrev] = useState(value.join());
  if (value.join() !== prev) {
    setPrev(value.join());
    if (parseList(text).join() !== value.join()) setText(value.join(", "));
  }
  return (
    <label className={styles.list}>
      <span>{label}</span>
      <input
        value={text} aria-label={label} placeholder="e.g. 10, 40"
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseList(e.target.value));
        }}
      />
    </label>
  );
}

function parseList(t: string): number[] {
  return t.split(/[,;\s]+/).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
}

export default function BoardForm({ board, onChange }: Props) {
  const set = (fn: (b: Board) => void) => {
    const b = clone(board);
    fn(b);
    onChange(b);
  };
  const [addType, setAddType] = useState<ComponentType>("led");

  return (
    <div className={styles.form}>
      <fieldset>
        <legend>Board</legend>
        <div className={styles.row}>
          <Num label="length x" value={board.board.size[0]} onChange={(v) => set((b) => { b.board.size[0] = v ?? 0; })} />
          <Num label="depth y" value={board.board.size[1]} onChange={(v) => set((b) => { b.board.size[1] = v ?? 0; })} />
          <Num label="thickness" placeholder="1.6" value={board.board.thickness} onChange={(v) => set((b) => { b.board.thickness = v; })} />
          <Num label="corner r" placeholder="1.5" value={board.board.corner_radius} onChange={(v) => set((b) => { b.board.corner_radius = v; })} />
        </div>
        <div className={styles.row}>
          <Num label="tallest part" value={board.board.component_height} onChange={(v) => set((b) => { b.board.component_height = v ?? 0; })} />
          <Num label="standoff" placeholder="5" value={board.board.standoff} onChange={(v) => set((b) => { b.board.standoff = v; })} />
          <label className={styles.num}>
            <span>screw</span>
            <select value={board.board.screw ?? "M2.5"} aria-label="screw"
              onChange={(e) => set((b) => { b.board.screw = e.target.value as "M2.5" | "M3"; })}>
              <option>M2.5</option>
              <option>M3</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Mounting holes</legend>
        {board.board.holes.map(([x, y], i) => (
          <div className={styles.row} key={i}>
            <Num label={`hole ${i + 1} x`} value={x} onChange={(v) => set((b) => { b.board.holes[i][0] = v ?? 0; })} />
            <Num label="y" value={y} onChange={(v) => set((b) => { b.board.holes[i][1] = v ?? 0; })} />
            <button type="button" className={styles.remove} aria-label={`remove hole ${i + 1}`}
              onClick={() => set((b) => { b.board.holes.splice(i, 1); })}>×</button>
          </div>
        ))}
        <button type="button" className={styles.add}
          onClick={() => set((b) => { b.board.holes.push([5, 5]); })}>+ hole</button>
      </fieldset>

      <fieldset>
        <legend>Components</legend>
        <p className={styles.hint}>Board coordinates in mm from the front left corner. Edge parts take a side and a position along it.</p>
        {board.components.map((c, i) => (
          <ComponentRow key={i} c={c} index={i}
            onChange={(nc) => set((b) => { b.components[i] = nc; })}
            onRemove={() => set((b) => { b.components.splice(i, 1); })} />
        ))}
        <div className={styles.row}>
          <select value={addType} aria-label="component type"
            onChange={(e) => setAddType(e.target.value as ComponentType)}>
            {(Object.keys(COMPONENT_LABELS) as ComponentType[]).map((t) => (
              <option key={t} value={t}>{COMPONENT_LABELS[t]}</option>
            ))}
          </select>
          <button type="button" className={styles.add}
            onClick={() => set((b) => { b.components.push(newComponent(addType, b)); })}>+ add</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Lid and mounting</legend>
        <div className={styles.row}>
          {SIDES.map((s) => (
            <NumList key={s} label={`hooks ${s}`} value={board.snap_hooks[s] ?? []}
              onChange={(v) => set((b) => {
                if (v.length) b.snap_hooks[s] = v;
                else delete b.snap_hooks[s];
              })} />
          ))}
        </div>
        <div className={styles.row}>
          <label className={styles.num}>
            <span>button</span>
            <select value={board.button ?? "flex"} aria-label="button style"
              onChange={(e) => set((b) => { b.button = e.target.value as "flex" | "cap"; })}>
              <option value="flex">flexure in the lid</option>
              <option value="cap">separate cap</option>
            </select>
          </label>
          <Num label="wall" placeholder="2" value={board.shell?.wall} onChange={(v) => set((b) => {
            b.shell = { ...(b.shell ?? {}), wall: v };
            if (v === undefined) delete b.shell.wall;
          })} />
          <NumList label="keyholes x" value={board.wall_mount ?? []}
            onChange={(v) => set((b) => { if (v.length) b.wall_mount = v; else delete b.wall_mount; })} />
        </div>
      </fieldset>
    </div>
  );
}

function ComponentRow({ c, index, onChange, onRemove }: {
  c: Component; index: number; onChange: (c: Component) => void; onRemove: () => void;
}) {
  const fields = COMPONENT_FIELDS[c.type];
  const upd = (key: string, v: number | string | undefined) => {
    const nc = { ...c, [key]: v };
    if (v === undefined) delete nc[key];
    onChange(nc);
  };
  return (
    <div className={styles.component}>
      <strong title={c.ref}>{COMPONENT_LABELS[c.type]}{c.ref ? ` ${c.ref}` : ""}</strong>
      {fields.map((f) =>
        f.kind === "side" ? (
          <label key={f.key} className={styles.num}>
            <span>{f.label}</span>
            <select value={String(c[f.key] ?? "left")} aria-label={`${f.label} ${index + 1}`}
              onChange={(e) => upd(f.key, e.target.value as Side)}>
              {SIDES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        ) : f.kind === "dir" ? (
          <label key={f.key} className={styles.num}>
            <span>{f.label}</span>
            <select value={String(c[f.key] ?? "+x")} aria-label={`flexure direction ${index + 1}`}
              onChange={(e) => upd(f.key, e.target.value)}>
              <option value="+x">root to +x</option>
              <option value="-x">root to -x</option>
            </select>
          </label>
        ) : (
          <Num key={f.key} label={f.label} step={f.step} value={c[f.key] as number | undefined}
            onChange={(v) => upd(f.key, v)} />
        ),
      )}
      <button type="button" className={styles.remove} aria-label={`remove component ${index + 1}`}
        onClick={onRemove}>×</button>
    </div>
  );
}
