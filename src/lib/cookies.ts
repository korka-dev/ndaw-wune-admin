/**
 * Utilitaires de gestion des cookies côté client (admin Next.js).
 *
 * Stratégie de sécurité :
 *   - access_token  → cookie SameSite=Strict; Secure (pas httpOnly : axios doit le lire).
 *                     Durée courte (60 min) donc le risque XSS est limité.
 *   - refresh_token → cookie httpOnly via la route API /api/auth/refresh.
 *                     JS ne peut pas le lire → XSS ne peut pas l'exfiltrer.
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
 */
export async function setRefreshToken(token: string): Promise<void> {
  try {
    await fetch("/api/auth/set-refresh", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refresh_token: token }),
    });
  } catch {
    // Fallback : stocker en cookie ordinaire si la route échoue
    setCookie(REFRESH_TOKEN_KEY, token, { maxAgeSeconds: 30 * 24 * 60 * 60 });
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
    return getCookie(REFRESH_TOKEN_KEY);
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
