"use client";
import { create } from "zustand";
import { authApi } from "./api";
import {
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  removeAccessToken,
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
  login:             (identifier: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout:            () => Promise<void>;
  fetchMe:           () => Promise<void>;
  clearPasswordFlag: () => void;
}

export const useAuth = create<AuthStore>((set) => ({
  user:               null,
  loading:            false,
  mustChangePassword: false,

  clearPasswordFlag: () => set({ mustChangePassword: false }),

  login: async (identifier, password) => {
    set({ loading: true });
    try {
      const { data } = await authApi.login(identifier, password);

      // Stocker les tokens dans des cookies (plus dans localStorage)
      setAccessToken(data.access_token);
      await setRefreshToken(data.refresh_token);  // cookie httpOnly via route API

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
      const refreshToken = await getRefreshToken().catch(() => null);
      await authApi.logout(refreshToken);
    } catch {}
    // Supprimer les cookies
    await clearAuthCookies();
    set({ user: null, mustChangePassword: false });
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },

  fetchMe: async () => {
    // Vérifier qu'on a un access token avant d'appeler /me
    const { getAccessToken } = await import("./cookies");
    const token = getAccessToken();
    if (!token) return;
    try {
      const { data } = await authApi.me();
      set({ user: data, mustChangePassword: data.must_change_password ?? false });
    } catch {
      await clearAuthCookies();
      set({ user: null });
    }
  },
}));
