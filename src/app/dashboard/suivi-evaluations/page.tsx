"use client";
import { useEffect, useState, useMemo } from "react";
import { suiviEvaluationsApi, evaluationCompetencesApi } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
interface EvaluationItem {
  id:             string;
  superviseur_id: string;
  superviseur:    string;
  eleve_id:       string;
  eleve:          string;
  classe:         string | null;
  school_name:    string | null;
  competence:     string;
  resultat:       string;
  date_eval:      string;
  commentaire:    string | null;
  created_at:     string;
}

interface SuperviseurOption { id: string; name: string }

type Level = "supervisors" | "schools" | "students";

// ── Config résultats ──────────────────────────────────────────────────────────
const RESULTAT_CFG: Record<string, {
  label: string; badgeCls: string; rowAccent: string; avatarCls: string;
  kpiText: string; kpiBg: string; barCls: string;
  icon: "check" | "clock" | "alert";
}> = {
  acquis: {
    label: "Acquis", badgeCls: "bg-success-soft text-success",
    rowAccent: "border-l-success", avatarCls: "bg-success-soft text-success",
    kpiText: "text-success", kpiBg: "bg-success-soft", barCls: "bg-success",
    icon: "check",
  },
  en_cours: {
    label: "En cours", badgeCls: "bg-brand-soft text-brand",
    rowAccent: "border-l-brand", avatarCls: "bg-brand-soft text-brand",
    kpiText: "text-brand", kpiBg: "bg-brand-soft", barCls: "bg-brand",
    icon: "clock",
  },
  a_aider: {
    label: "À aider", badgeCls: "bg-warn-soft text-warn",
    rowAccent: "border-l-warn", avatarCls: "bg-warn-soft text-warn",
    kpiText: "text-warn", kpiBg: "bg-warn-soft", barCls: "bg-warn",
    icon: "alert",
  },
  // Nouveaux résultats (évaluation superviseur à 3 options)
  reussi: {
    label: "Réussi", badgeCls: "bg-success-soft text-success",
    rowAccent: "border-l-success", avatarCls: "bg-success-soft text-success",
    kpiText: "text-success", kpiBg: "bg-success-soft", barCls: "bg-success",
    icon: "check",
  },
  intermediaire: {
    label: "Intermédiaire", badgeCls: "bg-brand-soft text-brand",
    rowAccent: "border-l-brand", avatarCls: "bg-brand-soft text-brand",
    kpiText: "text-brand", kpiBg: "bg-brand-soft", barCls: "bg-brand",
    icon: "clock",
  },
  pas_reussi: {
    label: "Pas réussi", badgeCls: "bg-danger-soft text-danger",
    rowAccent: "border-l-danger", avatarCls: "bg-danger-soft text-danger",
    kpiText: "text-danger", kpiBg: "bg-danger-soft", barCls: "bg-danger",
    icon: "alert",
  },
};

