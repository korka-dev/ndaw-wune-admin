import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL: API_URL });

// Injecter le token sur chaque requête
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh automatique si 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (identifier: string, password: string) =>
    api.post("/auth/login", { identifier, password }),
  me:      () => api.get("/auth/me"),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
  resetPassword: (identifier: string, new_password: string, confirm_password: string) =>
    api.post("/auth/reset-password", { identifier, new_password, confirm_password }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list:     ()            => api.get("/admin/sessions"),
  create:   (d: unknown)  => api.post("/admin/sessions", d),
  update:   (id: string, d: unknown) => api.patch(`/admin/sessions/${id}`, d),
  delete:   (id: string)  => api.delete(`/admin/sessions/${id}`),
  activate:   (id: string)  => api.post(`/admin/sessions/${id}/activate`),
  deactivate: (id: string)  => api.patch(`/admin/sessions/${id}`, { status: "inactive" }),
  assignTeachers: (id: string, teacher_ids: string[]) =>
    api.post(`/admin/sessions/${id}/teachers`, { teacher_ids }),
  getTeachers: (id: string) => api.get(`/admin/sessions/${id}/teachers`),
};

export const teachersApi = {
  list:         ()              => api.get("/admin/teachers"),
  create:       (d: unknown)    => api.post("/admin/teachers", d),
  update:       (id: string, d: unknown) => api.patch(`/admin/teachers/${id}`, d),
  delete:       (id: string)    => api.delete(`/admin/teachers/${id}`),
  toggleStatus: (id: string)    => api.post(`/admin/teachers/${id}/toggle-status`),
};

export const schoolsApi = {
  list:   ()              => api.get("/admin/schools"),
  create: (d: unknown)    => api.post("/admin/schools", d),
  update: (id: string, d: unknown) => api.patch(`/admin/schools/${id}`, d),
  delete: (id: string)    => api.delete(`/admin/schools/${id}`),
};

export const planningApi = {
  list:   (session_id?: string) =>
    api.get("/admin/planning", { params: session_id ? { session_id } : {} }),
  create: (d: unknown)    => api.post("/admin/planning", d),
  update: (id: string, d: unknown) => api.patch(`/admin/planning/${id}`, d),
  delete: (id: string)    => api.delete(`/admin/planning/${id}`),
  import: (session_id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post(`/admin/planning/import?session_id=${session_id}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const rapportsApi = {
  list: (params?: { session_id?: string; teacher_id?: string; limit?: number }) =>
    api.get("/admin/rapports", { params }),
  get:  (id: string) => api.get(`/admin/rapports/${id}`),
};

export const suiviApi = {
  list:   (params?: { session_id?: string; search?: string }) =>
    api.get("/admin/suivi-seances", { params }),
  detail: (teacher_id: string, params?: { session_id?: string }) =>
    api.get(`/admin/suivi-seances/${teacher_id}`, { params }),
};

export const suiviSuperviseurApi = {
  list:   (params?: { session_id?: string; search?: string }) =>
    api.get("/admin/suivi-superviseurs", { params }),
  detail: (superviseur_id: string, params?: { session_id?: string }) =>
    api.get(`/admin/suivi-superviseurs/${superviseur_id}`, { params }),
};

export const usersApi = {
  list:   ()              => api.get("/admin/users"),
  create: (d: unknown)    => api.post("/admin/users", d),
  update: (id: string, d: unknown) => api.patch(`/admin/users/${id}`, d),
  delete: (id: string)    => api.delete(`/admin/users/${id}`),
};

export const superviseursApi = {
  list:           ()                              => api.get("/admin/superviseurs"),
  create:         (d: unknown)                    => api.post("/admin/superviseurs", d),
  get:            (id: string)                    => api.get(`/admin/superviseurs/${id}`),
  update:         (id: string, d: unknown)        => api.patch(`/admin/superviseurs/${id}`, d),
  delete:         (id: string)                    => api.delete(`/admin/superviseurs/${id}`),
  toggleStatus:   (id: string)                    => api.post(`/admin/superviseurs/${id}/toggle-status`),
  assignTeachers: (id: string, ids: string[])     => api.post(`/admin/superviseurs/${id}/assign-teachers`, { assigned_teacher_ids: ids }),
};

export const evaluateursApi = {
  list:           ()                              => api.get("/admin/evaluateurs"),
  create:         (d: unknown)                    => api.post("/admin/evaluateurs", d),
  get:            (id: string)                    => api.get(`/admin/evaluateurs/${id}`),
  update:         (id: string, d: unknown)        => api.patch(`/admin/evaluateurs/${id}`, d),
  delete:         (id: string)                    => api.delete(`/admin/evaluateurs/${id}`),
  toggleStatus:   (id: string)                    => api.post(`/admin/evaluateurs/${id}/toggle-status`),
  assignTeachers: (id: string, ids: string[])     => api.post(`/admin/evaluateurs/${id}/assign-teachers`, { assigned_teacher_ids: ids }),
};
