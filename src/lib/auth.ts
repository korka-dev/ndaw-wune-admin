"use client";
import { create } from "zustand";
import { authApi } from "./api";

interface User {
  id:                  string;
  name:                string;
  email:               string | null;
  phone:               string | null;
  role:                string;
  status:              string;
  title:               string | null;
  school_id:           string | null;
  must_change_password: boolean;
}

interface AuthStore {
  user:               User | null;
  loading:            boolean;
  mustChangePassword: boolean;
  login:    (identifier: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout:   () => void;
  fetchMe:  () => Promise<void>;
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
      localStorage.setItem("access_token",  data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      const mustChange = data.must_change_password ?? false;
      set({ mustChangePassword: mustChange, loading: false });

      // Charger le profil seulement si pas de changement de mot de passe requis
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

  logout: () => {
    localStorage.clear();
    set({ user: null, mustChangePassword: false });
  },

  fetchMe: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) return;
    try {
      const { data } = await authApi.me();
      set({ user: data, mustChangePassword: data.must_change_password ?? false });
    } catch {
      localStorage.clear();
      set({ user: null });
    }
  },
}));
