import { describe, it, expect, beforeEach } from "vitest";
import { FakeFigma } from "./fake-figma";
import { Repository } from "../src/plugin/repository";
import { diagnose, type Issue } from "../src/core/doctor";
import { readThemes } from "../src/core/themes";
import { planImport } from "../src/core/parser";

let fig: FakeFigma;
let repo: Repository;
beforeEach(() => { fig = new FakeFigma(); repo = new Repository(fig.api); });

const plan = (json: Record<string, unknown>) => planImport(json, "tailwind");
async function healAll() {
  for (let round = 0; round < 5; round++) {
    const issues = diagnose(await repo.snapshot()).filter((i) => i.fix);
    if (!issues.length) return;
    for (const i of issues) await repo.applyFix(i.fix!);
  }
}

describe("system", () => {
  it("installs tailwind as a single collection with every primitive hidden", async () => {
    await repo.installSystem("tailwind");
    const s = await repo.snapshot();
    expect(s.rootSystem).toBe("tailwind");
    const sys = s.collections.filter((c) => c.meta.kind === "system");
    expect(sys).toHaveLength(1);
    expect(sys[0].name).toBe("Saider / Tailwind");
    expect(sys[0].variableIds.length).toBe(244 + 9 + 35);
    expect(s.variables[sys[0].variableIds[0]].scopes).toEqual([]);
    expect(diagnose(s)).toEqual([]);
  });
  it("does not allow installing a second system", async () => {
    await repo.installSystem("tailwind");
    await expect(repo.installSystem("tailwind")).rejects.toMatchObject({ detail: { code: "system-exists" } });
  });
});

describe("themes", () => {
  beforeEach(async () => { await repo.installSystem("tailwind"); });

  it("creates a theme from a plan: aliases to primitives, first theme as default, healthy file", async () => {
    const id = await repo.createTheme(plan({ name: "ocean", primary: "sky-700", "radius-field": 8 }));
    const s = await repo.snapshot();
    const [t] = readThemes(s);
    expect(t).toMatchObject({ collectionId: id, name: "ocean", isDefault: true });
    expect(t.values.primary).toEqual({ ref: "sky-700", value: "#0369a1" });
    expect(t.values["radius-field"]).toEqual({ ref: "lg", value: 8 });
    expect(Object.keys(t.values)).toHaveLength(26);
    expect(diagnose(s)).toEqual([]);
    expect(fig.undoCommits).toBeGreaterThan(0);
  });
  it("rejects plans with unresolved rows and repeated names", async () => {
    await expect(repo.createTheme(plan({ name: "x", primary: "nope-1" }))).rejects.toMatchObject({ detail: { code: "plan-invalid" } });
    await repo.createTheme(plan({ name: "ocean" }));
    await expect(repo.createTheme(plan({ name: "ocean" }))).rejects.toMatchObject({ detail: { code: "theme-exists", params: { name: "ocean" } } });
  });
  it("updates, renames, changes the default and deletes (promoting another default)", async () => {
    const a = await repo.createTheme(plan({ name: "ocean" }));
    const b = await repo.createTheme(plan({ name: "sunset" }));
    await repo.updateTheme(b, { primary: "orange-700" });
    await repo.renameTheme(b, "dusk");
    await repo.setDefault(b);
    let themes = readThemes(await repo.snapshot());
    expect(themes[0]).toMatchObject({ name: "dusk", isDefault: true });
    expect(themes[0].values.primary.ref).toBe("orange-700");
    expect(diagnose(await repo.snapshot())).toEqual([]);
    await repo.deleteTheme(b);
    themes = readThemes(await repo.snapshot());
    expect(themes.map((t) => t.name)).toEqual(["ocean"]);
    expect(themes[0]).toMatchObject({ collectionId: a, isDefault: true });
    expect(diagnose(await repo.snapshot())).toEqual([]);
  });
});

describe("doctor on Figma: fixes converge to a healthy file", () => {
  beforeEach(async () => { await repo.installSystem("tailwind"); });

  it("repairs a theme broken in many ways at once", async () => {
    const id = await repo.createTheme(plan({ name: "ocean" }));
    const col = fig.collections.get(id)!;
    const byName = (n: string) => [...fig.variables.values()].find((v) => v.variableCollectionId === id && v.name === n)!;
    byName("color/accent").remove();
    byName("color/primary").setValueForMode(col.modes[0].modeId, { r: 0.012, g: 0.41, b: 0.63, a: 1 });
    byName("color/primary-content").name = "Color/Primary_Content";
    byName("radius/box").scopes = ["ALL_SCOPES"];
    col.renameMode(col.modes[0].modeId, "Mode 1");
    const extra = fig.variablesApi.createVariable("color/primary/hover", col, "COLOR");
    extra.setValueForMode(col.modes[0].modeId, { r: 0, g: 0, b: 0, a: 1 });

    expect(diagnose(await repo.snapshot()).length).toBeGreaterThan(4);
    await healAll();
    const s = await repo.snapshot();
    expect(diagnose(s)).toEqual([]);
    expect(readThemes(s)[0].values.primary.ref).toBe("sky-700");
  });

  it("adopts a legacy theme collection that points to an old color collection", async () => {
    const old = fig.variablesApi.createVariableCollection("Tailwind Colors");
    const sky = fig.variablesApi.createVariable("Sky/700", old, "COLOR");
    sky.setValueForMode(old.modes[0].modeId, { r: 3 / 255, g: 105 / 255, b: 161 / 255, a: 1 });
    const legacy = fig.variablesApi.createVariableCollection("Theme / ocean");
    const p = fig.variablesApi.createVariable("color/primary", legacy, "COLOR");
    p.setValueForMode(legacy.modes[0].modeId, { type: "VARIABLE_ALIAS", id: sky.id });

    const first = diagnose(await repo.snapshot());
    expect(first.map((i: Issue) => i.rule)).toEqual(["unmanaged-theme"]);
    await healAll();
    const s = await repo.snapshot();
    expect(diagnose(s)).toEqual([]);
    const [t] = readThemes(s);
    expect(t.values.primary.ref).toBe("sky-700");
    expect(p.removed).toBe(false);
  });

  it("reinstalls missing system primitives", async () => {
    const sysCol = [...fig.collections.values()].find((c) => c.name === "Saider / Tailwind")!;
    const victim = [...fig.variables.values()].find((v) => v.variableCollectionId === sysCol.id && v.name === "color/rose/950")!;
    victim.remove();
    await healAll();
    expect(diagnose(await repo.snapshot())).toEqual([]);
  });
});
