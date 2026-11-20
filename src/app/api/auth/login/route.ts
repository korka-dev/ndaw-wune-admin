/**
 * Route API Next.js — connexion CÔTÉ SERVEUR (rapport V2, APP-09).
 *
 * POST /api/auth/login { identifier, password }
 *   → appelle l'API /auth/login, pose le refresh token dans un cookie httpOnly
 *     et ne renvoie au navigateur QUE { access_token, must_change_password }.
 *
 * Le refresh token (30 jours) n'apparaît donc dans aucune réponse lisible par
 * JavaScript : ni à la connexion, ni au renouvellement (/api/auth/refresh).
 * Les erreurs de l'API (401, 403, 422, 429) sont relayées telles quelles.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_COOKIE, apiUrl, refreshCookieOptions } from "@/lib/server/session";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { identifier?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Requête invalide." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl()}/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier: body.identifier ?? "", password: body.password ?? "" }),
      cache:   "no-store",
      signal:  AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      { detail: "Serveur momentanément injoignable. Réessayez dans quelques instants." },
      { status: 503 },
    );
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ detail: data?.detail ?? "Connexion impossible." }, { status: upstream.status });
  }

  const cookieStore = await cookies();
  cookieStore.set(REFRESH_COOKIE, data.refresh_token, refreshCookieOptions);
  return NextResponse.json({
    access_token:         data.access_token,
    must_change_password: data.must_change_password ?? false,
  });
}
