"use client";
import { useEffect, useState } from "react";
import { usageLogsApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 50;

const FEATURE_LABELS: Record<string, string> = {
  accueil: "Accueil",
  planning: "Planning",
  timer: "Timer",
  rapports: "Rapports",
  rapport_journalier: "Rapport journalier",
  ressources: "Ressources",
  evaluations: "Évaluations",
  presences: "Présences",
  difficultes: "Difficultés",
  remarques: "Remarques",
  profil: "Profil",
};

const ROLE_LABELS: Record<string, string> = {
  enseignant: "Tuteur",
  superviseur: "Superviseur",
};

interface LogItem {
  id: string;
  user_name: string;
  user_role: string;
  feature: string;
  created_at: string;
}

interface Stats {
  total: number;
  by_feature: { feature: string; count: number }[];
  by_role: { user_role: string; feature: string; count: number }[];
}

export default function LogsUtilisationPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterFeature, setFilterFeature] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadStats = () => {
    usageLogsApi
      .stats({ date_from: dateFrom || undefined, date_to: dateTo || undefined })
      .then(r => setStats(r.data))
      .catch(() => {});
  };

  const loadLogs = (p = page) => {
    usageLogsApi
      .list({
        feature: filterFeature || undefined,
        user_role: filterRole || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        skip: (p - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      .then(r => { setLogs(r.data.items ?? []); setTotal(r.data.total ?? 0); })
      .catch(() => {});
  };

  useEffect(() => { loadStats(); }, [dateFrom, dateTo]);
  useEffect(() => { setPage(1); loadLogs(1); }, [filterFeature, filterRole, dateFrom, dateTo]);
  useEffect(() => { loadLogs(page); }, [page]);

  const maxCount = Math.max(1, ...(stats?.by_feature ?? []).map(f => f.count));

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      {/* En-tête */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Logs d'utilisation</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            Fonctionnalités les plus utilisées dans l'application mobile
            {stats && <span className="ml-2 text-brand font-medium">· {stats.total} événements</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-surface text-tx focus:outline-none focus:ring-2 focus:ring-brand/30" />
          <span className="text-tx-muted text-sm">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-surface text-tx focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
      </div>

      {/* Stats par fonctionnalité */}
      <div className="bg-surface rounded-2xl border border-border p-5 mb-6">
        <h2 className="text-sm font-bold text-tx mb-4">Utilisation par fonctionnalité</h2>
        {(!stats || stats.by_feature.length === 0) ? (
          <p className="text-sm text-tx-muted py-6 text-center">Aucune donnée d'utilisation pour l'instant.</p>
        ) : (
          <div className="space-y-2.5">
            {stats.by_feature.map(f => (
              <div key={f.feature} className="flex items-center gap-3">
                <div className="w-40 text-sm text-tx font-medium truncate">
                  {FEATURE_LABELS[f.feature] ?? f.feature}
                </div>
                <div className="flex-1 h-5 bg-surface-alt rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-lg transition-all"
                    style={{ width: `${Math.max(3, (f.count / maxCount) * 100)}%` }}
                  />
                </div>
                <div className="w-14 text-right text-sm font-semibold text-tx">{f.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtres liste */}
      <div className="flex gap-3 mb-4">
        <select value={filterFeature} onChange={e => setFilterFeature(e.target.value)}
          className={`px-3 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none appearance-none min-w-[170px] ${filterFeature ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
          <option value="">Toutes les fonctionnalités</option>
          {Object.entries(FEATURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className={`px-3 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none appearance-none min-w-[150px] ${filterRole ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
          <option value="">Tous les rôles</option>
          <option value="enseignant">Tuteur</option>
          <option value="superviseur">Superviseur</option>
        </select>
        {(filterFeature || filterRole || dateFrom || dateTo) && (
          <button onClick={() => { setFilterFeature(""); setFilterRole(""); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste des événements */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Utilisateur", "Rôle", "Fonctionnalité", "Date"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-tx-muted">Aucun événement.</td></tr>
            ) : logs.map((l, i) => (
              <tr key={l.id} className={`border-t border-border ${i % 2 !== 0 ? "bg-surface-alt/40" : ""}`}>
                <td className="px-5 py-3 font-medium text-tx">{l.user_name}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${l.user_role === "superviseur" ? "bg-primary-soft text-primary" : "bg-brand-soft text-brand"}`}>
                    {ROLE_LABELS[l.user_role] ?? l.user_role}
                  </span>
                </td>
                <td className="px-5 py-3 text-tx">{FEATURE_LABELS[l.feature] ?? l.feature}</td>
                <td className="px-5 py-3 text-tx-muted font-mono text-xs">
                  {new Date(l.created_at).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 pb-4 border-t border-border">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
