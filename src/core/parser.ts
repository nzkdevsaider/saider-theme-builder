import { deltaE, parseHex } from "./color";
import { appError, fail, type AppError } from "./errors";
import { migrateValues, type MigrationOp } from "./migrations";
import { SCHEMA, SCHEMA_VERSION, type TokenDef } from "./schema";
import { getSystem, nearestPrimitive, resolveRef, type PrimitiveSystem, type TokenKind } from "./systems";

export type RowStatus = "ref" | "exact" | "snapped" | "reconverted" | "default" | "manual" | "unresolved";

export interface ImportRow {
  key: string;
  kind: TokenKind;
  input?: string | number;
  status: RowStatus;
  ref?: string;
  value?: string | number;
  delta?: number;
}

export interface ImportPlan {
  ok: boolean;
  errors: AppError[];
  name: string;
  sourceSystem: string;
  targetSystem: string;
  needsReconversion: boolean;
  schemaVersionIn: number;
  migrations: MigrationOp[];
  unknownKeys: string[];
  rows: ImportRow[];
}

const RESERVED = new Set(["$saider", "name", "system"]);
const RETIRED = new Set(["color-scheme", "depth", "noise"]);

export function slugify(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toPx(input: string | number): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const m = /^(-?\d*\.?\d+)\s*(px|rem)?$/i.exec(input.trim());
  if (!m) return null;
  return parseFloat(m[1]) * (m[2]?.toLowerCase() === "rem" ? 16 : 1);
}

function fromLiteral(target: PrimitiveSystem, def: TokenDef, literal: string | number): Omit<ImportRow, "key" | "kind" | "input"> {
  const near = nearestPrimitive(target, def.kind, literal, deltaE);
  const delta = Math.round(near.delta * 100) / 100;
  return { status: delta === 0 ? "exact" : "snapped", ref: near.ref, value: near.value, delta };
}

function resolveRow(def: TokenDef, input: unknown, target: PrimitiveSystem, source: PrimitiveSystem | null, reconvert: boolean): ImportRow {
  const base = { key: def.key, kind: def.kind };
  if (input === undefined || input === null || input === "") {
    const r = resolveRef(target, def.kind, def.default)!;
    return { ...base, status: "default", ref: r.ref, value: r.value };
  }
  if (typeof input !== "string" && typeof input !== "number") {
    return { ...base, status: "unresolved" };
  }

  if (def.kind === "color") {
    if (typeof input !== "string") return { ...base, input, status: "unresolved" };
    const hex = parseHex(input);
    if (hex) return { ...base, input, ...fromLiteral(target, def, hex) };
  } else if (typeof input === "number") {
    return { ...base, input, ...fromLiteral(target, def, input) };
  }

  const str = String(input);
  if (reconvert) {
    const src = source && resolveRef(source, def.kind, str);
    if (!src) {
      const px = def.kind !== "color" ? toPx(str) : null;
      if (px !== null) return { ...base, input, ...fromLiteral(target, def, px) };
      return { ...base, input, status: "unresolved" };
    }
    const lit = fromLiteral(target, def, src.value);
    return { ...base, input, ...lit, status: lit.status === "exact" ? "exact" : "reconverted" };
  }

  const direct = resolveRef(target, def.kind, str);
  if (direct) return { ...base, input, status: "ref", ref: direct.ref, value: direct.value };
  if (def.kind !== "color") {
    const px = toPx(str);
    if (px !== null) return { ...base, input, ...fromLiteral(target, def, px) };
  }
  return { ...base, input, status: "unresolved" };
}

function finalize(plan: ImportPlan): ImportPlan {
  return { ...plan, ok: plan.errors.length === 0 && plan.rows.every((r) => r.status !== "unresolved") };
}

export function planImport(raw: string | Record<string, unknown>, projectSystem: string): ImportPlan {
  const empty: ImportPlan = {
    ok: false, errors: [], name: "", sourceSystem: projectSystem, targetSystem: projectSystem,
    needsReconversion: false, schemaVersionIn: SCHEMA_VERSION, migrations: [], unknownKeys: [], rows: [],
  };

  let data: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      data = parsed;
    } catch {
      return { ...empty, errors: [appError("invalid-json", {})] };
    }
  } else data = raw;

  const target = getSystem(projectSystem);
  if (!target) return { ...empty, errors: [appError("system-unavailable", { system: projectSystem })] };

  const errors: AppError[] = [];
  const name = typeof data.name === "string" ? slugify(data.name) : "";
  if (!name) errors.push(appError("missing-name", {}));

  const version = data.$saider === undefined ? SCHEMA_VERSION : Number(data.$saider);
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (!RESERVED.has(k) && !RETIRED.has(k)) values[k] = v as string;

  const mig = migrateValues(values, version);
  if (mig.status === "newer") errors.push(appError("schema-newer", { version, supported: SCHEMA_VERSION }));
  if (mig.status === "broken-chain") errors.push(appError("broken-migration", { version }));

  const sourceSystem = typeof data.system === "string" && data.system ? data.system.toLowerCase() : projectSystem;
  const reconvert = sourceSystem !== projectSystem;
  const source = getSystem(sourceSystem);

  const known = new Set(SCHEMA.tokens.map((t) => t.key));
  const unknownKeys = Object.keys(mig.values).filter((k) => !known.has(k));
  const rows = SCHEMA.tokens.map((def) => resolveRow(def, mig.values[def.key], target, source, reconvert));

  return finalize({
    ...empty, errors, name, sourceSystem, needsReconversion: reconvert, schemaVersionIn: version,
    migrations: mig.applied.map((a) => a.op), unknownKeys, rows,
  });
}

export function overrideRow(plan: ImportPlan, key: string, ref: string): ImportPlan {
  const sys = getSystem(plan.targetSystem)!;
  const rows = plan.rows.map((r) => {
    if (r.key !== key) return r;
    const res = resolveRef(sys, r.kind, ref);
    if (!res) fail("unknown-ref", { ref, system: sys.label });
    return { ...r, status: "manual" as const, ref: res.ref, value: res.value, delta: undefined };
  });
  return finalize({ ...plan, rows });
}

export function previewValues(rows: ImportRow[]): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const r of rows) if (r.value !== undefined) out[r.key] = r.value;
  return out;
}
