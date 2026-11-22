"use client";

/**
 * Paramètres de campagne (rapport V2, D8 et D9.3) : calendrier des jours
 * attendus, obligations de transmission/visite (versionnées), seuils d'alerte
 * (proposés par défaut, à valider par ARED) et protocole de recherche du
 * minuteur (APP-33).
 */
import { useCallback, useEffect, useState } from "react";
import { Badge, CampagneSelect, Tableau, bouton, boutonPrincipal, champ, etiquette, fmtDate } from "@/components/L6Ui";
import { campagnesApi, type Obligation, type Parametres, type Seuil } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LIB_SEUILS: Record<string, string> = {
  absences_taux: "Taux d'absence élève déclenchant une alerte",
  absences_consecutives: "Absences consécutives d'un élève",
  retard_transmission_jours: "Retard de transmission toléré",
  visite_delai_jours: "Délai maximal entre deux visites d'un tuteur",
  domaine_taux_min: "Taux minimal par domaine de la grille",
};

function Calendrier({ p, onMaj }: { p: Parametres; onMaj: () => void }) {
  const [jours, setJours] = useState<number[]>([0, 1, 2, 3, 4]);
  const [exceptions, setExceptions] = useState("");
  const [remplacer, setRemplacer] = useState(false);
  const [apercu, setApercu] = useState<Record<string, any> | null>(null);

  const corps = (dry_run: boolean) => ({
    jours_semaine: jours, remplacer, dry_run,
    exceptions: exceptions.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
      const [date, ...m] = l.split(/[;,]/);
      return { date: date.trim(), motif: m.join(" ").trim() || "Exception" };
    }),
  });
  const lancer = async (dry_run: boolean) => {
    try {
      const r = (await campagnesApi.generer(p.campagne.id, corps(dry_run))).data as Record<string, any>;
      setApercu(r);
      if (!dry_run) onMaj();
    } catch (e) { notifyError("Génération impossible.", e); }
  };
  const basculer = async (date: string, attendu: boolean) => {
    const motif = attendu ? undefined : window.prompt("Motif (jour férié, grève, examen…) :") ?? undefined;
    if (!attendu && !motif) return;
    try { await campagnesApi.jour(p.campagne.id, date, { attendu, motif }); onMaj(); }
    catch (e) { notifyError("Modification impossible.", e); }
  };

  return (
    <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-bold text-tx">Calendrier des jours attendus</h2>
        <p className="text-sm text-tx-muted">{p.nb_jours_attendus} jour(s) attendu(s) du {fmtDate(p.campagne.date_debut)} au {fmtDate(p.campagne.date_fin)}.
          Sans calendrier, les taux de transmission sont « non calculables ».</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <p className={etiquette}>Jours de classe</p>
          <div className="flex flex-wrap gap-2">
            {JOURS.map((j, i) => (
              <label key={j} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={jours.includes(i)} onChange={e => setJours(x => e.target.checked ? [...x, i].sort() : x.filter(y => y !== i))} />{j}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={remplacer} onChange={e => setRemplacer(e.target.checked)} />Remplacer le calendrier existant</label>
        </div>
        <div className="md:col-span-2">
          <label className={etiquette}>Exceptions (une par ligne : AAAA-MM-JJ;motif)</label>
          <textarea className={champ} rows={4} value={exceptions} onChange={e => setExceptions(e.target.value)} placeholder={"2026-12-25;Noël\n2027-01-01;Jour de l'an"} />
        </div>
      </div>
      <div className="flex gap-2">
        <button className={bouton} onClick={() => lancer(true)}>Aperçu</button>
        <button className={boutonPrincipal} onClick={() => lancer(false)} disabled={!jours.length}>Générer</button>
      </div>
      {apercu && (
        <p className="text-sm bg-surface-alt rounded-lg p-3">
          {apercu.jours_generes} jour(s) générés · {apercu.jours_attendus} attendus · {apercu.exceptions} exception(s) ·
          {" "}{apercu.deja_presents} déjà présents{apercu.supprimes_si_remplacement ? ` · ${apercu.supprimes_si_remplacement} supprimés` : ""}
          {" "}{apercu.applique ? <Badge ton="ok">Appliqué</Badge> : <Badge ton="info">Aperçu</Badge>}
        </p>
      )}
      {p.calendrier.length > 0 && (
        <div className="max-h-72 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {p.calendrier.map(j => (
            <button key={j.date} title={j.motif ?? ""} onClick={() => basculer(j.date, !j.attendu)}
                    className={`text-left text-xs rounded-md px-2 py-1 border ${j.attendu ? "border-border" : "border-danger bg-danger-soft text-danger"}`}>
              {fmtDate(j.date)}{!j.attendu && <span className="block truncate">{j.motif}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Obligations({ p, onMaj }: { p: Parametres; onMaj: () => void }) {
  const [obl, setObl] = useState<Obligation[]>(p.obligations);
  const [ok, setOk] = useState(false);
  useEffect(() => setObl(p.obligations), [p]);
  const maj = (i: number, patch: Partial<Obligation>) => setObl(xs => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const enregistrer = async () => {
    try {
      await campagnesApi.obligations(p.campagne.id, obl.map(({ id, version, ...o }) => o));
      setOk(true); onMaj();
    } catch (e) { notifyError("Enregistrement impossible.", e); }
  };
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 space-y-3">
      <h2 className="font-bold text-tx">Obligations par rôle</h2>
      <p className="text-sm text-tx-muted">Ce qui est attendu de chaque acteur ; sert au calcul des relances et des taux de la vue « Soumissions ».</p>
      {obl.map((o, i) => (
        <div key={i} className="grid grid-cols-2 md:grid-cols-7 gap-2 items-center">
          <select className={champ} value={o.role} onChange={e => maj(i, { role: e.target.value as Obligation["role"] })}>
            <option value="enseignant">Tuteur</option><option value="superviseur">Superviseur</option></select>
          <select className={champ} value={o.objet} onChange={e => maj(i, { objet: e.target.value as Obligation["objet"] })}>
            <option value="rapport_journalier">Rapport journalier</option><option value="pointage">Pointage</option><option value="visite">Visite</option></select>
          <select className={champ} value={o.periodicite} onChange={e => maj(i, { periodicite: e.target.value as Obligation["periodicite"] })}>
            <option value="jour">par jour attendu</option><option value="semaine">par semaine</option></select>
          <input type="number" min={1} className={champ} title="Quantité" value={o.quantite} onChange={e => maj(i, { quantite: Number(e.target.value) })} />
          <input type="number" min={0} className={champ} title="Délai de transmission (jours)" value={o.delai_jours} onChange={e => maj(i, { delai_jours: Number(e.target.value) })} />
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={o.active} onChange={e => maj(i, { active: e.target.checked })} />Active {o.version ? <span className="text-tx-muted">v{o.version}</span> : null}</label>
          <button className="text-danger text-xs text-left" onClick={() => setObl(xs => xs.filter((_, j) => j !== i))}>Retirer</button>
        </div>
      ))}
      <p className="text-[11px] text-tx-muted">Colonnes : rôle · objet · périodicité · quantité · délai (jours) · active.</p>
      <div className="flex gap-2">
        <button className={bouton} onClick={() => setObl(x => [...x, { role: "enseignant", objet: "rapport_journalier", periodicite: "jour", quantite: 1, delai_jours: 1, active: true }])}>+ Obligation</button>
        <button className={boutonPrincipal} onClick={enregistrer}>Enregistrer</button>
        {ok && <Badge ton="ok">Enregistré (nouvelle version)</Badge>}
      </div>
    </section>
  );
}

function Seuils({ p, onMaj }: { p: Parametres; onMaj: () => void }) {
  const [s, setS] = useState<Seuil[]>(p.seuils);
  const [ok, setOk] = useState(false);
  useEffect(() => setS(p.seuils), [p]);
  const enregistrer = async () => {
    try {
      await campagnesApi.seuils(p.campagne.id, s.map(x => ({ code: x.code, valeur: Number(x.valeur), regle: x.regle })));
      setOk(true); onMaj();
    } catch (e) { notifyError("Enregistrement impossible.", e); }
  };
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 space-y-3">
      <h2 className="font-bold text-tx">Seuils d&apos;alerte</h2>
      <p className="text-sm text-tx-muted">Valeurs « proposées » par défaut, à valider par ARED. Une valeur enregistrée ici s&apos;applique à cette campagne.</p>
      <Tableau lignes={s as any[]} colonnes={[
        { cle: "code", titre: "Seuil", rendu: (x: Seuil) => LIB_SEUILS[x.code] ?? x.code },
        { cle: "valeur", titre: "Valeur", rendu: (x: Seuil) => (
          <input type="number" className={`${champ} w-28`} value={x.valeur}
                 onChange={e => setS(xs => xs.map(y => (y.code === x.code ? { ...y, valeur: Number(e.target.value) } : y)))} />) },
        { cle: "unite", titre: "Unité" },
        { cle: "provenance", titre: "Provenance", rendu: (x: Seuil) => <Badge ton={x.provenance === "propose" ? "info" : "ok"}>{x.provenance}</Badge> },
      ]} />
      <div className="flex items-center gap-2">
        <button className={boutonPrincipal} onClick={enregistrer}>Enregistrer les seuils</button>
        {ok && <Badge ton="ok">Enregistré</Badge>}
      </div>
    </section>
  );
}

export default function ParametresCampagnePage() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [p, setP] = useState<Parametres | null>(null);

  const charger = useCallback(async () => {
    if (!sessionId) return;
    try { setP((await campagnesApi.parametres(sessionId)).data); } catch (e) { notifyError("Paramètres indisponibles.", e); }
  }, [sessionId]);
  useEffect(() => { charger(); }, [charger]);

  const protocole = async (actif: boolean) => {
    if (!p) return;
    const msg = actif
      ? "Activer le protocole : l'affichage du minuteur sera piloté par le groupe de recherche (traitement / contrôle). Continuer ?"
      : "Désactiver le protocole : chaque compte retrouve son réglage individuel. Continuer ?";
    if (!window.confirm(msg)) return;
    try { await campagnesApi.protocole(p.campagne.id, actif); charger(); } catch (e) { notifyError("Modification impossible.", e); }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Paramètres de campagne</h1>
          <p className="text-tx-muted text-sm">Calendrier, obligations, seuils et protocole de recherche.</p>
        </div>
        <div className="w-72"><label className={etiquette}>Campagne</label><CampagneSelect value={sessionId} onChange={setSessionId} /></div>
      </div>
      {p && (
        <>
          <section className="bg-surface border border-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-tx">Protocole minuteur (APP-33) {p.campagne.protocole_minuteur ? <Badge ton="ok">Actif</Badge> : <Badge>Inactif</Badge>}</h2>
              <p className="text-sm text-tx-muted max-w-2xl">Actif : le serveur décide de l&apos;affichage du minuteur selon le groupe (contrôle = sans minuteur). Les exceptions individuelles exigent un motif et sont tracées.</p>
            </div>
            <button className={p.campagne.protocole_minuteur ? bouton : boutonPrincipal} onClick={() => protocole(!p.campagne.protocole_minuteur)}>
              {p.campagne.protocole_minuteur ? "Désactiver" : "Activer"}
            </button>
          </section>
          <Calendrier p={p} onMaj={charger} />
          <Obligations p={p} onMaj={charger} />
          <Seuils p={p} onMaj={charger} />
        </>
      )}
    </div>
  );
}
