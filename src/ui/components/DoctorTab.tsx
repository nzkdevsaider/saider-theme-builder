import { useState } from "preact/hooks";
import { isSafe, type Issue } from "../../core/doctor";
import { errorMessage, issueMessage } from "../../i18n";
import type { FixReport } from "../../plugin/messages";
import { notify, send } from "../bridge";
import { useT } from "../i18n";

const ORDER = { error: 0, warning: 1, info: 2 } as const;

export function DoctorTab({ issues }: { issues: Issue[] }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (list: Issue[]) => {
    setBusy(true); setError(null); setConfirm(null);
    try {
      const report = (await send({ type: "apply-fixes", fixes: list.map((i) => i.fix!) })) as FixReport;
      notify(t.notify.fixesApplied(report.done, report.failed.length), report.failed.length > 0);
      if (report.failed.length) setError(report.failed.map((f) => errorMessage(t, f)).join("\n"));
    } catch (e) { setError(errorMessage(t, e)); }
    finally { setBusy(false); }
  };

  if (!issues.length) {
    return (
      <div class="empty">
        <h3>{t.doctor.allGoodTitle}</h3>
        <p class="muted">{t.doctor.allGoodBody}</p>
        <button onClick={() => send({ type: "refresh" })}>{t.doctor.recheck}</button>
      </div>
    );
  }

  const safe = issues.filter(isSafe);
  const sorted = [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return (
    <div>
      <div class="section toolbar">
        <span class="grow muted">{t.doctor.findings(issues.length)}</span>
        <button onClick={() => send({ type: "refresh" })} disabled={busy}>{t.doctor.check}</button>
        <button class="primary" disabled={!safe.length || busy} onClick={() => apply(safe)}>{t.doctor.fixSafe(safe.length)}</button>
      </div>
      {error && <div class="section"><div class="banner error" style={{ whiteSpace: "pre-line" }}>{error}</div></div>}
      {sorted.map((i) => (
        <div class="issue" key={i.id}>
          <span class={`ico ${i.severity}`} role="img" aria-label={t.severity[i.severity]} />
          <div class="msg">
            {i.theme && <span class="faint">{i.theme} · </span>}{issueMessage(t, i)}
            {confirm === i.id && (
              <div class="banner error" style={{ marginTop: "6px", marginBottom: 0 }}>
                <span class="grow">{t.doctor.destructiveWarning}</span>
                <button onClick={() => setConfirm(null)}>{t.common.cancel}</button>
                <button class="danger" disabled={busy} onClick={() => apply([i])}>{t.doctor.confirm}</button>
              </div>
            )}
          </div>
          {i.fix && confirm !== i.id && (
            <button class={i.destructive ? "danger" : ""} disabled={busy} onClick={() => (i.destructive ? setConfirm(i.id) : apply([i]))}>
              {t.doctor.fix}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
