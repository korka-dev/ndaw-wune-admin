"use client";
/**
 * Références support (rapport V2, APP-45).
 *
 * - Chaque requête porte un identifiant `X-Request-ID` (adm-…), repris par
 *   l'API dans ses journaux : l'erreur affichée se retrouve côté serveur.
 * - Une erreur inattendue (5xx, serveur injoignable, plantage d'écran) est
 *   signalée à `/client-errors`, qui renvoie une référence `SUP-…` affichée à
 *   l'utilisateur. Aucun contenu personnel : chemin sans paramètres, statut,
 *   référence de requête et message court seulement (purgé aussi côté API).
 */
import { getAccessToken } from "./cookies";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "admin";

export function nouvelIdRequete(): string {
  const hex = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `adm-${hex.slice(0, 20)}`;
}

type ErreurHttp = {
  message?: string;
  config?: { url?: string; method?: string; headers?: Record<string, unknown> };
  response?: { status?: number; headers?: Record<string, unknown> };
};

/** Référence de la requête en échec (réponse de l'API, sinon celle envoyée). */
export function referenceRequete(e: unknown): string | undefined {
  const err = e as ErreurHttp;
  const r = err?.response?.headers?.["x-request-id"] ?? err?.config?.headers?.["X-Request-ID"];
  return typeof r === "string" ? r : undefined;
}

/** Erreur à signaler : serveur en panne ou injoignable — pas un refus métier (4xx). */
export function estInattendue(e: unknown): boolean {
  const err = e as ErreurHttp;
  if (!err || typeof err !== "object") return false;
  const s = err.response?.status;
  return s === undefined ? err.message === "Network Error" || err.message?.includes("timeout") === true : s >= 500;
}

const _recents = new Map<string, number>();

export async function signalerErreur(p: {
  type: "http" | "reseau" | "ecran" | "autre";
  statut_http?: number;
  methode?: string;
  route?: string;
  message?: string;
  reference_requete?: string;
}): Promise<string | undefined> {
  if (!API_URL || typeof window === "undefined") return undefined;
  // Limite locale : une même erreur n'est signalée qu'une fois par minute.
  const cle = `${p.type}|${p.statut_http}|${p.route}`;
  const maintenant = Date.now();
  if ((_recents.get(cle) ?? 0) > maintenant - 60_000) return undefined;
  _recents.set(cle, maintenant);
  try {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        source: "admin", app_version: APP_VERSION, plateforme: "web", ...p,
        route: p.route?.split("?")[0]?.slice(0, 200),
        message: p.message?.slice(0, 300),
        survenue_le: new Date().toISOString(),
      }),
      keepalive: true,
    });
    if (!res.ok) return undefined;
    return (await res.json()).reference as string;
  } catch {
    return undefined; // le signalement ne doit jamais aggraver l'incident
  }
}

/** Signale une erreur HTTP inattendue ; renvoie la référence support. */
export function signalerErreurHttp(e: unknown): Promise<string | undefined> {
  const err = e as ErreurHttp;
  return signalerErreur({
    type: err.response ? "http" : "reseau",
    statut_http: err.response?.status,
    methode: err.config?.method?.toUpperCase(),
    route: err.config?.url,
    message: err.message,
    reference_requete: referenceRequete(e),
  });
}
