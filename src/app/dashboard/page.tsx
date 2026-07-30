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
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const BAR_COLORS = ["#8B6F1F", "#4A90C2", "#2F7D4A", "#C68B1A", "#7B4F9E"];

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
   Page
══════════════════════════════════════════════════════════════ */
export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);

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
      });
      setLoading(false);
    });
  }, []);

  const s = stats;
  const _ = loading ? "—" : undefined;
  const regionMax = Math.max(...(s.ecolesByRegion ?? []).map(r => r.value), 1);
  const schoolMax = Math.max(...(s.teachersBySchool ?? []).map(r => r.value), 1);
  const planMax = Math.max(...(s.planningByDay ?? []).map(r => r.value), 1);
  const coverMax = Math.max(...(s.superviseursCoverage ?? []).map(r => r.total), 1);

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
        <div>
          <h1 className="text-xl font-bold text-tx">Tableau de bord</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            Vue d'ensemble du programme ARED · Ndaw Wune
          </p>
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

        {/* ══ Charts row 1 ══ */}
        <div className="grid grid-cols-3 gap-4">
          {/* Line chart — séances par mois */}
          <div className="col-span-2 bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-tx">Séances réalisées par mois</div>
                <div className="text-xs text-tx-muted mt-0.5">6 derniers mois · basé sur les rapports soumis</div>
              </div>
              <a href="/dashboard/suivi-seances" className="text-xs text-brand font-semibold hover:underline">Voir détail →</a>
            </div>
            {(s.seancesByMonth ?? []).some(d => d.v > 0)
              ? <LineChart data={s.seancesByMonth ?? []} color="#4A90C2" />
              : <div className="flex items-center justify-center h-24 text-xs text-tx-muted">Aucune séance enregistrée</div>
            }
          </div>

          {/* Donut — présence enseignants */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Présence enseignants</div>
              <a href="/dashboard/suivi-seances" className="text-xs text-brand font-semibold hover:underline">Détail →</a>
            </div>
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
          </div>
        </div>

        {/* ══ Charts row 2 ══ */}
        <div className="grid grid-cols-3 gap-4">

          {/* Couverture superviseurs */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-tx">Couverture superviseurs</div>
                <div className="text-xs text-tx-muted mt-0.5">Enseignants présents / total assignés</div>
              </div>
              <a href="/dashboard/suivi-superviseurs" className="text-xs text-brand font-semibold hover:underline">Voir →</a>
            </div>

            {(s.superviseursCoverage ?? []).length > 0 ? (
              <div className="space-y-2.5">
                {(s.superviseursCoverage ?? []).map((sup, i) => (
                  <div key={sup.label} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-right text-tx-muted truncate">{sup.label.split(" ")[0]}</span>
                    <div className="flex-1 bg-surface-alt rounded-full h-6 overflow-hidden relative">
                      {/* Barre de fond (total) */}
                      <div className="absolute inset-0 rounded-full" style={{ background: "#EFE7D2" }} />
                      {/* Barre présents */}
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
              <div className="flex flex-col items-center justify-center gap-3 py-4">
                {!loading && (s.superviseurs ?? 0) > 0 ? (
                  <p className="text-xs text-tx-muted text-center">Aucune donnée de suivi</p>
                ) : (
                  <p className="text-xs text-tx-muted text-center">{loading ? "Chargement…" : "Aucun superviseur"}</p>
                )}
              </div>
            )}
          </div>

          {/* Écoles par région */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Écoles par région</div>
              <a href="/dashboard/ecoles" className="text-xs text-brand font-semibold hover:underline">Voir →</a>
            </div>
            <div className="space-y-2.5">
              {(s.ecolesByRegion ?? []).slice(0, 5).map((r, i) => (
                <HBar key={r.label} label={r.label} value={r.value} max={regionMax}
                  color={BAR_COLORS[i % 5]} />
              ))}
              {!s.ecolesByRegion?.length && (
                <p className="text-xs text-tx-muted text-center py-4">
                  {loading ? "Chargement…" : "Aucune donnée"}
                </p>
              )}
            </div>
          </div>

          {/* Enseignants par école */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Enseignants par école</div>
              <a href="/dashboard/teachers" className="text-xs text-brand font-semibold hover:underline">Voir →</a>
            </div>
            <div className="space-y-2.5">
              {(s.teachersBySchool ?? []).length > 0
                ? (s.teachersBySchool ?? []).map((r, i) => (
                  <HBar key={r.label} label={r.label} value={r.value} max={schoolMax}
                    color={BAR_COLORS[i % BAR_COLORS.length]} />
                ))
                : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucune donnée"}</p>
              }
            </div>
          </div>
        </div>

        {/* ══ Charts row 3 ══ */}
        <div className="grid grid-cols-3 gap-4">

          {/* Durée planning / jour */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-tx">Durée planning / jour</div>
              <a href="/dashboard/planning" className="text-xs text-brand font-semibold hover:underline">Voir →</a>
            </div>
            <div className="space-y-2.5">
              {(s.planningByDay ?? []).length > 0
                ? (s.planningByDay ?? []).map((d, i) => (
                  <HBar key={d.label} label={d.label} value={d.value} max={planMax}
                    color={BAR_COLORS[i % BAR_COLORS.length]} />
                ))
                : <p className="text-xs text-tx-muted text-center py-4">{loading ? "Chargement…" : "Aucun créneau planifié"}</p>
              }
            </div>
          </div>

          {/* Card récap global */}
          <div className="col-span-2 bg-surface border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold text-tx mb-4">Récapitulatif global du programme</div>
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
                  color: "text-success"
                },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-xs text-tx-muted">{row.label}</span>
                  <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ Charts row 4 ══ */}
        <div className="grid grid-cols-3 gap-4">
          <RemplacementsWidget />
        </div>

      </div>
    </div>
  );
}
