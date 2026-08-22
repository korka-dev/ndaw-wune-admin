"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { dashboardApi, suiviApi, suiviSuperviseurApi, remplacementsApi } from "@/lib/api";

/* ── Types ── */
interface Stats {
  /* Entités */
  schools: number;
  schoolRegions: number;
  teachers: number;   // count réel (total depuis API)
  superviseurs: number;
  sessionsTotal: number;
  activeSession: { name: string; dateDebut: string; dateFin: string } | null;
  students: number;   // count réel des élèves (total depuis API)
  eleves: number;   // alias clair

  /* Présence enseignants (suivi temps réel) */
  teachersEnCours: number;
  teachersPresents: number;
  teachersAbsents: number;

  /* Rapports & séances */
  rapportsTotal: number;
  seancesTotal: number;
  seancesByMonth: { m: string; v: number }[];

  /* Charts */
  ecolesByRegion: { label: string; value: number }[];
  teachersBySchool: { label: string; value: number }[];
  planningByDay: { label: string; value: number }[];
  superviseursCoverage: { label: string; presents: number; total: number }[];

  /* Autres pages */
  classesTotal:            number;
  evaluationsTotal:        number;
  rapportsJournaliersTotal: number;
  remplacementsTotal:      number;
  competencesTotal:        number;
  evaluationDocsTotal:     number;
  evaluationsByResultat:    { label: string; value: number }[];
  elevesByGroupeLecture:    { label: string; value: number }[];
  elevesByGroupeMaths:      { label: string; value: number }[];
  elevesByStatutSelection:  { label: string; value: number }[];

