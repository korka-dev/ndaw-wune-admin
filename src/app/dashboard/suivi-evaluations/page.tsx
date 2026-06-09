"use client";
import { useEffect, useState, useCallback } from "react";
import { suiviEvaluationsApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

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

const RESULTATS = [
  { key: "",         label: "Tous",     short: "Tous"     },
  { key: "acquis",   label: "Acquis",   short: "Acquis"   },
  { key: "en_cours", label: "En cours", short: "En cours" },
  { key: "a_aider",  label: "À aider",  short: "À aider"  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const RESULTAT_CFG: Record<string, {
  label: string;
  badgeCls: string;
  rowAccent: string;
  avatarCls: string;
  kpiRing: string;
  kpiText: string;
  kpiBg: string;
  icon: "check" | "clock" | "alert";
}> = {
  acquis: {
    label:      "Acquis",
    badgeCls:   "bg-success-soft text-success",
    rowAccent:  "border-l-success",
    avatarCls:  "bg-success-soft text-success",
    kpiRing:    "border-success/30",
    kpiText:    "text-success",
    kpiBg:      "bg-success-soft",
    icon:       "check",
  },
  en_cours: {
    label:      "En cours",
    badgeCls:   "bg-brand-soft text-brand",
    rowAccent:  "border-l-brand",
    avatarCls:  "bg-brand-soft text-brand",
    kpiRing:    "border-brand/30",
    kpiText:    "text-brand",
    kpiBg:      "bg-brand-soft",
    icon:       "clock",
  },
  a_aider: {
    label:      "À aider",
    badgeCls:   "bg-warn-soft text-warn",
    rowAccent:  "border-l-warn",
    avatarCls:  "bg-warn-soft text-warn",
    kpiRing:    "border-warn/30",
    kpiText:    "text-warn",
    kpiBg:      "bg-warn-soft",
    icon:       "alert",
  },
};

function KpiIcon({ name, size = 16 }: { name: "check" | "clock" | "alert"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "check")  return <svg {...p}><path d="M20 6L9 17l-5-5"/></svg>;
  if (name === "clock")  return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SuiviEvaluationsPage() {
  const [items,    setItems]    = useState<EvaluationItem[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);

  // Compteurs globaux par résultat (requêtes légères indépendantes)
  const [kpiCounts, setKpiCounts] = useState<Record<string, number>>({});
  const [kpiLoaded, setKpiLoaded] = useState(false);

  const [superviseurs, setSuperviseurs] = useState<SuperviseurOption[]>([]);

  // Filtres
  const [search,       setSearch]       = useState("");
  const [superviseurId, setSuperviseurId] = useState("");
  const [resultat,     setResultat]     = useState<typeof RESULTATS[number]["key"]>("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  // Détail
  const [detail, setDetail] = useState<EvaluationItem | null>(null);

  // ── Chargement des superviseurs + KPI globaux ──
  useEffect(() => {
    suiviEvaluationsApi.superviseurs()
      .then(({ data }) => setSuperviseurs(data ?? []))
      .catch(() => {});

    // 3 requêtes légères (limit=1) pour les compteurs globaux
    Promise.all([
      suiviEvaluationsApi.list({ resultat: "acquis",   limit: 1, skip: 0 }),
      suiviEvaluationsApi.list({ resultat: "en_cours", limit: 1, skip: 0 }),
      suiviEvaluationsApi.list({ resultat: "a_aider",  limit: 1, skip: 0 }),
    ]).then(([r1, r2, r3]) => {
      setKpiCounts({
        acquis:   r1.data.total ?? 0,
        en_cours: r2.data.total ?? 0,
        a_aider:  r3.data.total ?? 0,
      });
      setKpiLoaded(true);
    }).catch(() => { setKpiLoaded(true); });
  }, []);

  // ── Chargement de la liste filtrée ──
  const fetchItems = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE };
      if (search.trim())  params.search        = search.trim();
      if (superviseurId)  params.superviseur_id = superviseurId;
      if (resultat)       params.resultat       = resultat;
      if (dateFrom)       params.date_from      = dateFrom;
      if (dateTo)         params.date_to        = dateTo;

      const res = await suiviEvaluationsApi.list(params);
      setItems(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, superviseurId, resultat, dateFrom, dateTo]);

  useEffect(() => { fetchItems(page); },               [fetchItems, page]);
  useEffect(() => { setPage(1); },                     [search, superviseurId, resultat, dateFrom, dateTo]);

  const hasFilters   = !!(search || superviseurId || resultat || dateFrom || dateTo);
  const kpiTotal     = (kpiCounts.acquis ?? 0) + (kpiCounts.en_cours ?? 0) + (kpiCounts.a_aider ?? 0);
  const pct          = (n: number) => kpiTotal > 0 ? Math.round((n / kpiTotal) * 100) : 0;

  // ── KPI Cards ──────────────────────────────────────────────────────────────
  const KPI_DEF = [
    { key: "acquis",   label: "Acquis",   sub: "Compétence maîtrisée" },
    { key: "en_cours", label: "En cours", sub: "En progression"       },
    { key: "a_aider",  label: "À aider",  sub: "Besoin d'appui"       },
  ];

  return (
    <div className="flex flex-col min-h-full px-7 pb-8">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-5 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Suivi Évaluations</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {loading
              ? "Chargement…"
              : hasFilters
                ? `${total} résultat${total !== 1 ? "s" : ""} pour les filtres actifs`
                : `${kpiLoaded ? kpiTotal : "…"} évaluation${kpiTotal !== 1 ? "s" : ""} au total`}
          </p>
        </div>
      </div>

      {/* ── Cartes KPI ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {KPI_DEF.map(({ key, label, sub }) => {
          const cfg   = RESULTAT_CFG[key];
          const count = kpiCounts[key] ?? 0;
          const p     = pct(count);
          return (
            <button
              key={key}
              onClick={() => setResultat(resultat === key ? "" : key as typeof resultat)}
              className={`rounded-2xl border-2 p-5 text-left transition-all cursor-pointer focus:outline-none group ${
                resultat === key
                  ? `${cfg.kpiBg} ${cfg.kpiRing} border-opacity-100 shadow-sm`
                  : "bg-surface border-border hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className={`text-3xl font-bold tracking-tight ${cfg.kpiText}`}>
                    {kpiLoaded ? count.toLocaleString("fr-FR") : <span className="text-xl text-tx-muted">…</span>}
                  </div>
                  <div className="text-sm font-semibold text-tx mt-0.5">{label}</div>
                  <div className="text-xs text-tx-muted mt-0.5">{sub}</div>
                </div>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.kpiBg} ${cfg.kpiText}`}>
                  <KpiIcon name={cfg.icon} size={20} />
                </span>
              </div>
              {/* Barre de progression */}
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    key === "acquis"   ? "bg-success"  :
                    key === "en_cours" ? "bg-brand"    : "bg-warn"
                  }`}
                  style={{ width: kpiLoaded ? `${p}%` : "0%" }}
                />
              </div>
              <div className={`text-xs mt-1.5 font-medium ${cfg.kpiText}`}>
                {kpiLoaded ? `${p}%` : "—"}
                <span className="text-tx-muted font-normal ml-1">du total</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">

          {/* Résultat quick-filter (répété ici comme tabs texte) */}
          <div className="flex items-center gap-1 bg-surface-alt border border-border rounded-xl p-1 flex-shrink-0">
            {RESULTATS.map(opt => (
              <button
                key={opt.key || "all"}
                onClick={() => setResultat(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  resultat === opt.key
                    ? opt.key === ""        ? "bg-tx text-white"
                    : opt.key === "acquis"   ? "bg-success text-white"
                    : opt.key === "en_cours" ? "bg-brand text-white"
                    :                         "bg-warn text-white"
                    : "text-tx-muted hover:text-tx hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Superviseur */}
          <select
            value={superviseurId} onChange={e => setSuperviseurId(e.target.value)}
            className="bg-white border border-border rounded-xl px-3 py-2 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition min-w-[170px]"
          >
            <option value="">Tous les superviseurs</option>
            {superviseurs.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Recherche texte */}
          <div className="relative flex-1 min-w-[200px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Élève, compétence, école…"
              className="w-full bg-white border border-border rounded-xl pl-9 pr-8 py-2 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-tx-muted font-medium">Du</span>
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-white border border-border rounded-xl px-3 py-2 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
            />
            <span className="text-xs text-tx-muted font-medium">au</span>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-white border border-border rounded-xl px-3 py-2 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
            />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setSuperviseurId(""); setResultat(""); setDateFrom(""); setDateTo(""); }}
              className="px-3.5 py-2 rounded-xl text-xs text-tx-muted border border-border hover:bg-surface-alt transition-colors flex-shrink-0 flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* ── Liste ────────────────────────────────────────────────────────────── */}
      {/*
        La liste occupe tout l'espace vertical restant (flex-1).
        On utilise un layout flex-col interne pour que :
          • L'en-tête de colonnes reste toujours visible en haut
          • Le corps défile indépendamment (overflow-y-auto)
          • La pagination reste toujours visible en bas
      */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1 flex flex-col min-h-0">

        {/* En-tête de colonnes — fixe */}
        <div className="grid grid-cols-[1fr_2fr_auto_1fr] gap-0 border-b border-border bg-surface-alt px-5 py-3 flex-shrink-0">
          {["Élève & Classe", "Compétence évaluée", "Résultat", "Superviseur & Date"].map((h, i) => (
            <div key={i} className={`text-[11px] font-semibold text-tx-muted uppercase tracking-wider ${i === 2 ? "text-center px-4" : ""}`}>
              {h}
            </div>
          ))}
        </div>

        {/* Corps — défilant */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-tx-muted">Chargement des évaluations…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-alt flex items-center justify-center text-tx-muted">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
              </svg>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-tx mb-1">
                {hasFilters ? "Aucun résultat" : "Aucune évaluation"}
              </div>
              <div className="text-xs text-tx-muted max-w-[280px]">
                {hasFilters
                  ? "Essayez de modifier ou d'effacer vos filtres."
                  : "Les évaluations soumises par les superviseurs apparaîtront ici."}
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setSuperviseurId(""); setResultat(""); setDateFrom(""); setDateTo(""); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-tx-muted border border-border hover:bg-surface-alt transition-colors"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-border">
              {items.map(it => {
                const cfg = RESULTAT_CFG[it.resultat];
                const ini = initials(it.eleve);
                return (
                  <div
                    key={it.id}
                    onClick={() => setDetail(it)}
                    className={`grid grid-cols-[1fr_2fr_auto_1fr] gap-0 items-center cursor-pointer hover:bg-surface-alt transition-colors border-l-4 ${cfg?.rowAccent ?? "border-l-border"}`}
                  >
                    {/* Colonne 1 : Élève */}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${cfg?.avatarCls ?? "bg-surface-alt text-tx-muted"}`}>
                        {ini}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-tx truncate">{it.eleve}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {it.classe && (
                            <span className="text-[11px] font-medium text-tx-muted bg-surface-alt px-1.5 py-0.5 rounded-md">
                              {it.classe}
                            </span>
                          )}
                          {it.school_name && (
                            <span className="text-[11px] text-tx-muted truncate">{it.school_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Colonne 2 : Compétence */}
                    <div className="px-4 py-3.5">
                      <div className="text-sm text-tx leading-snug line-clamp-2">{it.competence}</div>
                      {it.commentaire && (
                        <div className="text-xs text-tx-muted mt-1 line-clamp-1 italic">
                          "{it.commentaire}"
                        </div>
                      )}
                    </div>

                    {/* Colonne 3 : Résultat */}
                    <div className="px-4 py-3.5 flex items-center justify-center">
                      <ResultatBadge resultat={it.resultat} />
                    </div>

                    {/* Colonne 4 : Superviseur + date */}
                    <div className="px-4 py-3.5 text-right">
                      <div className="text-sm font-medium text-tx truncate">{it.superviseur}</div>
                      <div className="text-[11px] text-tx-muted mt-0.5">{fmtDate(it.date_eval)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination — fixe en bas */}
        {!loading && total > 0 && (
          <div className="border-t border-border px-5 flex items-center justify-between flex-shrink-0 bg-surface">
            <span className="text-xs text-tx-muted py-3">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total.toLocaleString("fr-FR")} résultat{total !== 1 ? "s" : ""}
            </span>
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Modal détail ──────────────────────────────────────────────────────── */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header modal */}
            {(() => {
              const cfg = RESULTAT_CFG[detail.resultat];
              const ini = initials(detail.eleve);
              return (
                <div className={`px-6 pt-6 pb-5 ${cfg?.kpiBg ?? "bg-surface-alt"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${cfg?.avatarCls ?? "bg-surface text-tx-muted"} border-2 border-white/60 shadow-sm`}>
                        {ini}
                      </div>
                      <div>
                        <div className="text-base font-bold text-tx">{detail.eleve}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {detail.classe && (
                            <span className="text-xs font-medium text-tx-muted bg-white/70 px-2 py-0.5 rounded-md">
                              {detail.classe}
                            </span>
                          )}
                          {detail.school_name && (
                            <span className="text-xs text-tx-muted">{detail.school_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetail(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/60 text-tx-muted transition-colors flex-shrink-0"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Badge résultat mis en avant */}
                  <div className="flex items-center gap-3 mt-4">
                    <ResultatBadge resultat={detail.resultat} />
                    <span className="text-xs text-tx-muted">{fmtDate(detail.date_eval)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Corps modal */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">

              {/* Compétence — en valeur principale */}
              <div>
                <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1.5">Compétence évaluée</div>
                <p className="text-sm font-medium text-tx bg-surface-alt rounded-xl px-4 py-3 leading-relaxed">
                  {detail.competence}
                </p>
              </div>

              {/* Grille infos */}
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

              {/* Commentaire */}
              {detail.commentaire && (
                <div>
                  <div className="text-[10px] font-semibold text-tx-muted uppercase tracking-widest mb-1.5">Commentaire du superviseur</div>
                  <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3 leading-relaxed italic">
                    "{detail.commentaire}"
                  </p>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button
                onClick={() => setDetail(null)}
                className="px-5 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
