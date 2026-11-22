/**
 * Client API du lot L6 (rapport V2, Partie II D8-D10, APP-33) :
 * tableau de bord D8, visites et grilles, demandes d'appui, paramètres de
 * campagne, présences, protocole de recherche, reprise de l'historique et
 * clés de service.
 */
import { api } from "./api";

export interface FiltresTb {
  session_id?: string;
  date_debut?: string;
  date_fin?: string;
  school_id?: string;
  region?: string;
  commune?: string;
  teacher_id?: string;
}

const net = <T extends object>(f: T) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "" && v !== undefined && v !== null && v !== false));

/** Déclenche le téléchargement d'un Blob reçu de l'API. */
export function telecharger(data: Blob, nom: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export type Vue = {
  statut: "calcule" | "non_calculable";
  raison?: string;
  totaux: Record<string, number | null>;
  lignes: Record<string, any>[];
  unites?: Record<string, string>;
  [k: string]: any;
};

export const tableauBordApi = {
  vue: (vue: "vue-ensemble" | "soumissions" | "relances" | "assiduite" | "supervision" | "appui", f: FiltresTb) =>
    api.get<Vue>(`/admin/tableau-de-bord/${vue}`, { params: net(f) }),
  csv: (vue: "relances" | "assiduite", f: FiltresTb) =>
    api.get<Blob>(`/admin/tableau-de-bord/${vue}`, { params: net({ ...f, format: "csv" }), responseType: "blob", timeout: 0 }),
};

// ── Grilles et visites ────────────────────────────────────────────────────────
export interface GrilleItem {
  id?: string;
  code: string;
  domaine: string;
  libelle: string;
  type: "echelle" | "oui_non" | "outil" | "texte";
  bareme_max?: number | null;
  ordre: number;
  aide?: string | null;
  obligatoire: boolean;
}
export interface Grille {
  id: string;
  nom: string;
  version: number;
  statut: "brouillon" | "active" | "retiree";
  session_id: string | null;
  description: string | null;
  publiee_le: string | null;
  created_at: string;
  items: GrilleItem[];
  nb_visites: number;
}
export interface Visite {
  id: string;
  superviseur_id: string;
  superviseur_nom: string | null;
  teacher_id: string;
  teacher_nom: string | null;
  ecole: string | null;
  classe: string | null;
  session_id: string | null;
  grille_id: string;
  grille_version: number | null;
  date_visite: string;
  heure_debut: string | null;
  duree_minutes: number | null;
  points_appui: string | null;
  points_amelioration: string | null;
  commentaire: string | null;
  score_obtenu: number | null;
  score_max: number | null;
  scores_domaines: Record<string, { obtenu: number; max: number; items: number; taux: number | null }> | null;
  nb_items_manquants: number;
  nb_outils_indisponibles: number;
  statut: "soumise" | "annulee";
  statut_motif: string | null;
  created_at: string;
  reponses: { item_id: string; valeur: number | null; disponible: boolean | null; texte: string | null; non_applicable: boolean }[];
  demandes: Demande[];
}

export const grillesApi = {
  list: () => api.get<Grille[]>("/admin/grilles-visite"),
  create: (d: unknown) => api.post<Grille>("/admin/grilles-visite", d),
  update: (id: string, d: unknown) => api.put<Grille>(`/admin/grilles-visite/${id}`, d),
  publier: (id: string) => api.post<Grille>(`/admin/grilles-visite/${id}/publier`),
  nouvelleVersion: (id: string) => api.post<Grille>(`/admin/grilles-visite/${id}/nouvelle-version`),
  retirer: (id: string, motif: string) => api.post<Grille>(`/admin/grilles-visite/${id}/retirer`, { motif }),
};

export const visitesApi = {
  list: (p: Record<string, unknown>) => api.get<{ total: number; items: Visite[] }>("/admin/visites", { params: net(p) }),
  get: (id: string) => api.get<Visite>(`/admin/visites/${id}`),
  annuler: (id: string, motif: string) => api.post<Visite>(`/admin/visites/${id}/annuler`, { motif }),
  export: (p: Record<string, unknown>) =>
    api.get<Blob>("/admin/visites/export", { params: net(p), responseType: "blob", timeout: 0 }),
};

// ── Demandes d'appui ──────────────────────────────────────────────────────────
export interface Evenement {
  id: string;
  type: string;
  ancien_statut: string | null;
  nouveau_statut: string | null;
  responsable_nom: string | null;
  commentaire: string | null;
  auteur_nom: string | null;
  created_at: string;
}
export interface Demande {
  id: string;
  origine: "visite" | "difficulte" | "besoin" | "manuel";
  visite_id: string | null;
  rapport_id: string | null;
  libelle_source: string | null;
  domaine: string | null;
  titre: string;
  description: string | null;
  beneficiaire_id: string | null;
  beneficiaire_nom: string | null;
  ecole: string | null;
  responsable_id: string | null;
  responsable_nom: string | null;
  echeance: string | null;
  en_retard: boolean;
  statut: "ouverte" | "assignee" | "en_cours" | "resolue" | "abandonnee";
  created_at: string;
  cloturee_le: string | null;
  evenements: Evenement[];
}

export const demandesApi = {
  list: (p: Record<string, unknown>) => api.get<{ total: number; items: Demande[] }>("/admin/demandes-appui", { params: net(p) }),
  get: (id: string) => api.get<Demande>(`/admin/demandes-appui/${id}`),
  create: (d: unknown) => api.post<Demande>("/admin/demandes-appui", d),
  depuisRapport: (d: unknown) => api.post<Demande>("/admin/demandes-appui/depuis-rapport", d),
  agir: (id: string, d: unknown) => api.patch<Demande>(`/admin/demandes-appui/${id}`, d),
  export: (p: Record<string, unknown>) =>
    api.get<Blob>("/admin/demandes-appui/export", { params: net(p), responseType: "blob", timeout: 0 }),
  exportEvenements: (p: Record<string, unknown>) =>
    api.get<Blob>("/admin/demandes-appui/evenements/export", { params: net(p), responseType: "blob", timeout: 0 }),
};

// ── Paramètres de campagne ────────────────────────────────────────────────────
export interface Obligation {
  id?: string;
  role: "enseignant" | "superviseur";
  objet: "rapport_journalier" | "pointage" | "visite";
  periodicite: "jour" | "semaine";
  quantite: number;
  delai_jours: number;
  active: boolean;
  version?: number;
  commentaire?: string | null;
}
export interface Seuil { code: string; valeur: number; unite: string; regle: string | null; provenance: string }
export interface Parametres {
  campagne: { id: string; nom: string; date_debut: string; date_fin: string; protocole_minuteur: boolean };
  calendrier: { date: string; attendu: boolean; motif: string | null }[];
  nb_jours_attendus: number;
  obligations: Obligation[];
  seuils: Seuil[];
}

export const campagnesApi = {
  parametres: (id: string) => api.get<Parametres>(`/admin/campagnes/${id}/parametres`),
  generer: (id: string, d: unknown) => api.post(`/admin/campagnes/${id}/calendrier/generer`, d),
  jour: (id: string, date: string, d: { attendu: boolean; motif?: string }) =>
    api.patch(`/admin/campagnes/${id}/calendrier/${date}`, d),
  obligations: (id: string, d: Obligation[]) => api.put<Parametres>(`/admin/campagnes/${id}/obligations`, d),
  seuils: (id: string, d: { code: string; valeur: number; regle?: string | null }[]) =>
    api.put<Parametres>(`/admin/campagnes/${id}/seuils`, d),
  protocole: (id: string, actif: boolean) => api.patch(`/admin/sessions/${id}`, { protocole_minuteur: actif }),
};

// ── Protocole de recherche (APP-33) ───────────────────────────────────────────
export const rechercheApi = {
  matrice: (session_id?: string) => api.get("/admin/recherche/matrice", { params: net({ session_id }) }),
  aligner: (d: { session_id?: string; motif: string; dry_run: boolean }) => api.post("/admin/recherche/aligner", d),
  historique: (user_id?: string) => api.get("/admin/recherche/historique", { params: net({ user_id }) }),
  assigner: (d: { user_id: string; groupe_recherche: string | null; app_access: string; motif: string }) =>
    api.post("/admin/recherche/assignation", d),
};

// ── Reprise de l'historique (D10.2) ───────────────────────────────────────────
export const repriseApi = {
  lots: () => api.get("/admin/reprise/lots"),
  lot: (id: string) => api.get(`/admin/reprise/lots/${id}`),
  lignes: (id: string, p: Record<string, unknown>) => api.get(`/admin/reprise/lots/${id}/lignes`, { params: net(p) }),
  correspondances: (type?: string) => api.get("/admin/reprise/correspondances", { params: net({ type }) }),
  importerCorrespondances: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/reprise/correspondances/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

// ── Clés de service (D9.4) ────────────────────────────────────────────────────
export const clesApi = {
  list: () => api.get("/admin/cles-service"),
  create: (d: { nom: string; portees: string[]; expire_le?: string | null }) => api.post("/admin/cles-service", d),
  revoquer: (id: string) => api.post(`/admin/cles-service/${id}/revoquer`),
};

export const LIBELLES_STATUT_DEMANDE: Record<Demande["statut"], string> = {
  ouverte: "Ouverte", assignee: "Affectée", en_cours: "En cours", resolue: "Résolue", abandonnee: "Abandonnée",
};
export const LIBELLES_ORIGINE: Record<Demande["origine"], string> = {
  visite: "Visite", difficulte: "Difficulté (rapport)", besoin: "Besoin d'appui (rapport)", manuel: "Manuelle",
};
