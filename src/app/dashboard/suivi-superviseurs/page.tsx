"use client";
import { useEffect, useState, useCallback } from "react";
import { suiviSuperviseurApi, sessionsApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";
import Pagination from "@/components/Pagination";
import { Donut, BarList } from "@/components/Charts";
import { BIButton, BIModal, BIPanel } from "@/components/BIModal";

const PAGE_SIZE = 20;
const MODAL_PAGE_SIZE = 10;

/* ══ Types ═══════════════════════════════════════════════════════ */
interface TuteurEnAlerte {
  teacher_id:       string;
  name:             string;
  rapports_manques: number;
}

interface SuperviseurSuivi {
  superviseur_id:    string;
  name:              string;
  title?:            string;
  phone?:            string;
  email?:            string;
  school_name?:      string;
  total_assignes:    number;
  presents:          number;
  en_cours:          number;
  absents:           number;
  tuteurs_en_alerte: TuteurEnAlerte[];
}

interface TeacherPresence {
  teacher_id:        string;
  name:              string;
  title?:            string;
  phone?:            string;
  email?:            string;
  school_name?:      string;
  classes?:          string[];
  presence_status:   "present" | "en_cours" | "absent";
  total_seances:     number;
  seances_terminees: number;
  seances_en_cours:  number;
  derniere_seance?:  string;
  derniere_matiere?: string;
  derniere_classe?:  string;
  has_rapport:       boolean;
}

interface SuperviseurDetail {
  superviseur_id: string;
  name:           string;
  title?:         string;
  phone?:         string;
  email?:         string;
  school_name?:   string;
  teachers:       TeacherPresence[];
}

/* ══ Helpers ══════════════════════════════════════════════════════ */
function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) : "—";

/* ══ Badge présence ══════════════════════════════════════════════ */
function PresenceBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-tx-muted italic">—</span>;
  const cfg: Record<string, { label: string; cls: string; dot?: boolean }> = {
    en_cours: { label: "En cours",  cls: "bg-brand/10 text-brand border border-brand/20",       dot: true },
    present:  { label: "Présent",   cls: "bg-success-soft text-success border border-success/20" },
    absent:   { label: "Absent",    cls: "bg-danger-soft text-danger border border-danger/20"   },
  };
  const { label, cls, dot } = cfg[status] ?? { label: status, cls: "bg-surface-alt text-tx-muted border border-border" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />}
      {label}
    </span>
  );
}

