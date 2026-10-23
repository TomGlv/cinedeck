import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { AuthError, getOrCreatePlayer, getPlayerState, login, logout, register } from "@/lib/player";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register { username, password }  (keeps the current guest's progress)
 * POST /api/auth/login    { username, password }
 * POST /api/auth/logout
 * All return { state } of the player now signed in (a fresh guest after logout).
 */
export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const body = await readJson(req);
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  try {
    let playerId: string;
    switch (params.action) {
      case "register":
        playerId = (await register(username, password)).id;
        break;
      case "login":
        playerId = (await login(username, password)).id;
        break;
      case "logout":
        await logout();
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 404 });
    }
    return NextResponse.json({ state: await getPlayerState(playerId) });
  } catch (err) {
    if (err instanceof AuthError) {
      const player = await getOrCreatePlayer();
      return NextResponse.json({ error: err.message, state: await getPlayerState(player.id) }, { status: 400 });
    }
    throw err;
  }
}
