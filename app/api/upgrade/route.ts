import { NextResponse, type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { getOrCreatePlayer } from "@/lib/player";
import { getUpgradeTargets, upgrade } from "@/lib/upgrade";

export const dynamic = "force-dynamic";

/** GET -> { targets: { card, value }[] } */
export async function GET() {
  return NextResponse.json({ targets: await getUpgradeTargets() });
}

/** POST { ownedCardIds, targetCardId } -> { won, chance, roll, target, ... } */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const body = await readJson(req);
  const ids = Array.isArray(body.ownedCardIds) ? body.ownedCardIds.map(String) : [];
  return playerAction(player.id, () => upgrade(player.id, ids, String(body.targetCardId ?? "")));
}
