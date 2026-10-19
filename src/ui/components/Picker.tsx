import { useMemo } from "preact/hooks";
import { scaleOf, type PrimitiveSystem, type TokenKind } from "../../core/systems";
import { colorGrid } from "../helpers";
import { useT } from "../i18n";

interface Props {
  sys: PrimitiveSystem;
  kind: TokenKind;
  value?: string;
  onPick: (ref: string) => void;
}

export function Picker({ sys, kind, value, onPick }: Props) {
  const t = useT();
  const grid = useMemo(() => colorGrid(sys), [sys]);

  if (kind !== "color") {
    const entries = Object.entries(scaleOf(sys, kind)).sort((a, b) => Number(a[1]) - Number(b[1]));
    return (
      <div class="picker scale" role="listbox" aria-label={t.picker.scaleAria}>
        {entries.map(([ref, v]) => (
          <button key={ref} class={ref === value ? "on" : ""} role="option" aria-selected={ref === value} onClick={() => onPick(ref)}>
            {ref} · {Number(v) >= 9999 ? "∞" : `${v}px`}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div class="picker" role="listbox" aria-label={t.picker.colorAria}>
      <div class="grid">
        {grid.families.map((f) => [
          <span key={f.name} class="fam">{f.name}</span>,
          ...f.shades.map((s) => (
            <button key={s.ref} class={`cell${s.ref === value ? " on" : ""}`} style={{ background: s.hex }} title={`${s.ref} ${s.hex}`}
              role="option" aria-selected={s.ref === value} aria-label={s.ref} onClick={() => onPick(s.ref)} />
          )),
        ])}
      </div>
      <div class="toolbar" style={{ marginTop: "6px" }}>
        {grid.singles.map((s) => (
          <button key={s.ref} class={s.ref === value ? "on" : ""} onClick={() => onPick(s.ref)} style={{ height: "24px" }}>
            <span class="chip"><span class="sw" style={{ background: s.hex }} />{s.ref}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
