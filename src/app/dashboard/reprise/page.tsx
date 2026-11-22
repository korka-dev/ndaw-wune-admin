"use client";

/**
 * Reprise de l'historique (rapport V2, D10.2). L'import se lance côté
 * serveur avec `scripts/reprise_historique.py` (figer → analyser →
 * correspondances → importer --simulation → importer). Cette page sert au
 * contrôle : lots, réconciliation source / importé par niveau, lignes en
 * quarantaine ou rejetées, et table de correspondance des codes historiques.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Pagination from "@/components/Pagination";
import { Badge, Modale, Tableau, bouton, boutonPrincipal, champ, etiquette, fmtDateHeure } from "@/components/L6Ui";
import { repriseApi } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

const TAILLE = 50;
type Lot = { id: string; nom: string; statut: string; sources: any; compteurs: Record<string, number> | null;
             reconciliation: any; commentaire: string | null; created_at: string; importe_le: string | null };

function DetailLot({ id, onFermer }: { id: string; onFermer: () => void }) {
  const [lot, setLot] = useState<Lot | null>(null);
  const [niveau, setNiveau] = useState("total");
  const [statut, setStatut] = useState("quarantaine");
  const [page, setPage] = useState(1);
  const [lignes, setLignes] = useState<{ total: number; items: any[] }>({ total: 0, items: [] });

  useEffect(() => { repriseApi.lot(id).then(r => setLot(r.data as Lot)).catch(e => notifyError("Lot introuvable.", e)); }, [id]);
  useEffect(() => {
    repriseApi.lignes(id, { statut: statut || undefined, skip: (page - 1) * TAILLE, limit: TAILLE })
      .then(r => setLignes(r.data as any)).catch(e => notifyError("Lignes indisponibles.", e));
  }, [id, statut, page]);

  if (!lot) return <Modale titre="Lot" onFermer={onFermer}><p className="text-sm text-tx-muted">Chargement…</p></Modale>;
  const rec = lot.reconciliation?.rapports?.[niveau] ?? [];
  return (
    <Modale titre={lot.nom} onFermer={onFermer} large>
      <p className="text-sm mb-3">
        <Badge ton={lot.statut === "importe" ? "ok" : "info"}>{lot.statut}</Badge>{" "}
        {lot.reconciliation && (lot.reconciliation.toutes_lignes_expliquees
          ? <Badge ton="ok">Tous les écarts expliqués</Badge> : <Badge ton="alerte">Écarts non expliqués</Badge>)}
        <span className="text-tx-muted"> · importé le {fmtDateHeure(lot.importe_le)}</span>
      </p>
      {lot.compteurs && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Object.entries(lot.compteurs).map(([k, v]) => <Badge key={k}>{k} : {v}</Badge>)}
        </div>
      )}
      {lot.reconciliation && (
        <>
          <div className="flex gap-2 mb-2">
            {["total", "ief", "ecole", "acteur", "semaine"].map(n => (
              <button key={n} className={`${bouton} ${niveau === n ? "bg-surface-alt" : ""}`} onClick={() => setNiveau(n)}>{n}</button>
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto mb-4">
            <Tableau lignes={rec} colonnes={[
              { cle: "cle", titre: "Clé" },
              { cle: "source", titre: "Source", className: "text-right" },
              { cle: "importee", titre: "Importées", className: "text-right", rendu: (r: any) => r.importee ?? 0 },
              { cle: "quarantaine", titre: "Quarantaine", className: "text-right", rendu: (r: any) => r.quarantaine ?? 0 },
              { cle: "doublon", titre: "Doublons", className: "text-right", rendu: (r: any) => r.doublon ?? 0 },
              { cle: "rejetee", titre: "Rejetées", className: "text-right", rendu: (r: any) => r.rejetee ?? 0 },
              { cle: "ecart", titre: "Écart", className: "text-right" },
              { cle: "ecart_explique", titre: "", rendu: (r: any) => r.ecart_explique ? <Badge ton="ok">expliqué</Badge> : <Badge ton="alerte">à analyser</Badge> },
            ]} />
          </div>
        </>
      )}
      <div className="flex items-end gap-3 mb-2">
        <div className="w-52"><label className={etiquette}>Lignes</label>
          <select className={champ} value={statut} onChange={e => { setPage(1); setStatut(e.target.value); }}>
            <option value="quarantaine">En quarantaine</option><option value="rejetee">Rejetées</option>
            <option value="doublon">Doublons</option><option value="importee">Importées</option><option value="">Toutes</option>
          </select></div>
        <p className="text-sm text-tx-muted">{lignes.total} ligne(s)</p>
      </div>
      <Tableau lignes={lignes.items} vide="Aucune ligne." colonnes={[
        { cle: "fichier", titre: "Fichier" }, { cle: "numero_ligne", titre: "Ligne", className: "text-right" },
        { cle: "source_submission_id", titre: "Soumission" }, { cle: "statut", titre: "Statut" }, { cle: "motif", titre: "Motif" },
      ]} />
      <Pagination page={page} total={lignes.total} pageSize={TAILLE} onChange={setPage} />
    </Modale>
  );
}

export default function ReprisePage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [corr, setCorr] = useState<any[]>([]);
  const [resultat, setResultat] = useState<any | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    try {
      setLots((await repriseApi.lots()).data as Lot[]);
      setCorr((await repriseApi.correspondances(type || undefined)).data as any[]);
    } catch (e) { notifyError("Données de reprise indisponibles.", e); }
  }, [type]);
  useEffect(() => { charger(); }, [charger]);

  const importer = async (f?: File) => {
    if (!f) return;
    try { setResultat((await repriseApi.importerCorrespondances(f)).data); charger(); }
    catch (e) { notifyError("Import des correspondances impossible.", e); }
    finally { if (fichier.current) fichier.current.value = ""; }
  };

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-tx mb-0.5">Reprise de l&apos;historique</h1>
        <p className="text-tx-muted text-sm max-w-3xl">
          Import des exports historiques (Baseglobale, ElevesAbsents, difficulte, BaseBesoins). Les lignes sans correspondance
          validée restent en quarantaine : rien n&apos;est rattaché par simple ressemblance de nom.
        </p>
      </div>
      <section className="space-y-2">
        <h2 className="font-bold text-tx">Lots</h2>
        <Tableau lignes={lots} onClic={l => setOuvert(l.id)} vide="Aucun lot. Lancez scripts/reprise_historique.py sur le serveur." colonnes={[
          { cle: "nom", titre: "Lot" },
          { cle: "statut", titre: "Statut", rendu: l => <Badge ton={l.statut === "importe" ? "ok" : "info"}>{l.statut}</Badge> },
          { cle: "importees", titre: "Importées", className: "text-right", rendu: l => l.compteurs ? Object.entries(l.compteurs).filter(([k]) => k.endsWith(":importee")).reduce((a, [, v]) => a + v, 0) : "—" },
          { cle: "quarantaine", titre: "Quarantaine", className: "text-right", rendu: l => l.compteurs ? Object.entries(l.compteurs).filter(([k]) => k.endsWith(":quarantaine")).reduce((a, [, v]) => a + v, 0) : "—" },
          { cle: "ok", titre: "Réconciliation", rendu: l => !l.reconciliation ? "—" : l.reconciliation.toutes_lignes_expliquees ? <Badge ton="ok">OK</Badge> : <Badge ton="alerte">Écarts</Badge> },
          { cle: "created_at", titre: "Créé le", rendu: l => fmtDateHeure(l.created_at) },
        ]} />
      </section>
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold text-tx">Table de correspondance</h2>
            <p className="text-sm text-tx-muted">CSV « type;code_source;cible_id;libelle_source;commentaire » (types : tuteur, superviseur, ecole, eleve).</p>
          </div>
          <div className="flex gap-2 items-end">
            <div className="w-40"><label className={etiquette}>Type</label>
              <select className={champ} value={type} onChange={e => setType(e.target.value)}>
                <option value="">Tous</option><option value="tuteur">Tuteur</option><option value="superviseur">Superviseur</option>
                <option value="ecole">École</option><option value="eleve">Élève</option></select></div>
            <input ref={fichier} type="file" accept=".csv,text/csv" className="hidden" onChange={e => importer(e.target.files?.[0])} />
            <button className={boutonPrincipal} onClick={() => fichier.current?.click()}>Importer un CSV validé</button>
          </div>
        </div>
        {resultat && (
          <div className="text-sm bg-surface-alt rounded-lg p-3">
            {resultat.validees} correspondance(s) validée(s) · {resultat.nb_erreurs} erreur(s)
            {resultat.erreurs?.length > 0 && <ul className="mt-1 text-danger list-disc pl-5">{resultat.erreurs.slice(0, 20).map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>}
          </div>
        )}
        <div className="max-h-96 overflow-y-auto">
          <Tableau lignes={corr} vide="Aucune correspondance validée." colonnes={[
            { cle: "type", titre: "Type" }, { cle: "code_source", titre: "Code source" }, { cle: "libelle_source", titre: "Libellé source" },
            { cle: "cible_nom", titre: "Rattaché à", rendu: (c: any) => c.cible_nom ?? c.cible_id },
            { cle: "valide_par", titre: "Validé par", rendu: (c: any) => c.valide_par ?? "—" },
          ]} />
        </div>
      </section>
      {ouvert && <DetailLot id={ouvert} onFermer={() => setOuvert(null)} />}
    </div>
  );
}
