import { contrastRatio, deltaE, parseHex } from "./color";
import type { CollectionSnap, Snapshot, VarSnap } from "./model";
import { THEME_PREFIX, themeCollectionName } from "./model";
import { CONTRAST_PAIRS, SCHEMA, SCHEMA_VERSION, type TokenDef } from "./schema";
import { getSystem, nearestPrimitive, parsePrimitiveVarName, primitiveVarName, resolveRef, scaleOf, type PrimitiveSystem, type TokenKind } from "./systems";

export type Severity = "error" | "warning" | "info";

export type Fix =
  | { type: "install-system"; system: string }
  | { type: "repair-system"; system: string }
  | { type: "set-root-system"; system: string }
  | { type: "create-token"; collectionId: string; key: string; ref: string }
  | { type: "relink"; variableId: string; kind: TokenKind; ref: string }
  | { type: "rename-var"; variableId: string; name: string }
  | { type: "set-scopes"; variableId: string; scopes: string[] }
  | { type: "delete-var"; variableId: string }
  | { type: "recreate-token"; variableId: string; collectionId: string; key: string; ref: string }
  | { type: "rename-mode"; collectionId: string; modeId: string; name: string }
  | { type: "remove-mode"; collectionId: string; modeId: string }
  | { type: "rename-theme"; collectionId: string; name: string }
  | { type: "adopt-theme"; collectionId: string; name: string; system: string }
  | { type: "migrate-theme"; collectionId: string; from: number }
  | { type: "set-default"; collectionId: string };

export interface RuleParams {
  "multiple-systems": { count: number };
  "system-missing": { system: string };
  "root-mismatch": { system: string };
  "system-drift": { count: number; system: string };
  "unmanaged-theme": { collection: string };
  "duplicate-theme": { theme: string };
  "schema-newer": { theme: string; version: number; supported: number };
  "schema-outdated": { theme: string; version: number; target: number };
  "default-theme": { multiple: boolean };
  "collection-name": { actual: string; expected: string };
  "extra-modes": { theme: string; mode: string };
  "mode-name": { actual: string; expected: string };
  "name-drift": { actual: string; expected: string };
  "missing-token": { name: string };
  "wrong-type": { name: string; actual: string; expected: string };
  "empty-value": { name: string };
  "literal-value": { name: string; value: string };
  "broken-alias": { name: string };
  "foreign-alias": { name: string; target: string };
  "wrong-scale": { name: string; target: string };
  "wrong-scopes": { name: string };
  "extra-token": { name: string };
  contrast: { bg: string; fg: string; ratio: number };
}

export type RuleId = keyof RuleParams;

interface IssueBase {
  id: string;
  severity: Severity;
  collectionId?: string;
  theme?: string;
  token?: string;
  fix?: Fix;
  destructive?: boolean;
}

export type Issue = { [R in RuleId]: IssueBase & { rule: R; params: RuleParams[R] } }[RuleId];
type NewIssue = Issue extends infer I ? (I extends Issue ? Omit<I, "id"> : never) : never;

const expectedType = (def: TokenDef) => (def.kind === "color" ? "COLOR" : "FLOAT");
const normalizeName = (n: string) => n.toLowerCase().replace(/[\s_.]+/g, "-").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
const sameScopes = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

function resolveLiteral(s: Snapshot, v: VarSnap | undefined, depth = 0): string | number | null {
  if (!v || depth > 8) return null;
  if (v.value.kind === "literal") return typeof v.value.value === "boolean" ? null : v.value.value;
  if (v.value.kind === "alias") return resolveLiteral(s, s.variables[v.value.targetId], depth + 1);
  return null;
}

