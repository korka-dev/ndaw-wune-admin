/**
 * Route API Next.js — gestion du cookie httpOnly pour le refresh token.
 *
 * POST /api/auth/set-refresh  → créer/mettre à jour le cookie httpOnly
 * DELETE /api/auth/set-refresh → supprimer le cookie (logout)
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME    = "ndawwune_rt_http";
const MAX_AGE_DAYS   = 30;
const MAX_AGE_SECS   = MAX_AGE_DAYS * 24 * 60 * 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const refreshToken = body.refresh_token as string | undefined;

    if (!refreshToken) {
      return NextResponse.json({ error: "refresh_token manquant" }, { status: 400 });
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   MAX_AGE_SECS,
      path:     "/",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
