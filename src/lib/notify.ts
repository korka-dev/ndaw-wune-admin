"use client";
/**
 * Messages d'erreur visibles (rapport V2, APP-47) : aucun chargement, export
 * ou bouton ne doit échouer en silence. `notifyError` affiche un bandeau
 * (NoticeStack, monté dans le layout du dashboard) avec le détail renvoyé par
 * l'API quand il existe.
 */
import { create } from "zustand";
import { estInattendue, referenceRequete, signalerErreurHttp } from "./support";

export interface Notice {
  id:      number;
  message: string;
  detail?: string;
  /** Référence à communiquer au support (APP-45) : SUP-… ou, à défaut, celle de la requête. */
  reference?: string;
}

interface NoticeStore {
  notices: Notice[];
  push:    (n: Omit<Notice, "id">) => number;
  update:  (id: number, patch: Partial<Omit<Notice, "id">>) => void;
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
    // Une erreur avec référence support reste plus longtemps (le temps de la noter).
    setTimeout(() => set((s) => ({ notices: s.notices.filter((x) => x.id !== id) })), n.reference ? 30_000 : 10_000);
    return id;
  },
  update: (id, patch) => set((s) => ({ notices: s.notices.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
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
  const inattendue = e !== undefined && estInattendue(e);
  const store = useNotices.getState();
  const id = store.push({
    message, detail: e ? errorDetail(e) : undefined,
    reference: inattendue ? referenceRequete(e) : undefined,
  });
  // Panne serveur ou réseau : signalée au support, la référence SUP-… remplace
  // celle de la requête dès qu'elle est connue.
  if (inattendue) signalerErreurHttp(e).then((ref) => { if (ref) useNotices.getState().update(id, { reference: ref }); });
}
