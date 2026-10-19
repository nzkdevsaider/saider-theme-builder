import type { TokenKind } from "./systems";

export const SCHEMA_VERSION = 1;

export interface TokenDef {
  key: string;
  figmaName: string;
  kind: TokenKind;
  default: string;
  scopes: VariableScope[];
}

type VariableScope =
  | "ALL_SCOPES" | "FRAME_FILL" | "SHAPE_FILL" | "TEXT_FILL" | "STROKE_COLOR"
  | "CORNER_RADIUS" | "WIDTH_HEIGHT" | "GAP" | "STROKE_FLOAT";

const FILL: VariableScope[] = ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"];
const CONTENT: VariableScope[] = ["TEXT_FILL", "SHAPE_FILL", "STROKE_COLOR"];

const color = (key: string, def: string, content = false): TokenDef => ({
  key, figmaName: `color/${key}`, kind: "color", default: def, scopes: content ? CONTENT : FILL,
});

export const CONTRAST_PAIRS: [string, string][] = [
  ["base-100", "base-content"],
  ["base-200", "base-content"],
  ["primary", "primary-content"],
  ["secondary", "secondary-content"],
  ["accent", "accent-content"],
  ["neutral", "neutral-content"],
  ["info", "info-content"],
  ["success", "success-content"],
  ["warning", "warning-content"],
  ["error", "error-content"],
];

const BRAND: [string, string, string][] = [
  ["primary", "blue-600", "white"],
  ["secondary", "violet-600", "white"],
  ["accent", "teal-400", "teal-950"],
  ["neutral", "gray-800", "gray-50"],
  ["info", "sky-500", "sky-950"],
  ["success", "green-700", "green-50"],
  ["warning", "amber-400", "amber-950"],
  ["error", "red-700", "red-50"],
];

export const SCHEMA = {
  version: SCHEMA_VERSION,
  tokens: [
    color("base-100", "white"),
    color("base-200", "gray-100"),
    color("base-300", "gray-200"),
    color("base-content", "gray-900", true),
    ...BRAND.flatMap(([k, bg, fg]) => [color(k, bg), color(`${k}-content`, fg, true)]),
    { key: "radius-selector", figmaName: "radius/selector", kind: "radius", default: "lg", scopes: ["CORNER_RADIUS"] },
    { key: "radius-field", figmaName: "radius/field", kind: "radius", default: "default", scopes: ["CORNER_RADIUS"] },
    { key: "radius-box", figmaName: "radius/box", kind: "radius", default: "lg", scopes: ["CORNER_RADIUS"] },
    { key: "size-selector", figmaName: "size/selector", kind: "size", default: "1", scopes: ["WIDTH_HEIGHT", "GAP"] },
    { key: "size-field", figmaName: "size/field", kind: "size", default: "1", scopes: ["WIDTH_HEIGHT", "GAP"] },
    { key: "border", figmaName: "border", kind: "size", default: "px", scopes: ["STROKE_FLOAT"] },
  ] as TokenDef[],
};

export function tokenByKey(key: string): TokenDef | undefined {
  return SCHEMA.tokens.find((t) => t.key === key);
}

export function tokenByFigmaName(name: string): TokenDef | undefined {
  return SCHEMA.tokens.find((t) => t.figmaName === name);
}

export function figmaNameOf(key: string): string {
  const known = tokenByKey(key);
  if (known) return known.figmaName;
  const m = /^(radius|size)-(.+)$/.exec(key);
  if (m) return `${m[1]}/${m[2]}`;
  return key === "border" ? "border" : `color/${key}`;
}
