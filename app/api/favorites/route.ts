import { NextResponse, type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { getFavoriteIds, toggleFavorite } from "@/lib/favorites";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/** POST { cardId } -> { favorite, state }: adds or removes a watched card */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const { cardId } = await readJson(req);
  return playerAction(player.id, () => toggleFavorite(player.id, String(cardId ?? "")));
}

/** GET ?cardId= -> { favorite } */
export async function GET(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const cardId = req.nextUrl.searchParams.get("cardId") ?? "";
  return NextResponse.json({ favorite: (await getFavoriteIds(player.id)).has(cardId) });
}
