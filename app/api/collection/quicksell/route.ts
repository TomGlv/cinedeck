import { type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { quickSell } from "@/lib/market";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/** POST { ownedCardIds: string[] } */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const { ownedCardIds } = await readJson(req);
  const ids = Array.isArray(ownedCardIds) ? ownedCardIds.filter((id): id is string => typeof id === "string") : [];
  return playerAction(player.id, () => quickSell(player.id, ids));
}
