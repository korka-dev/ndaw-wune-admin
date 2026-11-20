/**
 * Route API Next.js — suppression du cookie httpOnly du refresh token.
 *
 * DELETE /api/auth/set-refresh → supprime le cookie (déconnexion locale).
 *
 * L'ancien POST (le navigateur envoyait lui-même le refresh token pour qu'il
 * soit posé en cookie) est supprimé : le jeton transitait par du JavaScript
 * lisible. Il est désormais posé par /api/auth/login (APP-09).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_COOKIE } from "@/lib/server/session";

export async function DELETE(): Promise<NextResponse> {
  const cookieStore = await cookies();
  cookieStore.delete(REFRESH_COOKIE);
  return NextResponse.json({ ok: true });
}
