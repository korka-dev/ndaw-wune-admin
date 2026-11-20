/**
 * Constantes partagées par les routes serveur /api/auth/* (jamais importé côté client).
 *
 * API_URL : variable serveur lue au DÉMARRAGE (APP-42) — changer de domaine
 * d'API ne nécessite plus de reconstruire l'image pour ces routes. Repli sur
 * NEXT_PUBLIC_API_URL (figée au build) si elle n'est pas définie.
 */
export const REFRESH_COOKIE = "ndawwune_rt_http";
export const REFRESH_MAX_AGE_SECS = 30 * 24 * 60 * 60;

export function apiUrl(): string {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "";
}

export const refreshCookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge:   REFRESH_MAX_AGE_SECS,
  path:     "/",
};
