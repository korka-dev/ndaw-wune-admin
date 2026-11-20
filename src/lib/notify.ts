"use client";
/**
 * Messages d'erreur visibles (rapport V2, APP-47) : aucun chargement, export
 * ou bouton ne doit échouer en silence. `notifyError` affiche un bandeau
 * (NoticeStack, monté dans le layout du dashboard) avec le détail renvoyé par
 * l'API quand il existe.
 */
import { create } from "zustand";

export interface Notice {
  id:      number;
  message: string;
  detail?: string;
}

interface NoticeStore {
  notices: Notice[];
  push:    (n: Omit<Notice, "id">) => void;
  dismiss: (id: number) => void;
}

let _seq = 0;

export const useNotices = create<NoticeStore>((set) => ({
  notices: [],
  push: (n) => {
    const id = ++_seq;
    set((s) => ({
      // Pas de doublon empilé pour un même message (ex. plusieurs appels en échec)
      notices: [...s.notices.filter((x) => x.message !== n.message), { ...n, id }].slice(-4),
    }));
    setTimeout(() => set((s) => ({ notices: s.notices.filter((x) => x.id !== id) })), 10_000);
  },
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((x) => x.id !== id) })),
}));

export function errorDetail(e: unknown): string | undefined {
  const r = (e as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  if (!r) return (e as { message?: string })?.message === "Network Error"
    ? "Serveur injoignable."
    : undefined;
  const d = r.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x: any) => x?.msg ?? String(x)).join(" ; ");
  if (d && typeof d === "object" && "message" in d) return String((d as { message: unknown }).message);
  return r.status ? `Erreur ${r.status}` : undefined;
}

export function notifyError(message: string, e?: unknown): void {
  // Session expirée : l'intercepteur gère déjà la redirection.
  if ((e as { response?: { status?: number } })?.response?.status === 401) return;
  useNotices.getState().push({ message, detail: e ? errorDetail(e) : undefined });
}
