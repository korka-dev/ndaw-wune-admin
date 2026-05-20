"use client";
import { useEffect, useState, useCallback } from "react";
import { suiviApi, sessionsApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

/* ══ Types ═══════════════════════════════════════════════════════ */
interface TeacherSuivi {
  teacher_id:         string;
  name:               string;
  title?:             string;
  phone?:             string;
  email?:             string;
  school_name?:       string;
  classes?:           string[];
  total_seances:      number;
  seances_terminees:  number;
  seances_en_cours:   number;
  derniere_activite?: string;
  derniere_matiere?:  string;
  derniere_classe?:   string;
  dernier_status?:    string;
  // Métriques d'usage
  taux_completion?:    number;
  taux_rapport?:       number;
  duree_moy_minutes?:  number;
  taux_presence?:      number;
  seances_7j:          number;
  seances_30j:         number;
  rapports_offline:    number;
  total_rapports:      number;
  jours_actifs:        number;
  premiere_seance?:    string;
  derniere_connexion?: string;
  seances_planifiees:  number;
  seances_ad_hoc:      number;
  score_engagement:    number;
}
interface PauseEvent {
  paused_at:   string;        // ISO 8601
  resumed_at?: string | null; // null si encore en pause
}
interface SeanceDetail {
  id:                   string;
  date_seance:          string;
  started_at?:          string;
  finished_at?:         string;
  duree_minutes?:       number;
  matiere?:             string;
  classe:               string;
  status:               string;
  has_rapport:          boolean;
  nb_eleves_presents?:  number;
  nb_eleves_total?:     number;
  planning_segment_id?: string;
  soumis_offline?:      boolean;
  rapport_at?:          string;
  pauses?:              PauseEvent[];
  total_paused_minutes?: number;
}
interface TeacherDetail {
  teacher_id:   string;
  name:         string;
  title?:       string;
  phone?:       string;
  email?:       string;
  school_name?: string;
  classes?:     string[];
  seances:      SeanceDetail[];
}

type FilterStatus = "all" | "en_cours" | "terminee" | "aucune";

interface FilterState {
  status:  FilterStatus;
  schools: string[];
  classes: string[];
  withRapport: "all" | "yes" | "no";
}

const FILTER_EMPTY: FilterState = { status: "all", schools: [], classes: [], withRapport: "all" };

/* ══ Helpers ══════════════════════════════════════════════════════ */
const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) : "—";

const fmtFull = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
      + " à " + new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDateShort = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0] ?? "").filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function countActiveFilters(f: FilterState) {
  return (f.status !== "all" ? 1 : 0) + f.schools.length + f.classes.length + (f.withRapport !== "all" ? 1 : 0);
}

/** Retourne une classe CSS de couleur selon la valeur et les seuils [bon, moyen]. */
function metricColor(value: number, seuils: [number, number]): string {
  if (value >= seuils[0]) return "text-success";
  if (value >= seuils[1]) return "text-warn";
  return "text-danger";
}

/** Badge coloré pour le score d'engagement. */
function scoreBadge(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: "Excellent", cls: "bg-success-soft text-success" };
  if (score >= 60) return { label: "Bon",       cls: "bg-brand/10 text-brand" };
  if (score >= 40) return { label: "Moyen",     cls: "bg-warn-soft text-warn" };
  return              { label: "Faible",     cls: "bg-danger-soft text-danger" };
}

/* ══ Composants partagés ═════════════════════════════════════════ */
function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-tx-muted italic">—</span>;
  const cfg: Record<string, { label: string; cls: string; dot?: boolean }> = {
    en_cours: { label: "En cours",  cls: "bg-brand/10 text-brand border border-brand/20",       dot: true },
    terminee: { label: "Terminée",  cls: "bg-success-soft text-success border border-success/20" },
    annulee:  { label: "Annulée",   cls: "bg-danger-soft text-danger border border-danger/20"   },
  };
  const { label, cls, dot } = cfg[status] ?? { label: status, cls: "bg-surface-alt text-tx-muted border border-border" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />}
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const { label, cls } = scoreBadge(score);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      {score}
      <span className="font-normal opacity-80">{label}</span>
    </span>
  );
}

