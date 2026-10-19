import { describe, it, expect } from "vitest";
import { SCHEMA, SCHEMA_VERSION, tokenByKey, tokenByFigmaName } from "../src/core/schema";
import { getSystem, resolveRef, primitiveVarName, parsePrimitiveVarName } from "../src/core/systems";

describe("SCHEMA v1", () => {
  it("defines 26 tokens with unique keys", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(SCHEMA.tokens).toHaveLength(26);
    expect(new Set(SCHEMA.tokens.map((t) => t.key)).size).toBe(26);
  });
  it("maps JSON keys to Figma variable names", () => {
    expect(tokenByKey("primary-content")?.figmaName).toBe("color/primary-content");
    expect(tokenByKey("radius-field")?.figmaName).toBe("radius/field");
    expect(tokenByKey("border")?.figmaName).toBe("border");
    expect(tokenByFigmaName("size/selector")?.key).toBe("size-selector");
  });
  it("every default value exists in tailwind", () => {
    const sys = getSystem("tailwind")!;
    for (const t of SCHEMA.tokens) expect(resolveRef(sys, t.kind, t.default), t.key).not.toBeNull();
  });
});

describe("tailwind system", () => {
  const sys = getSystem("tailwind")!;
  it("resolves references per scale kind", () => {
    expect(resolveRef(sys, "color", "sky-600")).toEqual({ ref: "sky-600", value: "#0284c7" });
    expect(resolveRef(sys, "radius", "lg")).toEqual({ ref: "lg", value: 8 });
    expect(resolveRef(sys, "size", "1.5")).toEqual({ ref: "1.5", value: 6 });
    expect(resolveRef(sys, "size", "px")).toEqual({ ref: "px", value: 1 });
  });
  it("accepts lenient aliases", () => {
    expect(resolveRef(sys, "radius", "rounded-lg")?.ref).toBe("lg");
    expect(resolveRef(sys, "radius", "rounded")?.ref).toBe("default");
    expect(resolveRef(sys, "color", "Sky-600")?.ref).toBe("sky-600");
    expect(resolveRef(sys, "size", "1_5")?.ref).toBe("1.5");
  });
  it("returns null for unknown references", () => {
    expect(resolveRef(sys, "color", "sky-650")).toBeNull();
    expect(resolveRef(sys, "radius", "huge")).toBeNull();
  });
  it("round-trips between a reference and a Figma variable name", () => {
    expect(primitiveVarName("color", "sky-600")).toBe("color/sky/600");
    expect(primitiveVarName("color", "white")).toBe("color/white");
    expect(primitiveVarName("size", "1.5")).toBe("spacing/1_5");
    expect(primitiveVarName("radius", "lg")).toBe("radius/lg");
    expect(parsePrimitiveVarName("color/sky/600")).toEqual({ kind: "color", ref: "sky-600" });
    expect(parsePrimitiveVarName("spacing/1_5")).toEqual({ kind: "size", ref: "1.5" });
    expect(parsePrimitiveVarName("screen/md")).toBeNull();
  });
});
