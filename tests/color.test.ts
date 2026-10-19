import { describe, it, expect } from "vitest";
import { parseHex, deltaE, contrastRatio, isDark, hexToFigmaRgb } from "../src/core/color";

describe("parseHex", () => {
  it("normalizes 6-digit hex to lowercase", () => {
    expect(parseHex("#0284C7")).toBe("#0284c7");
  });
  it("expands 3-digit hex", () => {
    expect(parseHex("#fff")).toBe("#ffffff");
  });
  it("accepts hex without the hash", () => {
    expect(parseHex("0284c7")).toBe("#0284c7");
  });
  it("returns null for text that is not hex", () => {
    expect(parseHex("sky-600")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });
});

describe("deltaE", () => {
  it("is 0 for identical colors", () => {
    expect(deltaE("#0284c7", "#0284c7")).toBe(0);
  });
  it("is larger between distant colors than between close ones", () => {
    expect(deltaE("#0284c7", "#ef4444")).toBeGreaterThan(deltaE("#0284c7", "#0369a1"));
  });
});

describe("contrastRatio", () => {
  it("black on white is 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
  it("is symmetric", () => {
    expect(contrastRatio("#0284c7", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#0284c7"), 5);
  });
});

describe("isDark", () => {
  it("detects dark and light backgrounds", () => {
    expect(isDark("#020617")).toBe(true);
    expect(isDark("#ffffff")).toBe(false);
  });
});

describe("hexToFigmaRgb", () => {
  it("converts to 0..1 channels with alpha 1", () => {
    expect(hexToFigmaRgb("#ff0000")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});
