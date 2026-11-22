"use client";

/**
 * Visites pédagogiques (rapport V2, D2.3 / D9.3).
 * Une visite est distincte du pointage de présence : date, classe, tuteur
 * observé, réponses aux items de la grille (version figée), points d'appui et
 * à améliorer, et les demandes d'accompagnement qui en sont issues.
 * Scores recalculés par le serveur ; « non applicable » et « manquant » ne
 * valent jamais zéro.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import {
  Badge, CampagneSelect, EcoleSelect, Modale, Tableau, bouton, champ, etiquette, fmtDate, fmtDateHeure,
} from "@/components/L6Ui";
import { grillesApi, telecharger, visitesApi, LIBELLES_STATUT_DEMANDE, type Grille, type Visite } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

const TAILLE = 25;

function Detail({ id, onFermer, onMaj }: { id: string; onFermer: () => void; onMaj: () => void }) {
  const [v, setV] = useState<Visite | null>(null);
  const [grille, setGrille] = useState<Grille | null>(null);
  const [motif, setMotif] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = (await visitesApi.get(id)).data;
        setV(d);
        setGrille((await grillesApi.list()).data.find(g => g.id === d.grille_id) ?? null);
      } catch (e) { notifyError("Visite introuvable.", e); }
    })();
  }, [id]);

  const annuler = async () => {
    if (motif.trim().length < 3) return notifyError("Indiquez le motif de l'annulation.");
    try { setV((await visitesApi.annuler(id, motif)).data); onMaj(); }
    catch (e) { notifyError("Annulation impossible.", e); }
  };

  if (!v) return <Modale titre="Visite" onFermer={onFermer}><p className="text-sm text-tx-muted">Chargement…</p></Modale>;
  const rep = Object.fromEntries(v.reponses.map(r => [r.item_id, r]));
  return (
    <Modale titre={`Visite du ${fmtDate(v.date_visite)}`} onFermer={onFermer} large>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
        <div><p className={etiquette}>Tuteur</p>{v.teacher_nom}</div>
        <div><p className={etiquette}>Superviseur</p>{v.superviseur_nom}</div>
        <div><p className={etiquette}>École / classe</p>{v.ecole ?? "—"} · {v.classe ?? "—"}</div>
        <div><p className={etiquette}>Durée</p>{v.duree_minutes ? `${v.duree_minutes} min` : "—"}{v.heure_debut ? ` (dès ${v.heure_debut})` : ""}</div>
        <div><p className={etiquette}>Score</p>{v.score_max ? `${v.score_obtenu} / ${v.score_max}` : "—"}</div>
        <div><p className={etiquette}>Items manquants</p>{v.nb_items_manquants}</div>
        <div><p className={etiquette}>Outils indisponibles</p>{v.nb_outils_indisponibles}</div>
        <div><p className={etiquette}>Grille</p>v{v.grille_version} {v.statut === "annulee" && <Badge ton="alerte">Annulée</Badge>}</div>
      </div>
      {grille && (
        <Tableau lignes={grille.items as any[]} colonnes={[
          { cle: "code", titre: "Item" }, { cle: "domaine", titre: "Domaine" }, { cle: "libelle", titre: "Libellé" },
          { cle: "rep", titre: "Réponse", rendu: (it: any) => {
            const r = rep[it.id];
            if (!r) return <Badge>Manquant</Badge>;
            if (r.non_applicable) return <Badge>Non applicable</Badge>;
            if (it.type === "outil") return r.disponible === null ? <Badge>Manquant</Badge> : r.disponible ? <Badge ton="ok">Disponible</Badge> : <Badge ton="alerte">Indisponible</Badge>;
            if (it.type === "texte") return r.texte ?? "—";
            return r.valeur === null ? <Badge>Manquant</Badge> : `${r.valeur}${it.bareme_max ? ` / ${it.bareme_max}` : ""}`;
          } },
        ]} />
      )}
      <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
        <div><p className={etiquette}>Points d&apos;appui</p><p className="whitespace-pre-wrap">{v.points_appui || "—"}</p></div>
        <div><p className={etiquette}>Points à améliorer</p><p className="whitespace-pre-wrap">{v.points_amelioration || "—"}</p></div>
        {v.commentaire && <div className="md:col-span-2"><p className={etiquette}>Commentaire</p><p className="whitespace-pre-wrap">{v.commentaire}</p></div>}
      </div>
      <div className="mt-4">
        <p className={etiquette}>Demandes d&apos;accompagnement issues de la visite</p>
        {v.demandes.length ? (
          <ul className="text-sm space-y-1">
            {v.demandes.map(d => (
              <li key={d.id}><Link className="underline" href={`/dashboard/demandes-appui?id=${d.id}`}>{d.titre}</Link> — {LIBELLES_STATUT_DEMANDE[d.statut]}
                {d.echeance && ` · échéance ${fmtDate(d.echeance)}`}</li>
            ))}
          </ul>
        ) : <p className="text-sm text-tx-muted">Aucune.</p>}
      </div>
      {v.statut === "soumise" ? (
        <div className="mt-5 border-t border-border pt-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]"><label className={etiquette}>Annuler la visite (motif obligatoire)</label>
            <input className={champ} value={motif} onChange={e => setMotif(e.target.value)} placeholder="ex. Doublon, mauvaise classe" /></div>
          <button className={bouton} onClick={annuler}>Annuler la visite</button>
        </div>
      ) : <p className="mt-4 text-sm text-danger">Annulée : {v.statut_motif}</p>}
      <p className="mt-3 text-[11px] text-tx-muted">Reçue le {fmtDateHeure(v.created_at)}</p>
    </Modale>
  );
}

export default function VisitesPage() {
  const [f, setF] = useState<Record<string, string | undefined>>({ statut: "soumise" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: Visite[] }>({ total: 0, items: [] });
  const [ouverte, setOuverte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try { setData((await visitesApi.list({ ...f, skip: (page - 1) * TAILLE, limit: TAILLE })).data); }
    catch (e) { notifyError("Impossible de charger les visites.", e); }
  }, [f, page]);
  useEffect(() => { charger(); }, [charger]);

  const set = (k: string, v?: string) => { setPage(1); setF(x => ({ ...x, [k]: v || undefined })); };
  const exporter = async () => {
    try { telecharger((await visitesApi.export({ ...f, statut: f.statut ?? "toutes" })).data, "visites.csv"); }
    catch (e) { notifyError("Export impossible.", e); }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Visites pédagogiques</h1>
          <p className="text-tx-muted text-sm max-w-3xl">Visites saisies par les superviseurs depuis l&apos;application, avec la grille utilisée et les recommandations transformées en demandes d&apos;appui.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/grilles-visite" className={bouton}>Grilles de visite</Link>
          <button className={bouton} onClick={exporter}>Exporter (CSV, une ligne par item)</button>
        </div>
      </div>
      <div className="bg-surface border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div><label className={etiquette}>Campagne</label><CampagneSelect toutes value={f.session_id} onChange={v => set("session_id", v)} /></div>
        <div><label className={etiquette}>École</label><EcoleSelect value={f.school_id} onChange={v => set("school_id", v)} /></div>
        <div><label className={etiquette}>Du</label><input type="date" className={champ} value={f.date_debut ?? ""} onChange={e => set("date_debut", e.target.value)} /></div>
        <div><label className={etiquette}>Au</label><input type="date" className={champ} value={f.date_fin ?? ""} onChange={e => set("date_fin", e.target.value)} /></div>
        <div><label className={etiquette}>Statut</label>
          <select className={champ} value={f.statut ?? "soumise"} onChange={e => set("statut", e.target.value)}>
            <option value="soumise">Soumises</option><option value="annulee">Annulées</option><option value="toutes">Toutes</option>
          </select></div>
      </div>
      <Tableau lignes={data.items} onClic={v => setOuverte(v.id)} vide="Aucune visite sur ce périmètre." colonnes={[
        { cle: "date_visite", titre: "Date", rendu: v => fmtDate(v.date_visite) },
        { cle: "teacher_nom", titre: "Tuteur" }, { cle: "superviseur_nom", titre: "Superviseur" },
        { cle: "ecole", titre: "École" }, { cle: "classe", titre: "Classe" },
        { cle: "score", titre: "Score", className: "text-right", rendu: v => v.score_max ? `${v.score_obtenu} / ${v.score_max}` : "—" },
        { cle: "domaines", titre: "Domaines", rendu: v => Object.entries(v.scores_domaines ?? {}).map(([d, s]) =>
          <span key={d} className="mr-1"><Badge ton={(s.taux ?? 100) < 50 ? "alerte" : "neutre"}>{d} {s.taux ?? "—"}%</Badge></span>) },
        { cle: "nb_outils_indisponibles", titre: "Outils manquants", className: "text-right" },
        { cle: "statut", titre: "", rendu: v => v.statut === "annulee" ? <Badge ton="alerte">Annulée</Badge> : null },
      ]} />
      <Pagination page={page} total={data.total} pageSize={TAILLE} onChange={setPage} />
      {ouverte && <Detail id={ouverte} onFermer={() => setOuverte(null)} onMaj={charger} />}
    </div>
  );
}
