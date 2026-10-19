import { useState } from "preact/hooks";
import { SYSTEMS, type PrimitiveSystem } from "../../core/systems";
import { systemCollectionName } from "../../core/model";
import { errorMessage } from "../../i18n";
import { notify, send } from "../bridge";
import { useT } from "../i18n";

export function SystemTab({ sys }: { sys: PrimitiveSystem | null }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const install = async (id: string) => {
    setBusy(true); setError(null);
    try { await send({ type: "install-system", system: id }); notify(t.notify.systemInstalled); }
    catch (e) { setError(errorMessage(t, e)); }
    finally { setBusy(false); }
  };
  const stats = (s: PrimitiveSystem) => t.system.stats(Object.keys(s.colors).length, Object.keys(s.radius).length, Object.keys(s.spacing).length);

  if (sys) {
    return (
      <div>
        <div class="section">
          <p class="label">{t.system.projectSystem}</p>
          <div class="name" style={{ fontSize: "14px", fontWeight: 600 }}>{sys.label}</div>
          <p class="muted">{t.system.collection(systemCollectionName(sys.label))}</p>
          <p>{stats(sys)}</p>
        </div>
        <div class="section muted">
          <p>{t.system.oneSystem}</p>
          <p>{t.system.hidden}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="section">
        <p class="label">{t.system.chooseTitle}</p>
        <p class="muted">{t.system.chooseBody}</p>
      </div>
      {Object.values(SYSTEMS).map((s) => (
        <div class="row" key={s.id} style={{ cursor: "default" }}>
          <div style={{ flex: 1 }}>
            <div class="name">{s.label}</div>
            <div class="muted">{stats(s)}</div>
          </div>
          <button class="primary" disabled={busy} onClick={() => install(s.id)}>{busy ? t.system.installing : t.system.install}</button>
        </div>
      ))}
      {error && <div class="section"><div class="banner error">{error}</div></div>}
    </div>
  );
}
