/**
 * Utilitaires de gestion des cookies côté client (admin Next.js).
 *
 * Stratégie de sécurité :
 *   - access_token  → cookie SameSite=Strict; Secure (PAS httpOnly : axios a besoin
 *                     de lire sa valeur pour l'attacher en header Authorization).
 *                     C'est un compromis assumé, pas une garantie : un XSS peut
 *                     encore lire ce cookie comme il lirait un localStorage. Seule
 *                     sa durée de vie courte (60 min) limite la fenêtre d'exploitation.
 *                     Le vrai fix (accès non lisible en JS) demanderait de faire
 *                     passer tous les appels API par des routes serveur Next.js
 *                     (proxy), pas juste un changement de cookie.
 *   - refresh_token → cookie httpOnly posé côté serveur par /api/auth/login et
 *                     /api/auth/refresh (APP-09). Il ne transite jamais par
 *                     une réponse lisible par JavaScript.
 *
 * Les tokens ne sont PLUS stockés dans localStorage.
 */

const ACCESS_TOKEN_KEY  = "ndawwune_at";
const REFRESH_TOKEN_KEY = "ndawwune_rt";

function isSecureContext(): boolean {
  return typeof window !== "undefined" &&
    (window.location.protocol === "https:" || window.location.hostname === "localhost");
}

/** Écrit un cookie dans le navigateur. */
function setCookie(name: string, value: string, options: {
  maxAgeSeconds: number;
  httpOnly?: boolean;
  path?: string;
}): void {
  if (typeof document === "undefined") return;
  const secure   = isSecureContext() ? "; Secure" : "";
  const httpOnly = options.httpOnly ? "; HttpOnly" : "";
  document.cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `; Max-Age=${options.maxAgeSeconds}`,
    `; Path=${options.path ?? "/"}`,
    `; SameSite=Strict`,
    secure,
    httpOnly,
  ].join("");
}

/** Lit un cookie par son nom. */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const key = encodeURIComponent(name) + "=";
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(key)) {
      return decodeURIComponent(trimmed.substring(key.length));
    }
  }
  return null;
}

/** Supprime un cookie en le faisant expirer immédiatement. */
function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Strict`;
}

// ── API publique ──────────────────────────────────────────────────────────────

/** Durée de vie de l'access token côté client (alignée sur le backend : 60 min). */
const ACCESS_MAX_AGE = 60 * 60; // 3 600 s

/** Stocke l'access token dans un cookie sécurisé (non httpOnly). */
export function setAccessToken(token: string): void {
  setCookie(ACCESS_TOKEN_KEY, token, { maxAgeSeconds: ACCESS_MAX_AGE });
}

/** Récupère l'access token. */
export function getAccessToken(): string | null {
  return getCookie(ACCESS_TOKEN_KEY);
}

/** Supprime l'access token. */
export function removeAccessToken(): void {
  deleteCookie(ACCESS_TOKEN_KEY);
}

/**
 * Connexion par la route serveur Next.js /api/auth/login (rapport V2, APP-09).
 * La route pose elle-même le refresh token en cookie httpOnly : il n'apparaît
 * dans aucune réponse lisible par JavaScript. Seul l'access token est renvoyé.
 *
 * En cas d'échec, l'erreur reproduit la forme d'une erreur axios
 * (`err.response.status`, `err.response.data.detail`) pour les écrans existants.
 */
export async function serverLogin(
  identifier: string,
  password: string,
): Promise<{ access_token: string; must_change_password: boolean }> {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier, password }),
    });
  } catch {
    throw { response: { status: 0, data: { detail: "Serveur injoignable. Vérifiez votre connexion." } } };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { response: { status: res.status, data } };
  setAccessToken(data.access_token);
  return data;
}

export type RefreshOutcome =
  | { ok: true;  accessToken: string }
  | { ok: false; fatal: boolean };   // fatal = session invalide → reconnexion ; sinon incident temporaire

/**
 * Renouvelle la session via la route serveur /api/auth/refresh.
 * Le refresh token reste dans le cookie httpOnly : il n'est jamais lu ni
 * renvoyé au JavaScript. Un seul renouvellement à la fois, partagé par toutes
 * les requêtes qui reçoivent un 401 en même temps.
 */
let _refreshInFlight: Promise<RefreshOutcome> | null = null;

export function refreshSession(): Promise<RefreshOutcome> {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.access_token);
        return { ok: true, accessToken: data.access_token };
      }
      return { ok: false, fatal: res.status === 401 };
    } catch {
      return { ok: false, fatal: false };   // réseau coupé : on ne déconnecte pas
    } finally {
      // libérer après la résolution
      setTimeout(() => { _refreshInFlight = null; }, 0);
    }
  })();
  return _refreshInFlight;
}

/** Supprime tous les cookies d'auth (access + refresh). */
export async function clearAuthCookies(): Promise<void> {
  removeAccessToken();
  deleteCookie(REFRESH_TOKEN_KEY);
  // Demander à la route API de supprimer le cookie httpOnly
  try {
    await fetch("/api/auth/set-refresh", {
      method:  "DELETE",
    });
  } catch {}
}
