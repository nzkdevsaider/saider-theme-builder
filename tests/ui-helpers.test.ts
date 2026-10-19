import { describe, it, expect } from "vitest";
import { colorGrid, newThemeTemplate, duplicateTemplate, TOKEN_GROUPS, issueCounts, needsAttention } from "../src/ui/helpers";
import { getSystem } from "../src/core/systems";
import { planImport } from "../src/core/parser";
import { readThemes } from "../src/core/themes";
import { diagnose } from "../src/core/doctor";
import { healthySnapshot, themeVar } from "./helpers";

describe("colorGrid", () => {
  it("groups colors into families with sorted shades and separates the singles", () => {
    const g = colorGrid(getSystem("tailwind")!);
    expect(g.families).toHaveLength(22);
    expect(g.families[0].name).toBe("slate");
    expect(g.families[0].shades.map((s) => s.shade)).toEqual(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]);
    expect(g.singles.map((s) => s.ref)).toEqual(["white", "black"]);
  });
});

describe("templates", () => {
  it("the new theme template yields a valid plan with every default value", () => {
    const p = planImport(newThemeTemplate("tailwind"), "tailwind");
    expect(p.ok).toBe(true);
    expect(p.name).toBe("new-theme");
    expect(p.rows.every((r) => r.status === "ref")).toBe(true);
  });
  it("duplicating keeps the references and changes the name", () => {
    const t = readThemes(healthySnapshot())[0];
    const p = planImport(duplicateTemplate(t, "tailwind"), "tailwind");
    expect(p.name).toBe("ocean-copy");
    expect(p.ok).toBe(true);
  });
});

describe("TOKEN_GROUPS", () => {
  it("covers every Schema token exactly once", () => {
    const keys = TOKEN_GROUPS.flatMap((g) => g.keys);
    expect(keys).toHaveLength(26);
    expect(new Set(keys).size).toBe(26);
  });
});

describe("issueCounts", () => {
  it("counts by severity and by theme", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "primary").value = { kind: "literal", value: "#000001" };
    const c = issueCounts(diagnose(s));
    expect(c.error).toBe(1);
    expect(c.byTheme.ocean).toBe(1);
  });
});

describe("needsAttention", () => {
  it("only flags snapped, reconverted, default or unresolved rows", () => {
    const p = planImport({ name: "x", "base-100": "#ffffff", primary: "#6d28d8", secondary: "nope-1", accent: "teal-400" }, "tailwind");
    const by = (k: string) => needsAttention(p.rows.find((r) => r.key === k)!);
    expect(by("base-100")).toBe(false);
    expect(by("accent")).toBe(false);
    expect(by("primary")).toBe(true);
    expect(by("secondary")).toBe(true);
    expect(by("neutral")).toBe(true);
  });
});
