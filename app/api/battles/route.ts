import { NextResponse, type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { cancelBattle, createBattle, fillWithBot, getBattle, joinBattle, listBattles, markSeen } from "@/lib/battle";
import { getOrCreatePlayer, getPlayerState } from "@/lib/player";

export const dynamic = "force-dynamic";

/** GET -> BattlesDTO · GET ?id= -> { battle } */
export async function GET(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const id = req.nextUrl.searchParams.get("id");
  if (id) return playerAction(player.id, async () => ({ battle: await getBattle(player.id, id) }));
  const [battles, state] = await Promise.all([listBattles(player.id), getPlayerState(player.id)]);
  return NextResponse.json({ ...battles, state });
}

/**
 * POST { action: "create", pack, mode, opponent: "bot" | "open" | "friend", friend? }
 * POST { action: "join" | "bot" | "cancel" | "seen", battleId }
 */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const body = await readJson(req);
  const battleId = String(body.battleId ?? "");

  return playerAction(player.id, async () => {
    switch (body.action) {
      case "create":
        return createBattle(player.id, {
          pack: String(body.pack ?? ""),
          mode: String(body.mode ?? "classic"),
          opponent: String(body.opponent ?? "bot"),
          friend: body.friend ? String(body.friend) : undefined,
        });
      case "join":
        return joinBattle(player.id, battleId);
      case "bot":
        return fillWithBot(player.id, battleId);
      case "cancel":
        await cancelBattle(player.id, battleId);
        return { ok: true };
      case "seen":
        await markSeen(player.id, battleId);
        return { ok: true };
      default:
        return { ok: false };
    }
  });
}
