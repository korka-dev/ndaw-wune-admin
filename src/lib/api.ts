import axios from "axios";
import {
  getAccessToken,
  refreshSession,
  clearAuthCookies,
} from "./cookies";
import { nouvelIdRequete } from "./support";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const api = axios.create({ baseURL: API_URL });

// ── Intercepteur requête : injection du Bearer token depuis le cookie ─────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  // APP-45 : référence de requête, reprise dans les journaux de l'API.
  config.headers["X-Request-ID"] = nouvelIdRequete();
  return config;
});

// ── Intercepteur réponse : refresh automatique sur 401 ───────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Compte pas encore activé : le serveur impose le changement du mot de passe temporaire
    if (
      error.response?.status === 403 &&
      error.response?.data?.detail === "PASSWORD_CHANGE_REQUIRED" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/change-password"
    ) {
      window.location.href = "/change-password";
      return Promise.reject(error);
    }

    // Une erreur 401 sur la connexion elle-même (identifiants faux) n'est pas
    // une session expirée : pas de renouvellement ni de redirection.
    const url: string = original?.url ?? "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/refresh");

    if (error.response?.status === 401 && original && !isAuthCall && !original._retry) {
      original._retry = true;
      // Renouvellement côté serveur (cookie httpOnly) — partagé entre requêtes concurrentes
      const outcome = await refreshSession();
      if ("accessToken" in outcome) {
        original.headers.Authorization = `Bearer ${outcome.accessToken}`;
        return api(original);
      }
      if ("fatal" in outcome && outcome.fatal) {
        // Session réellement invalide : retour à la connexion
        await clearAuthCookies();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      // Incident temporaire (API injoignable, 5xx) : on ne déconnecte pas et on
      // ne perd pas la saisie en cours — l'erreur remonte à l'écran appelant.
      // Marqueur lu par fetchMe (APP-41) : ce 401 ne prouve pas une session invalide.
      else error.refreshUnavailable = true;
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  // Connexion : voir serverLogin() (route serveur /api/auth/login, APP-09).
  me: () => api.get("/auth/me"),
  changePassword: (new_password: string) =>
    api.post("/auth/change-password", { new_password }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list: (params?: { limit?: number; skip?: number; archives?: boolean }) => api.get("/admin/sessions", { params }),
  create: (d: unknown) => api.post("/admin/sessions", d),
  update: (id: string, d: unknown) => api.patch(`/admin/sessions/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/sessions/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/sessions/${id}/restaurer`),
  activate: (id: string) => api.post(`/admin/sessions/${id}/activate`),
  deactivate: (id: string) => api.patch(`/admin/sessions/${id}`, { status: "inactive" }),
  assignTeachers: (id: string, teacher_ids: string[]) =>
    api.post(`/admin/sessions/${id}/teachers`, { teacher_ids }),
  getTeachers: (id: string) => api.get(`/admin/sessions/${id}/teachers`),
};

export const teachersApi = {
  list: (params?: { limit?: number; skip?: number; archives?: boolean }) => api.get("/admin/teachers", { params }),
  create: (d: unknown) => api.post("/admin/teachers", d),
  update: (id: string, d: unknown) => api.patch(`/admin/teachers/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/teachers/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/teachers/${id}/restaurer`),
  toggleStatus: (id: string) => api.post(`/admin/teachers/${id}/toggle-status`),
  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/teachers/import/csv", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  importXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/teachers/import/xlsx", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  reimportXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/teachers/reimport", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

export const schoolsApi = {
  list: (params?: { limit?: number; skip?: number; archives?: boolean }) => api.get("/admin/schools", { params }),
  create: (d: unknown) => api.post("/admin/schools", d),
  update: (id: string, d: unknown) => api.patch(`/admin/schools/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/schools/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/schools/${id}/restaurer`),
  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/schools/import/csv", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  importXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/schools/import/xlsx", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  reimportXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/schools/reimport", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

export const planningApi = {
  /** Lot L9 : `type_ecole` = « tous » (défaut), « fls » ou « sans_fls » (aperçu des écoles sans FLS). */
  list: (session_id?: string, semaine?: number, type_ecole?: "tous" | "fls" | "sans_fls") =>
    api.get("/admin/planning", {
      params: {
        ...(session_id ? { session_id } : {}),
        ...(semaine != null ? { semaine } : {}),
        ...(type_ecole && type_ecole !== "tous" ? { type_ecole } : {}),
        limit: 200,
      },
    }),
  /** Lot L9 : nombre d'écoles avec / sans FLS et de créneaux réservés FLS. */
  flsResume: (session_id?: string) =>
    api.get("/admin/planning/fls/resume", { params: session_id ? { session_id } : undefined }),
  /** Lot L9 : import de la répartition des écoles avec / sans FLS (.xlsx). `dryRun` vaut true par défaut. */
  importFls: (file: File, opts?: { dryRun?: boolean; completerIef?: boolean; associations?: Record<string, string> }) => {
    const fd = new FormData();
    fd.append("file", file);
    // Choix de l'admin : { nom dans le fichier : id de l'école } (suggestion acceptée, ambiguïté tranchée).
    if (opts?.associations && Object.keys(opts.associations).length > 0) {
      fd.append("associations", JSON.stringify(opts.associations));
    }
    return api.post("/admin/planning/import-fls", fd, {
      params: {
        dry_run: opts?.dryRun ?? true,
        completer_ief: opts?.completerIef ?? true,
      },
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  create: (d: unknown) => api.post("/admin/planning", d),
  update: (id: string, d: unknown) => api.patch(`/admin/planning/${id}`, d),
  delete: (id: string) => api.delete(`/admin/planning/${id}`),
  /** APP-26 : `dryRun` = aperçu sans modification ; `accepterErreurs` confirme un import partiel. */
  import: (session_id: string, file: File, semaine?: number, opts?: { dryRun?: boolean; accepterErreurs?: boolean }) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/planning/import", fd, {
      params: {
        session_id,
        semaine: semaine ?? undefined,
        dry_run: opts?.dryRun || undefined,
        accepter_erreurs: opts?.accepterErreurs || undefined,
      },
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const rapportsApi = {
  list: (params?: { session_id?: string; teacher_id?: string; limit?: number }) =>
    api.get("/admin/rapports", { params }),
  get: (id: string) => api.get(`/admin/rapports/${id}`),
};

export const suiviApi = {
  list: (params?: { session_id?: string; search?: string }) =>
    api.get("/admin/suivi-seances", { params }),
  detail: (teacher_id: string, params?: { session_id?: string }) =>
    api.get(`/admin/suivi-seances/${teacher_id}`, { params }),
};

export const suiviSuperviseurApi = {
  list: (params?: { session_id?: string; search?: string }) =>
    api.get("/admin/suivi-superviseurs", { params }),
  detail: (superviseur_id: string, params?: { session_id?: string }) =>
    api.get(`/admin/suivi-superviseurs/${superviseur_id}`, { params }),
  exportCsv: (params?: { session_id?: string; search?: string }) =>
    api.get("/admin/suivi-superviseurs/export/csv", { params, responseType: "blob" }),
};

export const suiviEvaluationsApi = {
  list: (params?: {
    superviseur_id?: string;
    resultat?: string;
    classe?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }) => api.get("/admin/suivi-evaluations", { params }),
  superviseurs: () => api.get("/admin/suivi-evaluations/superviseurs"),
};

export const usersApi = {
  list: (params?: { limit?: number; skip?: number; archives?: boolean }) => api.get("/admin/users", { params }),
  create: (d: unknown) => api.post("/admin/users", d),
  update: (id: string, d: unknown) => api.patch(`/admin/users/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/users/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/users/${id}/restaurer`),
  /** Nouveau mot de passe pour un compte admin/coordonnateur (sessions invalidées). */
  resetPassword: (id: string, d: { new_password: string; force_change?: boolean }) =>
    api.post(`/admin/users/${id}/reset-password`, d),
};

export const superviseursApi = {
  list: (params?: { limit?: number; skip?: number; archives?: boolean }) => api.get("/admin/superviseurs", { params }),
  create: (d: unknown) => api.post("/admin/superviseurs", d),
  get: (id: string) => api.get(`/admin/superviseurs/${id}`),
  update: (id: string, d: unknown) => api.patch(`/admin/superviseurs/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/superviseurs/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/superviseurs/${id}/restaurer`),
  toggleStatus: (id: string) => api.post(`/admin/superviseurs/${id}/toggle-status`),
  assignTeachers: (id: string, ids: string[]) => api.post(`/admin/superviseurs/${id}/assign-teachers`, { assigned_teacher_ids: ids }),
  exportCsv: () => api.get("/admin/superviseurs/export/csv", { responseType: "blob" }),
  exportXlsx: (fields?: string) => api.get("/admin/superviseurs/export/xlsx", { params: fields ? { fields } : undefined, responseType: "blob" }),
};

export const comptesTerrainApi = {
  // Liste unifiée tuteurs + superviseurs — les mots de passe ne sont jamais
  // transmis : bcrypt les hache à sens unique, aucune route ne peut les lire.
  list: (params?: { role?: "enseignant" | "superviseur" | "inspecteur"; search?: string; skip?: number; limit?: number; archives?: boolean }) =>
    api.get("/admin/comptes-terrain", { params }),
  resetPassword: (id: string, d: { new_password: string; force_change?: boolean }) =>
    api.post(`/admin/comptes-terrain/${id}/reset-password`, d),
};

export const evaluateursApi = {
  list: (params?: { limit?: number; skip?: number; archives?: boolean }) => api.get("/admin/evaluateurs", { params }),
  create: (d: unknown) => api.post("/admin/evaluateurs", d),
  get: (id: string) => api.get(`/admin/evaluateurs/${id}`),
  update: (id: string, d: unknown) => api.patch(`/admin/evaluateurs/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/evaluateurs/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/evaluateurs/${id}/restaurer`),
  toggleStatus: (id: string) => api.post(`/admin/evaluateurs/${id}/toggle-status`),
  assignTeachers: (id: string, ids: string[]) => api.post(`/admin/evaluateurs/${id}/assign-teachers`, { assigned_teacher_ids: ids }),
};

/** Lot L8 : comptes inspecteurs (IEF) — consultation en lecture seule des écoles de leur IEF dans l'app mobile. */
export const inspecteursApi = {
  list: (params?: { limit?: number; skip?: number; archives?: boolean }) => api.get("/admin/inspecteurs", { params }),
  /** IEF possibles (libellés des écoles) : [{ ief, nb_ecoles }]. */
  iefs: () => api.get("/admin/inspecteurs/iefs"),
  create: (d: { name: string; phone: string; email?: string; title?: string; ief: string }) => api.post("/admin/inspecteurs", d),
  update: (id: string, d: { name?: string; phone?: string; email?: string; title?: string; ief?: string; status?: string }) =>
    api.patch(`/admin/inspecteurs/${id}`, d),
  /** Archivage : l'historique est conservé. */
  delete: (id: string) => api.delete(`/admin/inspecteurs/${id}`),
  restore: (id: string) => api.post(`/admin/inspecteurs/${id}/restaurer`),
  toggleStatus: (id: string) => api.post(`/admin/inspecteurs/${id}/toggle-status`),
};

export const rapportJournalierAdminApi = {
  list: (params?: {
    teacher_id?: string;
    role?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    ief?: string;
    statut?: string;
    skip?: number;
    limit?: number;
  }) =>
    api.get("/admin/rapports/journalier", { params }),
  exportCsv: (params?: {
    teacher_id?: string;
    role?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    ief?: string;
    statut?: string;
    fields?: string;
  }) =>
    api.get("/admin/rapports/journalier/export/csv", {
      params: params ?? {},
      responseType: "blob",
    }),
  stats: (params?: {
    teacher_id?: string;
    role?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    ief?: string;
    statut?: string;
  }) => api.get("/admin/rapports/journalier/stats", { params }),
  photos: (params?: {
    teacher_id?: string;
    role?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    ief?: string;
    statut?: string;
    skip?: number;
    limit?: number;
  }) => api.get("/admin/rapports/journalier/photos", { params }),
  // Les photos sont servies en binaire, une par une : la liste ne les contient
  // plus (un rapport pèse 1 à 3 Mo en base64). Le <img> ne pouvant pas porter
  // l'en-tête d'authentification, on récupère un blob puis une object URL.
  photo: (rapportId: string, index: number) =>
    api.get(`/admin/rapports/journalier/${rapportId}/photo/${index}`, {
      responseType: "blob",
    }),
  /** APP-31 : annulation motivée (le rapport reste consultable avec statut=annule). */
  annuler: (id: string, motif: string) => api.post(`/admin/rapports/journalier/${id}/annuler`, { motif }),
  historique: (id: string) => api.get(`/admin/rapports/journalier/${id}/historique`),
};

export const rapportQuestionsApi = {
  list: () => api.get("/admin/rapport-questions"),
  create: (d: unknown) => api.post("/admin/rapport-questions", d),
  update: (id: string, d: unknown) => api.patch(`/admin/rapport-questions/${id}`, d),
  delete: (id: string) => api.delete(`/admin/rapport-questions/${id}`),
};

export const rapportDifficultesApi = {
  list: () => api.get("/admin/rapport-difficultes"),
  create: (d: unknown) => api.post("/admin/rapport-difficultes", d),
  update: (id: string, d: unknown) => api.patch(`/admin/rapport-difficultes/${id}`, d),
  delete: (id: string) => api.delete(`/admin/rapport-difficultes/${id}`),
};

export const rapportLibellesApi = {
  list: () => api.get("/admin/rapport-libelles"),
  update: (cle: string, d: { texte: string }) => api.patch(`/admin/rapport-libelles/${cle}`, d),
};

export const rapportDifficulteResolutionsApi = {
  list: (params?: { rapport_id?: string; resolue?: boolean }) =>
    api.get("/admin/rapport-difficulte-resolutions", { params }),
  resolve: (
    rapport_id: string,
    d: { difficulte_label: string; resolue: boolean; commentaire_resolution?: string }
  ) => api.patch(`/admin/rapport-difficulte-resolutions/${rapport_id}/resolve`, d),
};

export const progressionConfigsApi = {
  list: () => api.get("/admin/progression-configs"),
  create: (d: { school_id?: string | null; session_id?: string | null; nb_semaines: number; nb_jours: number }) =>
    api.post("/admin/progression-configs", d),
  update: (id: string, d: Partial<{ school_id: string | null; session_id: string | null; nb_semaines: number; nb_jours: number }>) =>
    api.patch(`/admin/progression-configs/${id}`, d),
  delete: (id: string) => api.delete(`/admin/progression-configs/${id}`),
};

export const remplacementsApi = {
  list: (params?: {
    school_id?: string;
    teacher_id?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
    statut?: string;
  }) => api.get("/admin/remplacements", { params }),
  // L7 / RET03 : demande à valider (si ARED a choisi la validation)
  decider: (id: string, d: { decision: "valider" | "refuser"; motif?: string }) =>
    api.post(`/admin/remplacements/${id}/decision`, d),
};

// L7 — décisions terrain
export const terrainApi = {
  propositions: (statut?: string) => api.get("/admin/propositions-groupe", { params: statut ? { statut } : {} }),
  deciderProposition: (id: string, d: { decision: "valider" | "refuser"; motif?: string }) =>
    api.post(`/admin/propositions-groupe/${id}/decision`, d),
  parametres: () => api.get("/admin/terrain/parametres"),
};

export const auditLogsApi = {
  list: (params?: { skip?: number; limit?: number }) =>
    api.get("/admin/audit-logs", { params }),
};

export const evaluationCompetencesApi = {
  list: () => api.get("/admin/evaluation-competences"),
  create: (d: unknown) => api.post("/admin/evaluation-competences", d),
  update: (id: string, d: unknown) => api.patch(`/admin/evaluation-competences/${id}`, d),
  delete: (id: string) => api.delete(`/admin/evaluation-competences/${id}`),
};

/** Filtres serveur de la liste, des compteurs et des exports élèves (APP-38). */
export type EleveFiltres = {
  school_id?: string; session_id?: string; classe?: string; search?: string; ief?: string;
  sexe?: string; statut?: string; type?: "titulaire" | "remplacant"; archives?: boolean;
  sort?: "nom" | "prenom" | "classe" | "statut" | "type" | "ecole" | "ief" | "created_at"; order?: "asc" | "desc";
};

export const elevesApi = {
  list: (params?: EleveFiltres & { skip?: number; limit?: number }) =>
    api.get("/admin/eleves", { params }),
  /** Compteurs agrégés côté serveur sur le résultat filtré (KPI, BI). */
  stats: (params?: EleveFiltres) => api.get("/admin/eleves/stats", { params }),
  create: (d: unknown) => api.post("/admin/eleves", d),
  update: (id: string, d: unknown) => api.patch(`/admin/eleves/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/eleves/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/eleves/${id}/restaurer`),
  bulkDelete: (ids: string[]) => api.delete("/admin/eleves", { data: { ids } }),
  // Export
  // Export du résultat filtré complet (aucun plafond de pagination, APP-38)
  exportCsv: (filtres?: EleveFiltres) => api.get("/admin/eleves/export/csv", { params: filtres, responseType: "blob" }),
  exportXlsx: (fields?: string, filtres?: EleveFiltres) =>
    api.get("/admin/eleves/export/xlsx", { params: { ...filtres, ...(fields ? { fields } : {}) }, responseType: "blob" }),
  // Import unifié (CSV, Excel, PDF)
  import: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/eleves/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  // Modèles à télécharger
  templateCsv: () => api.get("/admin/eleves/template/csv", { responseType: "blob" }),
  templateXlsx: () => api.get("/admin/eleves/template/xlsx", { responseType: "blob" }),
  // Rétrocompat
  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/eleves/import/csv", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  // Import Excel avec liaison école (format liste-élèves ARED)
  importXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/eleves/import/xlsx", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  reimportXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/eleves/reimport", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

export const classesApi = {
  list: (params?: { school_id?: string; niveau?: string; skip?: number; limit?: number; archives?: boolean }) =>
    api.get("/admin/classes", { params }),
  create: (d: unknown) => api.post("/admin/classes", d),
  update: (id: string, d: unknown) => api.patch(`/admin/classes/${id}`, d),
  /** Archive (APP-15) : l'historique est conservé. `definitif` : suppression physique, refusée (409) s'il existe un historique. */
  delete: (id: string, definitif = false) => api.delete(`/admin/classes/${id}`, { params: definitif ? { definitif: true } : undefined }),
  restore: (id: string) => api.post(`/admin/classes/${id}/restaurer`),
  exportXlsx: (fields?: string) => api.get("/admin/classes/export/xlsx", { params: fields ? { fields } : undefined, responseType: "blob" }),
  reimportXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/classes/reimport", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

export const ressourcesApi = {
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/ressources", { params }),
  upload: (file: File, title?: string, description?: string, resource_type?: string, langue?: string,
           classement?: { activite?: string; niveau?: string; version?: string }) => {
    const fd = new FormData();
    // RET08 : classement terrain
    if (classement?.activite) fd.append("activite", classement.activite);
    if (classement?.niveau) fd.append("niveau", classement.niveau);
    if (classement?.version) fd.append("version", classement.version);
    fd.append("file", file);
    if (title) fd.append("title", title);
    if (description) fd.append("description", description);
    if (resource_type) fd.append("resource_type", resource_type);
    if (langue) fd.append("langue", langue);
    return api.post("/admin/ressources", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  update: (id: string, d: { title?: string; description?: string; langue?: string | null;
    activite?: string | null; niveau?: string | null; version?: string | null }) =>
    api.patch(`/admin/ressources/${id}`, d),
  download: (id: string) =>
    api.get(`/admin/ressources/${id}/download`, { responseType: "blob" }),
  delete: (id: string) => api.delete(`/admin/ressources/${id}`),
};

export const evaluationSujetsApi = {
  list: () => api.get("/admin/evaluation-sujets"),
  create: (d: { titre: string; description?: string; nb_eleves_par_classe: number; langue?: string }) =>
    api.post("/admin/evaluation-sujets", d),
  get: (id: string) => api.get(`/admin/evaluation-sujets/${id}`),
  retirage: (id: string) => api.post(`/admin/evaluation-sujets/${id}/retirage`),
  delete: (id: string) => api.delete(`/admin/evaluation-sujets/${id}`),
  audioUrl: (filename: string) => `${API_URL}/app/supervisor/evaluation-audio/${filename}`,
};

export const evaluationDocsApi = {
  list:   ()                          => api.get("/admin/evaluation-docs"),
  get:    (id: string)                => api.get(`/admin/evaluation-docs/${id}`),
  create: (d: {
    langue: string; titre: string;
    lettres: string[]; syllabes: string[]; mots: string[]; operations: string[];
    is_active: boolean;
    semaine_debut?: number | null; semaine_fin?: number | null;
  })                                  => api.post("/admin/evaluation-docs", d),
  update: (id: string, d: Partial<{
    langue: string; titre: string;
    lettres: string[]; syllabes: string[]; mots: string[]; operations: string[];
    is_active: boolean;
    semaine_debut: number | null; semaine_fin: number | null; clear_semaines: boolean;
  }>)                                 => api.patch(`/admin/evaluation-docs/${id}`, d),
  delete: (id: string)                => api.delete(`/admin/evaluation-docs/${id}`),
  upload: (file: File)                => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/admin/evaluation-docs/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Logs d'utilisation de l'app mobile ────────────────────────────────────────
export const usageLogsApi = {
  list: (params?: { feature?: string; user_role?: string; date_from?: string; date_to?: string; skip?: number; limit?: number }) =>
    api.get("/admin/usage-logs", { params }),
  stats: (params?: { date_from?: string; date_to?: string }) =>
    api.get("/admin/usage-logs/stats", { params }),
  exportCsv: (params?: { feature?: string; user_role?: string; date_from?: string; date_to?: string }) =>
    api.get("/admin/usage-logs/export/csv", { params, responseType: "blob" }),
};

// ── Remarques des utilisateurs de l'app mobile ────────────────────────────────
export const remarquesApi = {
  list: (params?: { categorie?: string; statut?: string; skip?: number; limit?: number }) =>
    api.get("/admin/remarques", { params }),
  setStatus: (id: string, statut: "nouveau" | "traite") =>
    api.patch(`/admin/remarques/${id}`, { statut }),
  reply: (id: string, reponse_admin: string) =>
    api.patch(`/admin/remarques/${id}`, { reponse_admin }),
};

// ── Dashboard stats (agrégations SQL, un seul appel) ─────────────────────────
export const dashboardApi = {
  stats: () => api.get("/admin/dashboard/stats"),
};

// Export CSV pour les autres entités
export const exportApi = {
  teachers: () => api.get("/admin/teachers/export/csv", { responseType: "blob" }),
  teachersXlsx: (fields?: string) => api.get("/admin/teachers/export/xlsx", { params: fields ? { fields } : undefined, responseType: "blob" }),
  schools: () => api.get("/admin/schools/export/csv", { responseType: "blob" }),
  schoolsXlsx: (fields?: string) => api.get("/admin/schools/export/xlsx", { params: fields ? { fields } : undefined, responseType: "blob" }),
  planning: (params?: { session_id?: string; semaine?: number; jour?: number; matiere?: string }) =>
    api.get("/admin/planning/export/csv", { params, responseType: "blob" }),
  eleves: () => api.get("/admin/eleves/export/csv", { responseType: "blob" }),
};

// ── Import / Export global (écoles, superviseurs, tuteurs, classes, élèves) ────
export const importExportApi = {
  export: () => api.get("/admin/import-export/export", { responseType: "blob" }),
  /** APP-25 : `dryRun` = aperçu exact (tout est vérifié puis annulé).
   *  Lot L10 : `nouvelleAnnee` = le fichier fait référence (absents archivés). */
  import: (file: File, dryRun = false, nouvelleAnnee = false) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/admin/import-export/import", form, {
      params: { dry_run: dryRun || undefined, nouvelle_annee: nouvelleAnnee || undefined },
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 0, // une base complète (5 000 élèves) prend près d'une minute
    });
  },
  /** Lot L10 : import en tâche de fond (le proxy coupe les requêtes > 60 s). */
  lancer: (file: File, dryRun: boolean, nouvelleAnnee: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/admin/import-export/import/taches", form, {
      params: { dry_run: dryRun, nouvelle_annee: nouvelleAnnee || undefined },
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  suivre: (id: string) => api.get(`/admin/import-export/import/taches/${id}`),
};


// ── Données analytiques (rapport V2, lot L4 — APP-36, Partie II D5-D9) ─────────
export interface AnalytiqueFiltres {
  campagne_id?: string;
  date_debut?: string;
  date_fin?: string;
  recu_depuis?: string;
  recu_jusqua?: string;
  ief?: string;
  commune?: string;
  ecole_id?: string;
  statut?: "tous" | "valides" | "soumis" | "corrige" | "annule";
  nominatif?: boolean;
}

export interface Indicateur {
  code: string;
  libelle: string;
  unite: string;
  valeur: number | string | null;
  statut: "calcule" | "non_calculable";
  raison: string | null;
  numerateur: number | null;
  denominateur: number | null;
  population: string | null;
  manquants: unknown;
  definition: string;
  sources: string[];
  detail: Record<string, unknown>;
}

export interface IndicateursReponse {
  schema_version: string;
  borne_snapshot: string;
  fraicheur: string | null;
  filtres: Record<string, unknown>;
  indicateurs: Indicateur[];
}

export interface ExportHistorique {
  date: string;
  par: string;
  role: string;
  export_id?: string;
  mode?: "nominatif" | "pseudonymise";
  filtres?: Record<string, unknown>;
  borne_snapshot?: string;
  lignes?: Record<string, number>;
  anomalies?: number;
  taille_octets?: number;
}

/** Retire les filtres vides : un champ vide ne doit jamais devenir un filtre. */
const nettoyer = (f: AnalytiqueFiltres) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "" && v !== undefined && v !== false));

export const analytiqueApi = {
  indicateurs: (f: AnalytiqueFiltres) =>
    api.get<IndicateursReponse>("/admin/analytique/indicateurs", { params: nettoyer({ ...f, nominatif: false }) }),
  /** Archive CSV complète du périmètre (aucun plafond d'écran). */
  exporter: (f: AnalytiqueFiltres) =>
    api.get<Blob>("/admin/analytique/export", { params: nettoyer(f), responseType: "blob", timeout: 0 }),
  tables: () => api.get("/admin/analytique/tables"),
  historique: (limit = 50) => api.get<ExportHistorique[]>("/admin/analytique/exports", { params: { limit } }),
};
