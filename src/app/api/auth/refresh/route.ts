/**
 * Route API Next.js — renouvellement de session CÔTÉ SERVEUR.
 *
 * POST /api/auth/refresh
 *   → lit le refresh token dans le cookie httpOnly, appelle l'API /auth/refresh,
 *     réécrit le cookie httpOnly avec le nouveau refresh token et ne renvoie au
 *     navigateur QUE le nouvel access token.
 *
 * Le refresh token ne transite donc plus jamais par du JavaScript lisible.
 *
 * Codes de réponse :
 *   200 → session renouvelée { access_token, must_change_password }
 *   401 → session réellement invalide ou absente (cookie supprimé) : se reconnecter
 *   503 → incident TEMPORAIRE (API injoignable, 5xx) : le cookie est conservé,
 *         le client ne doit PAS déconnecter l'utilisateur
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME  = "ndawwune_rt_http";
const MAX_AGE_SECS = 30 * 24 * 60 * 60;
const API_URL      = process.env.NEXT_PUBLIC_API_URL;

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/auth/refresh`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refresh_token: refreshToken }),
      cache:   "no-store",
      signal:  AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }

  if (upstream.status === 401 || upstream.status === 403) {
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }

  const data = await upstream.json();
  cookieStore.set(COOKIE_NAME, data.refresh_token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   MAX_AGE_SECS,
    path:     "/",
  });
  return NextResponse.json({
    access_token:         data.access_token,
    must_change_password: data.must_change_password ?? false,
  });
}
