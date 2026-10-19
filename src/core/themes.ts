import type { Snapshot, VarSnap } from "./model";
import { SCHEMA, SCHEMA_VERSION } from "./schema";
import { getSystem, parsePrimitiveVarName, scaleOf } from "./systems";

export interface ThemeValue {
  ref?: string;
  value?: string | number;
}

export interface ThemeInfo {
  collectionId: string;
  name: string;
  isDefault: boolean;
  schemaVersion: number;
  readOnly: boolean;
  values: Record<string, ThemeValue>;
}

export function readThemes(s: Snapshot): ThemeInfo[] {
  const sysCol = s.collections.find((c) => c.meta.kind === "system");
  const sys = getSystem(sysCol?.meta.system ?? s.rootSystem);
  const inSystem = new Set(sysCol?.variableIds ?? []);

  return s.collections
    .filter((c) => c.meta.kind === "theme")
    .map((c) => {
      const vars = c.variableIds.map((id) => s.variables[id]).filter(Boolean) as VarSnap[];
      const values: Record<string, ThemeValue> = {};
      for (const def of SCHEMA.tokens) {
        const v = vars.find((x) => x.name === def.figmaName);
        if (!v) continue;
        if (v.value.kind === "literal" && typeof v.value.value !== "boolean") {
          values[def.key] = { value: v.value.value };
        } else if (v.value.kind === "alias" && inSystem.has(v.value.targetId)) {
          const target = s.variables[v.value.targetId];
          const p = target && parsePrimitiveVarName(target.name);
          if (p && sys && p.kind === def.kind) values[def.key] = { ref: p.ref, value: scaleOf(sys, p.kind)[p.ref] };
        }
      }
      const version = c.meta.schemaVersion ?? 1;
      return {
        collectionId: c.id,
        name: c.meta.theme ?? c.name,
        isDefault: !!c.meta.isDefault,
        schemaVersion: version,
        readOnly: version > SCHEMA_VERSION,
        values,
      };
    })
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
}