export function diagnose(s: Snapshot): Issue[] {
  const issues: Issue[] = [];
  let n = 0;
  const push = (i: NewIssue) => issues.push({ id: `${i.rule}:${n++}`, ...i } as Issue);

  const systemCols = s.collections.filter((c) => c.meta.kind === "system");
  const managedThemes = s.collections.filter((c) => c.meta.kind === "theme");
  const legacyThemes = s.collections.filter((c) => !c.meta.kind && c.name.startsWith(THEME_PREFIX));

  if (systemCols.length > 1) {
    push({ rule: "multiple-systems", severity: "error", params: { count: systemCols.length } });
  }
  const sysCol = systemCols[0];
  const systemId = sysCol?.meta.system ?? s.rootSystem ?? managedThemes[0]?.meta.system ?? "tailwind";
  const sys = getSystem(systemId);

  if (!sysCol) {
    if (managedThemes.length || legacyThemes.length) {
      push({ rule: "system-missing", severity: "error", params: { system: sys?.label ?? systemId }, fix: { type: "install-system", system: systemId } });
    }
  } else if (s.rootSystem !== sysCol.meta.system) {
    push({ rule: "root-mismatch", severity: "warning", params: { system: sysCol.meta.system! }, fix: { type: "set-root-system", system: sysCol.meta.system! } });
  }

  const primitives = new Map<string, { kind: TokenKind; ref: string }>();
  if (sysCol && sys) {
    const byName = new Map<string, VarSnap>();
    for (const id of sysCol.variableIds) {
      const v = s.variables[id];
      if (!v) continue;
      byName.set(v.name, v);
      const p = parsePrimitiveVarName(v.name);
      if (p) primitives.set(v.id, p);
    }
    let drift = 0;
    const check = (kind: TokenKind) => {
      for (const [ref, val] of Object.entries(scaleOf(sys, kind))) {
        const v = byName.get(primitiveVarName(kind, ref));
        if (!v || v.value.kind !== "literal" || String(v.value.value).toLowerCase() !== String(val)) drift++;
      }
    };
    (["color", "radius", "size"] as TokenKind[]).forEach(check);
    if (drift) push({ rule: "system-drift", severity: "warning", collectionId: sysCol.id, params: { count: drift, system: sys.label }, fix: { type: "repair-system", system: sys.id } });
  }

  for (const c of legacyThemes) {
    const name = c.name.slice(THEME_PREFIX.length).trim().toLowerCase();
    push({ rule: "unmanaged-theme", severity: "warning", collectionId: c.id, theme: name, params: { collection: c.name }, fix: { type: "adopt-theme", collectionId: c.id, name, system: systemId } });
  }

  const names = new Map<string, CollectionSnap[]>();
  for (const c of managedThemes) {
    const t = c.meta.theme ?? "";
    names.set(t, [...(names.get(t) ?? []), c]);
  }
  for (const [t, cols] of names) {
    cols.slice(1).forEach((c, i) => push({ rule: "duplicate-theme", severity: "error", collectionId: c.id, theme: t, params: { theme: t }, fix: { type: "rename-theme", collectionId: c.id, name: `${t}-${i + 2}` } }));
  }

  const editable: CollectionSnap[] = [];
  for (const c of managedThemes) {
    const theme = c.meta.theme ?? "";
    const version = c.meta.schemaVersion ?? 1;
    if (version > SCHEMA_VERSION) {
      push({ rule: "schema-newer", severity: "info", collectionId: c.id, theme, params: { theme, version, supported: SCHEMA_VERSION } });
      continue;
    }
    if (version < SCHEMA_VERSION) {
      push({ rule: "schema-outdated", severity: "warning", collectionId: c.id, theme, params: { theme, version, target: SCHEMA_VERSION }, fix: { type: "migrate-theme", collectionId: c.id, from: version } });
      continue;
    }
    editable.push(c);
    diagnoseTheme(s, c, sys, primitives, push);
  }

  if (editable.length) {
    const defaults = editable.filter((c) => c.meta.isDefault);
    if (defaults.length !== 1) {
      const target = defaults[0] ?? editable[0];
      push({ rule: "default-theme", severity: "info", collectionId: target.id, theme: target.meta.theme, params: { multiple: defaults.length > 1 }, fix: { type: "set-default", collectionId: target.id } });
    }
  }
  return issues;
}

