import { NextResponse } from "next/server";
import { getCollection } from "@/lib/collection";
import { marketTick } from "@/lib/market";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

export async function GET() {
  const player = await getOrCreatePlayer();
  // Settle auctions first so won cards show up
  await marketTick();
  return NextResponse.json(await getCollection(player.id));
}
