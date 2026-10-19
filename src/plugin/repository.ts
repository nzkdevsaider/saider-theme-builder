import { figmaRgbToHex, hexToFigmaRgb } from "../core/color";
import type { Fix } from "../core/doctor";
import { fail } from "../core/errors";
import { collapseOps } from "../core/migrations";
import { systemCollectionName, themeCollectionName, type CollectionMeta, type Snapshot, type VarSnap, type VarType } from "../core/model";
import { slugify, type ImportPlan } from "../core/parser";
import { figmaNameOf, SCHEMA_VERSION, tokenByKey, type TokenDef } from "../core/schema";
import { getSystem, primitiveVarName, resolveRef, scaleOf, type PrimitiveSystem, type TokenKind } from "../core/systems";

const META_KEY = "saider";
const ROOT_SYSTEM_KEY = "saider.system";

export interface FigmaLike {
  variables: Pick<PluginAPI["variables"],
    "getLocalVariableCollectionsAsync" | "getLocalVariablesAsync" | "getVariableByIdAsync" |
    "getVariableCollectionByIdAsync" | "createVariableCollection" | "createVariable" | "createVariableAlias">;
  root: Pick<DocumentNode, "getPluginData" | "setPluginData">;
  commitUndo(): void;
}

const readMeta = (c: VariableCollection): CollectionMeta => {
  try { return JSON.parse(c.getPluginData(META_KEY) || "{}"); } catch { return {}; }
};
const writeMeta = (c: VariableCollection, meta: CollectionMeta) => c.setPluginData(META_KEY, JSON.stringify(meta));
const typeOf = (kind: TokenKind): VariableResolvedDataType => (kind === "color" ? "COLOR" : "FLOAT");

function toVarValue(raw: VariableValue | undefined): VarSnap["value"] {
  if (raw === undefined) return { kind: "none" };
  if (typeof raw === "object" && raw !== null && "type" in raw && raw.type === "VARIABLE_ALIAS") return { kind: "alias", targetId: raw.id };
  if (typeof raw === "object" && raw !== null && "r" in raw) return { kind: "literal", value: figmaRgbToHex(raw) };
  return { kind: "literal", value: raw as string | number | boolean };
}

export class Repository {
  constructor(private api: FigmaLike) {}

  async snapshot(): Promise<Snapshot> {
    const cols = await this.api.variables.getLocalVariableCollectionsAsync();
    const vars = await this.api.variables.getLocalVariablesAsync();
    const firstMode = new Map(cols.map((c) => [c.id, c.modes[0]?.modeId]));
    const variables: Snapshot["variables"] = {};
    for (const v of vars) {
      const mode = firstMode.get(v.variableCollectionId);
      variables[v.id] = {
        id: v.id, name: v.name, collectionId: v.variableCollectionId, type: v.resolvedType as VarType,
        scopes: [...v.scopes], value: toVarValue(mode ? v.valuesByMode[mode] : undefined),
      };
    }
    return {
      rootSystem: this.api.root.getPluginData(ROOT_SYSTEM_KEY) || null,
      collections: cols.map((c) => ({
        id: c.id, name: c.name, modes: c.modes.map((m) => ({ ...m })), meta: readMeta(c), variableIds: [...c.variableIds],
      })),
      variables,
    };
  }

  private async systemCollection(): Promise<{ col: VariableCollection; sys: PrimitiveSystem } | null> {
    const cols = await this.api.variables.getLocalVariableCollectionsAsync();
    for (const c of cols) {
      const meta = readMeta(c);
      if (meta.kind === "system") {
        const sys = getSystem(meta.system);
        if (sys) return { col: c, sys };
      }
    }
    return null;
  }

  private async themeCollections(): Promise<VariableCollection[]> {
    return (await this.api.variables.getLocalVariableCollectionsAsync()).filter((c) => readMeta(c).kind === "theme");
  }

  private async varsOf(col: VariableCollection): Promise<Variable[]> {
    return (await this.api.variables.getLocalVariablesAsync()).filter((v) => v.variableCollectionId === col.id);
  }

  private async primitive(kind: TokenKind, ref: string): Promise<Variable> {
    const s = await this.systemCollection();
    if (!s) fail("no-system", {});
    if (!resolveRef(s.sys, kind, ref)) fail("unknown-ref", { ref, system: s.sys.label });
    const name = primitiveVarName(kind, ref);
    const v = (await this.varsOf(s.col)).find((x) => x.name === name);
    if (!v) fail("missing-primitive", { name });
    return v;
  }

