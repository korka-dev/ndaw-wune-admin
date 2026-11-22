"use client";

/**
 * Décisions terrain (lot L7) :
 * - RET07 : propositions de changement de groupe faites par les tuteurs.
 *   Valider applique le nouveau groupe ; l'ancien reste dans l'historique.
 *   L'assignation de recherche (traitement / contrôle) n'est jamais touchée.
 * - Règles terrain transmises aux téléphones (lecture seule, fixées dans le .env du serveur).
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, Tableau, bouton, fmtDateHeure } from "@/components/L6Ui";
import { terrainApi } from "@/lib/api";
import { notifyError } from "@/lib/notify";

type Proposition = {
  id: string; eleve_id: string; eleve_nom: string | null; classe: string | null; domaine: string;
  ancien_groupe: string | null; nouveau_groupe: string; motif: string; statut: string;
  propose_par: string | null; motif_refus: string | null; decide_le: string | null; created_at: string;
};

const STATUTS: Record<string, string> = { proposee: "En attente", validee: "Validée", refusee: "Refusée" };
const REGLES: Record<string, string> = {
  remplacement_validation: "Remplacement d'élève",
  photo_rapport_obligatoire: "Photo obligatoire dans le rapport",
  minuteur_prealerte_secondes: "Préalerte du minuteur (secondes)",
  minuteur_son: "Son du minuteur",
  proposition_groupe_active: "Propositions de groupe ouvertes",
  support_contact: "Contact d'assistance affiché",
  systemes_supportes: "Téléphones pris en charge",
  rappels_max_par_jour: "Rappels de début par jour",
  latest_app_version: "Dernière version de l'application",
};
const VARIABLES: Record<string, string> = {
  remplacement_validation: "REMPLACEMENT_VALIDATION", photo_rapport_obligatoire: "PHOTO_RAPPORT_OBLIGATOIRE",
  minuteur_prealerte_secondes: "MINUTEUR_PREALERTE_SECONDES", minuteur_son: "MINUTEUR_SON",
  proposition_groupe_active: "PROPOSITION_GROUPE_ACTIVE", support_contact: "SUPPORT_CONTACT",
  systemes_supportes: "SYSTEMES_SUPPORTES", rappels_max_par_jour: "RAPPELS_MAX_PAR_JOUR",
  latest_app_version: "LATEST_APP_VERSION",
};

function valeur(cle: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "— (non défini)";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (cle === "remplacement_validation") return v === "superviseur" ? "À valider par le superviseur" : "Immédiat";
  return String(v);
}

export default function TerrainPage() {
  const [statut, setStatut] = useState("proposee");
  const [props, setProps] = useState<Proposition[]>([]);
  const [regles, setRegles] = useState<Record<string, unknown> | null>(null);

  const charger = useCallback(async () => {
    try { setProps((await terrainApi.propositions(statut || undefined)).data as Proposition[]); }
    catch (e) { notifyError("Propositions indisponibles.", e); }
  }, [statut]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { terrainApi.parametres().then(r => setRegles(r.data)).catch(() => {}); }, []);

  const decider = async (p: Proposition, decision: "valider" | "refuser") => {
    let motif: string | undefined;
    if (decision === "refuser") {
      const m = window.prompt("Motif du refus (visible par le tuteur) :");
      if (!m || !m.trim()) return;
      motif = m.trim();
    } else if (!window.confirm(`Passer ${p.eleve_nom ?? "l'élève"} en ${p.domaine} de ${p.ancien_groupe ?? "aucun groupe"} à ${p.nouveau_groupe} ?`)) return;
    try { await terrainApi.deciderProposition(p.id, { decision, motif }); await charger(); }
    catch (e) { notifyError("Décision refusée.", e); }
  };

  return (
    <div className="p-7 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-tx mb-0.5">Décisions terrain</h1>
        <p className="text-tx-muted text-sm">Propositions de changement de groupe des tuteurs et règles transmises aux téléphones.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-tx mr-2">Propositions de groupe</h2>
          {[["proposee", "En attente"], ["validee", "Validées"], ["refusee", "Refusées"], ["", "Toutes"]].map(([k, l]) => (
            <button key={k} className={`${bouton} ${statut === k ? "bg-surface-alt" : ""}`} onClick={() => setStatut(k)}>{l}</button>
          ))}
        </div>
        <p className="text-xs text-tx-muted">Valider applique le nouveau groupe ; l&apos;ancien reste tracé. Le groupe de recherche (traitement / contrôle) n&apos;est pas modifié.</p>
        <Tableau<Proposition> lignes={props} vide="Aucune proposition." colonnes={[
          { cle: "created_at", titre: "Date", rendu: p => fmtDateHeure(p.created_at) },
          { cle: "eleve_nom", titre: "Élève", rendu: p => <>{p.eleve_nom ?? "—"}<span className="text-tx-muted"> · {p.classe ?? "?"}</span></> },
          { cle: "domaine", titre: "Domaine", rendu: p => (p.domaine === "lecture" ? "Lecture" : "Maths") },
          { cle: "nouveau_groupe", titre: "Changement", rendu: p => `${p.ancien_groupe ?? "aucun"} → ${p.nouveau_groupe}` },
          { cle: "motif", titre: "Motif", rendu: p => <span title={p.motif}>{p.motif.length > 60 ? `${p.motif.slice(0, 60)}…` : p.motif}</span> },
          { cle: "propose_par", titre: "Tuteur", rendu: p => p.propose_par ?? "—" },
          { cle: "statut", titre: "Statut", rendu: p => p.statut === "proposee" ? (
            <span className="inline-flex gap-1">
              <button className="px-2 py-1 rounded bg-brand text-white text-xs font-semibold" onClick={() => decider(p, "valider")}>Valider</button>
              <button className="px-2 py-1 rounded border border-border text-xs font-semibold" onClick={() => decider(p, "refuser")}>Refuser</button>
            </span>
          ) : <span title={p.motif_refus ?? undefined}><Badge ton={p.statut === "validee" ? "ok" : "alerte"}>{STATUTS[p.statut] ?? p.statut}</Badge>{p.decide_le ? ` ${fmtDateHeure(p.decide_le)}` : ""}</span> },
        ]} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-tx">Règles terrain en vigueur</h2>
        <p className="text-xs text-tx-muted">Envoyées aux téléphones à chaque synchronisation. Elles se modifient dans le fichier <code>.env</code> du serveur (variable indiquée), puis redémarrage de l&apos;API.</p>
        {regles ? (
          <div className="bg-surface border border-border rounded-2xl divide-y divide-border">
            {Object.entries(regles).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-tx">{REGLES[k] ?? k} <span className="text-[11px] text-tx-muted">{VARIABLES[k] ?? ""}</span></span>
                <span className="font-semibold text-tx">{valeur(k, v)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-tx-muted">Chargement…</p>}
      </section>
    </div>
  );
}
