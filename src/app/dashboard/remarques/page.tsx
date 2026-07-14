"use client";
import { useEffect, useState } from "react";
import { remarquesApi } from "@/lib/api";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 50;

const CATEGORIE_LABELS: Record<string, string> = {
  materiel: "Matériel",
  local: "Local / salle",
  eleves: "Élèves",
  securite: "Sécurité",
  autre: "Autre",
};

const ROLE_LABELS: Record<string, string> = {
  enseignant: "Tuteur",
  superviseur: "Superviseur",
};

interface RemarqueItem {
  id: string;
  user_name: string;
  user_role: string;
  ecole?: string | null;
  categorie: string;
  message: string;
  statut: string;
  created_at: string;
}

export default function RemarquesPage() {
  const [items, setItems] = useState<RemarqueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [detail, setDetail] = useState<RemarqueItem | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = (p = page) => {
    remarquesApi
      .list({
        categorie: filterCategorie || undefined,
        statut: filterStatut || undefined,
        skip: (p - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      .then(r => { setItems(r.data.items ?? []); setTotal(r.data.total ?? 0); })
      .catch(() => {});
  };

  useEffect(() => { setPage(1); load(1); }, [filterCategorie, filterStatut]);
  useEffect(() => { load(page); }, [page]);

  const toggleStatut = async (r: RemarqueItem) => {
    setUpdating(true);
    try {
      await remarquesApi.setStatus(r.id, r.statut === "traite" ? "nouveau" : "traite");
      load();
      setDetail(null);
    } finally { setUpdating(false); }
  };

  return (
    <div className="flex flex-col min-h-full px-7 pb-7">
      {/* En-tête */}
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Remarques utilisateurs</h1>
          <p className="text-tx-muted text-sm mt-0.5">
            Problèmes signalés depuis l'app mobile (hors application : matériel, local…)
            <span className="ml-2 text-brand font-medium">· {total} remarque{total !== 1 ? "s" : ""}</span>
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-4">
        <select value={filterCategorie} onChange={e => setFilterCategorie(e.target.value)}
          className={`px-3 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none appearance-none min-w-[160px] ${filterCategorie ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className={`px-3 pr-8 py-2.5 border rounded-xl text-sm bg-surface cursor-pointer focus:outline-none appearance-none min-w-[140px] ${filterStatut ? "border-brand text-brand font-medium" : "border-border text-tx"}`}>
          <option value="">Tous les statuts</option>
          <option value="nouveau">Nouveau</option>
          <option value="traite">Traité</option>
        </select>
        {(filterCategorie || filterStatut) && (
          <button onClick={() => { setFilterCategorie(""); setFilterStatut(""); }}
            className="px-3 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-sm font-medium hover:bg-brand hover:text-white transition-colors">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Utilisateur", "École", "Catégorie", "Message", "Statut", "Date", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-tx-muted">Aucune remarque.</td></tr>
            ) : items.map((r, i) => (
              <tr key={r.id} className={`border-t border-border hover:bg-surface-alt transition-colors ${i % 2 !== 0 ? "bg-surface-alt/40" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-tx">{r.user_name}</div>
                  <div className="text-[11px] text-tx-muted">{ROLE_LABELS[r.user_role] ?? r.user_role}</div>
                </td>
                <td className="px-4 py-3 text-tx-muted">{r.ecole ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warn-soft text-warn">
                    {CATEGORIE_LABELS[r.categorie] ?? r.categorie}
                  </span>
                </td>
                <td className="px-4 py-3 text-tx max-w-[320px]">
                  <span className="line-clamp-2">{r.message}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.statut === "traite" ? "bg-success-soft text-success" : "bg-primary-soft text-primary"}`}>
                    {r.statut === "traite" ? "Traité" : "Nouveau"}
                  </span>
                </td>
                <td className="px-4 py-3 text-tx-muted font-mono text-xs whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setDetail(r)}
                    className="text-xs bg-primary-soft text-primary px-2.5 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 pb-4 border-t border-border">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* Modal détail */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-tx">Remarque</h2>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${detail.statut === "traite" ? "bg-success-soft text-success" : "bg-primary-soft text-primary"}`}>
                {detail.statut === "traite" ? "Traité" : "Nouveau"}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[11px] text-tx-muted">Utilisateur</div>
                <div className="font-medium text-tx">{detail.user_name} <span className="text-tx-muted">({ROLE_LABELS[detail.user_role] ?? detail.user_role})</span></div>
              </div>
              <div>
                <div className="text-[11px] text-tx-muted">École</div>
                <div className="font-medium text-tx">{detail.ecole ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-tx-muted">Catégorie</div>
                <div className="font-medium text-tx">{CATEGORIE_LABELS[detail.categorie] ?? detail.categorie}</div>
              </div>
              <div>
                <div className="text-[11px] text-tx-muted">Date</div>
                <div className="font-medium text-tx">{new Date(detail.created_at).toLocaleString("fr-FR")}</div>
              </div>
              <div>
                <div className="text-[11px] text-tx-muted mb-1">Message</div>
                <div className="bg-surface-alt rounded-xl px-4 py-3 text-tx whitespace-pre-wrap">{detail.message}</div>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">
                Fermer
              </button>
              <button onClick={() => toggleStatut(detail)} disabled={updating}
                className={`px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-colors ${detail.statut === "traite" ? "bg-primary hover:opacity-90" : "bg-success hover:opacity-90"}`}>
                {updating ? "En cours…" : detail.statut === "traite" ? "Marquer comme nouveau" : "Marquer comme traité"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
