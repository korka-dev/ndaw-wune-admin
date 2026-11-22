"use client";

/**
 * Demandes d'appui (rapport V2, D9.3) : circuit ouverte → affectée → en cours
 * → résolue / abandonnée, avec responsable, échéance et historique complet.
 * Une demande issue d'une difficulté de rapport synchronise la résolution de
 * cette difficulté.
 */
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import {
  Badge, CampagneSelect, EcoleSelect, Modale, Tableau, bouton, boutonPrincipal, champ, etiquette, fmtDate, fmtDateHeure,
} from "@/components/L6Ui";
import { superviseursApi, usersApi } from "@/lib/api";
import { demandesApi, telecharger, LIBELLES_ORIGINE, LIBELLES_STATUT_DEMANDE, type Demande } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

const TAILLE = 25;
type Personne = { id: string; name: string };

function usePersonnes(): Personne[] {
  const [p, setP] = useState<Personne[]>([]);
  useEffect(() => {
    Promise.allSettled([usersApi.list({ limit: 1000 }), superviseursApi.list({ limit: 1000 })]).then(rs => {
      const tous: Personne[] = [];
      rs.forEach(r => { if (r.status === "fulfilled") tous.push(...((r.value.data.items ?? r.value.data) as Personne[])); });
      const vus = new Set<string>();
      setP(tous.filter(x => x?.id && !vus.has(x.id) && vus.add(x.id)).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
    });
  }, []);
  return p;
}

const tonStatut = (s: Demande["statut"]) => (s === "resolue" ? "ok" : s === "abandonnee" ? "neutre" : s === "ouverte" ? "alerte" : "info");

function Detail({ id, personnes, onFermer, onMaj }: { id: string; personnes: Personne[]; onFermer: () => void; onMaj: () => void }) {
  const [d, setD] = useState<Demande | null>(null);
  const [statut, setStatut] = useState("");
  const [resp, setResp] = useState("");
  const [echeance, setEcheance] = useState("");
  const [commentaire, setCommentaire] = useState("");

  useEffect(() => {
    demandesApi.get(id).then(r => { setD(r.data); setResp(r.data.responsable_id ?? ""); setEcheance(r.data.echeance ?? ""); })
      .catch(e => notifyError("Demande introuvable.", e));
  }, [id]);

  const enregistrer = async () => {
    if (!d) return;
    const corps: Record<string, unknown> = { commentaire: commentaire.trim() || null };
    if (statut) corps.statut = statut;
    if (resp && resp !== d.responsable_id) corps.responsable_id = resp;
    if (!resp && d.responsable_id) corps.retirer_responsable = true;
    if (echeance && echeance !== d.echeance) corps.echeance = echeance;
    try {
      const r = (await demandesApi.agir(d.id, corps)).data;
      setD(r); setStatut(""); setCommentaire(""); onMaj();
    } catch (e) { notifyError("Mise à jour impossible.", e); }
  };

  if (!d) return <Modale titre="Demande d'appui" onFermer={onFermer}><p className="text-sm text-tx-muted">Chargement…</p></Modale>;
  const close = d.statut === "resolue" || d.statut === "abandonnee";
  return (
    <Modale titre={d.titre} onFermer={onFermer} large>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
        <div><p className={etiquette}>Statut</p><Badge ton={tonStatut(d.statut)}>{LIBELLES_STATUT_DEMANDE[d.statut]}</Badge>{d.en_retard && <> <Badge ton="alerte">En retard</Badge></>}</div>
        <div><p className={etiquette}>Origine</p>{LIBELLES_ORIGINE[d.origine]}</div>
        <div><p className={etiquette}>Bénéficiaire</p>{d.beneficiaire_nom ?? "—"}</div>
        <div><p className={etiquette}>École</p>{d.ecole ?? "—"}</div>
        <div><p className={etiquette}>Domaine</p>{d.domaine ?? "—"}</div>
        <div><p className={etiquette}>Responsable</p>{d.responsable_nom ?? "—"}</div>
        <div><p className={etiquette}>Échéance</p>{fmtDate(d.echeance)}</div>
        <div><p className={etiquette}>Créée le</p>{fmtDate(d.created_at)}</div>
      </div>
      {d.libelle_source && <p className="text-sm mb-2"><span className={etiquette}>Libellé source</span>{d.libelle_source}</p>}
      {d.description && <p className="text-sm whitespace-pre-wrap mb-3">{d.description}</p>}

      <div className="border-t border-border pt-4 grid md:grid-cols-3 gap-3">
        <div><label className={etiquette}>Nouveau statut</label>
          <select className={champ} value={statut} onChange={e => setStatut(e.target.value)}>
            <option value="">(inchangé)</option>
            {Object.entries(LIBELLES_STATUT_DEMANDE).filter(([k]) => k !== d.statut).map(([k, l]) => <option key={k} value={k}>{close && (k !== "resolue" && k !== "abandonnee") ? `Rouvrir → ${l}` : l}</option>)}
          </select></div>
        <div><label className={etiquette}>Responsable</label>
          <select className={champ} value={resp} onChange={e => setResp(e.target.value)}>
            <option value="">Aucun</option>
            {personnes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div><label className={etiquette}>Échéance</label><input type="date" className={champ} value={echeance} onChange={e => setEcheance(e.target.value)} /></div>
        <div className="md:col-span-3"><label className={etiquette}>Commentaire {statut === "resolue" || statut === "abandonnee" || (close && statut) ? "(obligatoire)" : ""}</label>
          <textarea className={champ} rows={2} value={commentaire} onChange={e => setCommentaire(e.target.value)} /></div>
        <div className="md:col-span-3 flex justify-end"><button className={boutonPrincipal} onClick={enregistrer}>Enregistrer</button></div>
      </div>

      <p className={`${etiquette} mt-5`}>Historique</p>
      <ol className="text-sm space-y-2">
        {d.evenements.map(ev => (
          <li key={ev.id} className="border-l-2 border-border pl-3">
            <p className="text-[11px] text-tx-muted">{fmtDateHeure(ev.created_at)} · {ev.auteur_nom ?? "système"}</p>
            <p>{ev.type}{ev.nouveau_statut && ev.nouveau_statut !== ev.ancien_statut ? ` : ${ev.ancien_statut ? LIBELLES_STATUT_DEMANDE[ev.ancien_statut as Demande["statut"]] + " → " : ""}${LIBELLES_STATUT_DEMANDE[ev.nouveau_statut as Demande["statut"]] ?? ev.nouveau_statut}` : ""}
              {ev.responsable_nom ? ` · responsable ${ev.responsable_nom}` : ""}</p>
            {ev.commentaire && <p className="text-tx-muted whitespace-pre-wrap">{ev.commentaire}</p>}
          </li>
        ))}
      </ol>
    </Modale>
  );
}

function Creation({ personnes, onFermer, onMaj }: { personnes: Personne[]; onFermer: () => void; onMaj: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const creer = async () => {
    try {
      await demandesApi.create(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
      onMaj(); onFermer();
    } catch (e) { notifyError("Création impossible.", e); }
  };
  return (
    <Modale titre="Nouvelle demande d'appui" onFermer={onFermer}>
      <div className="space-y-3">
        <div><label className={etiquette}>Titre</label><input className={champ} value={f.titre ?? ""} onChange={e => setF({ ...f, titre: e.target.value })} /></div>
        <div><label className={etiquette}>Description</label><textarea className={champ} rows={3} value={f.description ?? ""} onChange={e => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquette}>Domaine</label><input className={champ} value={f.domaine ?? ""} onChange={e => setF({ ...f, domaine: e.target.value })} /></div>
          <div><label className={etiquette}>Échéance</label><input type="date" className={champ} value={f.echeance ?? ""} onChange={e => setF({ ...f, echeance: e.target.value })} /></div>
          <div><label className={etiquette}>Bénéficiaire</label>
            <select className={champ} value={f.beneficiaire_id ?? ""} onChange={e => setF({ ...f, beneficiaire_id: e.target.value })}>
              <option value="">—</option>{personnes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className={etiquette}>Responsable</label>
            <select className={champ} value={f.responsable_id ?? ""} onChange={e => setF({ ...f, responsable_id: e.target.value })}>
              <option value="">—</option>{personnes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
        <div className="flex justify-end"><button className={boutonPrincipal} disabled={!f.titre?.trim()} onClick={creer}>Créer</button></div>
      </div>
    </Modale>
  );
}

function Contenu() {
  const params = useSearchParams();
  const personnes = usePersonnes();
  const [f, setF] = useState<Record<string, string | boolean | undefined>>({ statut: "ouvertes" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: Demande[] }>({ total: 0, items: [] });
  const [ouverte, setOuverte] = useState<string | null>(params.get("id"));
  const [creation, setCreation] = useState(false);

  const charger = useCallback(async () => {
    try { setData((await demandesApi.list({ ...f, skip: (page - 1) * TAILLE, limit: TAILLE })).data); }
    catch (e) { notifyError("Impossible de charger les demandes.", e); }
  }, [f, page]);
  useEffect(() => { charger(); }, [charger]);

  const set = (k: string, v?: string | boolean) => { setPage(1); setF(x => ({ ...x, [k]: v || undefined })); };
  const exporter = async (evenements: boolean) => {
    try {
      if (evenements) telecharger((await demandesApi.exportEvenements({ session_id: f.session_id })).data, "demandes_appui_evenements.csv");
      else telecharger((await demandesApi.export(f)).data, "demandes_appui.csv");
    } catch (e) { notifyError("Export impossible.", e); }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Demandes d&apos;appui</h1>
          <p className="text-tx-muted text-sm max-w-3xl">Recommandations de visite, difficultés et besoins d&apos;appui signalés dans les rapports, suivis jusqu&apos;à leur clôture.</p>
        </div>
        <div className="flex gap-2">
          <button className={bouton} onClick={() => exporter(false)}>Exporter les demandes</button>
          <button className={bouton} onClick={() => exporter(true)}>Exporter l&apos;historique</button>
          <button className={boutonPrincipal} onClick={() => setCreation(true)}>Nouvelle demande</button>
        </div>
      </div>
      <div className="bg-surface border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div><label className={etiquette}>Campagne</label><CampagneSelect toutes value={f.session_id as string} onChange={v => set("session_id", v)} /></div>
        <div><label className={etiquette}>École</label><EcoleSelect value={f.school_id as string} onChange={v => set("school_id", v)} /></div>
        <div><label className={etiquette}>Statut</label>
          <select className={champ} value={(f.statut as string) ?? "ouvertes"} onChange={e => set("statut", e.target.value)}>
            <option value="ouvertes">Non clôturées</option><option value="toutes">Toutes</option>
            {Object.entries(LIBELLES_STATUT_DEMANDE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div><label className={etiquette}>Origine</label>
          <select className={champ} value={(f.origine as string) ?? ""} onChange={e => set("origine", e.target.value)}>
            <option value="">Toutes</option>{Object.entries(LIBELLES_ORIGINE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div><label className={etiquette}>Responsable</label>
          <select className={champ} value={(f.responsable_id as string) ?? ""} onChange={e => set("responsable_id", e.target.value)}>
            <option value="">Tous</option>{personnes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.en_retard} onChange={e => set("en_retard", e.target.checked)} />En retard</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.sans_responsable} onChange={e => set("sans_responsable", e.target.checked)} />Sans responsable</label>
        </div>
      </div>
      <Tableau lignes={data.items} onClic={d => setOuverte(d.id)} vide="Aucune demande sur ce périmètre." colonnes={[
        { cle: "titre", titre: "Demande" },
        { cle: "origine", titre: "Origine", rendu: d => LIBELLES_ORIGINE[d.origine] },
        { cle: "beneficiaire_nom", titre: "Bénéficiaire" }, { cle: "ecole", titre: "École" },
        { cle: "responsable_nom", titre: "Responsable" },
        { cle: "echeance", titre: "Échéance", rendu: d => <>{fmtDate(d.echeance)} {d.en_retard && <Badge ton="alerte">Retard</Badge>}</> },
        { cle: "statut", titre: "Statut", rendu: d => <Badge ton={tonStatut(d.statut)}>{LIBELLES_STATUT_DEMANDE[d.statut]}</Badge> },
      ]} />
      <Pagination page={page} total={data.total} pageSize={TAILLE} onChange={setPage} />
      {ouverte && <Detail id={ouverte} personnes={personnes} onFermer={() => setOuverte(null)} onMaj={charger} />}
      {creation && <Creation personnes={personnes} onFermer={() => setCreation(false)} onMaj={charger} />}
    </div>
  );
}

export default function DemandesAppuiPage() {
  return <Suspense fallback={null}><Contenu /></Suspense>;
}
