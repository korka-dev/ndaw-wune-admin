"use client";
import { create } from "zustand";
import { authApi } from "./api";
import {
  serverLogin,
  getAccessToken,
  refreshSession,
  clearAuthCookies,
} from "./cookies";

interface User {
  id:                   string;
  name:                 string;
  email:                string | null;
  phone:                string | null;
  role:                 string;
  status:               string;
  title:                string | null;
  school_id:            string | null;
  must_change_password: boolean;
}

interface AuthStore {
  user:               User | null;
  loading:            boolean;
  mustChangePassword: boolean;
  /** Serveur injoignable ou renouvellement impossible pour une raison
   *  temporaire (APP-41) : la session est conservée, on affiche un bandeau. */
  serverUnavailable:  boolean;
  login:             (identifier: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout:            () => Promise<void>;
  fetchMe:           () => Promise<void>;
  clearPasswordFlag: () => void;
}

export const useAuth = create<AuthStore>((set) => ({
  user:               null,
  loading:            false,
  mustChangePassword: false,
  serverUnavailable:  false,

  clearPasswordFlag: () => set({ mustChangePassword: false }),

  login: async (identifier, password) => {
    set({ loading: true });
    try {
      // Route serveur : le refresh token reste dans un cookie httpOnly (APP-09)
      const data = await serverLogin(identifier, password);

      const mustChange = data.must_change_password ?? false;
      set({ mustChangePassword: mustChange, loading: false });

      if (!mustChange) {
        const me = await authApi.me();
        set({ user: me.data });
      }

      return { mustChangePassword: mustChange };
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: async () => {
    // Révoquer le token d'accès ET le refresh token côté serveur (best-effort)
    try {
      const token = getAccessToken();
      // La route serveur lit le refresh token dans le cookie httpOnly,
      // le révoque avec l'access token puis supprime le cookie.
      await fetch("/api/auth/logout", {
        method:  "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
    // Supprimer les cookies
    await clearAuthCookies();
    set({ user: null, mustChangePassword: false });
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },

  fetchMe: async () => {
    // APP-41 : seul un refus explicite de la session (401) déconnecte.
    // Une panne réseau, un 5xx ou Redis indisponible (503 au renouvellement)
    // laissent la session intacte et affichent un bandeau.
    if (!getAccessToken()) {
      // Access token expiré (cookie de 60 min) : tenter le cookie httpOnly.
      const outcome = await refreshSession();
      if (!("accessToken" in outcome)) {
        if (outcome.fatal) {
          await clearAuthCookies();
          set({ user: null, serverUnavailable: false });
        } else {
          set({ serverUnavailable: true });
        }
        return;
      }
    }
    try {
      // L'intercepteur axios renouvelle déjà le jeton sur 401 et redirige
      // vers /login si la session est réellement invalide.
      const { data } = await authApi.me();
      set({ user: data, mustChangePassword: data.must_change_password ?? false, serverUnavailable: false });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 && !e?.refreshUnavailable) {
        await clearAuthCookies();
        set({ user: null, serverUnavailable: false });
      } else {
        set({ serverUnavailable: true });
      }
    }
  },
}));
