import { type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { redeemCode } from "@/lib/codes";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/** POST { code } -> { coins, unlimited, state } */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const { code } = await readJson(req);
  return playerAction(player.id, () => redeemCode(player.id, String(code ?? "")));
}
