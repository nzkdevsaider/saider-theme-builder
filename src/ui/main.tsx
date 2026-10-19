import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { AppError } from "../core/errors";
import { getSystem } from "../core/systems";
import { LOCALES, MESSAGES, detectLocale, errorMessage, type Locale } from "../i18n";
import type { PluginState } from "../plugin/messages";
import { send, subscribe } from "./bridge";
import { DoctorTab } from "./components/DoctorTab";
import { EditView } from "./components/EditView";
import { ImportView } from "./components/ImportView";
import { SystemTab } from "./components/SystemTab";
import { ThemesTab } from "./components/ThemesTab";
import { issueCounts, newThemeTemplate } from "./helpers";
import { I18n } from "./i18n";

type Tab = "themes" | "system" | "doctor";
type View = { kind: "list" } | { kind: "import"; text: string; title: "importTitle" | "newTitle" | "duplicateTitle" } | { kind: "edit"; id: string };

function App() {
  const [state, setState] = useState<PluginState | null>(null);
  const [fatal, setFatal] = useState<AppError | null>(null);
  const [tab, setTab] = useState<Tab>("themes");
  const [view, setView] = useState<View>({ kind: "list" });
  const [picked, setPicked] = useState<Locale | null>(null);

  useEffect(() => {
    subscribe(setState, setFatal);
    const onFocus = () => send({ type: "refresh" }).catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const locale = picked ?? state?.locale ?? detectLocale(navigator.languages ?? [navigator.language]);
  const t = MESSAGES[locale];
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const sys = useMemo(() => getSystem(state?.systemId), [state?.systemId]);
  const counts = useMemo(() => issueCounts(state?.issues ?? []), [state?.issues]);

  const editing = view.kind === "edit" ? state?.themes.find((th) => th.collectionId === view.id) : undefined;
  useEffect(() => {
    if (state && view.kind === "edit" && !editing) setView({ kind: "list" });
  }, [state, view, editing]);

  if (!state) {
    return (
      <div class="empty muted">
        {fatal ? <><h3>{t.app.loadFailed}</h3><p>{errorMessage(t, fatal)}</p></> : t.app.loading}
      </div>
    );
  }

  const go = (next: Tab) => { setTab(next); setView({ kind: "list" }); };
  const changeLocale = (next: Locale) => { setPicked(next); send({ type: "set-locale", locale: next }).catch(() => undefined); };
  const badge = counts.error ? <span class="count error">{counts.error}</span> : counts.warning ? <span class="count warning">{counts.warning}</span> : null;

  return (
    <I18n.Provider value={t}>
      <div class="app">
        <nav class="tabs" role="tablist">
          <button class="tab" role="tab" aria-selected={tab === "themes"} onClick={() => go("themes")}>{t.app.tabs.themes}</button>
          <button class="tab" role="tab" aria-selected={tab === "system"} onClick={() => go("system")}>{t.app.tabs.system}</button>
          <button class="tab" role="tab" aria-selected={tab === "doctor"} onClick={() => go("doctor")}>{t.app.tabs.doctor} {badge}</button>
          <select class="lang" aria-label={t.app.language} value={locale} onChange={(e) => changeLocale((e.target as HTMLSelectElement).value as Locale)}>
            {LOCALES.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.label}</option>)}
          </select>
        </nav>
        <main class="body">
          {tab === "themes" && view.kind === "list" && (
            <ThemesTab themes={state.themes} sys={sys} issuesByTheme={counts.byTheme}
              onOpen={(id) => setView({ kind: "edit", id })}
              onImport={() => setView({ kind: "import", text: "", title: "importTitle" })}
              onNew={() => setView({ kind: "import", text: newThemeTemplate(sys!.id), title: "newTitle" })}
              onGoSystem={() => go("system")} />
          )}
          {tab === "themes" && view.kind === "import" && sys && (
            <ImportView key={view.text} sys={sys} initialText={view.text} title={t.import[view.title]}
              onDone={() => setView({ kind: "list" })} onCancel={() => setView({ kind: "list" })} />
          )}
          {tab === "themes" && editing && sys && (
            <EditView key={editing.collectionId + JSON.stringify(editing.values)} theme={editing} sys={sys}
              onBack={() => setView({ kind: "list" })}
              onDuplicate={(text) => setView({ kind: "import", text, title: "duplicateTitle" })} />
          )}
          {tab === "system" && <SystemTab sys={sys} />}
          {tab === "doctor" && <DoctorTab issues={state.issues} />}
        </main>
      </div>
    </I18n.Provider>
  );
}

render(<App />, document.getElementById("app")!);