  private async collection(id: string): Promise<VariableCollection> {
    const c = await this.api.variables.getVariableCollectionByIdAsync(id);
    if (!c) fail("collection-gone", {});
    return c;
  }

  private async variable(id: string): Promise<Variable> {
    const v = await this.api.variables.getVariableByIdAsync(id);
    if (!v) fail("variable-gone", {});
    return v;
  }

  async installSystem(systemId: string): Promise<void> {
    const sys = getSystem(systemId);
    if (!sys) fail("unknown-system", { system: systemId });
    const existing = await this.systemCollection();
    if (existing) fail("system-exists", { system: existing.sys.label });
    const col = this.api.variables.createVariableCollection(systemCollectionName(sys.label));
    col.renameMode(col.modes[0].modeId, sys.label);
    writeMeta(col, { kind: "system", system: sys.id, systemVersion: sys.version });
    await this.syncPrimitives(col, sys);
    this.api.root.setPluginData(ROOT_SYSTEM_KEY, sys.id);
    this.api.commitUndo();
  }

  private async syncPrimitives(col: VariableCollection, sys: PrimitiveSystem): Promise<void> {
    const mode = col.modes[0].modeId;
    const byName = new Map((await this.varsOf(col)).map((v) => [v.name, v]));
    for (const kind of ["color", "radius", "size"] as TokenKind[]) {
      for (const [ref, val] of Object.entries(scaleOf(sys, kind))) {
        const name = primitiveVarName(kind, ref);
        let v = byName.get(name);
        if (v && v.resolvedType !== typeOf(kind)) { v.remove(); v = undefined; }
        if (!v) v = this.api.variables.createVariable(name, col, typeOf(kind));
        v.setValueForMode(mode, kind === "color" ? hexToFigmaRgb(String(val)) : Number(val));
        v.scopes = [];
      }
    }
  }

  private async assertNameFree(name: string, exceptId?: string) {
    for (const c of await this.themeCollections()) {
      if (c.id !== exceptId && readMeta(c).theme === name) fail("theme-exists", { name });
    }
  }

  private async writeToken(col: VariableCollection, def: TokenDef, ref: string, existing?: Variable): Promise<Variable> {
    const target = await this.primitive(def.kind, ref);
    const v = existing ?? this.api.variables.createVariable(def.figmaName, col, typeOf(def.kind));
    v.setValueForMode(col.modes[0].modeId, this.api.variables.createVariableAlias(target));
    v.scopes = [...def.scopes] as VariableScope[];
    return v;
  }

  async createTheme(plan: ImportPlan): Promise<string> {
    if (!plan.ok) fail("plan-invalid", {});
    const s = await this.systemCollection();
    if (!s) fail("no-system", {});
    if (s.sys.id !== plan.targetSystem) fail("plan-system-mismatch", { plan: plan.targetSystem, project: s.sys.id });
    await this.assertNameFree(plan.name);

    const hasDefault = (await this.themeCollections()).some((c) => readMeta(c).isDefault);
    const col = this.api.variables.createVariableCollection(themeCollectionName(plan.name));
    col.renameMode(col.modes[0].modeId, plan.name);
    writeMeta(col, { kind: "theme", theme: plan.name, system: s.sys.id, schemaVersion: SCHEMA_VERSION, isDefault: !hasDefault });
    for (const row of plan.rows) await this.writeToken(col, tokenByKey(row.key)!, row.ref!);
    this.api.commitUndo();
    return col.id;
  }

  private async editableTheme(id: string): Promise<VariableCollection> {
    const col = await this.collection(id);
    const meta = readMeta(col);
    if (meta.kind !== "theme") fail("not-managed", {});
    if ((meta.schemaVersion ?? 1) > SCHEMA_VERSION) fail("theme-newer", {});
    return col;
  }

  async updateTheme(id: string, values: Record<string, string>): Promise<void> {
    const col = await this.editableTheme(id);
    const vars = await this.varsOf(col);
    for (const [key, ref] of Object.entries(values)) {
      const def = tokenByKey(key);
      if (!def) fail("unknown-token", { key });
      await this.writeToken(col, def, ref, vars.find((v) => v.name === def.figmaName));
    }
    this.api.commitUndo();
  }