/* ══ Modal filtres avancés ═══════════════════════════════════════ */
const STATUS_OPTS: { v: FilterStatus; label: string; desc: string }[] = [
  { v: "all",      label: "Tous",           desc: "Afficher tous les enseignants" },
  { v: "en_cours", label: "En cours",       desc: "Séance actuellement active" },
  { v: "terminee", label: "Terminée",       desc: "Au moins une séance terminée" },
  { v: "aucune",   label: "Sans activité",  desc: "Aucune séance enregistrée" },
];

const RAPPORT_OPTS: { v: "all" | "yes" | "no"; label: string }[] = [
  { v: "all", label: "Tous" },
  { v: "yes", label: "Avec rapport" },
  { v: "no",  label: "Sans rapport" },
];

function FilterModal({
  open, onClose, onApply, initial, availableSchools, availableClasses,
}: {
  open:             boolean;
  onClose:          () => void;
  onApply:          (f: FilterState) => void;
  initial:          FilterState;
  availableSchools: string[];
  availableClasses: string[];
}) {
  const [draft, setDraft] = useState<FilterState>(initial);

  useEffect(() => { if (open) setDraft(initial); }, [open]); // eslint-disable-line

  const toggleSchool = (s: string) =>
    setDraft(d => ({ ...d, schools: d.schools.includes(s) ? d.schools.filter(x => x !== s) : [...d.schools, s] }));

  const toggleClass = (c: string) =>
    setDraft(d => ({ ...d, classes: d.classes.includes(c) ? d.classes.filter(x => x !== c) : [...d.classes, c] }));

  const activeCount = countActiveFilters(draft);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <h2 className="text-base font-bold text-tx">Filtres avancés</h2>
            {activeCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-brand text-white text-[11px] font-bold">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDraft(FILTER_EMPTY)}
              className="text-xs text-brand hover:text-brand/70 font-medium transition-colors"
            >
              Réinitialiser
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* ── Corps ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7">

          {/* Section Statut */}
          <div>
            <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest mb-3">Statut d&apos;activité</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTS.map(o => (
                <button
                  key={o.v}
                  onClick={() => setDraft(d => ({ ...d, status: o.v }))}
                  className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                    draft.status === o.v
                      ? "bg-brand/8 border-brand ring-1 ring-brand/30"
                      : "border-border hover:bg-surface-alt"
                  }`}
                >
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    draft.status === o.v ? "border-brand" : "border-border"
                  }`}>
                    {draft.status === o.v && <span className="w-2 h-2 rounded-full bg-brand" />}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${draft.status === o.v ? "text-brand" : "text-tx"}`}>{o.label}</p>
                    <p className="text-xs text-tx-muted mt-0.5">{o.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section École */}
          {availableSchools.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest">École</p>
                {draft.schools.length > 0 && (
                  <button onClick={() => setDraft(d => ({ ...d, schools: [] }))} className="text-[11px] text-brand hover:underline">
                    Tout désélectionner
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {availableSchools.map(school => {
                  const checked = draft.schools.includes(school);
                  return (
                    <label
                      key={school}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        checked ? "bg-brand/8 border-brand/40" : "border-border hover:bg-surface-alt"
                      }`}
                    >
                      <span className={`w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                        checked ? "bg-brand border-brand" : "border-border"
                      }`}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                        )}
                      </span>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleSchool(school)} />
                      <span className={`text-sm font-medium ${checked ? "text-brand" : "text-tx"}`}>{school}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section Classes */}
          {availableClasses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest">Classe</p>
                {draft.classes.length > 0 && (
                  <button onClick={() => setDraft(d => ({ ...d, classes: [] }))} className="text-[11px] text-brand hover:underline">
                    Tout désélectionner
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableClasses.map(cls => {
                  const active = draft.classes.includes(cls);
                  return (
                    <button
                      key={cls}
                      onClick={() => toggleClass(cls)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        active
                          ? "bg-brand/10 border-brand text-brand"
                          : "border-border text-tx-muted hover:bg-surface-alt hover:text-tx"
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section Rapport */}
          <div>
            <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest mb-3">Rapport de séance</p>
            <div className="flex gap-2">
              {RAPPORT_OPTS.map(o => (
                <button
                  key={o.v}
                  onClick={() => setDraft(d => ({ ...d, withRapport: o.v }))}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    draft.withRapport === o.v
                      ? "bg-brand/10 border-brand text-brand"
                      : "border-border text-tx-muted hover:bg-surface-alt"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ── Pied de page ── */}
        <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-surface-alt/40">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => { onApply(draft); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Appliquer{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══ Section "Profil d'utilisation" dans la modal ═══════════════ */
function ProfilUtilisation({ teacher }: { teacher: TeacherSuivi }) {
  const { label: scoreLabel, cls: scoreCls } = scoreBadge(teacher.score_engagement);

  return (
    <div className="px-6 py-5 border-b border-border bg-surface-alt/30">
      <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest mb-4">Profil d&apos;utilisation</p>

      <div className="grid grid-cols-3 gap-4">

        {/* Bloc 1 — Score global */}
        <div className="flex flex-col items-center justify-center bg-surface rounded-2xl border border-border px-4 py-5 gap-2">
          <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest">Score engagement</p>
          <span className={`text-4xl font-extrabold ${scoreCls.replace("bg-success-soft ", "").replace("bg-brand/10 ", "").replace("bg-warn-soft ", "").replace("bg-danger-soft ", "")}`}>
            {teacher.score_engagement}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${scoreCls}`}>{scoreLabel}</span>
          <div className="w-full mt-1">
            <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  teacher.score_engagement >= 80 ? "bg-success" :
                  teacher.score_engagement >= 60 ? "bg-brand" :
                  teacher.score_engagement >= 40 ? "bg-warn" : "bg-danger"
                }`}
                style={{ width: `${teacher.score_engagement}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bloc 2 — Métriques clés (grille 2×3) */}
        <div className="bg-surface rounded-2xl border border-border px-4 py-4">
          <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest mb-3">Métriques clés</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Complétion */}
            <div>
              <p className="text-[10px] text-tx-muted">Complétion</p>
              <p className={`text-sm font-bold ${teacher.taux_completion != null ? metricColor(teacher.taux_completion, [75, 50]) : "text-tx-muted"}`}>
                {teacher.taux_completion != null ? `${Math.round(teacher.taux_completion)}%` : "—"}
              </p>
            </div>
            {/* Rapport */}
            <div>
              <p className="text-[10px] text-tx-muted">Rapport</p>
              <p className={`text-sm font-bold ${teacher.taux_rapport != null ? metricColor(teacher.taux_rapport, [75, 50]) : "text-tx-muted"}`}>
                {teacher.taux_rapport != null ? `${Math.round(teacher.taux_rapport)}%` : "—"}
              </p>
            </div>
            {/* Durée moy */}
            <div>
              <p className="text-[10px] text-tx-muted">Durée moy.</p>
              <p className={`text-sm font-bold ${teacher.duree_moy_minutes != null ? metricColor(teacher.duree_moy_minutes, [45, 30]) : "text-tx-muted"}`}>
                {teacher.duree_moy_minutes != null ? `${Math.round(teacher.duree_moy_minutes)} min` : "—"}
              </p>
            </div>
            {/* Présence */}
            <div>
              <p className="text-[10px] text-tx-muted">Présence</p>
              <p className={`text-sm font-bold ${teacher.taux_presence != null ? metricColor(teacher.taux_presence, [80, 60]) : "text-tx-muted"}`}>
                {teacher.taux_presence != null ? `${Math.round(teacher.taux_presence)}%` : "—"}
              </p>
            </div>
            {/* Actif 7j */}
            <div>
              <p className="text-[10px] text-tx-muted">Actif 7j</p>
              <p className={`text-sm font-bold ${metricColor(teacher.seances_7j, [3, 1])}`}>
                {teacher.seances_7j} séance{teacher.seances_7j !== 1 ? "s" : ""}
              </p>
            </div>
            {/* Actif 30j */}
            <div>
              <p className="text-[10px] text-tx-muted">Actif 30j</p>
              <p className={`text-sm font-bold ${metricColor(teacher.seances_30j, [8, 3])}`}>
                {teacher.seances_30j} séance{teacher.seances_30j !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Bloc 3 — Usage app */}
        <div className="bg-surface rounded-2xl border border-border px-4 py-4">
          <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-widest mb-3">Usage app</p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-tx-muted">Séances planifiées</span>
              <span className="font-semibold text-tx">{teacher.seances_planifiees}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-tx-muted">Séances ad-hoc</span>
              <span className="font-semibold text-tx">{teacher.seances_ad_hoc}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-tx-muted">Rapports offline</span>
              <span className={`font-semibold ${teacher.rapports_offline > 0 ? "text-warn" : "text-tx"}`}>{teacher.rapports_offline}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-tx-muted">Jours actifs</span>
              <span className="font-semibold text-tx">{teacher.jours_actifs}</span>
            </div>
            <div className="pt-1 border-t border-border space-y-1.5">
              <div className="text-xs text-tx-muted">
                <span>Première séance : </span>
                <span className="font-medium text-tx">{fmtDateShort(teacher.premiere_seance)}</span>
              </div>
              <div className="text-xs text-tx-muted">
                <span>Dernière connexion : </span>
                <span className="font-medium text-tx">{fmtFull(teacher.derniere_connexion)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ══ Modal détail enseignant ═════════════════════════════════════ */
function TeacherModal({
  teacher, detail, loading, onClose,
}: {
  teacher: TeacherSuivi;
  detail:  TeacherDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── En-tête modal ── */}
        <div className="flex items-start gap-4 p-6 border-b border-border">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-base font-bold text-brand flex-shrink-0">
            {initials(teacher.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-tx">{teacher.name ?? "—"}</h2>
            {teacher.title && <p className="text-sm text-tx-muted">{teacher.title}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
              {teacher.phone && (
                <span className="flex items-center gap-1.5 text-xs text-tx-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 1.12h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 5.61 5.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.92v1z"/></svg>
                  {teacher.phone}
                </span>
              )}
              {teacher.email && (
                <span className="flex items-center gap-1.5 text-xs text-tx-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  {teacher.email}
                </span>
              )}
              {teacher.school_name && (
                <span className="flex items-center gap-1.5 text-xs text-tx-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  {teacher.school_name}
                </span>
              )}
              {teacher.classes && teacher.classes.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-tx-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  {teacher.classes.join(", ")}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            {[
              { v: teacher.total_seances,     l: "Total",     c: "text-tx" },
              { v: teacher.seances_terminees, l: "Terminées", c: "text-success" },
              { v: teacher.seances_en_cours,  l: "En cours",  c: "text-brand" },
            ].map(s => (
              <div key={s.l} className="text-center px-3 py-2 bg-surface-alt rounded-xl min-w-[56px]">
                <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[10px] text-tx-muted mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0 ml-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── Profil d'utilisation ── */}
        <ProfilUtilisation teacher={teacher} />

        {/* ── Corps : tableau des séances ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <svg className="animate-spin w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span className="text-sm text-tx-muted">Chargement des séances…</span>
            </div>
          ) : !detail || detail.seances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted/30">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p className="text-sm text-tx-muted">Aucune séance enregistrée</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-alt border-b border-border">
                <tr>
                  {["Date", "Activité / Classe", "Lancement", "Pauses", "Fin", "Durée", "Élèves", "Type", "Statut", "Rapport"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.seances.map(s => (
                  <tr key={s.id} className="hover:bg-surface-alt/40 transition-colors">
                    <td className="px-4 py-3.5 text-xs text-tx-muted whitespace-nowrap">{fmtDate(s.date_seance)}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-tx">{s.matiere ?? "—"}</p>
                      <p className="text-xs text-tx-muted">{s.classe}</p>
                    </td>
                    {/* Lancement */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {s.started_at ? (
                        <span title={fmtFull(s.started_at)}>
                          <p className="font-mono font-semibold text-tx">{fmtTime(s.started_at)}</p>
                          <p className="text-xs text-tx-muted">{fmtDate(s.started_at)}</p>
                        </span>
                      ) : <span className="text-tx-muted">—</span>}
                    </td>
                    {/* Pauses */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {s.pauses && s.pauses.length > 0 ? (
                        <div className="space-y-1">
                          {s.pauses.map((p, i) => (
                            <div key={i} className="text-xs leading-tight">
                              <span className="inline-flex items-center gap-1 text-warn font-semibold">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                {fmtTime(p.paused_at)}
                              </span>
                              {p.resumed_at && (
                                <span className="text-tx-muted ml-1">
                                  → <span className="text-success font-semibold">{fmtTime(p.resumed_at)}</span>
                                </span>
                              )}
                              {!p.resumed_at && (
                                <span className="ml-1 text-warn italic">en pause</span>
                              )}
                            </div>
                          ))}
                          {s.total_paused_minutes != null && s.total_paused_minutes > 0 && (
                            <p className="text-[10px] text-tx-muted mt-0.5">
                              Total pause : {s.total_paused_minutes} min
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-tx-muted text-xs">—</span>
                      )}
                    </td>
                    {/* Fin */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {s.finished_at ? (
                        <span title={fmtFull(s.finished_at)}>
                          <p className="font-mono font-semibold text-tx">{fmtTime(s.finished_at)}</p>
                          <p className="text-xs text-tx-muted">{fmtDate(s.finished_at)}</p>
                        </span>
                      ) : <span className="text-tx-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-tx whitespace-nowrap">
                      {s.duree_minutes != null ? `${s.duree_minutes} min` : "—"}
                    </td>
                    {/* Colonne Élèves */}
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                      {s.nb_eleves_total != null ? (
                        <span className={`font-semibold ${
                          s.nb_eleves_presents != null && s.nb_eleves_total > 0
                            ? metricColor(s.nb_eleves_presents / s.nb_eleves_total * 100, [80, 60])
                            : "text-tx-muted"
                        }`}>
                          {s.nb_eleves_presents ?? "?"}/{s.nb_eleves_total}
                        </span>
                      ) : <span className="text-tx-muted">—</span>}
                    </td>
                    {/* Colonne Type */}
                    <td className="px-4 py-3.5">
                      {s.planning_segment_id ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand/10 text-brand border border-brand/20">
                          Planifiée
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-alt text-tx-muted border border-border">
                          Ad-hoc
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3.5">
                      {s.has_rapport ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-success font-semibold">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            {s.rapport_at ? fmtTime(s.rapport_at) : "Oui"}
                          </span>
                          {s.soumis_offline && (
                            <span className="text-[10px] text-warn font-medium">📶 offline</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-tx-muted">Non</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ Page principale ═════════════════════════════════════════════ */
export default function SuiviSeancesPage() {
  const [teachers,     setTeachers]     = useState<TeacherSuivi[]>([]);
  const [sessId,       setSessId]       = useState("");
  const [sessions,     setSessions]     = useState<any[]>([]);
  const [search,       setSearch]       = useState("");
  const [filters,      setFilters]      = useState<FilterState>(FILTER_EMPTY);
  const [loading,      setLoading]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [showFilters,  setShowFilters]  = useState(false);
  const [quickStatus,  setQuickStatus]  = useState<FilterStatus>("all");

  /* Modal enseignant */
  const [modalTeacher, setModalTeacher] = useState<TeacherSuivi | null>(null);
  const [modalDetail,  setModalDetail]  = useState<TeacherDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  /* ── Sessions ── */
  useEffect(() => {
    sessionsApi.list().then(r => {
      const list = r.data.items ?? [];
      setSessions(list);
      const active = list.find((s: any) => s.status === "active");
      if (active) setSessId(active.id);
    }).catch(() => {});
  }, []);

  /* ── Chargement ── */
  const load = useCallback(() => {
    setLoading(true);
    suiviApi.list({ session_id: sessId || undefined, search: search || undefined })
      .then(r => setTeachers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessId, search]);

  useEffect(() => { load(); }, [load]);

  /* ── Options dérivées des données ── */
  const availableSchools = Array.from(
    new Set(teachers.map(t => t.school_name).filter(Boolean) as string[])
  ).sort();

  const availableClasses = Array.from(
    new Set(teachers.flatMap(t => t.classes ?? []))
  ).sort();

  /* ── Filtre côté client ── */
  const activeStatus = filters.status !== "all" ? filters.status : quickStatus;
  const filtered = teachers.filter(t => {
    if (activeStatus === "en_cours" && t.seances_en_cours === 0) return false;
    if (activeStatus === "terminee" && (t.seances_terminees === 0 || t.seances_en_cours > 0)) return false;
    if (activeStatus === "aucune"   && t.total_seances !== 0) return false;
    if (filters.schools.length > 0   && !filters.schools.includes(t.school_name ?? "")) return false;
    if (filters.classes.length > 0   && !filters.classes.some(c => t.classes?.includes(c))) return false;
    return true;
  });

  /* ── Pagination ── */
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setPage(1);

  /* ── Ouvrir modal enseignant ── */
  const openModal = async (t: TeacherSuivi) => {
    setModalTeacher(t);
    setModalDetail(null);
    setModalLoading(true);
    try {
      const r = await suiviApi.detail(t.teacher_id, { session_id: sessId || undefined });
      setModalDetail(r.data);
    } finally {
      setModalLoading(false);
    }
  };
  const closeModal = () => { setModalTeacher(null); setModalDetail(null); };

  /* ── Appliquer filtres ── */
  const applyFilters = (f: FilterState) => { setFilters(f); setQuickStatus("all"); resetPage(); };
  const resetFilters = () => { setFilters(FILTER_EMPTY); setQuickStatus("all"); resetPage(); };

  /* ── Supprimer un filtre individuel ── */
  const removeFilter = (key: keyof FilterState, val?: string) => {
    setFilters(prev => {
      if (key === "status")      return { ...prev, status: "all" };
      if (key === "withRapport") return { ...prev, withRapport: "all" };
      if (key === "schools")     return { ...prev, schools: prev.schools.filter(s => s !== val) };
      if (key === "classes")     return { ...prev, classes: prev.classes.filter(c => c !== val) };
      return prev;
    });
    resetPage();
  };

  /* ── Stats cartes ── */
  const totalActive   = teachers.filter(t => t.seances_en_cours > 0).length;
  const totalDone     = teachers.reduce((a, t) => a + t.seances_terminees, 0);
  const totalNoSeance = teachers.filter(t => t.total_seances === 0).length;

  const activeFilterCount = countActiveFilters(filters);

  /* ── Chips de filtres actifs ── */
  const filterChips: { label: string; onRemove: () => void }[] = [
    ...(filters.status !== "all"
      ? [{ label: STATUS_OPTS.find(o => o.v === filters.status)?.label ?? "", onRemove: () => removeFilter("status") }]
      : []),
    ...filters.schools.map(s => ({ label: `École : ${s}`, onRemove: () => removeFilter("schools", s) })),
    ...filters.classes.map(c => ({ label: `Classe : ${c}`, onRemove: () => removeFilter("classes", c) })),
    ...(filters.withRapport !== "all"
      ? [{ label: filters.withRapport === "yes" ? "Avec rapport" : "Sans rapport", onRemove: () => removeFilter("withRapport") }]
      : []),
  ];

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">

      {/* ── En-tête ── */}
      <div className="sticky top-0 z-10 bg-bg pt-7 pb-4 mb-6 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-tx">Suivi des séances</h1>
            <p className="text-tx-muted text-sm mt-0.5">
              Qui a lancé son planning, à quelle heure et les détails de chaque tuteur
            </p>
          </div>
        </div>

        {/* ── Barre de contrôle ── */}
        <div className="flex items-center gap-3">

          {/* Recherche */}
          <div className="relative flex-[2]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher un enseignant…"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
            />
          </div>

          <div className="flex-1" />

          {/* Bouton Filtres */}
          <button
            onClick={() => setShowFilters(true)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              activeFilterCount > 0
                ? "bg-brand/10 border-brand text-brand"
                : "bg-surface border-border text-tx hover:bg-surface-alt"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filtres
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-brand text-white text-[11px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Session */}
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

        {/* ── Chips filtres actifs ── */}
        {filterChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="text-xs text-tx-muted">Filtres actifs :</span>
            {filterChips.map(chip => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 text-xs font-medium text-brand"
              >
                {chip.label}
                <button
                  onClick={chip.onRemove}
                  className="hover:text-brand/60 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </span>
            ))}
            <button
              onClick={resetFilters}
              className="text-xs text-tx-muted hover:text-danger transition-colors ml-1"
            >
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* ── Cartes stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Enseignants",    value: teachers.length, icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "text-brand",    bg: "bg-brand/10",    fStatus: "all"      as FilterStatus },
          { label: "En cours",       value: totalActive,     icon: "M5 3l14 9-14 9V3z",                                                                    color: "text-warn",     bg: "bg-warn/10",     fStatus: "en_cours" as FilterStatus },
          { label: "Séances faites", value: totalDone,       icon: "M20 6 9 17l-5-5",                                                                       color: "text-success",  bg: "bg-success/10",  fStatus: "terminee" as FilterStatus },
          { label: "Sans activité",  value: totalNoSeance,   icon: "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", color: "text-tx-muted", bg: "bg-surface-alt", fStatus: "aucune"   as FilterStatus },
        ].map(stat => (
          <button
            key={stat.label}
            onClick={() => { setQuickStatus(prev => prev === stat.fStatus ? "all" : stat.fStatus); setFilters(f => ({ ...f, status: "all" })); resetPage(); }}
            className={`bg-surface border rounded-2xl px-5 py-4 flex items-center gap-4 text-left transition-all hover:shadow-sm ${
              activeStatus === stat.fStatus ? "border-brand ring-2 ring-brand/20" : "border-border"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={stat.color}>
                <path d={stat.icon}/>
              </svg>
            </div>
            <div className="flex-1 flex flex-col items-center text-center">
              <p className="text-2xl font-bold text-tx leading-none">{stat.value}</p>
              <p className="text-xs font-medium text-tx-muted mt-1">{stat.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Tableau ── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden flex-1">

        {/* Header colonnes */}
        <div className="flex items-center justify-between px-5 py-3 bg-surface-alt border-b border-border">
          <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_90px_90px] gap-x-4 flex-1 text-xs font-semibold text-tx-muted uppercase tracking-wide">
            <span>Enseignant</span>
            <span>Dernière activité</span>
            <span>Heure de lancement</span>
            <span>Statut</span>
            <span>Séances</span>
            <span>Score</span>
            <span className="text-center">Détail</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <svg className="animate-spin w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span className="text-sm text-tx-muted">Chargement…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted/30">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p className="text-sm text-tx-muted">Aucun enseignant trouvé</p>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="text-xs text-brand hover:underline mt-1">
                Effacer les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paginated.map(t => (
              <div
                key={t.teacher_id}
                className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_90px_90px] gap-x-4 px-5 py-4 items-center hover:bg-surface-alt/60 transition-colors"
              >
                {/* Identité */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand">
                    {initials(t.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-tx truncate">{t.name ?? "—"}</p>
                    <p className="text-xs text-tx-muted truncate">
                      {[t.title, t.school_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>

                {/* Dernière activité */}
                <div className="min-w-0">
                  {t.derniere_matiere || t.derniere_classe ? (
                    <>
                      <p className="text-sm font-medium text-tx truncate">{t.derniere_matiere ?? t.derniere_classe}</p>
                      <p className="text-xs text-tx-muted">{fmtDate(t.derniere_activite)}</p>
                    </>
                  ) : <span className="text-sm text-tx-muted italic">Aucune activité</span>}
                </div>

                {/* Heure de lancement */}
                <div>
                  {t.derniere_activite ? (
                    <>
                      <p className="text-sm font-mono font-semibold text-tx">{fmtTime(t.derniere_activite)}</p>
                      <p className="text-xs text-tx-muted">
                        {new Date(t.derniere_activite).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </>
                  ) : <span className="text-sm text-tx-muted">—</span>}
                </div>

                {/* Statut */}
                <div><StatusBadge status={t.dernier_status} /></div>

                {/* Compteur + mini-activité */}
                <div>
                  <p className="text-base font-bold text-tx">{t.total_seances}</p>
                  <p className="text-xs text-tx-muted">{t.seances_terminees} terminée{t.seances_terminees !== 1 ? "s" : ""}</p>
                  {/* Mini-indicateurs d'activité */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      t.seances_7j > 0 ? "bg-success-soft text-success" : "bg-surface-alt text-tx-muted"
                    }`}>
                      7j:{t.seances_7j}
                    </span>
                    {t.taux_rapport != null && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        t.taux_rapport >= 75 ? "bg-success-soft text-success" :
                        t.taux_rapport >= 50 ? "bg-warn-soft text-warn" :
                        "bg-danger-soft text-danger"
                      }`}>
                        R:{Math.round(t.taux_rapport)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div>
                  <ScoreBadge score={t.score_engagement} />
                </div>

                {/* Bouton détail */}
                <div className="flex justify-center">
                  <button
                    onClick={() => openModal(t)}
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

        <div className="px-5 pb-4">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ══ Modal filtres avancés ══ */}
      <FilterModal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        initial={filters}
        availableSchools={availableSchools}
        availableClasses={availableClasses}
      />

      {/* ══ Modal détail enseignant ══ */}
      {modalTeacher && (
        <TeacherModal
          teacher={modalTeacher}
          detail={modalDetail}
          loading={modalLoading}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
