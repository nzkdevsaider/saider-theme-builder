import { useMemo, useState } from "preact/hooks";
import { toSaiderJson } from "../../core/exporter";
import { tokenByKey } from "../../core/schema";
import { resolveRef, type PrimitiveSystem } from "../../core/systems";
import type { ThemeInfo } from "../../core/themes";
import { errorMessage } from "../../i18n";
import { copy, download, notify, send } from "../bridge";
import { TOKEN_GROUPS, duplicateTemplate } from "../helpers";
import { useT } from "../i18n";
import { Picker } from "./Picker";
import { Preview } from "./Preview";

export function EditView({ theme, sys, onBack, onDuplicate }: {
  theme: ThemeInfo; sys: PrimitiveSystem; onBack: () => void; onDuplicate: (json: string) => void;
}) {
  const t = useT();
  const initial = useMemo(() => Object.fromEntries(Object.entries(theme.values).map(([k, v]) => [k, v.ref ?? ""])), [theme]);
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState(theme.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const changed = Object.keys(draft).filter((k) => draft[k] && draft[k] !== initial[k]);
  const values = useMemo(() => {
    const out: Record<string, string | number> = {};
    for (const [k, ref] of Object.entries(draft)) {
      const def = tokenByKey(k);
      const r = def && ref ? resolveRef(sys, def.kind, ref) : null;
      if (r) out[k] = r.value;
      else if (theme.values[k]?.value !== undefined) out[k] = theme.values[k].value!;
    }
    return out;
  }, [draft, sys, theme]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); if (ok) { setMsg(ok); notify(ok); } }
    catch (e) { setMsg(errorMessage(t, e)); }
    finally { setBusy(false); }
  };

  const save = () => act(() => send({ type: "update-theme", id: theme.collectionId, values: Object.fromEntries(changed.map((k) => [k, draft[k]])) }), t.edit.saved);
  const rename = () => name.trim() && name !== theme.name && act(() => send({ type: "rename-theme", id: theme.collectionId, name }));
  const remove = () => act(async () => {
    await send({ type: "delete-theme", id: theme.collectionId });
    notify(t.notify.themeDeleted);
    onBack();
  });
  const json = () => toSaiderJson(theme, sys.id);

  return (
    <div>
      <div class="head">
        <button class="ghost" onClick={onBack} aria-label={t.common.back}>&#x25C0;</button>
        <h2>{theme.name}</h2>
        {theme.isDefault && <span class="pill">{t.common.defaultPill}</span>}
        <button class="primary" disabled={!changed.length || busy || theme.readOnly} onClick={save}>
          {t.edit.save(changed.length)}
        </button>
      </div>

      {theme.readOnly && (
        <div class="section"><div class="banner warning">{t.edit.readOnly(theme.schemaVersion)}</div></div>
      )}

      <div class="section">
        <Preview values={values} />
        {msg && <p class="muted" style={{ marginTop: "8px" }}>{msg}</p>}
      </div>

      <div class="section">
        <p class="label">{t.edit.nameLabel}</p>
        <input type="text" value={name} disabled={theme.readOnly} onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onBlur={rename} onKeyDown={(e) => e.key === "Enter" && rename()} aria-label={t.edit.nameAria} />
      </div>

      {TOKEN_GROUPS.map((g) => (
        <div class="section" key={g.group}>
          <p class="label">{t.groups[g.group]}</p>
          <table class="report">
            <tbody>
              {g.keys.map((k) => {
                const def = tokenByKey(k)!;
                const ref = draft[k];
                const hex = def.kind === "color" && ref ? sys.colors[ref] : undefined;
                return [
                  <tr key={k}>
                    <td class="key">{k}</td>
                    <td>
                      {ref ? (
                        <span class="chip">{hex && <span class="sw" style={{ background: hex }} />}{ref}
                          {def.kind !== "color" && <span class="faint">{String(values[k])}px</span>}
                        </span>
                      ) : <span class="status unresolved">{t.edit.noPrimitive}</span>}
                      {ref !== initial[k] && <span class="faint"> · {t.edit.edited}</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button class="ghost" disabled={theme.readOnly} aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>{t.common.change}</button>
                    </td>
                  </tr>,
                  open === k && (
                    <tr key={`${k}-p`}><td colSpan={3}>
                      <Picker sys={sys} kind={def.kind} value={ref} onPick={(r) => { setDraft({ ...draft, [k]: r }); setOpen(null); }} />
                    </td></tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div class="section">
        <p class="label">{t.edit.actions}</p>
        <div class="toolbar" style={{ flexWrap: "wrap" }}>
          <button onClick={() => download(`${theme.name}.saider.json`, json())}>{t.edit.downloadJson}</button>
          <button onClick={() => copy(json()).then(() => setMsg(t.edit.jsonCopied))}>{t.edit.copyJson}</button>
          <button onClick={() => onDuplicate(duplicateTemplate(theme, sys.id))}>{t.edit.duplicate}</button>
          {!theme.isDefault && <button disabled={busy} onClick={() => act(() => send({ type: "set-default", id: theme.collectionId }))}>{t.edit.makeDefault}</button>}
        </div>
      </div>

      <div class="section">
        {confirmDelete ? (
          <div class="banner error">
            <span class="grow">{t.edit.deleteWarning}</span>
            <button onClick={() => setConfirmDelete(false)}>{t.common.cancel}</button>
            <button class="danger" disabled={busy} onClick={remove}>{t.edit.delete}</button>
          </div>
        ) : (
          <button class="danger" onClick={() => setConfirmDelete(true)}>{t.edit.deleteTheme}</button>
        )}
      </div>
    </div>
  );
}
