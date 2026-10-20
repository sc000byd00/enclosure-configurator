// Board description in the same format as the generator's YAML files.

import { parse, stringify } from "yaml";

export type Side = "left" | "right" | "front" | "back";
export const SIDES: Side[] = ["left", "right", "front", "back"];

export type ComponentType =
  | "usb-c" | "barrel" | "terminal" | "vent"
  | "led" | "button" | "module" | "header" | "sensor" | "cap";

export type Component = { type: ComponentType; ref?: string } & Record<string, number | string | undefined>;

export type Board = {
  name: string;
  title?: string;
  board: {
    size: [number, number];
    holes: [number, number][];
    component_height: number;
    thickness?: number;
    corner_radius?: number;
    screw?: "M2.5" | "M3";
    standoff?: number;
  };
  components: Component[];
  snap_hooks: Partial<Record<Side, number[]>>;
  button?: "flex" | "cap";
  wall_mount?: number[];
  shell?: { wall?: number; floor?: number; lid?: number; corner_radius?: number };
  [key: string]: unknown;
};

type Field = { key: string; label: string; kind: "number" | "side" | "dir"; step?: number };

// Fields per component type, in the order they are shown
export const COMPONENT_FIELDS: Record<ComponentType, Field[]> = {
  "usb-c": edgeFields(),
  barrel: edgeFields(),
  terminal: edgeFields(),
  vent: [
    { key: "side", label: "side", kind: "side" },
    { key: "pos", label: "pos", kind: "number" },
    { key: "n", label: "slots", kind: "number", step: 1 },
    { key: "w", label: "w", kind: "number" },
    { key: "h", label: "h", kind: "number" },
    { key: "pitch", label: "pitch", kind: "number" },
  ],
  led: xy(),
  button: [...xy(), { key: "dir", label: "flexure", kind: "dir" }],
  module: [...xy(), ...wdh()],
  header: [...xy(), ...wdh()],
  sensor: [...xy(), ...wdh()],
  cap: [...xy(), { key: "dia", label: "Ø", kind: "number" }, { key: "h", label: "h", kind: "number" }],
};

function edgeFields(): Field[] {
  return [
    { key: "side", label: "side", kind: "side" },
    { key: "pos", label: "pos", kind: "number" },
    { key: "overhang", label: "overhang", kind: "number" },
  ];
}
function xy(): Field[] {
  return [
    { key: "x", label: "x", kind: "number" },
    { key: "y", label: "y", kind: "number" },
  ];
}
function wdh(): Field[] {
  return [
    { key: "w", label: "w", kind: "number" },
    { key: "d", label: "d", kind: "number" },
    { key: "h", label: "h", kind: "number" },
  ];
}

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  "usb-c": "USB-C", barrel: "DC jack", terminal: "Screw terminal", vent: "Vent slots",
  led: "LED", button: "Button", module: "Module", header: "Pin header", sensor: "Small part",
  cap: "Capacitor",
};

/** A new component of `type`, placed in the middle of the board or edge. */
export function newComponent(type: ComponentType, board: Board): Component {
  const [px, py] = board.board.size;
  const cx = Math.round(px / 2), cy = Math.round(py / 2);
  switch (type) {
    case "usb-c":
    case "barrel":
    case "terminal":
      return { type, side: "left", pos: cy, overhang: type === "usb-c" ? 0.6 : 0 };
    case "vent":
      return { type, side: "right", pos: cy, n: 5, w: 1.6, h: 6, pitch: 3.4 };
    case "led":
      return { type, x: cx, y: cy };
    case "button":
      return { type, x: cx, y: cy, dir: "+x" };
    case "cap":
      return { type, x: cx, y: cy, dia: 6.3, h: 7.7 };
    default:
      return { type, x: cx - 5, y: cy - 5, w: 10, d: 10, h: 2 };
  }
}

export function toYaml(b: Board): string {
  return stringify(b, { lineWidth: 100 });
}

export function fromYaml(text: string): Board {
  const data = parse(text, { maxAliasCount: 50 });
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("expected a board description");
  }
  const b = data as Board;
  if (!b.board || !Array.isArray(b.board.size)) throw new Error("missing board.size");
  b.components ??= [];
  b.snap_hooks ??= {};
  b.board.holes ??= [];
  return b;
}

/** Quick checks before sending a build; the server does the full validation. */
export function problems(b: Board): string[] {
  const out: string[] = [];
  const [px, py] = b.board.size;
  if (!(px > 0 && py > 0)) out.push("board size must be positive");
  if (px > 300 || py > 300) out.push("board larger than 300 mm");
  if (!(b.board.component_height > 0)) out.push("component height must be positive");
  b.board.holes.forEach(([x, y], i) => {
    if (!(x > 0 && x < px && y > 0 && y < py)) out.push(`hole ${i + 1} is outside the board`);
  });
  const hooks = Object.values(b.snap_hooks).flat();
  if (!hooks.length) out.push("add at least one snap hook");
  const buttons = b.components.filter((c) => c.type === "button");
  if (b.button === "cap" && buttons.length !== 1) out.push("a button cap needs exactly one button");
  return out;
}

// Viewer: how far each part moves up in the exploded view, as a share of the height
const EXPLODE: Record<string, number> = {
  base: 0, board: 1.3, components: 1.3, lid: 2.9, "light-pipe": 3.7,
};

export function explodeOffset(role: string, name: string, height: number, amount: number): number {
  const key = name === "button-cap" ? "light-pipe" : role;
  return (EXPLODE[key] ?? 0) * height * amount;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
