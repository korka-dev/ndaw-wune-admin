"use client";

/**
 * Filtres communs aux indicateurs et au centre d'exports (rapport V2, D6.1 / D9.2).
 * Les mêmes filtres produisent le même périmètre côté serveur : un indicateur
 * affiché se recalcule à l'identique depuis l'archive exportée (REC16).
 */
import { useEffect, useState } from "react";
import { schoolsApi, sessionsApi, type AnalytiqueFiltres } from "@/lib/api";

type Option = { id: string; name: string; status?: string };

const STATUTS: { v: NonNullable<AnalytiqueFiltres["statut"]>; l: string }[] = [
  { v: "tous", l: "Tous (annulés inclus, signalés)" },
  { v: "valides", l: "Valides (hors annulés)" },
  { v: "soumis", l: "Soumis non corrigés" },
  { v: "corrige", l: "Corrigés" },
  { v: "annule", l: "Annulés" },
];

/** ISO (UTC) → valeur d'un champ datetime-local à l'heure du poste. */
function versLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const champ ="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-tx";
const etiquette = "block text-[11px] font-semibold text-tx-muted uppercase tracking-wide mb-1";

export default function AnalytiqueFiltresBar({
  value, onChange, avancés = true,
}: { value: AnalytiqueFiltres; onChange: (f: AnalytiqueFiltres) => void; avancés?: boolean }) {
  const [sessions, setSessions] = useState<Option[]>([]);
  const [ecoles, setEcoles] = useState<Option[]>([]);

  useEffect(() => {
    sessionsApi.list({ limit: 1000 }).then(r => {
      const items: Option[] = r.data.items ?? [];
      setSessions(items);
      // Par défaut : la campagne active (jamais un périmètre implicite « tout »).
      if (!value.campagne_id) {
        const active = items.find(s => s.status === "active");
        if (active) onChange({ ...value, campagne_id: active.id });
      }
    }).catch(() => {});
    schoolsApi.list({ limit: 10000 }).then(r => setEcoles(r.data.items ?? [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof AnalytiqueFiltres, v: string) => onChange({ ...value, [k]: v || undefined });

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <label className={etiquette}>Campagne</label>
        <select className={champ} value={value.campagne_id ?? ""} onChange={e => set("campagne_id", e.target.value)}>
          <option value="">Toutes les campagnes</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}{s.status === "active" ? " (active)" : ""}</option>)}
        </select>
      </div>
      <div>
        <label className={etiquette}>Activité du</label>
        <input type="date" className={champ} value={value.date_debut ?? ""} onChange={e => set("date_debut", e.target.value)} />
      </div>
      <div>
        <label className={etiquette}>au</label>
        <input type="date" className={champ} value={value.date_fin ?? ""} onChange={e => set("date_fin", e.target.value)} />
      </div>
      <div>
        <label className={etiquette}>École</label>
        <select className={champ} value={value.ecole_id ?? ""} onChange={e => set("ecole_id", e.target.value)}>
          <option value="">Toutes</option>
          {ecoles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {avancés && (
        <>
          <div>
            <label className={etiquette}>IEF</label>
            <input className={champ} value={value.ief ?? ""} onChange={e => set("ief", e.target.value)} placeholder="ex. Pikine" />
          </div>
          <div>
            <label className={etiquette}>Commune</label>
            <input className={champ} value={value.commune ?? ""} onChange={e => set("commune", e.target.value)} />
          </div>
          <div>
            <label className={etiquette}>Reçu serveur depuis</label>
            <input type="datetime-local" className={champ} value={versLocal(value.recu_depuis)}
                   onChange={e => set("recu_depuis", e.target.value ? new Date(e.target.value).toISOString() : "")} />
          </div>
          <div>
            <label className={etiquette}>Statut des rapports</label>
            <select className={champ} value={value.statut ?? "tous"} onChange={e => set("statut", e.target.value)}>
              {STATUTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
