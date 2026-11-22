"use client";

/**
 * Tableau de bord de suivi (rapport V2, Partie II D8).
 * Les filtres (campagne, période, école) sont conservés d'une vue à l'autre.
 * Chaque vue indique ses unités et ses règles ; une vue dont les données ne
 * sont pas configurées ou collectées est affichée « non calculable » avec la
 * raison. Les seuils d'alerte sont des règles paramétrées, pas des prédictions.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge, CampagneSelect, Chiffre, EcoleSelect, NonCalculable, Tableau, bouton, champ, etiquette, fmtDate, fmtDateHeure,
} from "@/components/L6Ui";
import { tableauBordApi, telecharger, type FiltresTb, type Vue } from "@/lib/l6";
import { notifyError } from "@/lib/notify";

const VUES = [
  { id: "vue-ensemble", titre: "Vue d'ensemble" },
  { id: "soumissions", titre: "Mise en œuvre et soumissions" },
  { id: "assiduite", titre: "Assiduité" },
  { id: "supervision", titre: "Supervision et outils" },
  { id: "appui", titre: "Difficultés et appui" },
] as const;
type IdVue = (typeof VUES)[number]["id"];

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("fr-FR")} %`);

function Regle({ s }: { s?: { valeur: number; unite: string; regle: string | null; provenance: string } }) {
  if (!s) return null;
  return (
    <p className="text-[11px] text-tx-muted">
      Seuil : <strong className="text-tx">{s.valeur} {s.unite}</strong> — {s.regle}{" "}
      <Badge ton={s.provenance === "propose" ? "neutre" : "info"}>{s.provenance === "propose" ? "valeur proposée" : s.provenance}</Badge>
    </p>
  );
}

function VueEnsemble({ v }: { v: Vue }) {
  const t = v.totaux;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Chiffre libelle="Écoles actives" valeur={t.ecoles_actives} />
        <Chiffre libelle="Classes actives" valeur={t.classes_actives} />
        <Chiffre libelle="Élèves actifs" valeur={t.eleves_actifs} />
        <Chiffre libelle="Tuteurs affectés" valeur={t.tuteurs_affectes} unite="à la campagne" />
        <Chiffre libelle="Rapports reçus" valeur={t.rapports_recus} unite="sur la période (hors annulés)" />
        <Chiffre libelle="Visites pédagogiques" valeur={t.visites_recues} />
        <Chiffre libelle="Appels individuels" valeur={t.presences_individuelles} unite="élève × jour" />
        <Chiffre libelle="Élèves avec appel" valeur={t.eleves_avec_appel} />
      </div>
      <p className="text-xs text-tx-muted">Données à jour au <strong className="text-tx">{fmtDateHeure(v.fraicheur)}</strong>.</p>
      {(!v.calendrier_configure || !v.obligations_configurees) && (
        <div className="bg-brand-soft border border-border rounded-2xl p-4 text-sm">
          Pour calculer les soumissions attendues et les jours d&apos;appel attendus, configurez le
          {!v.calendrier_configure && " calendrier"}{!v.calendrier_configure && !v.obligations_configurees && " et les"}
          {!v.obligations_configurees && " obligations"} de la campagne dans{" "}
          <Link className="underline font-semibold" href="/dashboard/parametres/campagne">Paramètres de campagne</Link>.
        </div>
      )}
    </div>
  );
}

function Soumissions({ v, f }: { v: Vue; f: FiltresTb }) {
  const [seul, setSeul] = useState(false);
  const lignes = seul ? v.lignes.filter(l => l.manquant > 0) : v.lignes;
  const exporter = async () => {
    try { telecharger((await tableauBordApi.csv("relances", f)).data, "relances.csv"); }
    catch (e) { notifyError("Export de la liste de relance impossible.", e); }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Chiffre libelle="Attendues" valeur={v.totaux.attendu} unite={`${v.periode.jours_attendus} jour(s) attendu(s)`} />
        <Chiffre libelle="Reçues" valeur={v.totaux.recu} unite="plafonnées à l'attendu" />
        <Chiffre libelle="Taux" valeur={pct(v.totaux.taux)} />
        <Chiffre libelle="Sans aucune soumission" valeur={v.totaux.sans_soumission} ton={v.totaux.sans_soumission ? "alerte" : "ok"} />
        <Chiffre libelle="Reçues en retard" valeur={v.totaux.en_retard} />
      </div>
      <div className="text-[11px] text-tx-muted space-y-0.5">
        {v.regles.map((r: any) => (
          <p key={r.role + r.objet}>Règle v{r.version} : {r.role} — {r.quantite} {r.objet.replace("_", " ")} par {r.periodicite}, transmis sous {r.delai_jours} j.</p>
        ))}
        <Regle s={v.seuil_retard} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seul} onChange={e => setSeul(e.target.checked)} /> Seulement les acteurs à relancer</label>
        <button className={`${bouton} ml-auto`} onClick={exporter}>Télécharger la liste de relance (CSV, journalisé)</button>
      </div>
      <Tableau lignes={lignes} colonnes={[
        { cle: "acteur", titre: "Acteur" },
        { cle: "role", titre: "Rôle" },
        { cle: "objet", titre: "Obligation", rendu: l => l.objet.replace("_", " ") },
        { cle: "ecole", titre: "École" },
        { cle: "attendu", titre: "Attendu", className: "text-right" },
        { cle: "recu", titre: "Reçu", className: "text-right" },
        { cle: "taux", titre: "Taux", className: "text-right", rendu: l => pct(l.taux) },
        { cle: "en_retard", titre: "En retard", className: "text-right" },
        { cle: "derniere_soumission", titre: "Dernière", rendu: l => fmtDateHeure(l.derniere_soumission) },
        { cle: "etat", titre: "", rendu: l => l.sans_soumission ? <Badge ton="alerte">Aucune</Badge> : l.manquant ? <Badge>À relancer</Badge> : <Badge ton="ok">À jour</Badge> },
      ]} />
    </div>
  );
}

function Assiduite({ v, f }: { v: Vue; f: FiltresTb }) {
  const [alertes, setAlertes] = useState(true);
  const lignes = alertes ? v.lignes.filter(l => l.alertes.length) : v.lignes;
  const exporter = async () => {
    try { telecharger((await tableauBordApi.csv("assiduite", f)).data, "assiduite.csv"); }
    catch (e) { notifyError("Export de l'assiduité impossible.", e); }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Chiffre libelle="Élèves avec appel" valeur={v.totaux.eleves} />
        <Chiffre libelle="Jours d'appel renseignés" valeur={v.totaux.jours_renseignes} unite="élève × jour" />
        <Chiffre libelle="Absences" valeur={v.totaux.absences} />
        <Chiffre libelle="Élèves en alerte" valeur={v.totaux.eleves_en_alerte} ton={v.totaux.eleves_en_alerte ? "alerte" : "ok"} />
      </div>
      <div className="space-y-0.5">
        <Regle s={v.seuils.absences_taux} />
        <Regle s={v.seuils.absences_consecutives} />
        {!v.calendrier_configure && <p className="text-[11px] text-tx-muted">Calendrier non configuré : les jours attendus sans appel ne sont pas calculés.</p>}
        {v.tronque && <p className="text-[11px] text-danger">Affichage limité : téléchargez le CSV pour la liste complète.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alertes} onChange={e => setAlertes(e.target.checked)} /> Seulement les élèves en alerte</label>
        <button className={`${bouton} ml-auto`} onClick={exporter}>Télécharger (CSV nominatif, journalisé)</button>
      </div>
      <Tableau lignes={lignes} vide="Aucun élève ne dépasse les seuils." colonnes={[
        { cle: "nom", titre: "Élève" },
        { cle: "classe", titre: "Classe" },
        { cle: "ecole", titre: "École" },
        { cle: "jours_renseignes", titre: "Jours renseignés", className: "text-right" },
        { cle: "absences", titre: "Absences", className: "text-right" },
        { cle: "absences_excusees", titre: "Excusées", className: "text-right" },
        { cle: "jours_non_renseignes", titre: "Non renseignés", className: "text-right" },
        { cle: "taux_absence", titre: "Taux", className: "text-right", rendu: l => pct(l.taux_absence) },
        { cle: "max_absences_consecutives", titre: "Consécutives", className: "text-right" },
        { cle: "alertes", titre: "", rendu: l => l.alertes.map((a: string) => <Badge key={a} ton="alerte">{a === "taux" ? "taux" : "consécutives"}</Badge>) },
      ]} />
    </div>
  );
}

function Supervision({ v }: { v: Vue }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Chiffre libelle="Tuteurs" valeur={v.totaux.tuteurs} />
        <Chiffre libelle="Visites" valeur={v.totaux.visites} />
        <Chiffre libelle="Tuteurs visités" valeur={v.totaux.tuteurs_visites} />
        <Chiffre libelle="Sans visite récente" valeur={v.totaux.sans_visite_recente} ton={v.totaux.sans_visite_recente ? "alerte" : "ok"} />
      </div>
      <div className="space-y-0.5"><Regle s={v.seuils.visite_delai_jours} /><Regle s={v.seuils.domaine_taux_min} /></div>
      {Object.keys(v.domaines ?? {}).length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-2">Taux moyen par domaine de la grille</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(v.domaines).map(([d, t]) => (
              <Badge key={d} ton={(t as number) < v.seuils.domaine_taux_min.valeur ? "alerte" : "ok"}>{d} : {pct(t as number)}</Badge>
            ))}
          </div>
        </div>
      )}
      {v.items?.length > 0 && (
        <Tableau lignes={v.items} colonnes={[
          { cle: "code", titre: "Item" }, { cle: "libelle", titre: "Libellé" }, { cle: "domaine", titre: "Domaine" },
          { cle: "reponses", titre: "Réponses", className: "text-right" },
          { cle: "taux_moyen", titre: "Taux moyen", className: "text-right", rendu: l => l.type === "outil" ? "—" : pct(l.taux_moyen) },
          { cle: "indisponibles", titre: "Outil indisponible", className: "text-right" },
        ]} />
      )}
      <Tableau lignes={v.lignes} colonnes={[
        { cle: "tuteur", titre: "Tuteur" }, { cle: "ecole", titre: "École" },
        { cle: "classes", titre: "Classes", rendu: l => (l.classes ?? []).join(", ") || "—" },
        { cle: "nb_visites", titre: "Visites", className: "text-right" },
        { cle: "derniere_visite", titre: "Dernière visite", rendu: l => fmtDate(l.derniere_visite) },
        { cle: "dernier_superviseur", titre: "Par" },
        { cle: "domaines_a_appuyer", titre: "Domaines à appuyer", rendu: l => l.domaines_a_appuyer.join(", ") || "—" },
        { cle: "outils_indisponibles", titre: "Outils manquants", className: "text-right" },
        { cle: "etat", titre: "", rendu: l => l.sans_visite_recente ? <Badge ton="alerte">À visiter</Badge> : <Badge ton="ok">Suivi</Badge> },
      ]} />
    </div>
  );
}

function Appui({ v }: { v: Vue }) {
  const t = v.totaux;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Chiffre libelle="Demandes ouvertes" valeur={t.ouvertes} />
        <Chiffre libelle="En retard" valeur={t.en_retard} ton={t.en_retard ? "alerte" : "ok"} />
        <Chiffre libelle="Sans responsable" valeur={t.sans_responsable} ton={t.sans_responsable ? "alerte" : "ok"} />
        <Chiffre libelle="Délai moyen de résolution" valeur={t.delai_moyen_resolution} unite="jours" />
        <Chiffre libelle="Résolues" valeur={t.resolues} />
        <Chiffre libelle="Total" valeur={t.demandes} />
        <Chiffre libelle="Besoins de rapports non traités" valeur={t.besoins_rapports_non_traites} unite="rapports avec appui demandé sans demande" />
      </div>
      <Tableau lignes={v.par_domaine} colonnes={[
        { cle: "domaine", titre: "Domaine" }, { cle: "total", titre: "Total", className: "text-right" },
        { cle: "ouvertes", titre: "Ouvertes", className: "text-right" },
      ]} />
      <Link href="/dashboard/demandes-appui" className={bouton}>Ouvrir le suivi des demandes →</Link>
    </div>
  );
}

export default function TableauDeBordPage() {
  const [vue, setVue] = useState<IdVue>("vue-ensemble");
  const [f, setF] = useState<FiltresTb>({});
  const [res, setRes] = useState<{ vue: IdVue; v: Vue } | null>(null);
  const data = res && res.vue === vue ? res.v : null;
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (!f.session_id) return;
    const t = setTimeout(async () => {
      setChargement(true);
      try { setRes({ vue, v: (await tableauBordApi.vue(vue, f)).data }); }
      catch (e) { setRes(null); notifyError("Impossible de calculer cette vue.", e); }
      finally { setChargement(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [vue, f]);

  const set = (k: keyof FiltresTb, v?: string) => setF(x => ({ ...x, [k]: v || undefined }));

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-tx mb-0.5">Suivi de la mise en œuvre</h1>
        <p className="text-tx-muted text-sm max-w-3xl">
          Vues calculées par le serveur à partir des affectations datées, du calendrier et des obligations de la campagne.
          Les manquants ne sont jamais comptés comme zéro ; les listes nominatives sont réservées à l&apos;administration.
        </p>
      </div>
      <div className="bg-surface border border-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div><label className={etiquette}>Campagne</label><CampagneSelect value={f.session_id} onChange={v => set("session_id", v)} /></div>
        <div><label className={etiquette}>Du</label><input type="date" className={champ} value={f.date_debut ?? ""} onChange={e => set("date_debut", e.target.value)} /></div>
        <div><label className={etiquette}>Au</label><input type="date" className={champ} value={f.date_fin ?? ""} onChange={e => set("date_fin", e.target.value)} /></div>
        <div><label className={etiquette}>École</label><EcoleSelect value={f.school_id} onChange={v => set("school_id", v)} /></div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border">
        {VUES.map(x => (
          <button key={x.id} onClick={() => setVue(x.id)}
                  className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${vue === x.id ? "border-brand text-brand" : "border-transparent text-tx-muted hover:text-tx"}`}>
            {x.titre}
          </button>
        ))}
        {chargement && <span className="ml-auto self-center text-xs text-tx-muted">Calcul en cours…</span>}
      </div>
      {data && data.statut === "non_calculable" && <NonCalculable raison={data.raison} />}
      {data && data.statut === "calcule" && (
        vue === "vue-ensemble" ? <VueEnsemble v={data} /> :
        vue === "soumissions" ? <Soumissions v={data} f={f} /> :
        vue === "assiduite" ? <Assiduite v={data} f={f} /> :
        vue === "supervision" ? <Supervision v={data} /> : <Appui v={data} />
      )}
    </div>
  );
}