const RESULTAT_KEYS = ["acquis", "en_cours", "a_aider"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function computeStats(evals: EvaluationItem[]) {
  return {
    total:    evals.length,
    acquis:   evals.filter(e => e.resultat === "acquis").length,
    en_cours: evals.filter(e => e.resultat === "en_cours").length,
    a_aider:  evals.filter(e => e.resultat === "a_aider").length,
  };
}

// ── Sous-composants ───────────────────────────────────────────────────────────
function KpiIcon({ name, size = 16 }: { name: "check" | "clock" | "alert"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "check") return <svg {...p}><path d="M20 6L9 17l-5-5"/></svg>;
  if (name === "clock") return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}

function ResultatBadge({ resultat }: { resultat: string }) {
  const c = RESULTAT_CFG[resultat] ?? { label: resultat, badgeCls: "bg-surface-alt text-tx-muted" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${c.badgeCls}`}>
      {"icon" in c && <KpiIcon name={c.icon} size={11} />}
      {c.label}
    </span>
  );
}

function StatBar({ acquis, en_cours, a_aider, total }: { acquis: number; en_cours: number; a_aider: number; total: number }) {
  if (total === 0) return null;
  return (
    <div className="mt-3">
      <div className="flex h-1.5 rounded-full overflow-hidden bg-border gap-px">
        {acquis   > 0 && <div className="bg-success h-full" style={{ width: `${Math.round((acquis   / total) * 100)}%` }} />}
        {en_cours > 0 && <div className="bg-brand   h-full" style={{ width: `${Math.round((en_cours / total) * 100)}%` }} />}
        {a_aider  > 0 && <div className="bg-warn    h-full" style={{ width: `${Math.round((a_aider  / total) * 100)}%` }} />}
      </div>
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {RESULTAT_KEYS.map(k => {
          const n = k === "acquis" ? acquis : k === "en_cours" ? en_cours : a_aider;
          if (n === 0) return null;
          const cfg = RESULTAT_CFG[k];
          return (
            <span key={k} className={`text-[11px] font-medium flex items-center gap-1 ${cfg.kpiText}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.barCls}`} />
              {n} {cfg.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
      <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-tx-muted">{label}</span>
    </div>
  );
}

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
  total,
  filtered,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  total?: number;
  filtered?: number;
}) {
  const showCount = value.trim() !== "" && total !== undefined && filtered !== undefined;
  return (
    <div className="mb-5">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "Rechercher…"}
          className="w-full bg-surface border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-colors"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-tx-muted hover:text-tx hover:bg-surface-alt transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
      {showCount && (
        <p className="mt-1.5 text-xs text-tx-muted pl-1">
          {filtered === 0
            ? "Aucun résultat"
            : `${filtered} résultat${filtered! > 1 ? "s" : ""} sur ${total}`}
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SuiviEvaluationsPage() {
  // Navigation
  const [level,       setLevel]       = useState<Level>("supervisors");
  const [activeSup,   setActiveSup]   = useState<{ id: string; name: string } | null>(null);
  const [activeSchool, setActiveSchool] = useState<string | null>(null);

  // Données niveau 1
  const [superviseurs, setSuperviseurs] = useState<(SuperviseurOption & { total: number })[]>([]);
  const [loadingL1,    setLoadingL1]    = useState(true);

  // Données niveaux 2 & 3 — toutes les évals du superviseur actif
  const [supEvals,  setSupEvals]  = useState<EvaluationItem[]>([]);
  const [loadingL2, setLoadingL2] = useState(false);

  // Recherches par niveau
  const [searchL1, setSearchL1] = useState("");
  const [searchL2, setSearchL2] = useState("");
  const [searchL3, setSearchL3] = useState("");

  // Modal détail
  const [detail, setDetail] = useState<EvaluationItem | null>(null);

  // Libellés des compétences (configurées par l'admin), pour affichage lisible
  const [competenceLabels, setCompetenceLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    evaluationCompetencesApi.list()
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const c of data ?? []) map[c.code] = c.label;
        setCompetenceLabels(map);
      })
      .catch(() => {});
  }, []);
  const competenceLabel = (code: string) => competenceLabels[code] ?? code;

  // ── Chargement initial : superviseurs + total par superviseur ──
  useEffect(() => {
    setLoadingL1(true);
    suiviEvaluationsApi.superviseurs()
      .then(async ({ data }) => {
        const sups: SuperviseurOption[] = data ?? [];
        const withCounts = await Promise.all(
          sups.map(async s => {
            try {
              const r = await suiviEvaluationsApi.list({ superviseur_id: s.id, limit: 1, skip: 0 });
              return { ...s, total: r.data.total ?? 0 };
            } catch {
              return { ...s, total: 0 };
            }
          })
        );
        setSuperviseurs(withCounts.sort((a, b) => b.total - a.total));
      })
      .catch(() => setSuperviseurs([]))
      .finally(() => setLoadingL1(false));
  }, []);

  // ── Clic superviseur : charger toutes ses évals ──
  const handleSupClick = async (sup: { id: string; name: string }) => {
    setActiveSup(sup);
    setActiveSchool(null);
    setLevel("schools");
    setSearchL2("");
    setSearchL3("");
    setLoadingL2(true);
    try {
      let all: EvaluationItem[] = [];
      const pageSize = 200;
      let skip = 0;
      while (true) {
        const r = await suiviEvaluationsApi.list({ superviseur_id: sup.id, limit: pageSize, skip });
        const items: EvaluationItem[] = r.data.items ?? [];
        all = [...all, ...items];
        if (items.length < pageSize) break;
        skip += pageSize;
      }
      setSupEvals(all);
    } catch {
      setSupEvals([]);
    } finally {
      setLoadingL2(false);
    }
  };

  // ── Navigation arrière ──
  const goTo = (l: Level) => {
    setLevel(l);
    if (l === "supervisors") { setActiveSup(null); setActiveSchool(null); setSupEvals([]); setSearchL2(""); setSearchL3(""); }
    if (l === "schools")     { setActiveSchool(null); setSearchL3(""); }
  };

  // ── Écoles dérivées des évals ──
  const schools = useMemo(() => {
    const map = new Map<string, EvaluationItem[]>();
    supEvals.forEach(e => {
      const key = e.school_name ?? "École non renseignée";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries())
      .map(([name, evals]) => ({
        name,
        nbEleves: new Set(evals.map(e => e.eleve_id)).size,
        ...computeStats(evals),
      }))
      .sort((a, b) => b.total - a.total);
  }, [supEvals]);

  // ── Élèves de l'école active ──
  const students = useMemo(() => {
    if (!activeSchool) return [];
    const evalsInSchool = supEvals.filter(e => (e.school_name ?? "École non renseignée") === activeSchool);
    const map = new Map<string, { id: string; eleve: string; classe: string | null; evals: EvaluationItem[] }>();
    evalsInSchool.forEach(e => {
      if (!map.has(e.eleve_id)) map.set(e.eleve_id, { id: e.eleve_id, eleve: e.eleve, classe: e.classe, evals: [] });
      map.get(e.eleve_id)!.evals.push(e);
    });
    return Array.from(map.values()).sort((a, b) => a.eleve.localeCompare(b.eleve, "fr"));
  }, [supEvals, activeSchool]);

  // ── Listes filtrées par recherche ──
  const filteredSuperviseurs = useMemo(() => {
    if (!searchL1.trim()) return superviseurs;
    const q = searchL1.toLowerCase();
    return superviseurs.filter(s => s.name.toLowerCase().includes(q));
  }, [superviseurs, searchL1]);

  const filteredSchools = useMemo(() => {
    if (!searchL2.trim()) return schools;
    const q = searchL2.toLowerCase();
    return schools.filter(s => s.name.toLowerCase().includes(q));
  }, [schools, searchL2]);

  const filteredStudents = useMemo(() => {
    if (!searchL3.trim()) return students;
    const q = searchL3.toLowerCase();
    return students.filter(s =>
      s.eleve.toLowerCase().includes(q) ||
      s.evals.some(e => e.competence.toLowerCase().includes(q))
    );
  }, [students, searchL3]);

  // Totaux contextuels pour le sous-titre
  const supStats    = useMemo(() => computeStats(supEvals), [supEvals]);
  const schoolStats = useMemo(() => {
    if (!activeSchool) return null;
    return computeStats(supEvals.filter(e => (e.school_name ?? "École non renseignée") === activeSchool));
  }, [supEvals, activeSchool]);

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full px-7 pb-8">

      {/* ── En-tête sticky ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg pt-7 pb-4 mb-6 border-b border-border">

        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-1.5 text-sm mb-2">
          <button
            onClick={() => goTo("supervisors")}
            className={`font-medium transition-colors ${level === "supervisors" ? "text-tx pointer-events-none" : "text-tx-muted hover:text-tx"}`}
          >
            Superviseurs
          </button>
          {level !== "supervisors" && (
            <>
              <ChevronRight className="text-tx-muted flex-shrink-0" />
              <button
                onClick={() => goTo("schools")}
                className={`font-medium transition-colors ${level === "schools" ? "text-tx pointer-events-none" : "text-tx-muted hover:text-tx"}`}
              >
                {activeSup?.name}
              </button>
            </>
          )}
          {level === "students" && activeSchool && (
            <>
              <ChevronRight className="text-tx-muted flex-shrink-0" />
              <span className="font-medium text-tx truncate max-w-[220px]">{activeSchool}</span>
            </>
          )}
        </nav>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-tx">
              {level === "supervisors" ? "Suivi Évaluations" :
               level === "schools"     ? activeSup?.name :
                                         activeSchool}
            </h1>
            <p className="text-sm text-tx-muted mt-0.5">
              {level === "supervisors" && !loadingL1 &&
                `${superviseurs.length} superviseur${superviseurs.length !== 1 ? "s" : ""} · ${superviseurs.reduce((s, x) => s + x.total, 0).toLocaleString("fr-FR")} évaluations`}
              {level === "schools" && !loadingL2 &&
                `${schools.length} école${schools.length !== 1 ? "s" : ""} · ${new Set(supEvals.map(e => e.eleve_id)).size} élèves · ${supStats.total} évaluations`}
              {level === "students" && schoolStats &&
                `${students.length} élève${students.length !== 1 ? "s" : ""} · ${schoolStats.total} évaluation${schoolStats.total !== 1 ? "s" : ""}`}
              {(loadingL1 || loadingL2) && "Chargement…"}
            </p>
          </div>

          {level !== "supervisors" && (
            <button
              onClick={() => goTo(level === "students" ? "schools" : "supervisors")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              {level === "students" ? "Retour aux écoles" : "Retour aux superviseurs"}
            </button>
          )}
        </div>
      </div>

      {/* ── NIVEAU 1 : Superviseurs ─────────────────────────────────────────── */}
      {level === "supervisors" && (
        loadingL1 ? <Spinner label="Chargement des superviseurs…" /> :
        superviseurs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-alt flex items-center justify-center text-tx-muted mx-auto mb-3">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </div>
              <div className="text-sm font-semibold text-tx mb-1">Aucun superviseur</div>
              <div className="text-xs text-tx-muted max-w-[260px]">Les superviseurs apparaîtront ici une fois des évaluations soumises.</div>
            </div>
          </div>
        ) : (
          <>
            <SearchBar
              value={searchL1}
              onChange={setSearchL1}
              placeholder="Rechercher un superviseur…"
              total={superviseurs.length}
              filtered={filteredSuperviseurs.length}
            />
            {filteredSuperviseurs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="text-sm font-semibold text-tx mb-1">Aucun résultat</div>
                  <div className="text-xs text-tx-muted">Aucun superviseur ne correspond à "{searchL1}".</div>
                </div>
              </div>
            ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuperviseurs.map(sup => (
              <button
                key={sup.id}
                onClick={() => handleSupClick(sup)}
                className="bg-surface border border-border rounded-2xl p-5 text-left hover:border-brand/40 hover:shadow-sm transition-all group focus:outline-none"
              >
                {/* Avatar + nom */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-brand-soft text-brand flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {initials(sup.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-tx truncate">{sup.name}</div>
                    <div className="text-xs text-tx-muted mt-0.5">Superviseur</div>
                  </div>
                  <ChevronRight className="text-tx-muted group-hover:text-brand transition-colors flex-shrink-0" />
                </div>

                {/* Compteur */}
                <div className="text-3xl font-bold text-tx tracking-tight">{sup.total.toLocaleString("fr-FR")}</div>
                <div className="text-xs text-tx-muted mt-0.5 mb-3">évaluation{sup.total !== 1 ? "s" : ""}</div>

                {/* Barre placeholder (on n'a que le total à ce stade) */}
                <div className="h-1.5 rounded-full overflow-hidden bg-border">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: sup.total > 0 ? "100%" : "0%" }}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-tx-muted">Voir les écoles supervisées</span>
                  <span className="text-xs font-semibold text-brand group-hover:underline">Ouvrir →</span>
                </div>
              </button>
            ))}
          </div>
            )}
          </>
        )
      )}

      {/* ── NIVEAU 2 : Écoles du superviseur ───────────────────────────────── */}
      {level === "schools" && (
        loadingL2 ? <Spinner label="Chargement des écoles…" /> :
        schools.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-semibold text-tx mb-1">Aucune école</div>
              <div className="text-xs text-tx-muted">Ce superviseur n'a pas encore soumis d'évaluations.</div>
            </div>
          </div>
        ) : (
          <>
            <SearchBar
              value={searchL2}
              onChange={setSearchL2}
              placeholder="Rechercher une école…"
              total={schools.length}
              filtered={filteredSchools.length}
            />
            {filteredSchools.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="text-sm font-semibold text-tx mb-1">Aucun résultat</div>
                  <div className="text-xs text-tx-muted">Aucune école ne correspond à "{searchL2}".</div>
                </div>
              </div>
            ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchools.map(school => (
              <button
                key={school.name}
                onClick={() => { setActiveSchool(school.name); setLevel("students"); }}
                className="bg-surface border border-border rounded-2xl p-5 text-left hover:border-brand/40 hover:shadow-sm transition-all group focus:outline-none"
              >
                {/* Icône école */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center text-tx-muted flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  </div>
                  <ChevronRight className="text-tx-muted group-hover:text-brand transition-colors flex-shrink-0 mt-1" />
                </div>

                <div className="text-sm font-bold text-tx leading-snug mb-1">{school.name}</div>
                <div className="text-xs text-tx-muted">
                  {school.nbEleves} élève{school.nbEleves !== 1 ? "s" : ""} · {school.total} évaluation{school.total !== 1 ? "s" : ""}
                </div>

                <StatBar acquis={school.acquis} en_cours={school.en_cours} a_aider={school.a_aider} total={school.total} />

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-tx-muted">Voir les élèves</span>
                  <span className="text-xs font-semibold text-brand group-hover:underline">Ouvrir →</span>
                </div>
              </button>
            ))}
          </div>
            )}
          </>
        )
      )}

      {/* ── NIVEAU 3 : Élèves de l'école ───────────────────────────────────── */}
      {level === "students" && (
        students.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-sm font-semibold text-tx mb-1">Aucun élève</div>
              <div className="text-xs text-tx-muted">Aucune évaluation enregistrée pour cette école.</div>
            </div>
          </div>
        ) : (
          <>
            <SearchBar
              value={searchL3}
              onChange={setSearchL3}
              placeholder="Rechercher un élève ou une compétence…"
              total={students.length}
              filtered={filteredStudents.length}
            />
            {filteredStudents.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="text-sm font-semibold text-tx mb-1">Aucun résultat</div>
                  <div className="text-xs text-tx-muted">Aucun élève ni compétence ne correspond à "{searchL3}".</div>
                </div>
              </div>
            ) : (
          <div className="flex flex-col gap-3">
            {filteredStudents.map(student => {
              const stats = computeStats(student.evals);
              const ini   = initials(student.eleve);
              return (
                <div key={student.id} className="bg-surface border border-border rounded-2xl overflow-hidden">

                  {/* En-tête élève */}
                  <div className="flex items-center gap-3 px-5 py-4 bg-surface-alt border-b border-border">
                    <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {ini}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-tx">{student.eleve}</div>
                      {student.classe && (
                        <div className="text-xs text-tx-muted mt-0.5">{student.classe}</div>
                      )}
                    </div>
                    {/* Badges résumé */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {stats.acquis   > 0 && <span className="text-xs font-semibold text-success bg-success-soft px-2 py-0.5 rounded-full">{stats.acquis} acquis</span>}
                      {stats.en_cours > 0 && <span className="text-xs font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-full">{stats.en_cours} en cours</span>}
                      {stats.a_aider  > 0 && <span className="text-xs font-semibold text-warn bg-warn-soft px-2 py-0.5 rounded-full">{stats.a_aider} à aider</span>}
                    </div>
                  </div>

                  {/* Liste des évaluations de cet élève */}
                  <div className="divide-y divide-border">
                    {student.evals
                      .slice()
                      .sort((a, b) => new Date(b.date_eval).getTime() - new Date(a.date_eval).getTime())
                      .map(ev => {
                        const cfg = RESULTAT_CFG[ev.resultat];
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setDetail(ev)}
                            className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-surface-alt transition-colors border-l-4 ${cfg?.rowAccent ?? "border-l-border"}`}
                          >
                            {/* Icône résultat */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg?.avatarCls ?? "bg-surface-alt text-tx-muted"}`}>
                              <KpiIcon name={cfg?.icon ?? "check"} size={13} />
                            </div>

                            {/* Compétence + commentaire */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-tx leading-snug">{competenceLabel(ev.competence)}</div>
                              {ev.commentaire && (
                                <div className="text-xs text-tx-muted mt-0.5 italic truncate">"{ev.commentaire}"</div>
                              )}
                            </div>

                            {/* Badge + date */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <ResultatBadge resultat={ev.resultat} />
                              <span className="text-[11px] text-tx-muted whitespace-nowrap hidden sm:block">
                                {fmtDate(ev.date_eval)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
            )}
          </>
        )
      )}

      {/* ── Modal détail évaluation ────────────────────────────────────────────── */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {(() => {
              const cfg = RESULTAT_CFG[detail.resultat];
              return (
                <>
                  {/* Header */}
                  <div className={`px-6 pt-6 pb-5 ${cfg?.kpiBg ?? "bg-surface-alt"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg?.avatarCls ?? "bg-surface text-tx-muted"} border-2 border-white/60 shadow-sm`}>
                          {initials(detail.eleve)}
                        </div>
                        <div>
                          <div className="text-base font-bold text-tx">{detail.eleve}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {detail.classe     && <span className="text-xs font-medium text-tx-muted bg-white/70 px-2 py-0.5 rounded-md">{detail.classe}</span>}
                            {detail.school_name && <span className="text-xs text-tx-muted">{detail.school_name}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setDetail(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/60 text-tx-muted transition-colors flex-shrink-0"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <ResultatBadge resultat={detail.resultat} />
                      <span className="text-xs text-tx-muted">{fmtDate(detail.date_eval)}</span>
                    </div>
                  </div>

                  {/* Corps */}
                  <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1.5">Compétence évaluée</div>
                      <p className="text-sm font-medium text-tx bg-surface-alt rounded-xl px-4 py-3 leading-relaxed">{competenceLabel(detail.competence)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-alt rounded-xl px-4 py-3">
                        <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1">Superviseur</div>
                        <div className="text-sm font-medium text-tx">{detail.superviseur}</div>
                      </div>
                      <div className="bg-surface-alt rounded-xl px-4 py-3">
                        <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1">Date</div>
                        <div className="text-sm font-medium text-tx">{fmtDate(detail.date_eval)}</div>
                      </div>
                      {detail.school_name && (
                        <div className="bg-surface-alt rounded-xl px-4 py-3">
                          <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1">École</div>
                          <div className="text-sm font-medium text-tx">{detail.school_name}</div>
                        </div>
                      )}
                      {detail.classe && (
                        <div className="bg-surface-alt rounded-xl px-4 py-3">
                          <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1">Classe</div>
                          <div className="text-sm font-medium text-tx">{detail.classe}</div>
                        </div>
                      )}
                    </div>
                    {detail.commentaire && (
                      <div>
                        <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1.5">Commentaire du superviseur</div>
                        <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3 leading-relaxed italic">"{detail.commentaire}"</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-border flex justify-end">
                    <button onClick={() => setDetail(null)} className="px-5 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors">
                      Fermer
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
