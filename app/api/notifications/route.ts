import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { sweepBattles } from "@/lib/battle";
import { marketTick } from "@/lib/market";
import { getNotifications, markRead } from "@/lib/notifications";
import { getOrCreatePlayer, getPlayerState } from "@/lib/player";

export const dynamic = "force-dynamic";

/**
 * GET -> { items, unread, state }. Polled by the bell, so it also advances the market and
 * battle lobbies: auctions settle (and notify) even while the player is on another page.
 */
export async function GET() {
  const player = await getOrCreatePlayer();
  await Promise.all([marketTick(), sweepBattles()]).catch((err) => console.warn("[notifications] tick failed", err));
  const [list, state] = await Promise.all([getNotifications(player.id), getPlayerState(player.id)]);
  return NextResponse.json({ ...list, state });
}

/** POST { ids? } marks those (or all) notifications read -> { state } */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const body = await readJson(req);
  await markRead(player.id, Array.isArray(body.ids) ? body.ids.map(String) : undefined);
  return NextResponse.json({ state: await getPlayerState(player.id) });
}
