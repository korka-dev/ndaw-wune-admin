"use client";

import { useEffect, useState, useCallback } from "react";
import { remplacementsApi } from "@/lib/api";

type EleveRemplacement = {
  id: string;
  ancien_eleve_nom: string | null;
  nouveau_eleve_nom: string;
  motif: string;
  teacher_id: string;
  teacher_name: string | null;
  school_id: string | null;
  school_name: string | null;
  school_commune: string | null;
  classe: string;
  date_remplacement: string;
  statut?: "applique" | "en_attente" | "refuse";
  motif_refus?: string | null;
};

const STATUTS: Record<string, string> = { applique: "Appliqué", en_attente: "À valider", refuse: "Refusé" };

const PAGE_SIZE = 30;

export default function RemplacementsPage() {
  const [items, setItems] = useState<EleveRemplacement[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statut, setStatut] = useState<string>("");
  const [erreur, setErreur] = useState<string | null>(null);

  const fetchItems = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const { data } = await remplacementsApi.list({ skip: offset, limit: PAGE_SIZE, ...(statut ? { statut } : {}) });
      setItems(data.items);
      setTotal(data.total);
      setSkip(offset);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, [statut]);

  useEffect(() => { fetchItems(0); }, [fetchItems]);

  const decider = async (r: EleveRemplacement, decision: "valider" | "refuser") => {
    let motif: string | undefined;
    if (decision === "refuser") {
      const m = window.prompt("Motif du refus (visible par le tuteur) :");
      if (!m || !m.trim()) return;
      motif = m.trim();
    } else if (!window.confirm(`Valider le remplacement de ${r.ancien_eleve_nom ?? "?"} par ${r.nouveau_eleve_nom} ?`)) return;
    setErreur(null);
    try { await remplacementsApi.decider(r.id, { decision, motif }); await fetchItems(skip); }
    catch (e: any) { setErreur(e?.response?.data?.detail ?? "Décision refusée par le serveur."); }
  };

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
          Quand ARED exige une validation, les demandes « À valider » attendent une décision ici ou du superviseur.
        </p>
        <div className="flex gap-2 mt-3">
          {[["", "Tous"], ["en_attente", "À valider"], ["applique", "Appliqués"], ["refuse", "Refusés"]].map(([k, l]) => (
            <button key={k} onClick={() => setStatut(k)}
              className={`px-3 py-1.5 rounded-lg border border-border text-xs font-semibold ${statut === k ? "bg-surface-alt text-tx" : "text-tx-muted"}`}>{l}</button>
          ))}
        </div>
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
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

          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1050px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-tx-muted uppercase tracking-wide border-b border-border">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Commune</th>
                <th className="px-4 py-2.5">École</th>
                <th className="px-4 py-2.5">Tuteur</th>
                <th className="px-4 py-2.5">Classe</th>
                <th className="px-4 py-2.5">Ancien élève</th>
                <th className="px-4 py-2.5">Nouvel élève</th>
                <th className="px-4 py-2.5">Motif</th>
                <th className="px-4 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3 text-tx-muted whitespace-nowrap">{formatDate(r.date_remplacement)}</td>
                  <td className="px-4 py-3 text-tx-muted">{r.school_commune ?? "—"}</td>
                  <td className="px-4 py-3 text-tx" title={r.school_name ?? undefined}>{r.school_name ?? "—"}</td>
                  <td className="px-4 py-3 text-tx">{r.teacher_name ?? "—"}</td>
                  <td className="px-4 py-3 text-tx">{r.classe}</td>
                  <td className="px-4 py-3 text-tx-muted">{r.ancien_eleve_nom ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-tx">{r.nouveau_eleve_nom}</td>
                  <td className="px-4 py-3 text-tx-muted max-w-xs truncate" title={r.motif}>{r.motif}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-semibold" title={r.motif_refus ?? undefined}>{STATUTS[r.statut ?? "applique"]}</span>
                    {r.statut === "en_attente" && (
                      <span className="ml-2 inline-flex gap-1">
                        <button onClick={() => decider(r, "valider")} className="px-2 py-1 rounded bg-brand text-white text-xs font-semibold">Valider</button>
                        <button onClick={() => decider(r, "refuser")} className="px-2 py-1 rounded border border-border text-xs font-semibold">Refuser</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

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
