import { toCss } from "../../core/exporter";
import type { ThemeInfo } from "../../core/themes";
import type { PrimitiveSystem } from "../../core/systems";
import { copy, download } from "../bridge";
import { useT } from "../i18n";
import { ThemeStrip } from "./Preview";

const valuesOf = (t: ThemeInfo) => Object.fromEntries(Object.entries(t.values).map(([k, v]) => [k, v.value]));

export function ThemesTab({ themes, sys, issuesByTheme, onOpen, onImport, onNew, onGoSystem }: {
  themes: ThemeInfo[]; sys: PrimitiveSystem | null; issuesByTheme: Record<string, number>;
  onOpen: (id: string) => void; onImport: () => void; onNew: () => void; onGoSystem: () => void;
}) {
  const t = useT();
  if (!sys) {
    return (
      <div class="empty">
        <h3>{t.themes.noSystemTitle}</h3>
        <p class="muted">{t.themes.noSystemBody}</p>
        <button class="primary" onClick={onGoSystem}>{t.themes.chooseSystem}</button>
      </div>
    );
  }
  return (
    <div>
      <div class="section toolbar">
        <button class="primary" onClick={onImport}>{t.themes.importJson}</button>
        <button onClick={onNew}>{t.themes.newTheme}</button>
        <span class="grow" />
        <span class="faint">{t.themes.count(themes.length)}</span>
      </div>

      {themes.length === 0 ? (
        <div class="empty">
          <h3>{t.themes.emptyTitle}</h3>
          <p class="muted">{t.themes.emptyBody}</p>
        </div>
      ) : (
        themes.map((th) => (
          <div key={th.collectionId} class="row" tabIndex={0} role="button" onClick={() => onOpen(th.collectionId)} onKeyDown={(e) => e.key === "Enter" && onOpen(th.collectionId)}>
            <ThemeStrip values={valuesOf(th)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div class="name">{th.name}</div>
              <div class="toolbar" style={{ gap: "4px", marginTop: "2px" }}>
                {th.isDefault && <span class="pill">{t.common.defaultPill}</span>}
                {th.readOnly && <span class="pill">{t.themes.readOnlyPill}</span>}
                {issuesByTheme[th.name] ? <span class="count warning">{issuesByTheme[th.name]}</span> : null}
              </div>
            </div>
            <span class="faint">›</span>
          </div>
        ))
      )}

      {themes.length > 0 && (
        <div class="section">
          <p class="label">{t.themes.exportLabel}</p>
          <div class="toolbar">
            <button onClick={() => download("saider-themes.css", toCss(themes), "text/css")}>{t.themes.downloadCss}</button>
            <button onClick={() => copy(toCss(themes))}>{t.themes.copyCss}</button>
          </div>
        </div>
      )}
    </div>
  );
}
