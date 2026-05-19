/**
 * Route API Next.js — lecture du refresh token httpOnly.
 *
 * GET /api/auth/get-refresh → retourne { refresh_token: string | null }
 *
 * Seul le serveur Next.js peut lire un cookie httpOnly.
 * Cette route expose le refresh token UNIQUEMENT pour qu'axios puisse
 * appeler /auth/refresh côté FastAPI.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "ndawwune_rt_http";

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAME)?.value ?? null;
  return NextResponse.json({ refresh_token: refreshToken });
}
