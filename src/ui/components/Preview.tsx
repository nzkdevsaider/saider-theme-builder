import { contrastRatio, isDark } from "../../core/color";
import { CONTRAST_PAIRS } from "../../core/schema";
import { useT } from "../i18n";

type Values = Record<string, string | number | undefined>;
const c = (v: Values, k: string) => String(v[k] ?? "transparent");
const px = (v: Values, k: string, fb: number) => `${Number(v[k] ?? fb)}px`;

export function Preview({ values }: { values: Values }) {
  const t = useT();
  const box = px(values, "radius-box", 8);
  const field = px(values, "radius-field", 4);
  const sel = px(values, "radius-selector", 8);
  const border = `${px(values, "border", 1)} solid ${c(values, "base-300")}`;
  const weak = CONTRAST_PAIRS.filter(([a, b]) => typeof values[a] === "string" && typeof values[b] === "string" && contrastRatio(String(values[a]), String(values[b])) < 4.5);
  const dark = typeof values["base-100"] === "string" && isDark(String(values["base-100"]));

  return (
    <div>
      <div class="preview" style={{ background: c(values, "base-100"), color: c(values, "base-content"), border }} aria-label={t.preview.aria(dark)}>
        <div class="card" style={{ background: c(values, "base-200"), borderRadius: box, border }}>
          <div style={{ fontWeight: 600, fontSize: "13px" }}>{t.preview.cardTitle}</div>
          <div style={{ opacity: 0.75, margin: "2px 0 10px" }}>{t.preview.cardBody}</div>
          <div style={{ background: c(values, "base-100"), border, borderRadius: field, padding: "6px 10px", opacity: 0.8 }}>{t.preview.field}</div>
          <div class="btns" style={{ marginTop: "10px" }}>
            {(["primary", "secondary", "accent", "neutral"] as const).map((k) => (
              <span key={k} class="btn" style={{ background: c(values, k), color: c(values, `${k}-content`), borderRadius: field }}>
                {k[0].toUpperCase() + k.slice(1)}
              </span>
            ))}
          </div>
        </div>
        <div class="badges">
          {(["info", "success", "warning", "error"] as const).map((k) => (
            <span key={k} class="badge" style={{ background: c(values, k), color: c(values, `${k}-content`), borderRadius: sel }}>{k}</span>
          ))}
          <span style={{ marginLeft: "auto", width: "32px", height: "18px", borderRadius: sel, background: c(values, "primary"), position: "relative", display: "inline-block" }}>
            <span style={{ position: "absolute", right: "2px", top: "2px", width: "14px", height: "14px", borderRadius: sel, background: c(values, "primary-content") }} />
          </span>
        </div>
      </div>
      {weak.length > 0 && (
        <p class="muted" style={{ marginTop: "8px" }}>
          {t.preview.lowContrast(weak.map(([a, b]) => `${a} / ${b} ${contrastRatio(String(values[a]), String(values[b])).toFixed(1)}:1`).join(", "))}
        </p>
      )}
    </div>
  );
}

export function ThemeStrip({ values }: { values: Values }) {
  return (
    <div class="strip" style={{ background: c(values, "base-100"), color: c(values, "base-content") }} aria-hidden="true">
      <span class="aa">Aa</span>
      {["primary", "secondary", "accent", "neutral"].map((k) => <span key={k} class="dot" style={{ background: c(values, k) }} />)}
    </div>
  );
}
