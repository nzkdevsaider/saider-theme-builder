import { describe, it, expect } from "vitest";
import { diagnose } from "../src/core/doctor";
import { SaiderError, appError } from "../src/core/errors";
import { MESSAGES, detectLocale, errorMessage, issueMessage } from "../src/i18n";
import { healthySnapshot, themeVar } from "./helpers";

describe("detectLocale", () => {
  it("picks the first supported language by its base tag", () => {
    expect(detectLocale(["fr-FR", "ja-JP", "en"])).toBe("ja");
    expect(detectLocale(["es-419"])).toBe("es");
  });
  it("falls back to English", () => {
    expect(detectLocale(["de-DE"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });
});

describe("messages", () => {
  it("formats doctor issues with their params in every locale", () => {
    const s = healthySnapshot();
    themeVar(s, "ocean", "primary").value = { kind: "literal", value: "#0285c8" };
    const [issue] = diagnose(s);
    expect(issueMessage(MESSAGES.en, issue)).toBe('"color/primary" has a loose value (#0285c8). Themes only point to primitives.');
    expect(issueMessage(MESSAGES.es, issue)).toContain("#0285c8");
    expect(issueMessage(MESSAGES.ja, issue)).toContain("#0285c8");
  });
  it("formats coded errors and wraps unexpected ones", () => {
    expect(errorMessage(MESSAGES.en, new SaiderError(appError("theme-exists", { name: "ocean" })))).toBe('A theme named "ocean" already exists.');
    expect(errorMessage(MESSAGES.es, appError("empty-name", {}))).toBe("El nombre no puede quedar vacío.");
    expect(errorMessage(MESSAGES.en, new Error("boom"))).toBe("Something went wrong: boom");
  });
});
