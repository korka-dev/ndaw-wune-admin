"use client";

/**
 * Grilles de visite versionnées (rapport V2, D2.3 et Annexe D « Supervision »).
 * Un brouillon se modifie librement ; une grille publiée est figée pour que
 * les visites passées restent interprétables. Toute évolution passe par une
 * nouvelle version (la version active précédente est alors retirée).
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, CampagneSelect, Modale, bouton, boutonPrincipal, champ, etiquette, fmtDate } from "@/components/L6Ui";
import { grillesApi, type Grille, type GrilleItem } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

const TYPES: { v: GrilleItem["type"]; l: string }[] = [
  { v: "echelle", l: "Échelle (0 à barème)" }, { v: "oui_non", l: "Oui / non" },
  { v: "outil", l: "Outil (disponible ?)" }, { v: "texte", l: "Observation libre" },
];

function Editeur({ g, onFermer, onMaj }: { g: Grille | null; onFermer: () => void; onMaj: () => void }) {
  const [nom, setNom] = useState(g?.nom ?? "");
  const [description, setDescription] = useState(g?.description ?? "");
  const [sessionId, setSessionId] = useState<string | undefined>(g?.session_id ?? undefined);
  const [items, setItems] = useState<GrilleItem[]>(g?.items ?? []);
  const lecture = g !== null && g.statut !== "brouillon";

  const maj = (i: number, patch: Partial<GrilleItem>) => setItems(xs => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const ajouter = () => setItems(xs => [...xs, { code: "", domaine: "", libelle: "", type: "echelle", bareme_max: 3, ordre: xs.length + 1, obligatoire: false }]);
  const enregistrer = async () => {
    const corps = { nom, description: description || null, session_id: sessionId ?? null,
                    items: items.map((x, i) => ({ ...x, id: undefined, ordre: i + 1, bareme_max: x.type === "echelle" ? Number(x.bareme_max) || null : null })) };
    try {
      if (g) await grillesApi.update(g.id, corps); else await grillesApi.create(corps);
      onMaj(); onFermer();
    } catch (e) { notifyError("Enregistrement de la grille impossible.", e); }
  };

  return (
    <Modale titre={g ? `${g.nom} — v${g.version}` : "Nouvelle grille"} onFermer={onFermer} large>
      {lecture && <p className="mb-3 text-sm bg-brand-soft rounded-lg p-3">Grille {g!.statut === "active" ? "publiée" : "retirée"} : lecture seule. Créez une nouvelle version pour la faire évoluer.</p>}
      <div className="grid md:grid-cols-3 gap-3 mb-3">
        <div className="md:col-span-2"><label className={etiquette}>Nom</label><input className={champ} disabled={lecture} value={nom} onChange={e => setNom(e.target.value)} /></div>
        <div><label className={etiquette}>Campagne (vide = toutes)</label><CampagneSelect toutes value={sessionId} onChange={setSessionId} /></div>
        <div className="md:col-span-3"><label className={etiquette}>Description / consignes</label>
          <textarea className={champ} rows={2} disabled={lecture} value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center border border-border rounded-lg p-2">
            <input className={`${champ} col-span-1`} disabled={lecture} placeholder="Code" value={it.code} onChange={e => maj(i, { code: e.target.value })} />
            <input className={`${champ} col-span-2`} disabled={lecture} placeholder="Domaine" value={it.domaine} onChange={e => maj(i, { domaine: e.target.value })} />
            <input className={`${champ} col-span-4`} disabled={lecture} placeholder="Libellé" value={it.libelle} onChange={e => maj(i, { libelle: e.target.value })} />
            <select className={`${champ} col-span-2`} disabled={lecture} value={it.type} onChange={e => maj(i, { type: e.target.value as GrilleItem["type"] })}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <input className={`${champ} col-span-1`} disabled={lecture || it.type !== "echelle"} type="number" min={1} title="Barème maximal"
                   value={it.type === "echelle" ? (it.bareme_max ?? "") : ""} onChange={e => maj(i, { bareme_max: Number(e.target.value) })} />
            <label className="col-span-1 text-[11px] flex items-center gap-1"><input type="checkbox" disabled={lecture} checked={it.obligatoire} onChange={e => maj(i, { obligatoire: e.target.checked })} />oblig.</label>
            {!lecture && <button className="col-span-1 text-danger text-xs" onClick={() => setItems(xs => xs.filter((_, j) => j !== i))}>Retirer</button>}
          </div>
        ))}
      </div>
      {!lecture && (
        <div className="flex justify-between mt-4">
          <button className={bouton} onClick={ajouter}>+ Item</button>
          <button className={boutonPrincipal} onClick={enregistrer} disabled={!nom.trim()}>Enregistrer le brouillon</button>
        </div>
      )}
    </Modale>
  );
}

export default function GrillesPage() {
  const [grilles, setGrilles] = useState<Grille[]>([]);
  const [edition, setEdition] = useState<Grille | null | undefined>(undefined);

  const charger = useCallback(async () => {
    try { setGrilles((await grillesApi.list()).data); } catch (e) { notifyError("Impossible de charger les grilles.", e); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const action = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); charger(); } catch (e) { notifyError(msg, e); } };

  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Grilles de visite</h1>
          <p className="text-tx-muted text-sm max-w-3xl">
            Items, domaines, barèmes et non-applicables sont à valider par ARED avant publication. La grille provisoire
            créée à l&apos;installation reprend les domaines de l&apos;export superviseur historique (O, P, C, R, T, LL, LM, J et outils).
          </p>
        </div>
        <button className={boutonPrincipal} onClick={() => setEdition(null)}>Nouvelle grille</button>
      </div>
      <div className="space-y-3">
        {grilles.map(g => (
          <div key={g.id} className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <p className="font-semibold text-tx">{g.nom} <span className="text-tx-muted font-normal">v{g.version}</span>{" "}
                <Badge ton={g.statut === "active" ? "ok" : g.statut === "brouillon" ? "info" : "neutre"}>{g.statut}</Badge></p>
              <p className="text-xs text-tx-muted">{g.items.length} items · {g.nb_visites} visite(s) · {g.publiee_le ? `publiée le ${fmtDate(g.publiee_le)}` : "non publiée"}</p>
            </div>
            <button className={bouton} onClick={() => setEdition(g)}>{g.statut === "brouillon" ? "Modifier" : "Consulter"}</button>
            {g.statut === "brouillon" && (
              <button className={bouton} onClick={() => window.confirm("Publier cette grille ? Elle ne sera plus modifiable et remplacera la version active de même nom.")
                && action(() => grillesApi.publier(g.id), "Publication impossible.")}>Publier</button>
            )}
            {g.statut !== "brouillon" && <button className={bouton} onClick={() => action(() => grillesApi.nouvelleVersion(g.id), "Création impossible.")}>Nouvelle version</button>}
            {g.statut === "active" && (
              <button className={bouton} onClick={() => {
                const m = window.prompt("Motif du retrait de cette grille :");
                if (m && m.trim().length >= 3) action(() => grillesApi.retirer(g.id, m), "Retrait impossible.");
              }}>Retirer</button>
            )}
          </div>
        ))}
      </div>
      {edition !== undefined && <Editeur g={edition} onFermer={() => setEdition(undefined)} onMaj={charger} />}
    </div>
  );
}
