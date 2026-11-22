"use client";

/**
 * Clés de service (rapport V2, D9.4) : accès en lecture seule aux vues
 * analytiques pseudonymisées (/service/...) pour un outil externe (Power BI,
 * Metabase…). La valeur n'est affichée qu'une fois ; seule son empreinte est
 * conservée.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, Modale, Tableau, bouton, boutonPrincipal, champ, etiquette, fmtDateHeure } from "@/components/L6Ui";
import { clesApi } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

type Cle = { id: string; nom: string; prefixe: string; portees: string[]; expire_le: string | null; revoquee_le: string | null;
             derniere_utilisation: string | null; created_at: string; active: boolean };
const PORTEES = { analytique: "Vues analytiques (/service/analytique)", tableau_bord: "Tableau de bord pseudonymisé (/service/tableau-de-bord)" };

export default function ClesServicePage() {
  const [cles, setCles] = useState<Cle[]>([]);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState("");
  const [portees, setPortees] = useState<string[]>(["analytique"]);
  const [expire, setExpire] = useState("");
  const [valeur, setValeur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try { setCles((await clesApi.list()).data as Cle[]); } catch (e) { notifyError("Clés indisponibles.", e); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const creer = async () => {
    try {
      const r = (await clesApi.create({ nom, portees, expire_le: expire ? `${expire}T23:59:59Z` : null })).data as { valeur: string };
      setValeur(r.valeur); setCreation(false); setNom(""); charger();
    } catch (e) { notifyError("Création impossible.", e); }
  };
  const revoquer = async (c: Cle) => {
    if (!window.confirm(`Révoquer « ${c.nom} » ? Les outils qui l'utilisent perdront l'accès immédiatement.`)) return;
    try { await clesApi.revoquer(c.id); charger(); } catch (e) { notifyError("Révocation impossible.", e); }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Clés de service</h1>
          <p className="text-tx-muted text-sm max-w-3xl">Accès en lecture seule, sans noms ni identifiants directs, transmis dans l&apos;en-tête <code>X-Api-Key</code>. Réservé aux administrateurs.</p>
        </div>
        <button className={boutonPrincipal} onClick={() => setCreation(true)}>Nouvelle clé</button>
      </div>
      <Tableau lignes={cles} vide="Aucune clé." colonnes={[
        { cle: "nom", titre: "Nom" }, { cle: "prefixe", titre: "Préfixe", rendu: c => <code>{c.prefixe}…</code> },
        { cle: "portees", titre: "Portées", rendu: c => c.portees.join(", ") },
        { cle: "expire_le", titre: "Expire", rendu: c => fmtDateHeure(c.expire_le) },
        { cle: "derniere_utilisation", titre: "Dernier usage", rendu: c => fmtDateHeure(c.derniere_utilisation) },
        { cle: "active", titre: "État", rendu: c => c.active ? <Badge ton="ok">Active</Badge> : <Badge>{c.revoquee_le ? "Révoquée" : "Expirée"}</Badge> },
        { cle: "actions", titre: "", rendu: c => c.active ? <button className={bouton} onClick={() => revoquer(c)}>Révoquer</button> : null },
      ]} />
      {creation && (
        <Modale titre="Nouvelle clé de service" onFermer={() => setCreation(false)}>
          <div className="space-y-3">
            <div><label className={etiquette}>Nom (usage)</label><input className={champ} value={nom} onChange={e => setNom(e.target.value)} placeholder="ex. Power BI ARED" /></div>
            <div><p className={etiquette}>Portées</p>
              {Object.entries(PORTEES).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={portees.includes(k)} onChange={e => setPortees(x => e.target.checked ? [...x, k] : x.filter(y => y !== k))} />{l}
                </label>
              ))}</div>
            <div><label className={etiquette}>Expiration (recommandée)</label><input type="date" className={champ} value={expire} onChange={e => setExpire(e.target.value)} /></div>
            <div className="flex justify-end"><button className={boutonPrincipal} disabled={nom.trim().length < 3 || !portees.length} onClick={creer}>Créer</button></div>
          </div>
        </Modale>
      )}
      {valeur && (
        <Modale titre="Clé créée" onFermer={() => setValeur(null)}>
          <p className="text-sm mb-2">Copiez cette valeur maintenant : elle ne sera plus jamais affichée.</p>
          <code className="block break-all bg-surface-alt rounded-lg p-3 text-sm select-all">{valeur}</code>
          <div className="flex justify-end mt-3"><button className={bouton} onClick={() => navigator.clipboard?.writeText(valeur)}>Copier</button></div>
        </Modale>
      )}
    </div>
  );
}
