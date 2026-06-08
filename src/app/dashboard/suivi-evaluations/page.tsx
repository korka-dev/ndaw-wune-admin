"use client";
import { useEffect, useState, useCallback } from "react";
import { suiviEvaluationsApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

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
  { key: "",          label: "Tous" },
  { key: "acquis",    label: "Acquis" },
  { key: "en_cours",  label: "En cours" },
  { key: "a_aider",   label: "À aider" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}

function resultatBadge(resultat: string) {
  const cfg: Record<string, { label: string; cls: string }> = {
    acquis:   { label: "Acquis",   cls: "bg-success-soft text-success" },
    en_cours: { label: "En cours", cls: "bg-brand-soft text-brand" },
    a_aider:  { label: "À aider",  cls: "bg-warn-soft text-warn" },
  };
  const c = cfg[resultat] ?? { label: resultat, cls: "bg-surface-alt text-tx-muted" };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>{c.label}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SuiviEvaluationsPage() {
  const [items, setItems] = useState<EvaluationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [superviseurs, setSuperviseurs] = useState<SuperviseurOption[]>([]);

  // Filtres
  const [search, setSearch] = useState("");
  const [superviseurId, setSuperviseurId] = useState("");
  const [resultat, setResultat] = useState<typeof RESULTATS[number]["key"]>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modal détail
  const [detail, setDetail] = useState<EvaluationItem | null>(null);

  useEffect(() => {
    suiviEvaluationsApi.superviseurs().then(({ data }) => setSuperviseurs(data ?? [])).catch(() => {});
  }, []);

  const fetchItems = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        skip: (p - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (search.trim()) params.search = search.trim();
      if (superviseurId) params.superviseur_id = superviseurId;
      if (resultat) params.resultat = resultat;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

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

  useEffect(() => { fetchItems(page); }, [fetchItems, page]);
  useEffect(() => { setPage(1); }, [search, superviseurId, resultat, dateFrom, dateTo]);

  const hasFilters = !!(search || superviseurId || resultat || dateFrom || dateTo);

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">

      {/* ── En-tête sticky ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Suivi Évaluations</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            {loading ? "Chargement…" : `${total} évaluation${total !== 1 ? "s" : ""} au total`}
          </p>
        </div>
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Résultat */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          {RESULTATS.map(opt => (
            <button
              key={opt.key || "all"}
              onClick={() => setResultat(opt.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                resultat === opt.key
                  ? "bg-brand text-white"
                  : "text-tx-muted hover:bg-surface-alt hover:text-tx"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Superviseur */}
        <select
          value={superviseurId} onChange={e => setSuperviseurId(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition min-w-[180px]"
        >
          <option value="">Tous les superviseurs</option>
          {superviseurs.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Recherche texte */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted pointer-events-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Élève, superviseur, compétence…"
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm text-tx placeholder:text-tx-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Date from / to */}
        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
        />
        <input
          type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setSuperviseurId(""); setResultat(""); setDateFrom(""); setDateTo(""); }}
            className="px-4 py-2.5 rounded-xl text-sm text-tx-muted border border-border hover:bg-surface-alt transition-colors"
          >
            Effacer filtres
          </button>
        )}
      </div>

      {/* ── Tableau évaluations ──────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm table-fixed">
          <colgroup><col className="w-[12%]" /><col className="w-[20%]" /><col className="w-[14%]" /><col className="w-[20%]" /><col className="w-[12%]" /><col className="w-[22%]" /></colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Date", "Élève", "Classe", "Compétence", "Résultat", "Superviseur"].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-tx-muted text-sm">Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-tx-muted text-sm">
                {hasFilters ? "Aucune évaluation ne correspond aux filtres." : "Aucune évaluation enregistrée pour l'instant."}
              </td></tr>
            ) : items.map(it => (
              <tr
                key={it.id}
                onClick={() => setDetail(it)}
                className="border-t border-border hover:bg-surface-alt transition-colors cursor-pointer"
              >
                <td className="px-4 py-3.5">
                  <span className="text-tx font-medium text-xs">{fmtDate(it.date_eval)}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-tx font-medium truncate block">{it.eleve}</span>
                  {it.school_name && <span className="text-tx-muted text-xs truncate block">{it.school_name}</span>}
                </td>
                <td className="px-4 py-3.5 text-tx-muted text-xs truncate">{it.classe ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <span className="text-tx truncate block">{it.competence}</span>
                </td>
                <td className="px-4 py-3.5">{resultatBadge(it.resultat)}</td>
                <td className="px-4 py-3.5 text-tx-muted text-xs truncate">{it.superviseur}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && total > 0 && (
          <div className="border-t border-border px-5">
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Modal détail évaluation ─────────────────────────────────────────── */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-tx">{fmtDate(detail.date_eval)}</span>
                  {resultatBadge(detail.resultat)}
                </div>
                <p className="text-sm text-tx-muted mt-0.5">{detail.eleve}{detail.classe ? ` · ${detail.classe}` : ""}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-alt text-tx-muted transition-colors flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Compétence", value: detail.competence },
                  { label: "École", value: detail.school_name },
                  { label: "Superviseur", value: detail.superviseur },
                  { label: "Classe", value: detail.classe },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface-alt rounded-xl px-4 py-3">
                    <div className="text-[11px] text-tx-muted mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-tx">{value || "—"}</div>
                  </div>
                ))}
              </div>
              {detail.commentaire && (
                <div>
                  <h3 className="text-xs font-semibold text-tx-muted uppercase tracking-wide mb-2">Commentaire</h3>
                  <p className="text-sm text-tx bg-surface-alt rounded-xl px-4 py-3">{detail.commentaire}</p>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 border-t border-border pt-4 flex justify-end">
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
