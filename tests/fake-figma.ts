type Scope = string;
let seq = 0;
const nextId = (p: string) => `${p}:${++seq}`;

class PluginData {
  private data = new Map<string, string>();
  getPluginData(k: string) { return this.data.get(k) ?? ""; }
  setPluginData(k: string, v: string) { this.data.set(k, v); }
}

export class FakeVariable extends PluginData {
  id = nextId("VariableID");
  scopes: Scope[] = ["ALL_SCOPES"];
  valuesByMode: Record<string, unknown> = {};
  removed = false;
  constructor(private api: FakeFigma, private _name: string, public variableCollectionId: string, public resolvedType: string) { super(); }
  get name() { return this._name; }
  set name(n: string) { this.api.assertName(n, this.variableCollectionId, this.id); this._name = n; }
  setValueForMode(modeId: string, v: unknown) {
    const col = this.api.collections.get(this.variableCollectionId)!;
    if (!col.modes.some((m) => m.modeId === modeId)) throw new Error("Invalid modeId");
    if (v && typeof v === "object" && (v as any).type === "VARIABLE_ALIAS") {
      const t = this.api.variables.get((v as any).id);
      if (!t) throw new Error("Alias target not found");
      if (t.resolvedType !== this.resolvedType) throw new Error("Alias type mismatch");
    }
    this.valuesByMode[modeId] = v;
  }
  remove() { this.removed = true; this.api.variables.delete(this.id); }
}

export class FakeCollection extends PluginData {
  id = nextId("VariableCollectionId");
  modes: { modeId: string; name: string }[] = [{ modeId: nextId("mode"), name: "Mode 1" }];
  constructor(private api: FakeFigma, public name: string) { super(); }
  get variableIds() { return [...this.api.variables.values()].filter((v) => v.variableCollectionId === this.id).map((v) => v.id); }
  get defaultModeId() { return this.modes[0].modeId; }
  renameMode(modeId: string, name: string) { const m = this.modes.find((x) => x.modeId === modeId); if (!m) throw new Error("mode"); m.name = name; }
  addMode(name: string) { if (this.modes.length >= this.api.maxModes) throw new Error("Limited to 1 mode on this plan"); const id = nextId("mode"); this.modes.push({ modeId: id, name }); return id; }
  removeMode(modeId: string) { this.modes = this.modes.filter((m) => m.modeId !== modeId); }
  remove() { for (const id of this.variableIds) this.api.variables.delete(id); this.api.collections.delete(this.id); }
}

export class FakeFigma {
  collections = new Map<string, FakeCollection>();
  variables = new Map<string, FakeVariable>();
  maxModes = 1;
  root = new PluginData();
  undoCommits = 0;

  assertName(name: string, collectionId: string, selfId?: string) {
    if (/[.{}]/.test(name) || !name.trim()) throw new Error(`Invalid variable name: ${name}`);
    for (const v of this.variables.values()) if (v.variableCollectionId === collectionId && v.name === name && v.id !== selfId) throw new Error(`Duplicate variable name: ${name}`);
  }

  commitUndo() { this.undoCommits++; }

  variablesApi = {
    getLocalVariableCollectionsAsync: async () => [...this.collections.values()],
    getLocalVariablesAsync: async () => [...this.variables.values()],
    getVariableByIdAsync: async (id: string) => this.variables.get(id) ?? null,
    getVariableCollectionByIdAsync: async (id: string) => this.collections.get(id) ?? null,
    createVariableCollection: (name: string) => { const c = new FakeCollection(this, name); this.collections.set(c.id, c); return c; },
    createVariable: (name: string, collection: FakeCollection | string, type: string) => {
      const colId = typeof collection === "string" ? collection : collection.id;
      if (!this.collections.has(colId)) throw new Error("Collection not found");
      this.assertName(name, colId);
      const v = new FakeVariable(this, name, colId, type);
      this.variables.set(v.id, v);
      return v;
    },
    createVariableAlias: (v: FakeVariable) => ({ type: "VARIABLE_ALIAS", id: v.id }),
  };

  get api() {
    return { variables: this.variablesApi, root: this.root, commitUndo: () => this.commitUndo() } as any;
  }
}
