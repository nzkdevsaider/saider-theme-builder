import { FakeFigma } from "../fake-figma";
import { Repository } from "../../src/plugin/repository";
import { diagnose } from "../../src/core/doctor";
import { toAppError } from "../../src/core/errors";
import { readThemes } from "../../src/core/themes";
import { SCHEMA_VERSION } from "../../src/core/schema";
import type { Locale } from "../../src/i18n/locale";
import type { FixReport } from "../../src/plugin/messages";

const fig = new FakeFigma();
const repo = new Repository(fig.api);
let locale: Locale | null = null;
(window as any).__fig = fig;
(window as any).__repo = repo;

const post = (msg: unknown) => window.postMessage({ pluginMessage: msg }, "*");
async function pushState() {
  const s = await repo.snapshot();
  const sys = s.collections.find((c) => c.meta.kind === "system");
  post({ type: "state", state: { systemId: sys?.meta.system ?? null, schemaVersion: SCHEMA_VERSION, locale, themes: readThemes(s), issues: diagnose(s), foreignCollections: 0 } });
}
(window as any).__push = pushState;

window.addEventListener("message", async (e) => {
  const env = e.data?.pluginMessage;
  if (!env || !env.command) return;
  const c = env.command;
  try {
    let data: unknown;
    if (c.type === "notify") console.info("[figma.notify]", c.message);
    if (c.type === "set-locale") locale = c.locale;
    if (c.type === "install-system") await repo.installSystem(c.system);
    if (c.type === "create-theme") data = await repo.createTheme(c.plan);
    if (c.type === "update-theme") await repo.updateTheme(c.id, c.values);
    if (c.type === "rename-theme") await repo.renameTheme(c.id, c.name);
    if (c.type === "set-default") await repo.setDefault(c.id);
    if (c.type === "delete-theme") await repo.deleteTheme(c.id);
    if (c.type === "apply-fixes") {
      const report: FixReport = { done: 0, failed: [] };
      for (const f of c.fixes) {
        try { await repo.applyFix(f); report.done++; } catch (err) { report.failed.push(toAppError(err)); }
      }
      data = report;
    }
    await pushState();
    post({ type: "result", requestId: env.requestId, ok: true, data });
  } catch (err) {
    await pushState();
    post({ type: "result", requestId: env.requestId, ok: false, error: toAppError(err) });
  }
});
setTimeout(pushState, 100);
