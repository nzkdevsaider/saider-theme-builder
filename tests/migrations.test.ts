import { describe, it, expect } from "vitest";
import { migrateValues, collapseOps, type Migration } from "../src/core/migrations";

const FAKE: Migration[] = [
  { from: 1, to: 2, ops: [
    { op: "rename", from: "a", to: "b" },
    { op: "add", token: "c", default: { copyFrom: "b" } },
  ] },
  { from: 2, to: 3, ops: [
    { op: "remove", token: "x" },
    { op: "add", token: "d", default: { ref: "sky-600" } },
  ] },
];

describe("migrateValues", () => {
  it("chains migrations up to the target version", () => {
    const r = migrateValues({ a: "red-500", x: "1" }, 1, FAKE, 3);
    expect(r.status).toBe("ok");
    expect(r.values).toEqual({ b: "red-500", c: "red-500", d: "sky-600" });
    expect(r.applied).toHaveLength(4);
  });
  it("touches nothing when already on the target version", () => {
    const r = migrateValues({ a: "red-500" }, 3, FAKE, 3);
    expect(r.status).toBe("ok");
    expect(r.values).toEqual({ a: "red-500" });
    expect(r.applied).toHaveLength(0);
  });
  it("flags a theme from a future version as 'newer'", () => {
    expect(migrateValues({}, 4, FAKE, 3).status).toBe("newer");
  });
  it("fails when a step in the chain is missing", () => {
    expect(migrateValues({}, 1, [FAKE[1]], 3).status).toBe("broken-chain");
  });
  it("does not overwrite an existing value when adding a token", () => {
    const r = migrateValues({ a: "red-500", c: "blue-500" }, 1, FAKE, 2);
    expect(r.values.c).toBe("blue-500");
  });
});

describe("collapseOps", () => {
  it("returns the operations in order to apply them in Figma", () => {
    const ops = collapseOps(1, FAKE, 3);
    expect(ops.map((o) => o.op)).toEqual(["rename", "add", "remove", "add"]);
  });
});
