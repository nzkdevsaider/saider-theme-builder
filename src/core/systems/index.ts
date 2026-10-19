import { TAILWIND_COLORS, TAILWIND_RADIUS, TAILWIND_SPACING, TAILWIND_SCREENS } from "./tailwind.data";

export type TokenKind = "color" | "radius" | "size";

export interface PrimitiveSystem {
  id: string;
  label: string;
  version: number;
  colors: Record<string, string>;
  radius: Record<string, number>;
  spacing: Record<string, number>;
  screens: Record<string, number>;
}

export const SYSTEMS: Record<string, PrimitiveSystem> = {
  tailwind: {
    id: "tailwind",
    label: "Tailwind",
    version: 1,
    colors: TAILWIND_COLORS,
    radius: TAILWIND_RADIUS,
    spacing: TAILWIND_SPACING,
    screens: TAILWIND_SCREENS,
  },
};

export function getSystem(id: string | undefined | null): PrimitiveSystem | null {
  return (id && SYSTEMS[id]) || null;
}

export function scaleOf(sys: PrimitiveSystem, kind: TokenKind): Record<string, string | number> {
  if (kind === "color") return sys.colors;
  if (kind === "radius") return sys.radius;
  return sys.spacing;
}

export function normalizeRef(kind: TokenKind, input: string): string {
  const s = input.trim().toLowerCase();
  if (kind === "color") return s.replace(/[/.]/g, "-");
  if (kind === "radius") return s === "rounded" ? "default" : s.replace(/^rounded-/, "");
  return s.replace(/[_\u2024]/g, ".");
}

export interface Resolved<V = string | number> {
  ref: string;
  value: V;
}

export function resolveRef(sys: PrimitiveSystem, kind: TokenKind, input: string): Resolved | null {
  const ref = normalizeRef(kind, input);
  const scale = scaleOf(sys, kind);
  return ref in scale ? { ref, value: scale[ref] } : null;
}

const GROUP: Record<TokenKind, string> = { color: "color", radius: "radius", size: "spacing" };

export function primitiveVarName(kind: TokenKind, ref: string): string {
  if (kind === "color") {
    const m = /^(.+)-(\d+)$/.exec(ref);
    return m ? `color/${m[1]}/${m[2]}` : `color/${ref}`;
  }
  return `${GROUP[kind]}/${ref.replace(/\./g, "_")}`;
}

export function parsePrimitiveVarName(name: string): { kind: TokenKind; ref: string } | null {
  const [group, ...rest] = name.split("/");
  if (!rest.length) return null;
  if (group === "color") return { kind: "color", ref: rest.join("-") };
  if (group === "radius") return { kind: "radius", ref: rest.join("/") };
  if (group === "spacing") return { kind: "size", ref: rest.join("/").replace(/_/g, ".") };
  return null;
}

export function nearestPrimitive(
  sys: PrimitiveSystem,
  kind: TokenKind,
  value: string | number,
  distance: (a: string, b: string) => number,
): { ref: string; value: string | number; delta: number } {
  const scale = scaleOf(sys, kind);
  let best = { ref: "", value: value, delta: Infinity };
  for (const [ref, v] of Object.entries(scale)) {
    const d = kind === "color" ? distance(String(value), String(v)) : Math.abs(Number(v) - Number(value));
    if (d < best.delta) best = { ref, value: v, delta: d };
  }
  return best;
}
