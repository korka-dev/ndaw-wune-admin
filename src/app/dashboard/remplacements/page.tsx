"use client";

import { useEffect, useState, useCallback } from "react";
import { remplacementsApi } from "@/lib/api";

type EleveRemplacement = {
  id: string;
  ancien_eleve_nom: string | null;
  nouveau_eleve_nom: string;
  motif: string;
  teacher_id: string;
  school_id: string | null;
  classe: string;
  date_remplacement: string;
};

const PAGE_SIZE = 30;

export default function RemplacementsPage() {
  const [items, setItems] = useState<EleveRemplacement[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const { data } = await remplacementsApi.list({ skip: offset, limit: PAGE_SIZE });
      setItems(data.items);
      setTotal(data.total);
      setSkip(offset);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(0); }, [fetchItems]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const hasPrev = skip > 0;
  const hasNext = skip + PAGE_SIZE < total;

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-tx mb-0.5">Remplacements élève</h1>
        <p className="text-tx-muted text-sm">
          Historique des remplacements d&apos;élève effectués par les tuteurs depuis l&apos;app mobile.
        </p>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm font-medium">Aucun remplacement enregistré pour l&apos;instant</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
              {total} remplacement{total > 1 ? "s" : ""}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-tx-muted uppercase tracking-wide border-b border-border">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Classe</th>
                <th className="px-4 py-2.5">Ancien élève</th>
                <th className="px-4 py-2.5">Nouvel élève</th>
                <th className="px-4 py-2.5">Motif</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3 text-tx-muted whitespace-nowrap">{formatDate(r.date_remplacement)}</td>
                  <td className="px-4 py-3 text-tx">{r.classe}</td>
                  <td className="px-4 py-3 text-tx-muted">{r.ancien_eleve_nom ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-tx">{r.nouveau_eleve_nom}</td>
                  <td className="px-4 py-3 text-tx-muted max-w-xs truncate" title={r.motif}>{r.motif}</td>
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
                onClick={() => fetchItems(Math.max(0, skip - PAGE_SIZE))}
                disabled={!hasPrev}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-tx disabled:opacity-40 hover:bg-surface-alt transition-colors"
              >
                Précédent
              </button>
              <button
                onClick={() => fetchItems(skip + PAGE_SIZE)}
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
