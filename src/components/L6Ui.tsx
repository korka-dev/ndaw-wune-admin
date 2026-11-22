"use client";
/**
 * Éléments d'interface partagés par les pages du lot L6 : sélecteurs de
 * campagne et d'école, cartes de chiffres, tableau simple et encart
 * « non calculable » (une valeur absente n'est jamais affichée comme 0).
 */
import { useEffect, useState, type ReactNode } from "react";
import { schoolsApi, sessionsApi } from "@/lib/api";

export const champ = "w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-tx";
export const etiquette = "block text-[11px] font-semibold text-tx-muted uppercase tracking-wide mb-1";
export const bouton = "px-3 py-2 rounded-lg border border-border text-xs font-semibold text-tx hover:bg-surface-alt disabled:opacity-50";
export const boutonPrincipal = "px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold disabled:opacity-50";

type Option = { id: string; name: string; status?: string };

export function useCampagnes(): Option[] {
  const [s, setS] = useState<Option[]>([]);
  useEffect(() => { sessionsApi.list({ limit: 1000 }).then(r => setS(r.data.items ?? [])).catch(() => {}); }, []);
  return s;
}

export function useEcoles(): Option[] {
  const [s, setS] = useState<Option[]>([]);
  useEffect(() => { schoolsApi.list({ limit: 10000 }).then(r => setS(r.data.items ?? [])).catch(() => {}); }, []);
  return s;
}

/** Sélecteur de campagne ; choisit la campagne active si aucune valeur. */
export function CampagneSelect({ value, onChange, toutes = false }: { value?: string; onChange: (v?: string) => void; toutes?: boolean }) {
  const campagnes = useCampagnes();
  useEffect(() => {
    if (!value && !toutes && campagnes.length) {
      const a = campagnes.find(c => c.status === "active") ?? campagnes[0];
      if (a) onChange(a.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campagnes]);
  return (
    <select className={champ} value={value ?? ""} onChange={e => onChange(e.target.value || undefined)}>
      {toutes && <option value="">Toutes les campagnes</option>}
      {campagnes.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === "active" ? " (active)" : ""}</option>)}
    </select>
  );
}

export function EcoleSelect({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const ecoles = useEcoles();
  return (
    <select className={champ} value={value ?? ""} onChange={e => onChange(e.target.value || undefined)}>
      <option value="">Toutes les écoles</option>
      {ecoles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

export function Chiffre({ libelle, valeur, unite, ton }: { libelle: string; valeur: ReactNode; unite?: string; ton?: "alerte" | "ok" }) {
  const couleur = ton === "alerte" ? "text-danger" : ton === "ok" ? "text-success" : "text-tx";
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <p className="text-[11px] font-semibold text-tx-muted uppercase tracking-wide">{libelle}</p>
      <p className={`mt-1 text-2xl font-bold ${couleur}`}>{valeur ?? "—"}</p>
      {unite && <p className="text-[11px] text-tx-muted">{unite}</p>}
    </div>
  );
}

export function NonCalculable({ raison }: { raison?: string }) {
  return (
    <div className="bg-surface border border-dashed border-border rounded-2xl p-5 text-sm">
      <p className="font-semibold text-tx">Non calculable avec les données actuelles</p>
      <p className="mt-1 text-tx-muted">{raison}</p>
    </div>
  );
}

export type Colonne<T> = { cle: string; titre: string; rendu?: (l: T) => ReactNode; className?: string };

export function Tableau<T extends Record<string, any>>({ colonnes, lignes, vide = "Aucune ligne.", onClic }:
  { colonnes: Colonne<T>[]; lignes: T[]; vide?: string; onClic?: (l: T) => void }) {
  if (!lignes.length) return <p className="text-sm text-tx-muted p-4">{vide}</p>;
  return (
    <div className="overflow-x-auto bg-surface border border-border rounded-2xl">
      <table className="w-full text-sm">
        <thead className="bg-surface-alt text-[11px] uppercase tracking-wide text-tx-muted">
          <tr>{colonnes.map(c => <th key={c.cle} className={`px-3 py-2 text-left font-semibold ${c.className ?? ""}`}>{c.titre}</th>)}</tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={(l.id ?? l.acteur_id ?? l.eleve_id ?? l.teacher_id ?? i) + String(l.objet ?? "")}
                className={`border-t border-border ${onClic ? "cursor-pointer hover:bg-surface-alt" : ""}`}
                onClick={onClic ? () => onClic(l) : undefined}>
              {colonnes.map(c => (
                <td key={c.cle} className={`px-3 py-2 align-top ${c.className ?? ""}`}>
                  {c.rendu ? c.rendu(l) : l[c.cle] === null || l[c.cle] === undefined ? "—" : String(l[c.cle])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children, ton = "neutre" }: { children: ReactNode; ton?: "neutre" | "alerte" | "ok" | "info" }) {
  const c = { neutre: "bg-surface-alt text-tx-muted", alerte: "bg-danger-soft text-danger", ok: "bg-success-soft text-success",
              info: "bg-brand-soft text-brand-dark" }[ton];
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${c}`}>{children}</span>;
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateHeure = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function Modale({ titre, onFermer, children, large }: { titre: string; onFermer: () => void; children: ReactNode; large?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-6" onClick={onFermer}>
      <div className={`bg-surface rounded-2xl shadow-xl w-full ${large ? "max-w-4xl" : "max-w-xl"} p-5`} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-tx">{titre}</h2>
          <button onClick={onFermer} className="text-tx-muted hover:text-tx text-xl leading-none" aria-label="Fermer">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
