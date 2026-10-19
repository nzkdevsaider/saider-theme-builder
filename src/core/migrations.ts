import { SCHEMA_VERSION } from "./schema";

export type MigrationDefault = { ref: string } | { copyFrom: string };

export type MigrationOp =
  | { op: "rename"; from: string; to: string }
  | { op: "add"; token: string; default: MigrationDefault }
  | { op: "remove"; token: string };

export interface Migration {
  from: number;
  to: number;
  ops: MigrationOp[];
}

export const MIGRATIONS: Migration[] = [];

export type MigrationStatus = "ok" | "newer" | "broken-chain";

export interface MigrationResult {
  status: MigrationStatus;
  values: Record<string, string>;
  applied: { to: number; op: MigrationOp }[];
}

export function chain(from: number, migrations: Migration[], target: number): Migration[] | null {
  const steps: Migration[] = [];
  for (let v = from; v < target; ) {
    const step = migrations.find((m) => m.from === v);
    if (!step) return null;
    steps.push(step);
    v = step.to;
  }
  return steps;
}

export function migrateValues(
  input: Record<string, string>,
  fromVersion: number,
  migrations: Migration[] = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrationResult {
  if (fromVersion > target) return { status: "newer", values: { ...input }, applied: [] };
  const steps = chain(fromVersion, migrations, target);
  if (!steps) return { status: "broken-chain", values: { ...input }, applied: [] };

  const values = { ...input };
  const applied: MigrationResult["applied"] = [];
  for (const step of steps) {
    for (const op of step.ops) {
      if (op.op === "rename") {
        if (op.from in values) {
          if (!(op.to in values)) values[op.to] = values[op.from];
          delete values[op.from];
        }
      } else if (op.op === "add") {
        if (!(op.token in values)) {
          const d = op.default;
          const v = "ref" in d ? d.ref : values[d.copyFrom];
          if (v !== undefined) values[op.token] = v;
        }
      } else {
        delete values[op.token];
      }
      applied.push({ to: step.to, op });
    }
  }
  return { status: "ok", values, applied };
}

export function collapseOps(
  fromVersion: number,
  migrations: Migration[] = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrationOp[] {
  return (chain(fromVersion, migrations, target) ?? []).flatMap((m) => m.ops);
}
