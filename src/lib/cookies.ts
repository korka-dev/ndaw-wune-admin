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
 *   - refresh_token → cookie httpOnly via la route API /api/auth/set-refresh.
 *                     JS ne peut pas le lire → XSS ne peut pas l'exfiltrer.
 *                     AUCUN repli en cookie JS-lisible si cette route échoue —
 *                     dans ce cas la session ne survit simplement pas au
 *                     rechargement (ré-authentification requise), plutôt que
 *                     d'exposer un refresh token de 30 jours en clair.
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
 * Stocke le refresh token via la route API Next.js (/api/auth/set-refresh).
 * La route crée un cookie httpOnly → JS ne peut pas lire le refresh token.
 *
 * Volontairement AUCUN repli en cookie JS-lisible si la requête échoue : un
 * refresh token de 30 jours exposé à un XSS serait bien pire qu'une session
 * qui ne survit pas à un rechargement de page en cas d'échec réseau rare.
 */
export async function setRefreshToken(token: string): Promise<void> {
  try {
    const res = await fetch("/api/auth/set-refresh", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refresh_token: token }),
    });
    if (!res.ok) throw new Error(`set-refresh a échoué (${res.status})`);
  } catch (e) {
    console.error("[Auth] Impossible de stocker le refresh token de façon sécurisée :", e);
  }
}

/**
 * Récupère le refresh token via la route API Next.js (/api/auth/get-refresh).
 * La route peut lire le cookie httpOnly côté serveur.
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    const res  = await fetch("/api/auth/get-refresh");
    const data = await res.json();
    return data.refresh_token ?? null;
  } catch {
    return null;
  }
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