  /* Suivi évaluation */
  evaluationsStudentsCovered:    number;
  evaluationsCoveragePct:        number;
  superviseursActifsSemaine:     number;
  evaluationsByWeek:              { label: string; value: number }[];
  evaluationsAAiderByCompetence:  { label: string; value: number }[];
  superviseursEvalActivity: {
    name: string; total: number; evaluationsSemaine: number; joursDepuisDernier: number | null;
  }[];
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const BAR_COLORS = ["#8B6F1F", "#4A90C2", "#2F7D4A", "#C68B1A", "#7B4F9E"];
const RESULTAT_LABELS: Record<string, string> = { acquis: "Acquis", en_cours: "En cours", a_aider: "À aider" };

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* ══════════════════════════════════════════════════════════════
   SVG Line chart
══════════════════════════════════════════════════════════════ */
function LineChart({ data, color }: { data: { m: string; v: number }[]; color: string }) {
  const W = 440, H = 130, ML = 32, MB = 20, MT = 8, MR = 8;
  const pw = W - ML - MR, ph = H - MT - MB;
  const maxV = Math.ceil(Math.max(...data.map(d => d.v)) / 10) * 10 || 1;
  const pts = data.map((d, i) => ({ x: ML + (i / (data.length - 1 || 1)) * pw, y: MT + (1 - d.v / maxV) * ph, m: d.m, v: d.v }));
  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L${pts[pts.length - 1].x.toFixed(1)} ${MT + ph} L${ML} ${MT + ph} Z`;
  const grid = [0, Math.round(maxV / 2), maxV];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      {grid.map(v => {
        const y = MT + (1 - v / maxV) * ph; return (
          <g key={v}>
            <line x1={ML} y1={y.toFixed(1)} x2={W - MR} y2={y.toFixed(1)} stroke="#EFE7D2" strokeWidth="1" strokeDasharray={v === 0 ? "" : "3 3"} />
            <text x={ML - 4} y={(y + 4).toFixed(1)} textAnchor="end" fontSize="9" fill="#9C8E73">{v}</text>
          </g>
        );
      })}
      <path d={areaD} fill={color} opacity="0.1" />
      <path d={lineD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
          <text x={p.x.toFixed(1)} y={(MT + ph + 15).toFixed(1)} textAnchor="middle" fontSize="9" fill="#6E624A">{p.m}</text>
        </g>
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   SVG Donut chart — Présence enseignants
══════════════════════════════════════════════════════════════ */
function PresenceDonut({ enCours, presents, absents }: { enCours: number; presents: number; absents: number }) {
  const total = enCours + presents + absents || 1;
  const segs = [
    { v: presents, color: "#2F7D4A" },
    { v: enCours, color: "#4A90C2" },
    { v: absents, color: "#B23A3A" },
  ];
  const R = 46, r = 30, cx = 60, cy = 60;
  let angle = -Math.PI / 2;
  const paths = segs.map(s => {
    if (s.v === 0) return null;
    const a = (s.v / total) * 2 * Math.PI;
    const ea = angle + a;
    const la = a > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(ea), y2 = cy + R * Math.sin(ea);
    const ix1 = cx + r * Math.cos(ea), iy1 = cy + r * Math.sin(ea);
    const ix2 = cx + r * Math.cos(angle), iy2 = cy + r * Math.sin(angle);
    const d = `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R},0,${la},1,${x2.toFixed(1)},${y2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${r},${r},0,${la},0,${ix2.toFixed(1)},${iy2.toFixed(1)} Z`;
    angle = ea;
    return { d, color: s.color };
  });
  const pct = total > 0 ? Math.round((presents + enCours) / total * 100) : 0;
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 flex-shrink-0">
      {paths.map((p, i) => p && <path key={i} d={p.d} fill={p.color} />)}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="17" fontWeight="700" fill="#1F1A10">{pct}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6E624A">présents</text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   SVG Mini Donut — Superviseurs coverage
══════════════════════════════════════════════════════════════ */
function CoverageDonut({ presents, enCours, absents }: { presents: number; enCours: number; absents: number }) {
  const total = presents + enCours + absents || 1;
  const segs = [
    { v: presents, color: "#2F7D4A" },
    { v: enCours, color: "#4A90C2" },
    { v: absents, color: "#B23A3A" },
  ];
  const R = 40, r = 26, cx = 50, cy = 50;
  let angle = -Math.PI / 2;
  const paths = segs.map(s => {
    if (s.v === 0) return null;
    const a = (s.v / total) * 2 * Math.PI;
    const ea = angle + a;
    const la = a > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(ea), y2 = cy + R * Math.sin(ea);
    const ix1 = cx + r * Math.cos(ea), iy1 = cy + r * Math.sin(ea);
    const ix2 = cx + r * Math.cos(angle), iy2 = cy + r * Math.sin(angle);
    const d = `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R},0,${la},1,${x2.toFixed(1)},${y2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${r},${r},0,${la},0,${ix2.toFixed(1)},${iy2.toFixed(1)} Z`;
    angle = ea;
    return { d, color: s.color };
  });
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
      {paths.map((p, i) => p && <path key={i} d={p.d} fill={p.color} />)}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1F1A10">{total}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" fill="#6E624A">total</text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   Horizontal bar
══════════════════════════════════════════════════════════════ */
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max ? Math.round(value / max * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 text-right text-tx-muted truncate">{label}</span>
      <div className="flex-1 bg-surface-alt rounded-full h-6 overflow-hidden">
        <div className="h-full rounded-full flex items-center px-2 transition-all"
          style={{ width: `${Math.max(pct, value > 0 ? 8 : 0)}%`, background: color }}>
          <span className="text-white font-bold text-[11px]">{value}</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Stat card
══════════════════════════════════════════════════════════════ */
function StatCard({ icon, label, value, sub, iconBg, iconColor }: {
  icon: string; label: string; value: React.ReactNode;
  sub?: React.ReactNode; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: icon }} />
      </div>
      <div className="flex-1 flex flex-col items-center text-center">
        <div className="text-2xl font-bold text-tx leading-none">{value}</div>
        <div className="text-xs font-medium text-tx mt-1">{label}</div>
        {sub && <div className="text-[11px] text-tx-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Widget — Remplacements élève récents
══════════════════════════════════════════════════════════════ */
function RemplacementsWidget() {
  const [items, setItems] = useState<{ id: string; nouveau_eleve_nom: string; ancien_eleve_nom: string | null; classe: string; date_remplacement: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    remplacementsApi.list({ limit: 5 })
      .then(r => setItems(r.data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-tx">Remplacements élève récents</div>
        <a href="/dashboard/remplacements" className="text-xs text-brand font-semibold hover:underline">Voir tout →</a>
      </div>
      {loading ? (
        <p className="text-xs text-tx-muted text-center py-4">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-tx-muted text-center py-4">Aucun remplacement enregistré</p>
      ) : (
        <div className="space-y-2.5">
          {items.map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="text-tx-muted">{r.ancien_eleve_nom ?? "?"}</span>
                <span className="text-tx-muted mx-1">→</span>
                <span className="font-semibold text-tx">{r.nouveau_eleve_nom}</span>
                <span className="text-tx-muted ml-1.5">({r.classe})</span>
              </div>
              <span className="text-tx-muted flex-shrink-0 ml-2">
                {new Date(r.date_remplacement).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Section title
══════════════════════════════════════════════════════════════ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-tx-muted/60 px-2">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Panel — carte de graphique réutilisable dans le modal BI
══════════════════════════════════════════════════════════════ */
function Panel({ title, sub, href, hrefLabel, className = "", children }: {
  title: string; sub?: string; href?: string; hrefLabel?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`bg-surface border border-border rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-tx">{title}</div>
          {sub && <div className="text-xs text-tx-muted mt-0.5">{sub}</div>}
        </div>
        {href && <a href={href} className="text-xs text-brand font-semibold hover:underline flex-shrink-0">{hrefLabel ?? "Voir →"}</a>}
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Modal BI — vue analytique complète façon Power BI
══════════════════════════════════════════════════════════════ */
type BITab = "overview" | "presence" | "evaluation" | "eleves";

function BIModal({ s, loading, teachersTotal, onClose }: {
  s: Partial<Stats>; loading: boolean; teachersTotal: number; onClose: () => void;
}) {
  const [tab, setTab] = useState<BITab>("overview");

  const regionMax = Math.max(...(s.ecolesByRegion ?? []).map(r => r.value), 1);
  const schoolMax = Math.max(...(s.teachersBySchool ?? []).map(r => r.value), 1);
  const planMax   = Math.max(...(s.planningByDay ?? []).map(r => r.value), 1);
  const lectureMax = Math.max(...(s.elevesByGroupeLecture ?? []).map(r => r.value), 1);
  const mathsMax    = Math.max(...(s.elevesByGroupeMaths ?? []).map(r => r.value), 1);
  const statutMax   = Math.max(...(s.elevesByStatutSelection ?? []).map(r => r.value), 1);
  const resultatMax = Math.max(...(s.evaluationsByResultat ?? []).map(r => r.value), 1);

  const kpis = [
    { label: "Élèves",          value: s.eleves ?? 0,           color: "text-warn" },
    { label: "Enseignants",     value: s.teachers ?? 0,         color: "text-primary" },
    { label: "Écoles",          value: s.schools ?? 0,          color: "text-success" },
    { label: "Superviseurs",    value: s.superviseurs ?? 0,     color: "text-purple-600" },
    { label: "Évaluations",     value: s.evaluationsTotal ?? 0, color: "text-brand" },
    { label: "Couverture éval.", value: `${s.evaluationsCoveragePct ?? 0}%`, color: "text-brand" },
    {
      label: "Taux de présence",
      value: teachersTotal > 0
        ? `${Math.round(((s.teachersPresents ?? 0) + (s.teachersEnCours ?? 0)) / teachersTotal * 100)}%`
        : "—",
      color: "text-success",
    },
  ];

  const TABS: { id: BITab; label: string }[] = [
    { id: "overview",   label: "Vue d'ensemble" },
    { id: "presence",   label: "Présence & couverture" },
    { id: "evaluation", label: "Suivi évaluation" },
    { id: "eleves",     label: "Élèves" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border flex-shrink-0 bg-gradient-to-r from-brand/10 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A90C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-tx truncate">Analyse BI — Programme ARED · Ndaw Wune</h2>
              <p className="text-xs text-tx-muted truncate">
                {s.activeSession ? `Session « ${s.activeSession.name} »` : "Toutes sessions"} · vue analytique complète
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── Bande KPI ── */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 px-6 py-4 border-b border-border flex-shrink-0 bg-surface-alt/30">
          {kpis.map(k => (
            <div key={k.label} className="text-center">
              <div className={`text-xl font-bold ${k.color}`}>{loading ? "—" : k.value}</div>
              <div className="text-[10px] text-tx-muted mt-0.5 uppercase tracking-wide">{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── Onglets (pages de rapport) ── */}
        <div className="flex items-center gap-1 px-6 pt-2 border-b border-border flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                tab === t.id ? "text-brand border-brand" : "text-tx-muted border-transparent hover:text-tx"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Corps ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {tab === "overview" && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Panel title="Séances réalisées par mois" sub="6 derniers mois · basé sur les rapports soumis"
                  href="/dashboard/suivi-seances" hrefLabel="Voir détail →" className="col-span-2">
                  {(s.seancesByMonth ?? []).some(d => d.v > 0)
                    ? <LineChart data={s.seancesByMonth ?? []} color="#4A90C2" />
                    : <div className="flex items-center justify-center h-24 text-xs text-tx-muted">Aucune séance enregistrée</div>
                  }
                </Panel>

                <Panel title="Présence enseignants" href="/dashboard/suivi-seances" hrefLabel="Détail →">
                  <div className="flex items-center gap-4">
                    <PresenceDonut
                      enCours={s.teachersEnCours ?? 0}
                      presents={s.teachersPresents ?? 0}
                      absents={s.teachersAbsents ?? 0}
                    />
                    <div className="space-y-2.5 text-xs flex-1">
                      {[
                        { label: "Présents", value: s.teachersPresents ?? 0, color: "bg-success" },
                        { label: "En cours", value: s.teachersEnCours ?? 0, color: "bg-primary" },
                        { label: "Absents", value: s.teachersAbsents ?? 0, color: "bg-danger" },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${l.color} flex-shrink-0`} />
                          <span className="text-tx-muted">{l.label}</span>
                          <span className="font-bold text-tx ml-auto">{loading ? "—" : l.value}</span>
                        </div>
                      ))}
                      <div className="pt-1 border-t border-border flex items-center justify-between">
                        <span className="text-tx-muted">Total suivi</span>
                        <span className="font-bold text-tx">{loading ? "—" : teachersTotal}</span>
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Panel title="Durée planning / jour" href="/dashboard/planning">
                  <div className="space-y-2.5">
                    {(s.planningByDay ?? []).length > 0
                      ? (s.planningByDay ?? []).map((d, i) => (
                        <HBar key={d.label} label={d.label} value={d.value} max={planMax} color={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))
                      : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucun créneau planifié"}</p>
                    }
                  </div>
                </Panel>

                <Panel title="Récapitulatif global du programme" className="col-span-2">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {[
                      { label: "Écoles participantes", value: loading ? "—" : s.schools, color: "text-success" },
                      { label: "Régions couvertes", value: loading ? "—" : s.schoolRegions, color: "text-success" },
                      { label: "Enseignants actifs", value: loading ? "—" : s.teachers, color: "text-primary" },
                      { label: "Superviseurs de terrain", value: loading ? "—" : s.superviseurs, color: "text-purple-600" },
                      { label: "Séances réalisées (rapports)", value: loading ? "—" : s.seancesTotal, color: "text-brand" },
                      { label: "Élèves suivis (total)", value: loading ? "—" : (s.students || "—"), color: "text-warn" },
                      { label: "Enseignants en cours", value: loading ? "—" : s.teachersEnCours, color: "text-primary" },
                      {
                        label: "Taux de présence",
                        value: loading ? "—" : teachersTotal > 0
                          ? `${Math.round(((s.teachersPresents ?? 0) + (s.teachersEnCours ?? 0)) / teachersTotal * 100)}%`
                          : "—",
                        color: "text-success",
                      },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="text-xs text-tx-muted">{row.label}</span>
                        <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
          )}

          {tab === "presence" && (
            <div className="grid grid-cols-3 gap-4">
              <Panel title="Couverture superviseurs" sub="Enseignants présents / total assignés" href="/dashboard/suivi-superviseurs">
                {(s.superviseursCoverage ?? []).length > 0 ? (
                  <div className="space-y-2.5">
                    {(s.superviseursCoverage ?? []).map((sup, i) => (
                      <div key={sup.label} className="flex items-center gap-3 text-xs">
                        <span className="w-20 text-right text-tx-muted truncate">{sup.label.split(" ")[0]}</span>
                        <div className="flex-1 bg-surface-alt rounded-full h-6 overflow-hidden relative">
                          <div className="absolute inset-0 rounded-full" style={{ background: "#EFE7D2" }} />
                          <div className="h-full rounded-full flex items-center px-2 relative"
                            style={{
                              width: `${sup.total > 0 ? Math.max(Math.round(sup.presents / sup.total * 100), sup.presents > 0 ? 12 : 0) : 0}%`,
                              background: BAR_COLORS[i % BAR_COLORS.length],
                            }}>
                            <span className="text-white font-bold text-[11px]">{sup.presents}/{sup.total}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-tx-muted text-center py-4">
                    {loading ? "Chargement…" : (s.superviseurs ?? 0) > 0 ? "Aucune donnée de suivi" : "Aucun superviseur"}
                  </p>
                )}
              </Panel>

              <Panel title="Écoles par région" href="/dashboard/ecoles">
                <div className="space-y-2.5">
                  {(s.ecolesByRegion ?? []).slice(0, 5).map((r, i) => (
                    <HBar key={r.label} label={r.label} value={r.value} max={regionMax} color={BAR_COLORS[i % 5]} />
                  ))}
                  {!s.ecolesByRegion?.length && (
                    <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune donnée"}</p>
                  )}
                </div>
              </Panel>

              <Panel title="Enseignants par école" href="/dashboard/teachers">
                <div className="space-y-2.5">
                  {(s.teachersBySchool ?? []).length > 0
                    ? (s.teachersBySchool ?? []).map((r, i) => (
                      <HBar key={r.label} label={r.label} value={r.value} max={schoolMax} color={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))
                    : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune donnée"}</p>
                  }
                </div>
              </Panel>
            </div>
          )}

          {tab === "evaluation" && (
            <>
              {/* KPI de couverture — pour les responsables du suivi terrain */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface border border-border rounded-2xl p-5 text-center">
                  <div className="text-2xl font-bold text-brand">{loading ? "—" : `${s.evaluationsCoveragePct ?? 0}%`}</div>
                  <div className="text-xs font-medium text-tx mt-1">Couverture évaluation</div>
                  <div className="text-[11px] text-tx-muted mt-0.5">
                    {loading ? "—" : `${(s.evaluationsStudentsCovered ?? 0).toLocaleString("fr-FR")} / ${(s.students ?? 0).toLocaleString("fr-FR")} élèves évalués`}
                  </div>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-5 text-center">
                  <div className="text-2xl font-bold text-success">{loading ? "—" : s.superviseursActifsSemaine ?? 0}</div>
                  <div className="text-xs font-medium text-tx mt-1">Superviseurs actifs</div>
                  <div className="text-[11px] text-tx-muted mt-0.5">
                    {loading ? "—" : `sur ${s.superviseurs ?? 0} · évaluation faite cette semaine`}
                  </div>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-5 text-center">
                  <div className="text-2xl font-bold text-danger">{loading ? "—" : (s.evaluationsAAiderByCompetence ?? []).length}</div>
                  <div className="text-xs font-medium text-tx mt-1">Compétences à renforcer</div>
                  <div className="text-[11px] text-tx-muted mt-0.5">avec au moins un résultat « à aider »</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Panel title="Évaluations par semaine" sub="8 dernières semaines" href="/dashboard/suivi-evaluations" hrefLabel="Voir détail →" className="col-span-2">
                  {(s.evaluationsByWeek ?? []).some(d => d.value > 0)
                    ? <LineChart data={(s.evaluationsByWeek ?? []).map(p => ({ m: p.label, v: p.value }))} color="#7B4F9E" />
                    : <div className="flex items-center justify-center h-24 text-xs text-tx-muted">Aucune évaluation enregistrée</div>
                  }
                </Panel>

                <Panel title="Compétences à renforcer" sub="résultats « à aider », top 6">
                  <div className="space-y-2.5">
                    {(s.evaluationsAAiderByCompetence ?? []).length > 0
                      ? (s.evaluationsAAiderByCompetence ?? []).map((r, i) => (
                        <HBar key={r.label} label={r.label} value={r.value}
                          max={Math.max(...(s.evaluationsAAiderByCompetence ?? []).map(x => x.value), 1)}
                          color="#B23A3A" />
                      ))
                      : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune donnée"}</p>
                    }
                  </div>
                </Panel>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Panel title="Évaluations par résultat" href="/dashboard/suivi-evaluations">
                  <div className="space-y-2.5">
                    {(s.evaluationsByResultat ?? []).length > 0
                      ? (s.evaluationsByResultat ?? []).map((r, i) => (
                        <HBar key={r.label} label={RESULTAT_LABELS[r.label] ?? r.label} value={r.value} max={resultatMax} color={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))
                      : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune évaluation enregistrée"}</p>
                    }
                  </div>
                </Panel>

                <Panel title="Activité des superviseurs" sub="les moins actifs cette semaine en premier" href="/dashboard/suivi-evaluations" hrefLabel="Voir tout →" className="col-span-2">
                  {(s.superviseursEvalActivity ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(s.superviseursEvalActivity ?? []).map(sup => {
                        const statut = sup.joursDepuisDernier === null
                          ? { label: "Jamais évalué", cls: "bg-danger-soft text-danger border-danger/20" }
                          : sup.evaluationsSemaine === 0
                          ? { label: `Inactif · ${sup.joursDepuisDernier}j`, cls: "bg-warn-soft text-warn border-warn/20" }
                          : { label: "Actif", cls: "bg-success-soft text-success border-success/20" };
                        return (
                          <div key={sup.name} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
                            <span className="font-medium text-tx truncate flex-1">{sup.name}</span>
                            <span className="text-tx-muted whitespace-nowrap">{sup.total} au total</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${statut.cls}`}>
                              {statut.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucun superviseur"}</p>
                  )}
                </Panel>
              </div>
            </>
          )}

          {tab === "eleves" && (
            <div className="grid grid-cols-3 gap-4">
                <Panel title="Élèves par groupe lecture" href="/dashboard/eleves">
                  <div className="space-y-2.5">
                    {(s.elevesByGroupeLecture ?? []).length > 0
                      ? (s.elevesByGroupeLecture ?? []).map((r, i) => (
                        <HBar key={r.label} label={r.label} value={r.value} max={lectureMax} color={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))
                      : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune donnée"}</p>
                    }
                  </div>
                </Panel>

                <Panel title="Élèves par groupe maths" href="/dashboard/eleves">
                  <div className="space-y-2.5">
                    {(s.elevesByGroupeMaths ?? []).length > 0
                      ? (s.elevesByGroupeMaths ?? []).map((r, i) => (
                        <HBar key={r.label} label={r.label} value={r.value} max={mathsMax} color={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))
                      : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune donnée"}</p>
                    }
                  </div>
                </Panel>

                <Panel title="Élèves par statut de sélection" href="/dashboard/eleves">
                  <div className="space-y-2.5">
                    {(s.elevesByStatutSelection ?? []).length > 0
                      ? (s.elevesByStatutSelection ?? []).map((r, i) => (
                        <HBar key={r.label} label={r.label} value={r.value} max={statutMax} color={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))
                      : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune donnée"}</p>
                    }
                  </div>
                </Panel>

                <div className="col-span-2">
                  <RemplacementsWidget />
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */
export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => {
    // 1 appel agrégé pour toutes les stats statiques + 2 appels légers pour les données temps réel
    Promise.allSettled([
      dashboardApi.stats(),        // agrégations SQL côté backend
      suiviApi.list(),             // présence enseignants (données live)
      suiviSuperviseurApi.list(),  // couverture superviseurs (données live)
    ]).then(([statsR, suiviR, supSuiviR]) => {
      const d  = statsR.status === "fulfilled" ? statsR.value.data : null;
      const suiviItems = suiviR.status === "fulfilled" ? (suiviR.value.data.items ?? suiviR.value.data ?? []) : [];
      const supSuivi   = supSuiviR.status === "fulfilled" ? (supSuiviR.value.data.items ?? supSuiviR.value.data ?? []) : [];

      /* ── Présence enseignants (données live depuis suiviApi) ── */
      let teachersEnCours = 0, teachersPresents = 0, teachersAbsents = 0;
      suiviItems.forEach((t: any) => {
        if ((t.seances_en_cours ?? 0) > 0) teachersEnCours++;
        else if ((t.seances_terminees ?? 0) > 0) teachersPresents++;
        else teachersAbsents++;
      });
      if (suiviItems.length === 0 && d) {
        teachersAbsents = d.teachers;
      }

      /* ── Couverture superviseurs (live) ── */
      const superviseursCoverage = supSuivi
        .map((sup: any) => ({
          label:    sup.name,
          presents: (sup.presents ?? 0) + (sup.en_cours ?? 0),
          total:    sup.total_assignes ?? 0,
        }))
        .filter((s: any) => s.total > 0)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 6);

      setStats({
        schools:       d?.schools       ?? 0,
        schoolRegions: d?.school_regions ?? 0,
        teachers:      d?.teachers      ?? 0,
        superviseurs:  d?.superviseurs  ?? 0,
        sessionsTotal: d?.sessions_total ?? 0,
        activeSession: d?.active_session
          ? { name: d.active_session.name, dateDebut: d.active_session.date_debut, dateFin: d.active_session.date_fin }
          : null,
        students: d?.students ?? 0,
        eleves:   d?.students ?? 0,
        teachersEnCours, teachersPresents, teachersAbsents,
        rapportsTotal: d?.rapports_total ?? 0,
        seancesTotal:  d?.rapports_total ?? 0,
        seancesByMonth: (d?.seances_by_month ?? []).map((p: any) => ({ m: p.label, v: p.value })),
        ecolesByRegion:   d?.ecoles_by_region  ?? [],
        teachersBySchool: d?.teachers_by_school ?? [],
        planningByDay:    d?.planning_by_day    ?? [],
        superviseursCoverage,
        classesTotal:             d?.classes_total              ?? 0,
        evaluationsTotal:         d?.evaluations_total           ?? 0,
        rapportsJournaliersTotal: d?.rapports_journaliers_total  ?? 0,
        remplacementsTotal:       d?.remplacements_total         ?? 0,
        competencesTotal:         d?.competences_total           ?? 0,
        evaluationDocsTotal:      d?.evaluation_docs_total       ?? 0,
        evaluationsByResultat:    (d?.evaluations_by_resultat    ?? []).map((p: any) => ({ label: p.label, value: p.value })),
        elevesByGroupeLecture:    (d?.eleves_by_groupe_lecture   ?? []).map((p: any) => ({ label: p.label, value: p.value })),
        elevesByGroupeMaths:      (d?.eleves_by_groupe_maths     ?? []).map((p: any) => ({ label: p.label, value: p.value })),
        elevesByStatutSelection:  (d?.eleves_by_statut_selection ?? []).map((p: any) => ({ label: p.label, value: p.value })),
        evaluationsStudentsCovered:   d?.evaluations_students_covered ?? 0,
        evaluationsCoveragePct:       d?.evaluations_coverage_pct     ?? 0,
        superviseursActifsSemaine:    d?.superviseurs_actifs_semaine  ?? 0,
        evaluationsByWeek:            (d?.evaluations_by_week ?? []).map((p: any) => ({ label: p.label, value: p.value })),
        evaluationsAAiderByCompetence: (d?.evaluations_a_aider_by_competence ?? []).map((p: any) => ({ label: p.label, value: p.value })),
        superviseursEvalActivity: (d?.superviseurs_eval_activity ?? []).map((r: any) => ({
          name: r.name, total: r.total, evaluationsSemaine: r.evaluations_semaine, joursDepuisDernier: r.jours_depuis_dernier,
        })),
      });
      setLoading(false);
    });
  }, []);

  const s = stats;
  const teachersTotal = (s.teachersEnCours ?? 0) + (s.teachersPresents ?? 0) + (s.teachersAbsents ?? 0);

  return (
    <div className="flex flex-col flex-1">

      {/* ── Session banner ── */}
      {s.activeSession && (
        <div className="sticky top-0 z-10 bg-brand text-white px-7 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="font-medium">Session active :</span>
            <span className="font-bold">{s.activeSession.name}</span>
            <span className="text-white/70 text-xs">
              {s.activeSession.dateDebut} → {s.activeSession.dateFin}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <span>{s.sessionsTotal} session{(s.sessionsTotal ?? 0) > 1 ? "s" : ""} au total</span>
          </div>
        </div>
      )}

      <div className="p-7 flex-1 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-tx">Tableau de bord</h1>
            <p className="text-tx-muted text-sm mt-0.5">
              Vue d'ensemble du programme ARED · Ndaw Wune
            </p>
          </div>
          <button
            onClick={() => setShowCharts(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 bg-brand text-white hover:bg-brand/90"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Voir les graphes
          </button>
        </div>

        {/* ══ Section 1 : Entités ══ */}
        <div>
          <SectionTitle>Structure du programme</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              label="Élèves"
              value={loading ? "—" : (s.eleves ?? 0).toLocaleString("fr-FR")}
              sub="inscrits au programme"
              iconBg="bg-warn-soft" iconColor="#C68B1A"
              icon='<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>'
            />
            <StatCard
              label="Enseignants"
              value={loading ? "—" : (s.teachers ?? 0).toLocaleString("fr-FR")}
              sub="enregistrés"
              iconBg="bg-primary-soft" iconColor="#4A90C2"
              icon='<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.8-2-4.5-5-4.5"/>'
            />
            <StatCard
              label="Écoles"
              value={loading ? "—" : s.schools}
              sub={`${s.schoolRegions ?? "—"} IEF`}
              iconBg="bg-success-soft" iconColor="#2F7D4A"
              icon='<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/>'
            />
            <StatCard
              label="Superviseurs"
              value={loading ? "—" : s.superviseurs}
              sub="de terrain"
              iconBg="bg-purple-soft" iconColor="#7B4F9E"
              icon='<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>'
            />
            <StatCard
              label="Sessions"
              value={loading ? "—" : s.sessionsTotal}
              sub={s.activeSession ? `« ${s.activeSession.name} »` : "Aucune active"}
              iconBg="bg-brand-soft" iconColor="#4A90C2"
              icon='<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
            />
            <StatCard
              label="Rapports"
              value={loading ? "—" : s.rapportsTotal}
              sub="soumis"
              iconBg="bg-success-soft" iconColor="#2F7D4A"
              icon='<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'
            />
          </div>
        </div>

        {/* ══ Section 2 : Présence en temps réel ══ */}
        <div>
          <SectionTitle>Présence enseignants (session en cours)</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="En cours de séance"
              value={loading ? "—" : s.teachersEnCours}
              sub="actuellement actifs"
              iconBg="bg-primary-soft" iconColor="#4A90C2"
              icon='<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'
            />
            <StatCard
              label="Présents"
              value={loading ? "—" : s.teachersPresents}
              sub="au moins 1 séance terminée"
              iconBg="bg-success-soft" iconColor="#2F7D4A"
              icon='<path d="M5 12l5 5 9-11"/>'
            />
            <StatCard
              label="Absents"
              value={loading ? "—" : s.teachersAbsents}
              sub="aucune séance enregistrée"
              iconBg="bg-danger-soft" iconColor="#B23A3A"
              icon='<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
            />
            <StatCard
              label="Rapports soumis"
              value={loading ? "—" : s.rapportsTotal}
              sub="toutes sessions"
              iconBg="bg-warn-soft" iconColor="#C68B1A"
              icon='<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'
            />
          </div>
        </div>

        {/* ══ Section 3 : Autres pages ══ */}
        <div>
          <SectionTitle>Autres pages</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              label="Classes"
              value={loading ? "—" : s.classesTotal}
              sub="toutes écoles"
              iconBg="bg-primary-soft" iconColor="#4A90C2"
              icon='<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 4v16"/>'
            />
            <StatCard
              label="Évaluations"
              value={loading ? "—" : s.evaluationsTotal}
              sub="élèves évalués"
              iconBg="bg-success-soft" iconColor="#2F7D4A"
              icon='<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'
            />
            <StatCard
              label="Rapports journaliers"
              value={loading ? "—" : s.rapportsJournaliersTotal}
              sub="soumis par les tuteurs"
              iconBg="bg-warn-soft" iconColor="#C68B1A"
              icon='<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'
            />
            <StatCard
              label="Remplacements"
              value={loading ? "—" : s.remplacementsTotal}
              sub="élèves remplacés"
              iconBg="bg-danger-soft" iconColor="#B23A3A"
              icon='<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'
            />
            <StatCard
              label="Compétences"
              value={loading ? "—" : s.competencesTotal}
              sub="actives"
              iconBg="bg-purple-soft" iconColor="#7B4F9E"
              icon='<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5"/>'
            />
            <StatCard
              label="Dossiers d'évaluation"
              value={loading ? "—" : s.evaluationDocsTotal}
              sub="langues actives"
              iconBg="bg-brand-soft" iconColor="#4A90C2"
              icon='<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'
            />
          </div>
        </div>

      </div>

      {showCharts && (
        <BIModal s={s} loading={loading} teachersTotal={teachersTotal} onClose={() => setShowCharts(false)} />
      )}
    </div>
  );
}
