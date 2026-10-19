import { describe, it, expect } from "vitest";
import { readThemes } from "../src/core/themes";
import { toSaiderJson, toCss } from "../src/core/exporter";
import { healthySnapshot, themeVar, pid } from "./helpers";

describe("readThemes", () => {
  it("lists managed themes with their references and values", () => {
    const s = healthySnapshot(["ocean", "sunset"]);
    themeVar(s, "ocean", "primary").value = { kind: "alias", targetId: pid("color", "sky-600") };
    const [ocean, sunset] = readThemes(s);
    expect(ocean).toMatchObject({ name: "ocean", isDefault: true, readOnly: false });
    expect(ocean.values.primary).toEqual({ ref: "sky-600", value: "#0284c7" });
    expect(ocean.values["radius-box"]).toEqual({ ref: "lg", value: 8 });
    expect(sunset.isDefault).toBe(false);
  });
  it("marks themes from a newer format as read-only", () => {
    const s = healthySnapshot();
    s.collections[1].meta.schemaVersion = 99;
    expect(readThemes(s)[0].readOnly).toBe(true);
  });
  it("leaves tokens that do not point to a primitive without a ref", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "primary").value = { kind: "literal", value: "#123456" };
    expect(readThemes(s)[0].values.primary).toEqual({ value: "#123456" });
  });
});

describe("exporter", () => {
  const theme = readThemes(healthySnapshot())[0];
  it("Saider JSON: references, never hex, in Schema order", () => {
    const json = JSON.parse(toSaiderJson(theme, "tailwind"));
    expect(json.$saider).toBe(1);
    expect(json.name).toBe("ocean");
    expect(json.system).toBe("tailwind");
    expect(json.primary).toBe("blue-600");
    expect(json["radius-field"]).toBe("default");
    expect(Object.keys(json).slice(3, 5)).toEqual(["base-100", "base-200"]);
    expect(JSON.stringify(json)).not.toMatch(/#[0-9a-f]{6}/i);
  });
  it("CSS: variables per data-theme with resolved values and computed color-scheme", () => {
    const css = toCss([theme]);
    expect(css).toContain('[data-theme="ocean"]');
    expect(css).toContain(":root,");
    expect(css).toContain("--color-primary: #2563eb;");
    expect(css).toContain("--radius-field: 0.25rem;");
    expect(css).toContain("--border: 1px;");
    expect(css).toContain("color-scheme: light;");
  });
});
