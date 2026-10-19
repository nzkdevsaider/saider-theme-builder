import type { Issue } from "../core/doctor";
import { toSaiderJson } from "../core/exporter";
import type { ImportRow } from "../core/parser";
import { SCHEMA, SCHEMA_VERSION } from "../core/schema";
import type { PrimitiveSystem } from "../core/systems";
import type { ThemeInfo } from "../core/themes";

export interface Swatch { ref: string; shade: string; hex: string }
export interface ColorGrid { families: { name: string; shades: Swatch[] }[]; singles: Swatch[] }

export function colorGrid(sys: PrimitiveSystem): ColorGrid {
  const families = new Map<string, Swatch[]>();
  const singles: Swatch[] = [];
  for (const [ref, hex] of Object.entries(sys.colors)) {
    const m = /^(.+)-(\d+)$/.exec(ref);
    if (!m) { singles.push({ ref, shade: "", hex }); continue; }
    families.set(m[1], [...(families.get(m[1]) ?? []), { ref, shade: m[2], hex }]);
  }
  return {
    families: [...families].map(([name, shades]) => ({ name, shades: shades.sort((a, b) => +a.shade - +b.shade) })),
    singles,
  };
}

export function newThemeTemplate(systemId: string): string {
  const out: Record<string, string | number> = { $saider: SCHEMA_VERSION, name: "new-theme", system: systemId };
  for (const t of SCHEMA.tokens) out[t.key] = t.default;
  return JSON.stringify(out, null, 2);
}

export function duplicateTemplate(theme: ThemeInfo, systemId: string): string {
  const json = JSON.parse(toSaiderJson(theme, systemId));
  json.name = `${theme.name}-copy`;
  return JSON.stringify(json, null, 2);
}

export const TOKEN_GROUPS: { group: "base" | "brand" | "states" | "shapes"; keys: string[] }[] = [
  { group: "base", keys: ["base-100", "base-200", "base-300", "base-content"] },
  { group: "brand", keys: ["primary", "primary-content", "secondary", "secondary-content", "accent", "accent-content", "neutral", "neutral-content"] },
  { group: "states", keys: ["info", "info-content", "success", "success-content", "warning", "warning-content", "error", "error-content"] },
  { group: "shapes", keys: ["radius-selector", "radius-field", "radius-box", "size-selector", "size-field", "border"] },
];

export function issueCounts(issues: Issue[]) {
  const c = { error: 0, warning: 0, info: 0, byTheme: {} as Record<string, number> };
  for (const i of issues) {
    c[i.severity]++;
    if (i.theme && i.severity !== "info") c.byTheme[i.theme] = (c.byTheme[i.theme] ?? 0) + 1;
  }
  return c;
}

export const needsAttention = (r: ImportRow) => r.status === "snapped" || r.status === "reconverted" || r.status === "default" || r.status === "unresolved";
