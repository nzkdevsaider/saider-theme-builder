import { diagnose } from "../core/doctor";
import { toAppError } from "../core/errors";
import { SCHEMA_VERSION } from "../core/schema";
import { readThemes } from "../core/themes";
import { isLocale, type Locale } from "../i18n/locale";
import type { Envelope, FixReport, PluginState, ToUi } from "./messages";
import { Repository } from "./repository";

const LOCALE_KEY = "locale";
const repo = new Repository(figma);
let locale: Locale | null = null;

figma.showUI(__html__, { width: 420, height: 680, themeColors: true, title: "Saider Theme Builder" });

const post = (msg: ToUi) => figma.ui.postMessage(msg);

async function pushState() {
  const snapshot = await repo.snapshot();
  const systemCol = snapshot.collections.find((c) => c.meta.kind === "system");
  const state: PluginState = {
    systemId: systemCol?.meta.system ?? null,
    schemaVersion: SCHEMA_VERSION,
    locale,
    themes: readThemes(snapshot),
    issues: diagnose(snapshot),
    foreignCollections: snapshot.collections.filter((c) => !c.meta.kind).length,
  };
  post({ type: "state", state });
}

async function run(env: Envelope): Promise<unknown> {
  const c = env.command;
  switch (c.type) {
    case "refresh":
      return;
    case "install-system":
      return repo.installSystem(c.system);
    case "create-theme":
      return repo.createTheme(c.plan);
    case "update-theme":
      return repo.updateTheme(c.id, c.values);
    case "rename-theme":
      return repo.renameTheme(c.id, c.name);
    case "set-default":
      return repo.setDefault(c.id);
    case "delete-theme":
      return repo.deleteTheme(c.id);
    case "apply-fixes": {
      const report: FixReport = { done: 0, failed: [] };
      for (const fix of c.fixes) {
        try { await repo.applyFix(fix); report.done++; } catch (e) { report.failed.push(toAppError(e)); }
      }
      return report;
    }
    case "set-locale":
      locale = c.locale;
      await figma.clientStorage.setAsync(LOCALE_KEY, c.locale);
      return;
    case "notify":
      figma.notify(c.message, { error: !!c.error });
      return;
  }
}

figma.ui.onmessage = async (env: Envelope) => {
  try {
    const data = await run(env);
    await pushState();
    post({ type: "result", requestId: env.requestId, ok: true, data });
  } catch (e) {
    await pushState().catch(() => undefined);
    post({ type: "result", requestId: env.requestId, ok: false, error: toAppError(e) });
  }
};

async function start() {
  const stored = await figma.clientStorage.getAsync(LOCALE_KEY).catch(() => null);
  locale = isLocale(stored) ? stored : null;
  await pushState();
}

start().catch((e) => post({ type: "fatal", error: toAppError(e) }));