/* ══ Modal détail superviseur ════════════════════════════════════ */
function SuperviseurModal({
  sup, detail, loading, onClose,
}: {
  sup:     SuperviseurSuivi;
  detail:  SuperviseurDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [presenceFilter, setPresenceFilter] = useState<"all" | "present" | "en_cours" | "absent">("all");
  const [modalPage, setModalPage] = useState(1);

  const teachers = (detail?.teachers ?? []).filter(t => {
    if (presenceFilter === "all") return true;
    return t.presence_status === presenceFilter;
  });

  useEffect(() => { setModalPage(1); }, [presenceFilter, sup.superviseur_id]);

  const paginatedTeachers = teachers.slice((modalPage - 1) * MODAL_PAGE_SIZE, modalPage * MODAL_PAGE_SIZE);

  const counts = detail ? {
    present:  detail.teachers.filter(t => t.presence_status === "present").length,
    en_cours: detail.teachers.filter(t => t.presence_status === "en_cours").length,
    absent:   detail.teachers.filter(t => t.presence_status === "absent").length,
  } : { present: 0, en_cours: 0, absent: 0 };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── En-tête ── */}
        <div className="flex items-start gap-4 p-6 border-b border-border flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-base font-bold text-brand flex-shrink-0">
            {initials(sup.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-tx">{sup.name}</h2>
            {sup.title && <p className="text-sm text-tx-muted">{sup.title}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
              {sup.phone && (
                <span className="flex items-center gap-1.5 text-xs text-tx-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 1.12h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 5.61 5.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.92v1z"/></svg>
                  {sup.phone}
                </span>
              )}
              {sup.email && (
                <span className="flex items-center gap-1.5 text-xs text-tx-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  {sup.email}
                </span>
              )}
              {sup.school_name && (
                <span className="flex items-center gap-1.5 text-xs text-tx-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  {sup.school_name}
                </span>
              )}
            </div>
          </div>

          {/* Compteurs */}
          <div className="flex gap-2 flex-shrink-0">
            {[
              { v: sup.total_assignes, l: "Assignés",  c: "text-tx" },
              { v: sup.en_cours,       l: "En cours",  c: "text-brand" },
              { v: sup.presents,       l: "Présents",  c: "text-success" },
              { v: sup.absents,        l: "Absents",   c: "text-danger" },
            ].map(s => (
              <div key={s.l} className="text-center px-3 py-2 bg-surface-alt rounded-xl min-w-[56px]">
                <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[10px] text-tx-muted mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0 ml-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── Filtres présence ── */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-surface-alt/40 flex-shrink-0">
          <span className="text-xs text-tx-muted font-medium">Afficher :</span>
          {[
            { v: "all"      as const, label: `Tous (${detail?.teachers.length ?? 0})` },
            { v: "en_cours" as const, label: `En cours (${counts.en_cours})` },
            { v: "present"  as const, label: `Présents (${counts.present})` },
            { v: "absent"   as const, label: `Absents (${counts.absent})` },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setPresenceFilter(o.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                presenceFilter === o.v
                  ? "bg-brand text-white"
                  : "text-tx-muted hover:text-tx hover:bg-surface-alt border border-border"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* ── Table enseignants ── */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <svg className="animate-spin w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span className="text-sm text-tx-muted">Chargement…</span>
            </div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted/30">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              <p className="text-sm text-tx-muted">
                {detail?.teachers.length === 0 ? "Aucun enseignant assigné" : "Aucun résultat pour ce filtre"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[860px]">
              <thead className="sticky top-0 bg-surface-alt border-b border-border">
                <tr>
                  {["Enseignant", "École / Classe", "Présence", "Dernière séance", "Heure", "Séances", "Rapport"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedTeachers.map(t => (
                  <tr
                    key={t.teacher_id}
                    className={`transition-colors ${
                      t.presence_status === "absent"
                        ? "hover:bg-danger-soft/20 bg-danger-soft/10"
                        : t.presence_status === "en_cours"
                        ? "hover:bg-brand/5 bg-brand/[0.03]"
                        : "hover:bg-surface-alt/40"
                    }`}
                  >
                    {/* Identité */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          t.presence_status === "absent" ? "bg-danger/10 text-danger"
                          : t.presence_status === "en_cours" ? "bg-brand/10 text-brand"
                          : "bg-success/10 text-success"
                        }`}>
                          {initials(t.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-tx">{t.name}</p>
                          {t.title && <p className="text-xs text-tx-muted">{t.title}</p>}
                        </div>
                      </div>
                    </td>
                    {/* École / Classe */}
                    <td className="px-5 py-3.5">
                      {t.school_name && <p className="text-xs font-medium text-tx">{t.school_name}</p>}
                      {t.classes && t.classes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {t.classes.slice(0, 3).map(c => (
                            <span key={c} className="text-[10px] bg-surface-alt border border-border rounded px-1.5 py-0.5 text-tx-muted">{c}</span>
                          ))}
                          {t.classes.length > 3 && <span className="text-[10px] text-tx-muted">+{t.classes.length - 3}</span>}
                        </div>
                      )}
                    </td>
                    {/* Présence */}
                    <td className="px-5 py-3.5"><PresenceBadge status={t.presence_status} /></td>
                    {/* Dernière séance */}
                    <td className="px-5 py-3.5 text-xs text-tx-muted whitespace-nowrap">
                      {t.derniere_seance ? (
                        <>
                          <p className="font-medium text-tx">{t.derniere_matiere ?? t.derniere_classe ?? "—"}</p>
                          <p>{fmtDate(t.derniere_seance)}</p>
                        </>
                      ) : <span className="italic">Aucune</span>}
                    </td>
                    {/* Heure lancement */}
                    <td className="px-5 py-3.5 font-mono text-xs text-tx whitespace-nowrap">
                      {fmtTime(t.derniere_seance)}
                    </td>
                    {/* Compteur */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-tx">{t.total_seances}</p>
                      <p className="text-xs text-tx-muted">{t.seances_terminees} terminée{t.seances_terminees !== 1 ? "s" : ""}</p>
                    </td>
                    {/* Rapport */}
                    <td className="px-5 py-3.5 text-center">
                      {t.has_rapport
                        ? <span className="inline-flex items-center gap-1 text-xs text-success font-semibold">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Oui
                          </span>
                        : <span className="text-xs text-tx-muted">Non</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && teachers.length > 0 && (
          <div className="border-t border-border px-6 flex-shrink-0">
            <Pagination page={modalPage} total={teachers.length} pageSize={MODAL_PAGE_SIZE} onChange={setModalPage} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ Page principale ═════════════════════════════════════════════ */
export default function SuiviSuperviseurPage() {
  const [superviseurs, setSuperviseurs] = useState<SuperviseurSuivi[]>([]);
  const [sessions,     setSessions]     = useState<any[]>([]);
  const [sessId,       setSessId]       = useState("");
  const [search,       setSearch]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [exporting,    setExporting]    = useState(false);
  const [showBI,       setShowBI]       = useState(false);

  /* Modal */
  const [modalSup,     setModalSup]     = useState<SuperviseurSuivi | null>(null);
  const [modalDetail,  setModalDetail]  = useState<SuperviseurDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  /* Sessions */
  useEffect(() => {
    sessionsApi.list().then(r => {
      const list = r.data.items ?? [];
      setSessions(list);
      const active = list.find((s: any) => s.status === "active");
      if (active) setSessId(active.id);
    }).catch(() => {});
  }, []);

  /* Chargement */
  const load = useCallback(() => {
    setLoading(true);
    suiviSuperviseurApi
      .list({ session_id: sessId || undefined, search: search || undefined })
      .then(r => setSuperviseurs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessId, search]);

  useEffect(() => { load(); }, [load]);

  /* Export CSV */
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await suiviSuperviseurApi.exportCsv({ session_id: sessId || undefined, search: search || undefined });
      downloadBlob(res.data, "suivi_superviseurs.csv");
    } catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  /* Pagination */
  const paginated = superviseurs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setPage(1);

  /* Ouvrir modal */
  const openModal = async (sup: SuperviseurSuivi) => {
    setModalSup(sup);
    setModalDetail(null);
    setModalLoading(true);
    try {
      const r = await suiviSuperviseurApi.detail(sup.superviseur_id, { session_id: sessId || undefined });
      setModalDetail(r.data);
    } finally {
      setModalLoading(false);
    }
  };

  /* Stats globales */
  const totalEnseignants = superviseurs.reduce((a, s) => a + s.total_assignes, 0);
  const totalPresents    = superviseurs.reduce((a, s) => a + s.presents + s.en_cours, 0);
  const totalAbsents     = superviseurs.reduce((a, s) => a + s.absents, 0);
  const totalSuivi       = totalPresents + totalAbsents;
  const supsEnAlerte     = superviseurs.filter(s => (s.tuteurs_en_alerte ?? []).length > 0).length;

  const supsByCouverture = superviseurs
    .slice()
    .sort((a, b) => b.total_assignes - a.total_assignes)
    .slice(0, 8)
    .map(s => ({ label: s.name, value: s.total_assignes }));

  const supsAbsentsTop = superviseurs
    .filter(s => s.absents > 0)
    .sort((a, b) => b.absents - a.absents)
    .slice(0, 8)
    .map(s => ({ label: s.name, value: s.absents }));

  return (
    <div className="flex flex-col min-h-full flex-shrink-0 px-7 pb-7">

      {/* ── En-tête ── */}
      <div className="sticky top-0 z-10 bg-bg pt-7 pb-4 mb-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-tx">Suivi des superviseurs</h1>
            <p className="text-tx-muted text-sm mt-0.5">
              Vue d'ensemble des superviseurs et de la présence de leurs enseignants
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <BIButton onClick={() => setShowBI(true)} />
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 border border-border bg-surface text-tx px-3.5 py-2.5 rounded-xl text-sm font-semibold hover:bg-surface-alt transition-colors disabled:opacity-60"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {exporting ? "Export…" : "Exporter CSV"}
            </button>
          </div>
        </div>

        {/* Barre de contrôle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-[2]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher un superviseur…"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
            />
          </div>
          <div className="flex-1" />
          <select
            value={sessId}
            onChange={e => { setSessId(e.target.value); resetPage(); }}
            className="text-sm bg-surface border border-border rounded-xl px-3 py-2.5 text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-[160px]"
          >
            <option value="">Toutes les sessions</option>
            {sessions.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Cartes stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Superviseurs",    value: superviseurs.length,  icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "text-brand",   bg: "bg-brand/10"   },
          { label: "Enseignants",     value: totalEnseignants,     icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", color: "text-tx",     bg: "bg-surface-alt" },
          { label: "Présents",        value: totalPresents,        icon: "M20 6 9 17l-5-5",  color: "text-success", bg: "bg-success/10" },
          { label: "Absents",         value: totalAbsents,         icon: "M18 6 6 18M6 6l12 12", color: "text-danger",  bg: "bg-danger/10"  },
        ].map(stat => (
          <div key={stat.label} className="bg-surface border border-border rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={stat.color}>
                <path d={stat.icon}/>
              </svg>
            </div>
            <div className="flex-1 flex flex-col items-center text-center">
              <p className="text-2xl font-bold text-tx leading-none">{stat.value}</p>
              <p className="text-xs font-medium text-tx-muted mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tableau ── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">

        {/* Header colonnes */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px] gap-x-4 px-5 py-3 bg-surface-alt border-b border-border text-xs font-semibold text-tx-muted uppercase tracking-wide">
          <span>Superviseur</span>
          <span>École</span>
          <span>Assignés</span>
          <span>Présents</span>
          <span>Absents</span>
          <span className="text-center">Détail</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <svg className="animate-spin w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span className="text-sm text-tx-muted">Chargement…</span>
          </div>
        ) : superviseurs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted/30">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
            <p className="text-sm text-tx-muted">Aucun superviseur trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paginated.map(sup => (
              <div
                key={sup.superviseur_id}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px] gap-x-4 px-5 py-4 items-center hover:bg-surface-alt/60 transition-colors"
              >
                {/* Identité */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand">
                    {initials(sup.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-tx truncate">{sup.name}</p>
                      {sup.tuteurs_en_alerte?.length > 0 && (
                        <span
                          title={`⚠️ ${sup.tuteurs_en_alerte.length} tuteur${sup.tuteurs_en_alerte.length > 1 ? "s" : ""} avec 3+ rapports manquants : ${sup.tuteurs_en_alerte.map(t => t.name).join(", ")}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold cursor-help flex-shrink-0"
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          {sup.tuteurs_en_alerte.length}
                        </span>
                      )}
                    </div>
                    {sup.title && <p className="text-xs text-tx-muted truncate">{sup.title}</p>}
                    {sup.tuteurs_en_alerte?.length > 0 && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                        {sup.tuteurs_en_alerte.length} tuteur{sup.tuteurs_en_alerte.length > 1 ? "s" : ""} sans rapport (&ge;3 jours)
                      </p>
                    )}
                  </div>
                </div>

                {/* École */}
                <div className="text-sm text-tx-muted truncate">
                  {sup.school_name ?? <span className="italic">—</span>}
                </div>

                {/* Assignés */}
                <div>
                  <p className="text-base font-bold text-tx">{sup.total_assignes}</p>
                  <p className="text-xs text-tx-muted">enseignant{sup.total_assignes !== 1 ? "s" : ""}</p>
                </div>

                {/* Présents */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-success">{sup.presents + sup.en_cours}</span>
                    {sup.en_cours > 0 && (
                      <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-semibold">{sup.en_cours} en cours</span>
                    )}
                  </div>
                  <p className="text-xs text-tx-muted">{sup.presents} terminé{sup.presents !== 1 ? "s" : ""}</p>
                </div>

                {/* Absents */}
                <div>
                  <p className={`text-base font-bold ${sup.absents > 0 ? "text-danger" : "text-tx-muted"}`}>{sup.absents}</p>
                  <p className="text-xs text-tx-muted">absent{sup.absents !== 1 ? "s" : ""}</p>
                </div>

                {/* Bouton */}
                <div className="flex justify-center">
                  <button
                    onClick={() => openModal(sup)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 hover:bg-brand hover:text-white text-brand text-xs font-semibold transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
                    Voir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border px-5">
          <Pagination page={page} total={superviseurs.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ══ Modal ══ */}
      {modalSup && (
        <SuperviseurModal
          sup={modalSup}
          detail={modalDetail}
          loading={modalLoading}
          onClose={() => { setModalSup(null); setModalDetail(null); }}
        />
      )}

      {/* ══ Modal BI ══ */}
      {showBI && (
        <BIModal
          title="Analyse BI — Suivi des superviseurs"
          subtitle={`${superviseurs.length} superviseur${superviseurs.length !== 1 ? "s" : ""} suivi${superviseurs.length !== 1 ? "s" : ""}`}
          onClose={() => setShowBI(false)}
          kpis={[
            { label: "Superviseurs", value: superviseurs.length },
            { label: "Enseignants assignés", value: totalEnseignants, color: "text-tx" },
            { label: "Présents", value: totalPresents, color: "text-success" },
            { label: "Absents", value: totalAbsents, color: "text-danger" },
            { label: "Taux de présence", value: totalSuivi > 0 ? `${Math.round((totalPresents / totalSuivi) * 100)}%` : "—", color: "text-brand" },
            { label: "Superviseurs en alerte", value: supsEnAlerte, color: "text-warn" },
          ]}
          tabs={[
            {
              id: "overview",
              label: "Vue d'ensemble",
              content: (
                <div className="grid grid-cols-3 gap-4">
                  <BIPanel title="Présence globale des enseignants">
                    <Donut
                      color="#2F7D4A"
                      pct={totalSuivi > 0 ? Math.round((totalPresents / totalSuivi) * 100) : 0}
                      legende={`${totalPresents} présents · ${totalAbsents} absents`}
                    />
                  </BIPanel>
                  <BIPanel title="Couverture par superviseur" sub="enseignants assignés, top 8">
                    <BarList color="#4A90C2" data={supsByCouverture} />
                  </BIPanel>
                  <BIPanel title="Superviseurs avec le plus d'absents" sub="top 8">
                    <BarList color="#B23A3A" data={supsAbsentsTop} />
                  </BIPanel>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
