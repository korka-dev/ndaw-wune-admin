"use client";

import { useEffect, useState, useCallback } from "react";
import { auditLogsApi } from "@/lib/api";

type AuditLog = {
  id: string;
  user_name: string;
  user_role: string;
  action: "create" | "update" | "delete";
  entity: string;
  method: string;
  path: string;
  description: string;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
};

const ACTION_STYLES: Record<string, string> = {
  create: "bg-success-soft text-success",
  update: "bg-brand-soft text-brand",
  delete: "bg-danger-soft text-danger",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  coordonnateur: "Coordonnateur",
};

const PAGE_SIZE = 30;

export default function HistoriqueModificationsPage() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [skip, setSkip]       = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const { data } = await auditLogsApi.list({ skip: offset, limit: PAGE_SIZE });
      setLogs(data.items);
      setTotal(data.total);
      setSkip(offset);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(0); }, [fetchLogs]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const hasPrev = skip > 0;
  const hasNext = skip + PAGE_SIZE < total;

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-tx mb-0.5">Historique des modifications</h1>
        <p className="text-tx-muted text-sm">
          Journal de toutes les actions de création, modification et suppression effectuées sur la plateforme.
        </p>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm font-medium">Aucune modification enregistrée pour l'instant</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
              {total} action{total > 1 ? "s" : ""}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-tx-muted uppercase tracking-wide border-b border-border">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Utilisateur</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Ressource</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3 text-tx-muted whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-tx">{log.user_name}</div>
                    <div className="text-xs text-tx-muted">{ROLE_LABELS[log.user_role] ?? log.user_role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${ACTION_STYLES[log.action] ?? "bg-surface-alt text-tx-muted"}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-tx">{log.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-tx-muted">
              {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} sur {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(Math.max(0, skip - PAGE_SIZE))}
                disabled={!hasPrev}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-tx disabled:opacity-40 hover:bg-surface-alt transition-colors"
              >
                Précédent
              </button>
              <button
                onClick={() => fetchLogs(skip + PAGE_SIZE)}
                disabled={!hasNext}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-tx disabled:opacity-40 hover:bg-surface-alt transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