  async renameTheme(id: string, rawName: string): Promise<void> {
    const name = slugify(rawName);
    if (!name) fail("empty-name", {});
    const col = await this.collection(id);
    await this.assertNameFree(name, id);
    col.name = themeCollectionName(name);
    col.renameMode(col.modes[0].modeId, name);
    writeMeta(col, { ...readMeta(col), theme: name });
    this.api.commitUndo();
  }

  async setDefault(id: string): Promise<void> {
    for (const c of await this.themeCollections()) writeMeta(c, { ...readMeta(c), isDefault: c.id === id });
    this.api.commitUndo();
  }

  async deleteTheme(id: string): Promise<void> {
    const col = await this.collection(id);
    const wasDefault = !!readMeta(col).isDefault;
    col.remove();
    if (wasDefault) {
      const next = (await this.themeCollections()).sort((a, b) => a.name.localeCompare(b.name))[0];
      if (next) writeMeta(next, { ...readMeta(next), isDefault: true });
    }
    this.api.commitUndo();
  }

  async applyFix(fix: Fix): Promise<void> {
    switch (fix.type) {
      case "install-system":
        await this.installSystem(fix.system);
        break;
      case "repair-system": {
        const s = await this.systemCollection();
        if (!s) fail("no-system", {});
        await this.syncPrimitives(s.col, s.sys);
        break;
      }
      case "set-root-system":
        this.api.root.setPluginData(ROOT_SYSTEM_KEY, fix.system);
        break;
      case "create-token":
        await this.writeToken(await this.collection(fix.collectionId), tokenByKey(fix.key)!, fix.ref);
        break;
      case "relink": {
        const v = await this.variable(fix.variableId);
        const col = await this.collection(v.variableCollectionId);
        v.setValueForMode(col.modes[0].modeId, this.api.variables.createVariableAlias(await this.primitive(fix.kind, fix.ref)));
        break;
      }
      case "rename-var":
        (await this.variable(fix.variableId)).name = fix.name;
        break;
      case "set-scopes":
        (await this.variable(fix.variableId)).scopes = fix.scopes as VariableScope[];
        break;
      case "delete-var":
        (await this.variable(fix.variableId)).remove();
        break;
      case "recreate-token": {
        (await this.variable(fix.variableId)).remove();
        await this.writeToken(await this.collection(fix.collectionId), tokenByKey(fix.key)!, fix.ref);
        break;
      }
      case "rename-mode":
        (await this.collection(fix.collectionId)).renameMode(fix.modeId, fix.name);
        break;
      case "remove-mode":
        (await this.collection(fix.collectionId)).removeMode(fix.modeId);
        break;
      case "rename-theme":
        await this.renameTheme(fix.collectionId, fix.name);
        break;
      case "adopt-theme": {
        const col = await this.collection(fix.collectionId);
        const hasDefault = (await this.themeCollections()).some((c) => readMeta(c).isDefault);
        writeMeta(col, { kind: "theme", theme: slugify(fix.name), system: fix.system, schemaVersion: SCHEMA_VERSION, isDefault: !hasDefault });
        break;
      }
      case "migrate-theme":
        await this.migrateTheme(fix.collectionId, fix.from);
        break;
      case "set-default":
        await this.setDefault(fix.collectionId);
        break;
    }
    this.api.commitUndo();
  }

  private async migrateTheme(id: string, from: number): Promise<void> {
    const col = await this.collection(id);
    const find = async (key: string) => (await this.varsOf(col)).find((v) => v.name === figmaNameOf(key));
    for (const op of collapseOps(from)) {
      if (op.op === "rename") {
        const v = await find(op.from);
        if (v && !(await find(op.to))) v.name = figmaNameOf(op.to);
      } else if (op.op === "remove") {
        (await find(op.token))?.remove();
      } else if (!(await find(op.token))) {
        const def = tokenByKey(op.token);
        if (!def) continue;
        if ("ref" in op.default) {
          await this.writeToken(col, def, op.default.ref);
        } else {
          const src = await find(op.default.copyFrom);
          const value = src?.valuesByMode[col.modes[0].modeId];
          const v = this.api.variables.createVariable(def.figmaName, col, typeOf(def.kind));
          if (value !== undefined) v.setValueForMode(col.modes[0].modeId, value);
          v.scopes = [...def.scopes] as VariableScope[];
        }
      }
    }
    writeMeta(col, { ...readMeta(col), schemaVersion: SCHEMA_VERSION });
  }
}

