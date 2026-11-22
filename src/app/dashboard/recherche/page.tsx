"use client";

/**
 * Protocole de recherche (rapport V2, APP-33) : matrice groupe → accès
 * effectif, détection des incohérences, alignement en masse (aperçu puis
 * application) et historique immuable des assignations. Toute exception
 * individuelle exige un motif.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, CampagneSelect, Chiffre, Modale, Tableau, bouton, boutonPrincipal, champ, etiquette, fmtDateHeure } from "@/components/L6Ui";
import { rechercheApi } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

type Ligne = {
  user_id: string; nom: string; groupe_recherche: string | null; app_access_stocke: string; app_access_attendu: string | null;
  app_access_effectif: string; minuteur_visible: boolean; source: string; exception: boolean; incoherent: boolean;
  // RET15 : ce que le téléphone a réellement reçu à sa dernière synchronisation
  version_app?: string | null; derniere_sync_le?: string | null; minuteur_expose?: boolean | null; ecart_telephone?: boolean;
};
type Matrice = { campagne: { id: string; nom: string; protocole_minuteur: boolean }; totaux: Record<string, number>; lignes: Ligne[] };
const ACCES: Record<string, string> = { full: "Complet", timer_only: "Minuteur seul", no_timer: "Sans minuteur" };

function Assignation({ l, sessionId, onFermer, onMaj }: { l: Ligne; sessionId?: string; onFermer: () => void; onMaj: () => void }) {
  const [groupe, setGroupe] = useState(l.groupe_recherche ?? "");
  const [acces, setAcces] = useState(l.app_access_stocke);
  const [motif, setMotif] = useState("");
  const [hist, setHist] = useState<any[]>([]);
  useEffect(() => { rechercheApi.historique(l.user_id).then(r => setHist(r.data as any[])).catch(() => {}); }, [l.user_id]);
  const valider = async () => {
    try {
      await rechercheApi.assigner({ user_id: l.user_id, groupe_recherche: groupe || null, app_access: acces, motif });
      onMaj(); onFermer();
    } catch (e) { notifyError("Assignation refusée.", e); }
  };
  void sessionId;
  return (
    <Modale titre={l.nom} onFermer={onFermer}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={etiquette}>Groupe</label>
          <select className={champ} value={groupe} onChange={e => setGroupe(e.target.value)}>
            <option value="">Non assigné</option><option value="traitement">Traitement</option><option value="controle">Contrôle</option></select></div>
        <div><label className={etiquette}>Accès</label>
          <select className={champ} value={acces} onChange={e => setAcces(e.target.value)}>
            {Object.entries(ACCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="col-span-2"><label className={etiquette}>Motif (obligatoire, tracé)</label>
          <input className={champ} value={motif} onChange={e => setMotif(e.target.value)} /></div>
      </div>
      <div className="flex justify-end mt-3"><button className={boutonPrincipal} disabled={motif.trim().length < 3} onClick={valider}>Enregistrer</button></div>
      <p className={`${etiquette} mt-4`}>Historique</p>
      <ul className="text-sm space-y-1 max-h-56 overflow-y-auto">
        {hist.map(h => (
          <li key={h.id}>{fmtDateHeure(h.effective_le)} · {h.groupe_recherche ?? "non assigné"} / {ACCES[h.app_access] ?? h.app_access}
            {h.exception && <> <Badge ton="alerte">Exception</Badge></>} — {h.auteur}{h.motif ? ` : ${h.motif}` : ""}</li>
        ))}
        {!hist.length && <li className="text-tx-muted">Aucun changement enregistré.</li>}
      </ul>
    </Modale>
  );
}

export default function RecherchePage() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [m, setM] = useState<Matrice | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "incoherents" | "exceptions" | "ecarts">("tous");
  const [choisi, setChoisi] = useState<Ligne | null>(null);
  const [motif, setMotif] = useState("");
  const [apercu, setApercu] = useState<any | null>(null);

  const charger = useCallback(async () => {
    if (!sessionId) return;
    try { setM((await rechercheApi.matrice(sessionId)).data as Matrice); } catch (e) { notifyError("Matrice indisponible.", e); }
  }, [sessionId]);
  useEffect(() => { charger(); }, [charger]);

  const aligner = async (dry_run: boolean) => {
    try {
      const r = (await rechercheApi.aligner({ session_id: sessionId, motif: motif || "Alignement sur le protocole", dry_run })).data;
      setApercu(r);
      if (!dry_run) charger();
    } catch (e) { notifyError("Alignement impossible.", e); }
  };

  const lignes = (m?.lignes ?? []).filter(l => filtre === "tous" || (filtre === "incoherents" ? l.incoherent : filtre === "ecarts" ? (l.ecart_telephone || l.derniere_sync_le == null) : l.exception));
  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Protocole de recherche</h1>
          <p className="text-tx-muted text-sm max-w-3xl">Affectation traitement / contrôle et affichage effectif du minuteur. Activez le protocole dans « Paramètres de campagne ».</p>
        </div>
        <div className="w-72"><label className={etiquette}>Campagne</label><CampagneSelect value={sessionId} onChange={setSessionId} /></div>
      </div>
      {m && (
        <>
          {!m.campagne.protocole_minuteur && <p className="text-sm bg-brand-soft rounded-lg p-3">Protocole inactif sur {m.campagne.nom} : l&apos;affichage du minuteur suit le réglage individuel de chaque compte.</p>}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <Chiffre libelle="Traitement" valeur={m.totaux.traitement} />
            <Chiffre libelle="Contrôle" valeur={m.totaux.controle} />
            <Chiffre libelle="Non assignés" valeur={m.totaux.non_assigne} ton={m.totaux.non_assigne ? "alerte" : undefined} />
            <Chiffre libelle="Incohérents" valeur={m.totaux.incoherents} ton={m.totaux.incoherents ? "alerte" : "ok"} />
            <Chiffre libelle="Exceptions" valeur={m.totaux.exceptions} />
            <Chiffre libelle="Écart téléphone" valeur={m.totaux.ecarts_telephone ?? 0} ton={m.totaux.ecarts_telephone ? "alerte" : "ok"} />
            <Chiffre libelle="Jamais synchronisés" valeur={m.totaux.jamais_synchronises ?? 0} ton={m.totaux.jamais_synchronises ? "alerte" : undefined} />
          </div>
          <p className="text-xs text-tx-muted">« Téléphone » = ce que l&apos;application a reçu à sa dernière synchronisation. Un écart signifie que le téléphone n&apos;a pas encore récupéré le réglage actuel : demandez au tuteur de synchroniser.</p>
          <section className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[240px]"><label className={etiquette}>Motif de l&apos;alignement</label>
              <input className={champ} value={motif} onChange={e => setMotif(e.target.value)} placeholder="ex. Démarrage de la campagne" /></div>
            <button className={bouton} onClick={() => aligner(true)}>Aperçu de l&apos;alignement</button>
            <button className={boutonPrincipal} disabled={motif.trim().length < 3} onClick={() => window.confirm("Aligner les accès stockés sur le protocole ?") && aligner(false)}>Aligner</button>
            {apercu && <p className="w-full text-sm">{apercu.a_aligner} compte(s) à aligner · {apercu.non_assignes} non assigné(s) · {apercu.applique ? <Badge ton="ok">Appliqué</Badge> : <Badge ton="info">Aperçu</Badge>}</p>}
          </section>
          <div className="flex gap-2">
            {(["tous", "incoherents", "exceptions", "ecarts"] as const).map(k => (
              <button key={k} className={`${bouton} ${filtre === k ? "bg-surface-alt" : ""}`} onClick={() => setFiltre(k)}>{k === "tous" ? "Tous" : k === "incoherents" ? "Incohérents" : k === "ecarts" ? "Écart téléphone" : "Exceptions"}</button>
            ))}
          </div>
          <Tableau<Ligne> lignes={lignes} onClic={l => setChoisi(l)} colonnes={[
            { cle: "nom", titre: "Tuteur" },
            { cle: "groupe_recherche", titre: "Groupe", rendu: l => l.groupe_recherche ?? <Badge ton="alerte">Non assigné</Badge> },
            { cle: "app_access_stocke", titre: "Réglage stocké", rendu: l => ACCES[l.app_access_stocke] ?? l.app_access_stocke },
            { cle: "app_access_attendu", titre: "Attendu", rendu: l => (l.app_access_attendu ? ACCES[l.app_access_attendu] : "—") },
            { cle: "app_access_effectif", titre: "Effectif", rendu: l => ACCES[l.app_access_effectif] ?? l.app_access_effectif },
            { cle: "minuteur_visible", titre: "Minuteur", rendu: l => (l.minuteur_visible ? "Visible" : "Masqué") },
            { cle: "minuteur_expose", titre: "Téléphone", rendu: l => (l.derniere_sync_le == null ? <Badge ton="alerte">Jamais synchronisé</Badge>
              : <>{l.minuteur_expose ? "Minuteur reçu" : "Sans minuteur"}{l.ecart_telephone && <> <Badge ton="alerte">Écart</Badge></>}</>) },
            { cle: "version_app", titre: "Version", rendu: l => l.version_app ?? "—" },
            { cle: "derniere_sync_le", titre: "Dernière synchro", rendu: l => (l.derniere_sync_le ? fmtDateHeure(l.derniere_sync_le) : "—") },
            { cle: "source", titre: "Source", rendu: l => <>{l.source}{l.exception && <> <Badge ton="alerte">Exception</Badge></>}{l.incoherent && <> <Badge ton="alerte">Incohérent</Badge></>}</> },
          ]} />
        </>
      )}
      {choisi && <Assignation l={choisi} sessionId={sessionId} onFermer={() => setChoisi(null)} onMaj={charger} />}
    </div>
  );
}
