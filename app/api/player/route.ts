import { NextResponse } from "next/server";
import { getOrCreatePlayer, getPlayerState } from "@/lib/player";

export const dynamic = "force-dynamic";

export async function GET() {
  const player = await getOrCreatePlayer();
  return NextResponse.json(await getPlayerState(player.id));
}
