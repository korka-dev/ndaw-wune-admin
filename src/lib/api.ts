import axios from "axios";
import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearAuthCookies,
} from "./cookies";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const api = axios.create({ baseURL: API_URL });

// ── Intercepteur requête : injection du Bearer token depuis le cookie ─────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Intercepteur réponse : refresh automatique sur 401 ───────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      // Lire le refresh token via la route API Next.js (cookie httpOnly)
      const refresh = await getRefreshToken();
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refresh,
          });
          // Stocker les nouveaux tokens dans les cookies
          setAccessToken(data.access_token);
          await setRefreshToken(data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          await clearAuthCookies();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      } else {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (identifier: string, password: string) =>
    api.post("/auth/login", { identifier, password }),
  me: () => api.get("/auth/me"),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
  /** Envoie aussi le refresh_token pour qu'il soit révoqué côté serveur, pas
   *  seulement le token d'accès — sinon un refresh token volé survivrait au logout. */
  logout: (refresh_token?: string | null) =>
    api.post("/auth/logout", refresh_token ? { refresh_token } : {}),
  changePassword: (new_password: string) =>
    api.post("/auth/change-password", { new_password }),
  resetPassword: (identifier: string, new_password: string, confirm_password: string) =>
    api.post("/auth/reset-password", { identifier, new_password, confirm_password }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/sessions", { params }),
  create: (d: unknown) => api.post("/admin/sessions", d),
  update: (id: string, d: unknown) => api.patch(`/admin/sessions/${id}`, d),
  delete: (id: string) => api.delete(`/admin/sessions/${id}`),
  activate: (id: string) => api.post(`/admin/sessions/${id}/activate`),
  deactivate: (id: string) => api.patch(`/admin/sessions/${id}`, { status: "inactive" }),
  assignTeachers: (id: string, teacher_ids: string[]) =>
    api.post(`/admin/sessions/${id}/teachers`, { teacher_ids }),
  getTeachers: (id: string) => api.get(`/admin/sessions/${id}/teachers`),
};

export const teachersApi = {
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/teachers", { params }),
  create: (d: unknown) => api.post("/admin/teachers", d),
  update: (id: string, d: unknown) => api.patch(`/admin/teachers/${id}`, d),
  delete: (id: string) => api.delete(`/admin/teachers/${id}`),
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
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/schools", { params }),
  create: (d: unknown) => api.post("/admin/schools", d),
  update: (id: string, d: unknown) => api.patch(`/admin/schools/${id}`, d),
  delete: (id: string) => api.delete(`/admin/schools/${id}`),
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
  list: (session_id?: string, semaine?: number) =>
    api.get("/admin/planning", {
      params: {
        ...(session_id ? { session_id } : {}),
        ...(semaine != null ? { semaine } : {}),
        limit: 200,
      },
    }),
  create: (d: unknown) => api.post("/admin/planning", d),
  update: (id: string, d: unknown) => api.patch(`/admin/planning/${id}`, d),
  delete: (id: string) => api.delete(`/admin/planning/${id}`),
  import: (session_id: string, file: File, semaine?: number) => {
    const fd = new FormData();
    fd.append("file", file);
    const qs = semaine != null ? `&semaine=${semaine}` : "";
    return api.post(`/admin/planning/import?session_id=${session_id}${qs}`, fd, {
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
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/users", { params }),
  create: (d: unknown) => api.post("/admin/users", d),
  update: (id: string, d: unknown) => api.patch(`/admin/users/${id}`, d),
  delete: (id: string) => api.delete(`/admin/users/${id}`),
};

export const superviseursApi = {
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/superviseurs", { params }),
  create: (d: unknown) => api.post("/admin/superviseurs", d),
  get: (id: string) => api.get(`/admin/superviseurs/${id}`),
  update: (id: string, d: unknown) => api.patch(`/admin/superviseurs/${id}`, d),
  delete: (id: string) => api.delete(`/admin/superviseurs/${id}`),
  toggleStatus: (id: string) => api.post(`/admin/superviseurs/${id}/toggle-status`),
  assignTeachers: (id: string, ids: string[]) => api.post(`/admin/superviseurs/${id}/assign-teachers`, { assigned_teacher_ids: ids }),
  exportCsv: () => api.get("/admin/superviseurs/export/csv", { responseType: "blob" }),
  exportXlsx: (fields?: string) => api.get("/admin/superviseurs/export/xlsx", { params: fields ? { fields } : undefined, responseType: "blob" }),
};

export const comptesTerrainApi = {
  // Liste unifiée tuteurs + superviseurs — les mots de passe ne sont jamais
  // transmis : bcrypt les hache à sens unique, aucune route ne peut les lire.
  list: (params?: { role?: "enseignant" | "superviseur"; search?: string; skip?: number; limit?: number }) =>
    api.get("/admin/comptes-terrain", { params }),
  resetPassword: (id: string, d: { new_password: string; force_change?: boolean }) =>
    api.post(`/admin/comptes-terrain/${id}/reset-password`, d),
};

export const evaluateursApi = {
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/evaluateurs", { params }),
  create: (d: unknown) => api.post("/admin/evaluateurs", d),
  get: (id: string) => api.get(`/admin/evaluateurs/${id}`),
  update: (id: string, d: unknown) => api.patch(`/admin/evaluateurs/${id}`, d),
  delete: (id: string) => api.delete(`/admin/evaluateurs/${id}`),
  toggleStatus: (id: string) => api.post(`/admin/evaluateurs/${id}/toggle-status`),
  assignTeachers: (id: string, ids: string[]) => api.post(`/admin/evaluateurs/${id}/assign-teachers`, { assigned_teacher_ids: ids }),
};

export const rapportJournalierAdminApi = {
  list: (params?: {
    teacher_id?: string;
    role?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    ief?: string;
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
  }) => api.get("/admin/rapports/journalier/stats", { params }),
  photos: (params?: {
    teacher_id?: string;
    role?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    ief?: string;
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
  }) => api.get("/admin/remplacements", { params }),
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

export const elevesApi = {
  list: (params?: { school_id?: string; session_id?: string; classe?: string; skip?: number; limit?: number }) =>
    api.get("/admin/eleves", { params }),
  create: (d: unknown) => api.post("/admin/eleves", d),
  update: (id: string, d: unknown) => api.patch(`/admin/eleves/${id}`, d),
  delete: (id: string) => api.delete(`/admin/eleves/${id}`),
  bulkDelete: (ids: string[]) => api.delete("/admin/eleves", { data: { ids } }),
  // Export
  exportCsv: () => api.get("/admin/eleves/export/csv", { responseType: "blob" }),
  exportXlsx: (fields?: string) => api.get("/admin/eleves/export/xlsx", { params: fields ? { fields } : undefined, responseType: "blob" }),
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
  list: (params?: { school_id?: string; niveau?: string; skip?: number; limit?: number }) =>
    api.get("/admin/classes", { params }),
  create: (d: unknown) => api.post("/admin/classes", d),
  update: (id: string, d: unknown) => api.patch(`/admin/classes/${id}`, d),
  delete: (id: string) => api.delete(`/admin/classes/${id}`),
  exportXlsx: (fields?: string) => api.get("/admin/classes/export/xlsx", { params: fields ? { fields } : undefined, responseType: "blob" }),
  reimportXlsx: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/admin/classes/reimport", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

export const ressourcesApi = {
  list: (params?: { limit?: number; skip?: number }) => api.get("/admin/ressources", { params }),
  upload: (file: File, title?: string, description?: string, resource_type?: string, langue?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (title) fd.append("title", title);
    if (description) fd.append("description", description);
    if (resource_type) fd.append("resource_type", resource_type);
    if (langue) fd.append("langue", langue);
    return api.post("/admin/ressources", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  update: (id: string, d: { title?: string; description?: string; langue?: string | null }) =>
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
  planning: () => api.get("/admin/planning/export/csv", { responseType: "blob" }),
  eleves: () => api.get("/admin/eleves/export/csv", { responseType: "blob" }),
};

// ── Import / Export global (écoles, superviseurs, tuteurs, classes, élèves) ────
export const importExportApi = {
  export: () => api.get("/admin/import-export/export", { responseType: "blob" }),
  import: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/admin/import-export/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

