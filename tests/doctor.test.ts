import { describe, it, expect } from "vitest";
import { diagnose } from "../src/core/doctor";
import { healthySnapshot, themeVar, pid } from "./helpers";

const rules = (s: Parameters<typeof diagnose>[0]) => diagnose(s).map((i) => i.rule);

describe("doctor · healthy file", () => {
  it("reports nothing", () => {
    expect(diagnose(healthySnapshot(["ocean", "sunset"]))).toEqual([]);
  });
});

describe("doctor · system", () => {
  it("themes without an installed system → install the system", () => {
    const s = healthySnapshot();
    s.collections = s.collections.filter((c) => c.meta.kind !== "system");
    s.rootSystem = null;
    const i = diagnose(s).find((x) => x.rule === "system-missing")!;
    expect(i.fix).toEqual({ type: "install-system", system: "tailwind" });
  });
  it("the file system does not match the collection → fix the file record", () => {
    const s = healthySnapshot();
    s.rootSystem = null;
    expect(diagnose(s)[0]).toMatchObject({ rule: "root-mismatch", fix: { type: "set-root-system", system: "tailwind" } });
  });
  it("primitives missing from the system collection → repair", () => {
    const s = healthySnapshot();
    const sysCol = s.collections[0];
    sysCol.variableIds = sysCol.variableIds.filter((id) => id !== pid("color", "rose-950"));
    expect(rules(s)).toContain("system-drift");
  });
});

describe("doctor · tokens", () => {
  it("missing token → create it with the default value", () => {
    const s = healthySnapshot();
    const c = s.collections[1];
    c.variableIds = c.variableIds.filter((id) => id !== "v:ocean:accent");
    expect(diagnose(s)[0]).toMatchObject({ rule: "missing-token", fix: { type: "create-token", key: "accent", ref: "teal-400" } });
  });
  it("drifted name → rename instead of recreating", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "primary-content").name = "Color/Primary_Content";
    expect(diagnose(s)[0]).toMatchObject({ rule: "name-drift", fix: { type: "rename-var", name: "color/primary-content" } });
  });
  it("literal value → link to the closest primitive", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "primary").value = { kind: "literal", value: "#0285c8" };
    expect(diagnose(s)[0]).toMatchObject({ rule: "literal-value", severity: "error", fix: { type: "relink", ref: "sky-600" } });
  });
  it("broken alias → fall back to the default value", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "primary").value = { kind: "alias", targetId: "p:gone" };
    expect(diagnose(s)[0]).toMatchObject({ rule: "broken-alias", fix: { type: "relink", ref: "blue-600" } });
  });
  it("alias to a foreign collection → relink to the system equivalent", () => {
    const s = healthySnapshot();
    s.collections.push({ id: "c:old", name: "Tailwind Colors", modes: [{ modeId: "m", name: "Mode 1" }], meta: {}, variableIds: ["old:sky"] });
    s.variables["old:sky"] = { id: "old:sky", name: "Sky/600", collectionId: "c:old", type: "COLOR", scopes: [], value: { kind: "literal", value: "#0284c7" } };
    themeVar(s, "ocean", "primary").value = { kind: "alias", targetId: "old:sky" };
    expect(diagnose(s)[0]).toMatchObject({ rule: "foreign-alias", fix: { type: "relink", ref: "sky-600" } });
  });
  it("radius pointing at the spacing scale → relink to the right scale", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "radius-box").value = { kind: "alias", targetId: pid("size", "2") };
    expect(diagnose(s)[0]).toMatchObject({ rule: "wrong-scale", fix: { type: "relink", ref: "lg" } });
  });
  it("wrong type → recreate, flagged as destructive", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "border").type = "STRING";
    expect(diagnose(s)[0]).toMatchObject({ rule: "wrong-type", destructive: true });
  });
  it("wrong scopes → fix them", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "radius-box").scopes = ["ALL_SCOPES"];
    expect(diagnose(s)[0]).toMatchObject({ rule: "wrong-scopes", fix: { type: "set-scopes", scopes: ["CORNER_RADIUS"] } });
  });
  it("variable outside the Schema → delete, flagged as destructive", () => {
    const s = healthySnapshot();
    s.variables["x"] = { id: "x", name: "color/primary/hover", collectionId: "c:ocean", type: "COLOR", scopes: [], value: { kind: "alias", targetId: pid("color", "sky-700") } };
    s.collections[1].variableIds.push("x");
    expect(diagnose(s)[0]).toMatchObject({ rule: "extra-token", destructive: true, fix: { type: "delete-var", variableId: "x" } });
  });
});

describe("doctor · theme collection", () => {
  it("extra modes → remove them (destructive)", () => {
    const s = healthySnapshot();
    s.collections[1].modes.push({ modeId: "m2", name: "Dark" });
    expect(diagnose(s)[0]).toMatchObject({ rule: "extra-modes", destructive: true });
  });
  it("misnamed mode → rename", () => {
    const s = healthySnapshot();
    s.collections[1].modes[0].name = "Mode 1";
    expect(diagnose(s)[0]).toMatchObject({ rule: "mode-name", fix: { type: "rename-mode", name: "ocean" } });
  });
  it("outdated Schema → migrate, skipping token checks until migrated", () => {
    const s = healthySnapshot();
    s.collections[1].meta.schemaVersion = 0;
    expect(rules(s)).toEqual(["schema-outdated"]);
  });
  it("Schema newer than the plugin → read-only, no fix", () => {
    const s = healthySnapshot();
    s.collections[1].meta.schemaVersion = 99;
    const i = diagnose(s);
    expect(i.map((x) => x.rule)).toEqual(["schema-newer"]);
    expect(i[0].fix).toBeUndefined();
  });
  it("unmanaged collection with a theme name → adopt", () => {
    const s = healthySnapshot();
    s.collections[1].meta = {};
    expect(diagnose(s)[0]).toMatchObject({ rule: "unmanaged-theme", fix: { type: "adopt-theme", name: "ocean" } });
  });
  it("no default theme → mark the first one", () => {
    const s = healthySnapshot(["ocean", "sunset"]);
    s.collections[1].meta.isDefault = false;
    expect(diagnose(s)[0]).toMatchObject({ rule: "default-theme", fix: { type: "set-default", collectionId: "c:ocean" } });
  });
});

describe("doctor · contrast", () => {
  it("warns when a pair falls below 4.5:1, without an automatic fix", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "primary-content").value = { kind: "alias", targetId: pid("color", "blue-500") };
    const i = diagnose(s)[0];
    expect(i).toMatchObject({ rule: "contrast", severity: "warning", params: { bg: "primary", fg: "primary-content" } });
    expect(i.fix).toBeUndefined();
  });
});
