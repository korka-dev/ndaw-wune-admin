/**
 * Route API Next.js — déconnexion complète côté serveur.
 *
 * POST /api/auth/logout (header Authorization: Bearer <access token>)
 *   → révoque l'access token ET le refresh token (lu dans le cookie httpOnly)
 *     auprès de l'API, puis supprime le cookie. Best-effort : le cookie est
 *     toujours supprimé, même si l'API est injoignable.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "ndawwune_rt_http";
const API_URL     = process.env.NEXT_PUBLIC_API_URL;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore  = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAME)?.value;
  const authorization = req.headers.get("authorization");

  if (authorization) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: authorization },
        body:    JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
        cache:   "no-store",
        signal:  AbortSignal.timeout(8_000),
      });
    } catch {
      // best-effort
    }
  }

  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
