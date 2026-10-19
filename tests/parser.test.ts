import { describe, it, expect } from "vitest";
import { planImport, overrideRow } from "../src/core/parser";

const row = (plan: ReturnType<typeof planImport>, key: string) => plan.rows.find((r) => r.key === key)!;

describe("planImport · validation", () => {
  it("rejects invalid JSON", () => {
    const p = planImport("{ nope", "tailwind");
    expect(p.ok).toBe(false);
    expect(p.errors).toEqual([{ code: "invalid-json", params: {} }]);
  });
  it("requires a name", () => {
    expect(planImport({ primary: "sky-600" }, "tailwind").errors.map((e) => e.code)).toEqual(["missing-name"]);
  });
  it("slugifies the name", () => {
    expect(planImport({ name: "My Dark Théme" }, "tailwind").name).toBe("my-dark-theme");
  });
  it("rejects themes from a newer Schema version", () => {
    const p = planImport({ $saider: 99, name: "x" }, "tailwind");
    expect(p.ok).toBe(false);
    expect(p.errors).toContainEqual({ code: "schema-newer", params: { version: 99, supported: 1 } });
  });
  it("silently ignores retired keys and reports unknown ones", () => {
    const p = planImport({ name: "x", "color-scheme": "dark", depth: 1, foo: "bar" }, "tailwind");
    expect(p.unknownKeys).toEqual(["foo"]);
  });
});

describe("planImport · value resolution", () => {
  it("a valid reference stays as 'ref'", () => {
    const r = row(planImport({ name: "x", primary: "sky-600" }, "tailwind"), "primary");
    expect(r).toMatchObject({ status: "ref", ref: "sky-600", value: "#0284c7" });
  });
  it("a hex identical to a primitive links as 'exact'", () => {
    const r = row(planImport({ name: "x", primary: "#0284C7" }, "tailwind"), "primary");
    expect(r).toMatchObject({ status: "exact", ref: "sky-600" });
  });
  it("a hex without a match snaps to the closest one as 'snapped'", () => {
    const r = row(planImport({ name: "x", primary: "#6d28d8" }, "tailwind"), "primary");
    expect(r.status).toBe("snapped");
    expect(r.ref).toBe("violet-700");
    expect(r.delta).toBeGreaterThan(0);
  });
  it("a missing token uses the Schema default", () => {
    const r = row(planImport({ name: "x" }, "tailwind"), "radius-box");
    expect(r).toMatchObject({ status: "default", ref: "lg", value: 8 });
  });
  it("dimensions: accepts a reference, a px number and units", () => {
    const p = planImport({ name: "x", "radius-field": "rounded-xl", "radius-box": 7, "size-field": "0.5rem" }, "tailwind");
    expect(row(p, "radius-field")).toMatchObject({ status: "ref", ref: "xl" });
    expect(row(p, "radius-box")).toMatchObject({ status: "snapped", ref: "md", value: 6 });
    expect(row(p, "size-field")).toMatchObject({ status: "exact", ref: "2", value: 8 });
  });
  it("an unknown reference stays 'unresolved' and blocks creation", () => {
    const p = planImport({ name: "x", primary: "sky-650" }, "tailwind");
    expect(row(p, "primary").status).toBe("unresolved");
    expect(p.ok).toBe(false);
  });
});

describe("planImport · system", () => {
  it("without 'system' it assumes the project one", () => {
    const p = planImport({ name: "x" }, "tailwind");
    expect(p.sourceSystem).toBe("tailwind");
    expect(p.needsReconversion).toBe(false);
  });
  it("a different system flags reconversion; hex values snap and unknown refs stay unresolved", () => {
    const p = planImport({ name: "x", system: "radix", primary: "#0284c7", secondary: "violet9" }, "tailwind");
    expect(p.needsReconversion).toBe(true);
    expect(row(p, "primary")).toMatchObject({ status: "exact", ref: "sky-600" });
    expect(row(p, "secondary").status).toBe("unresolved");
  });
});

describe("overrideRow", () => {
  it("lets you pick another primitive and unblocks creation", () => {
    const p = planImport({ name: "x", primary: "sky-650" }, "tailwind");
    const p2 = overrideRow(p, "primary", "sky-700");
    expect(row(p2, "primary")).toMatchObject({ status: "manual", ref: "sky-700", value: "#0369a1" });
    expect(p2.ok).toBe(true);
  });
  it("rejects an override that does not exist in the system", () => {
    const p = planImport({ name: "x" }, "tailwind");
    expect(() => overrideRow(p, "primary", "nope-1")).toThrow(expect.objectContaining({ detail: { code: "unknown-ref", params: { ref: "nope-1", system: "Tailwind" } } }));
  });
});
