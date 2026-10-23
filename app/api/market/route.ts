import { NextResponse } from "next/server";
import { getMarket, marketTick } from "@/lib/market";
import { getOrCreatePlayer, getPlayerState } from "@/lib/player";

export const dynamic = "force-dynamic";

export async function GET() {
  const player = await getOrCreatePlayer();
  await marketTick();
  const [market, state] = await Promise.all([getMarket(player.id), getPlayerState(player.id)]);
  return NextResponse.json({ ...market, state });
}
