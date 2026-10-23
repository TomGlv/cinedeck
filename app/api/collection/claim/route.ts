import { type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { claimReward } from "@/lib/collection";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/** POST { slug } - franchise set or combo */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const { slug } = await readJson(req);
  return playerAction(player.id, () => claimReward(player.id, String(slug ?? "")));
}
