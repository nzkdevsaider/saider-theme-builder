import type { Snapshot, CollectionSnap, VarSnap } from "../src/core/model";
import { SCHEMA, SCHEMA_VERSION } from "../src/core/schema";
import { getSystem, primitiveVarName, resolveRef, type TokenKind } from "../src/core/systems";

const sys = getSystem("tailwind")!;
export const pid = (kind: TokenKind, ref: string) => `p:${primitiveVarName(kind, ref)}`;

export function healthySnapshot(themes: string[] = ["ocean"]): Snapshot {
  const variables: Record<string, VarSnap> = {};
  const sysCol: CollectionSnap = {
    id: "c:system", name: "Saider / Tailwind", modes: [{ modeId: "m:sys", name: "Tailwind" }],
    meta: { kind: "system", system: "tailwind", systemVersion: 1 }, variableIds: [],
  };
  const add = (v: VarSnap, c: CollectionSnap) => { variables[v.id] = v; c.variableIds.push(v.id); };
  for (const [ref, hex] of Object.entries(sys.colors))
    add({ id: pid("color", ref), name: primitiveVarName("color", ref), collectionId: sysCol.id, type: "COLOR", scopes: [], value: { kind: "literal", value: hex } }, sysCol);
  for (const [ref, px] of Object.entries(sys.radius))
    add({ id: pid("radius", ref), name: primitiveVarName("radius", ref), collectionId: sysCol.id, type: "FLOAT", scopes: [], value: { kind: "literal", value: px } }, sysCol);
  for (const [ref, px] of Object.entries(sys.spacing))
    add({ id: pid("size", ref), name: primitiveVarName("size", ref), collectionId: sysCol.id, type: "FLOAT", scopes: [], value: { kind: "literal", value: px } }, sysCol);

  const collections = [sysCol];
  themes.forEach((t, i) => {
    const c: CollectionSnap = {
      id: `c:${t}`, name: `Theme / ${t}`, modes: [{ modeId: `m:${t}`, name: t }],
      meta: { kind: "theme", theme: t, system: "tailwind", schemaVersion: SCHEMA_VERSION, isDefault: i === 0 }, variableIds: [],
    };
    for (const def of SCHEMA.tokens) {
      const ref = resolveRef(sys, def.kind, def.default)!.ref;
      add({ id: `v:${t}:${def.key}`, name: def.figmaName, collectionId: c.id, type: def.kind === "color" ? "COLOR" : "FLOAT",
        scopes: [...def.scopes], value: { kind: "alias", targetId: pid(def.kind, ref) } }, c);
    }
    collections.push(c);
  });
  return { rootSystem: "tailwind", collections, variables };
}

export const themeVar = (s: Snapshot, theme: string, key: string) => s.variables[`v:${theme}:${key}`];