function diagnoseTheme(
  s: Snapshot,
  c: CollectionSnap,
  sys: PrimitiveSystem | null,
  primitives: Map<string, { kind: TokenKind; ref: string }>,
  push: (i: NewIssue) => void,
) {
  const theme = c.meta.theme ?? "";
  const base = { collectionId: c.id, theme };

  if (c.name !== themeCollectionName(theme)) {
    push({ ...base, rule: "collection-name", severity: "info", params: { actual: c.name, expected: themeCollectionName(theme) }, fix: { type: "rename-theme", collectionId: c.id, name: theme } });
  }
  c.modes.slice(1).forEach((m) => push({ ...base, rule: "extra-modes", severity: "warning", destructive: true, params: { theme, mode: m.name }, fix: { type: "remove-mode", collectionId: c.id, modeId: m.modeId } }));
  if (c.modes[0] && c.modes[0].name !== theme) {
    push({ ...base, rule: "mode-name", severity: "info", params: { actual: c.modes[0].name, expected: theme }, fix: { type: "rename-mode", collectionId: c.id, modeId: c.modes[0].modeId, name: theme } });
  }
  if (!sys) return;

  const vars = c.variableIds.map((id) => s.variables[id]).filter(Boolean);
  const used = new Set<string>();
  const defRef = (def: TokenDef) => resolveRef(sys, def.kind, def.default)!.ref;
  const hexOf = new Map<string, string>();

  for (const def of SCHEMA.tokens) {
    const tok = { ...base, token: def.key };
    let v = vars.find((x) => x.name === def.figmaName && !used.has(x.id));
    if (!v) {
      v = vars.find((x) => !used.has(x.id) && normalizeName(x.name) === def.figmaName);
      if (v) push({ ...tok, rule: "name-drift", severity: "warning", params: { actual: v.name, expected: def.figmaName }, fix: { type: "rename-var", variableId: v.id, name: def.figmaName } });
    }
    if (!v) {
      push({ ...tok, rule: "missing-token", severity: "error", params: { name: def.figmaName }, fix: { type: "create-token", collectionId: c.id, key: def.key, ref: defRef(def) } });
      continue;
    }
    used.add(v.id);

    if (v.type !== expectedType(def)) {
      push({ ...tok, rule: "wrong-type", severity: "error", destructive: true, params: { name: def.figmaName, actual: v.type, expected: expectedType(def) }, fix: { type: "recreate-token", variableId: v.id, collectionId: c.id, key: def.key, ref: defRef(def) } });
      continue;
    }

    const relink = (ref: string) => ({ type: "relink" as const, variableId: v!.id, kind: def.kind, ref });
    const nearest = (val: string | number) => nearestPrimitive(sys, def.kind, val, deltaE).ref;

    if (v.value.kind === "none") {
      push({ ...tok, rule: "empty-value", severity: "error", params: { name: def.figmaName }, fix: relink(defRef(def)) });
    } else if (v.value.kind === "literal") {
      const lit = v.value.value;
      const ref = typeof lit === "boolean" ? defRef(def) : nearest(def.kind === "color" ? parseHex(String(lit)) ?? String(lit) : Number(lit));
      push({ ...tok, rule: "literal-value", severity: "error", params: { name: def.figmaName, value: String(lit) }, fix: relink(ref) });
    } else {
      const target = s.variables[v.value.targetId];
      const prim = primitives.get(v.value.targetId);
      if (!target) {
        push({ ...tok, rule: "broken-alias", severity: "error", params: { name: def.figmaName }, fix: relink(defRef(def)) });
      } else if (!prim) {
        const lit = resolveLiteral(s, target);
        push({ ...tok, rule: "foreign-alias", severity: "warning", params: { name: def.figmaName, target: target.name }, fix: relink(lit === null ? defRef(def) : nearest(lit)) });
      } else if (prim.kind !== def.kind) {
        const lit = resolveLiteral(s, target);
        push({ ...tok, rule: "wrong-scale", severity: "warning", params: { name: def.figmaName, target: target.name }, fix: relink(lit === null ? defRef(def) : nearest(lit)) });
      } else if (def.kind === "color") {
        const hex = sys.colors[prim.ref];
        if (hex) hexOf.set(def.key, hex);
      }
    }

    if (!sameScopes(v.scopes, def.scopes)) {
      push({ ...tok, rule: "wrong-scopes", severity: "info", params: { name: def.figmaName }, fix: { type: "set-scopes", variableId: v.id, scopes: [...def.scopes] } });
    }
  }

  for (const v of vars) {
    if (used.has(v.id)) continue;
    push({ ...base, token: v.name, rule: "extra-token", severity: "warning", destructive: true, params: { name: v.name }, fix: { type: "delete-var", variableId: v.id } });
  }

  for (const [bg, fg] of CONTRAST_PAIRS) {
    const a = hexOf.get(bg), b = hexOf.get(fg);
    if (!a || !b) continue;
    const ratio = contrastRatio(a, b);
    if (ratio < 4.5) push({ ...base, token: fg, rule: "contrast", severity: "warning", params: { bg, fg, ratio } });
  }
}

export const isSafe = (i: Issue) => !!i.fix && !i.destructive;
