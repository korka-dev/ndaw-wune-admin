"use client";
/* Primitives de graphiques en SVG pur.
   Le projet n'embarque aucune bibliothèque de charts — le tableau de bord
   dessine déjà ses courbes à la main. On reste sur le même principe et la même
   palette pour que les écrans se ressemblent. */

export type Point = { label: string; value: number };

/* ── Courbe ─────────────────────────────────────────────────────────────── */
export function LineChart({ data, color = "#4A90C2" }: { data: Point[]; color?: string }) {
  if (data.length === 0) return <Vide />;
  const W = 440, H = 140, ML = 34, MB = 22, MT = 10, MR = 10;
  const pw = W - ML - MR, ph = H - MT - MB;
  const maxV = Math.max(...data.map(d => d.value), 1);
  const echelle = Math.ceil(maxV / 5) * 5 || 1;
  const pts = data.map((d, i) => ({
    x: ML + (i / (data.length - 1 || 1)) * pw,
    y: MT + (1 - d.value / echelle) * ph,
    ...d,
  }));
  const ligne = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const aire = `${ligne} L${pts[pts.length - 1].x.toFixed(1)} ${MT + ph} L${ML} ${MT + ph} Z`;
  // Un point unique ne dessine pas de ligne : on garde le marqueur seul.
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      {[0, Math.round(echelle / 2), echelle].map(v => {
        const y = MT + (1 - v / echelle) * ph;
        return (
          <g key={v}>
            <line x1={ML} y1={y.toFixed(1)} x2={W - MR} y2={y.toFixed(1)}
              stroke="#EFE7D2" strokeWidth="1" strokeDasharray={v === 0 ? "" : "3 3"} />
            <text x={ML - 5} y={(y + 4).toFixed(1)} textAnchor="end" fontSize="9" fill="#9C8E73">{v}</text>
          </g>
        );
      })}
      {pts.length > 1 && <path d={aire} fill={color} opacity="0.1" />}
      {pts.length > 1 && (
        <path d={ligne} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
          <title>{`${p.label} : ${p.value}`}</title>
          <text x={p.x.toFixed(1)} y={(MT + ph + 16).toFixed(1)} textAnchor="middle"
            fontSize="9" fill="#6E624A">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Barres horizontales ────────────────────────────────────────────────── */
export function BarList({ data, color = "#C08A3E", suffixe }: {
  data: Point[]; color?: string; suffixe?: string;
}) {
  if (data.length === 0) return <Vide />;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map(d => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div key={d.label} className="flex items-center gap-3 text-xs">
            <span className="w-36 text-right text-tx-muted truncate" title={d.label}>{d.label}</span>
            <div className="flex-1 bg-surface-alt rounded-full h-6 overflow-hidden">
              <div className="h-full rounded-full flex items-center px-2 transition-all"
                style={{ width: `${Math.max(pct, d.value > 0 ? 10 : 0)}%`, background: color }}>
                <span className="text-white font-bold text-[11px] whitespace-nowrap">
                  {d.value}{suffixe}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Anneau ─────────────────────────────────────────────────────────────── */
export function Donut({ pct, legende, color = "#2F7D4A" }: {
  pct: number; legende: string; color?: string;
}) {
  const R = 42, r = 28, cx = 55, cy = 55;
  const part = Math.min(Math.max(pct, 0), 100) / 100;
  const arc = (debut: number, fin: number, couleur: string, cle: string) => {
    const a0 = -Math.PI / 2 + debut * 2 * Math.PI;
    const a1 = -Math.PI / 2 + fin * 2 * Math.PI;
    if (fin - debut <= 0) return null;
    // Un arc de 360° ne peut pas se tracer d'un seul path SVG (début = fin).
    if (fin - debut >= 0.999) {
      return (
        <g key={cle}>
          <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={couleur} strokeWidth={R - r} />
        </g>
      );
    }
    const grand = fin - debut > 0.5 ? 1 : 0;
    const d = [
      `M${(cx + R * Math.cos(a0)).toFixed(1)},${(cy + R * Math.sin(a0)).toFixed(1)}`,
      `A${R},${R},0,${grand},1,${(cx + R * Math.cos(a1)).toFixed(1)},${(cy + R * Math.sin(a1)).toFixed(1)}`,
      `L${(cx + r * Math.cos(a1)).toFixed(1)},${(cy + r * Math.sin(a1)).toFixed(1)}`,
      `A${r},${r},0,${grand},0,${(cx + r * Math.cos(a0)).toFixed(1)},${(cy + r * Math.sin(a0)).toFixed(1)}`,
      "Z",
    ].join(" ");
    return <path key={cle} d={d} fill={couleur} />;
  };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 110 110" className="w-28 h-28">
        <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="#EFE7D2" strokeWidth={R - r} />
        {arc(0, part, color, "v")}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="17" fontWeight="700" fill="#1F1A10">
          {pct}%
        </text>
      </svg>
      <p className="text-[11px] text-tx-muted mt-1 text-center leading-tight max-w-[7rem]">{legende}</p>
    </div>
  );
}

/* ── Carte encadrante ───────────────────────────────────────────────────── */
export function Carte({ titre, sous, children }: {
  titre: string; sous?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <h3 className="text-sm font-bold text-tx">{titre}</h3>
      {sous && <p className="text-[11px] text-tx-muted mt-0.5 mb-3">{sous}</p>}
      <div className={sous ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Vide() {
  return <p className="text-xs text-tx-muted py-6 text-center">Aucune donnée sur cette période.</p>;
}
