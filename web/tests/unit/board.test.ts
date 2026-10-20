import { describe, expect, it } from "vitest";
import {
  COMPONENT_FIELDS, clone, explodeOffset, fromYaml, newComponent, problems, toYaml, type Board,
} from "@/lib/board";
import { PRESETS } from "@/lib/presets";

const m = () => clone(PRESETS[1]);

describe("presets", () => {
  it("are S, M, L and pass the quick checks", () => {
    expect(PRESETS.map((p) => p.name)).toEqual(["s", "m", "l"]);
    for (const p of PRESETS) expect(problems(p)).toEqual([]);
  });
});

describe("yaml", () => {
  it("round-trips a board", () => {
    const b = m();
    expect(fromYaml(toYaml(b))).toEqual(b);
  });
  it("rejects text that is not a board", () => {
    expect(() => fromYaml("- 1\n- 2")).toThrow("expected a board");
    expect(() => fromYaml("name: x")).toThrow("board.size");
  });
  it("fills in missing lists", () => {
    const b = fromYaml("board: {size: [40, 30], component_height: 5}");
    expect(b.components).toEqual([]);
    expect(b.snap_hooks).toEqual({});
    expect(b.board.holes).toEqual([]);
  });
});

describe("problems", () => {
  it("finds a hole outside the board and missing hooks", () => {
    const b: Board = m();
    b.board.holes.push([90, 10]);
    b.snap_hooks = {};
    const p = problems(b);
    expect(p).toContain("hole 5 is outside the board");
    expect(p).toContain("add at least one snap hook");
  });
  it("needs exactly one button for a cap", () => {
    const b = m();
    b.button = "cap";
    b.components = b.components.filter((c) => c.type !== "button");
    expect(problems(b)).toContain("a button cap needs exactly one button");
  });
});

describe("components", () => {
  it("new components have every field the form shows", () => {
    const b = m();
    for (const type of Object.keys(COMPONENT_FIELDS) as (keyof typeof COMPONENT_FIELDS)[]) {
      const c = newComponent(type, b);
      for (const f of COMPONENT_FIELDS[type]) expect(c[f.key], `${type}.${f.key}`).toBeDefined();
    }
  });
  it("edge parts start on an edge, others inside the board", () => {
    const b = m();
    expect(newComponent("usb-c", b)).toMatchObject({ side: "left", pos: 25 });
    expect(newComponent("led", b)).toMatchObject({ x: 35, y: 25 });
  });
});

describe("explode", () => {
  it("lifts the lid above the board and leaves the base", () => {
    expect(explodeOffset("base", "base", 20, 1)).toBe(0);
    expect(explodeOffset("lid", "lid", 20, 1)).toBeGreaterThan(explodeOffset("board", "board", 20, 1));
    expect(explodeOffset("lid", "button-cap", 20, 1)).toBe(explodeOffset("light-pipe", "light-pipe-1", 20, 1));
    expect(explodeOffset("lid", "lid", 20, 0)).toBe(0);
  });
});
