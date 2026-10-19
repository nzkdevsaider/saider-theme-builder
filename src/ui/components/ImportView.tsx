import { useEffect, useMemo, useState } from "preact/hooks";
import { themeCollectionName } from "../../core/model";
import { overrideRow, planImport, previewValues, type ImportRow } from "../../core/parser";
import type { PrimitiveSystem } from "../../core/systems";
import { errorMessage } from "../../i18n";
import { notify, send } from "../bridge";
import { needsAttention } from "../helpers";
import { useT } from "../i18n";
import { Picker } from "./Picker";
import { Preview } from "./Preview";

function Value({ row, sys }: { row: ImportRow; sys: PrimitiveSystem }) {
  if (!row.ref) return <span class="faint">—</span>;
  return (
    <span class="chip">
      {row.kind === "color" && <span class="sw" style={{ background: sys.colors[row.ref] }} />}
      {row.ref}
    </span>
  );
}

export function ImportView({ sys, initialText, title, onDone, onCancel }: {
  sys: PrimitiveSystem; initialText: string; title: string; onDone: () => void; onCancel: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(initialText);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setOverrides({}); setOpen(null); }, [text]);

  const plan = useMemo(() => {
    let p = planImport(text, sys.id);
    for (const [k, ref] of Object.entries(overrides)) {
      try { p = overrideRow(p, k, ref); } catch { continue; }
    }
    return p;
  }, [text, overrides, sys]);

  const flagged = plan.rows.filter(needsAttention);
  const rows = showAll ? plan.rows : flagged;
  const unresolved = plan.rows.filter((r) => r.status === "unresolved").length;
  const hasPreview = plan.rows.length > 0;

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) setText(await file.text());
  };

  const create = async () => {
    setBusy(true); setError(null);
    try {
      await send({ type: "create-theme", plan });
      notify(t.notify.themeCreated(plan.name));
      onDone();
    }
    catch (e) { setError(errorMessage(t, e)); }
    finally { setBusy(false); }
  };

  const hint = error ?? (unresolved ? t.import.unresolved(unresolved) : plan.ok ? t.import.willCreate(themeCollectionName(plan.name)) : "");

  return (
    <div>
      <div class="head">
        <button class="ghost" onClick={onCancel} aria-label={t.common.back}>←</button>
        <h2>{title}</h2>
        <label>
          <input type="file" accept=".json,application/json" onChange={onFile} style={{ display: "none" }} />
          <span class="muted" style={{ cursor: "pointer", textDecoration: "underline" }}>{t.import.uploadFile}</span>
        </label>
      </div>

      <div class="section">
        <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} spellcheck={false}
          placeholder={'{\n  "name": "my-theme",\n  "primary": "sky-700"\n}'} aria-label={t.import.jsonAria} />
      </div>

      {text.trim() && (
        <>
          {plan.errors.length > 0 && (
            <div class="section">
              {plan.errors.map((e) => <div key={e.code} class="banner error">{errorMessage(t, e)}</div>)}
            </div>
          )}

          {plan.errors.length === 0 && hasPreview && (
            <>
              <div class="section">
                {plan.needsReconversion && (
                  <div class="banner warning">
                    <span class="grow">{t.import.reconversion(plan.sourceSystem, sys.label)}</span>
                  </div>
                )}
                <p class="label">{t.import.preview} · <b>{plan.name}</b></p>
                <Preview values={previewValues(plan.rows)} />
              </div>

              <div class="section">
                <div class="toolbar" style={{ marginBottom: "6px" }}>
                  <p class="label grow" style={{ margin: 0 }}>
                    {flagged.length === 0 ? t.import.allLinked : t.import.needAttention(flagged.length, plan.rows.length)}
                  </p>
                  <button class="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? t.import.showFlagged : t.import.showAll(plan.rows.length)}</button>
                </div>
                {plan.unknownKeys.length > 0 && <p class="muted">{t.import.unknownKeys(plan.unknownKeys.join(", "))}</p>}
                <table class="report">
                  <tbody>
                    {rows.map((r) => [
                      <tr key={r.key}>
                        <td class="key">{r.key}</td>
                        <td>
                          {r.input !== undefined && r.status !== "ref" && <span class="faint">{String(r.input)} → </span>}
                          <Value row={r} sys={sys} />
                          {r.delta !== undefined && r.delta > 0 && <span class="faint"> Δ{r.delta}</span>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span class={`status ${r.status}`}>{t.status[r.status]}</span>{" "}
                          <button class="ghost" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>{t.common.change}</button>
                        </td>
                      </tr>,
                      open === r.key && (
                        <tr key={`${r.key}-picker`}>
                          <td colSpan={3}>
                            <Picker sys={sys} kind={r.kind} value={r.ref} onPick={(ref) => { setOverrides({ ...overrides, [r.key]: ref }); setOpen(null); }} />
                          </td>
                        </tr>
                      ),
                    ])}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div class="section toolbar">
            <span class="grow muted">{hint}</span>
            <button onClick={onCancel}>{t.common.cancel}</button>
            <button class="primary" disabled={!plan.ok || busy} onClick={create}>
              {busy ? t.import.creating : plan.needsReconversion ? t.import.reconvertAndCreate : t.import.create}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
