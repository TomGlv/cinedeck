import { NextResponse, type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { getOrCreatePlayer, getPlayerState } from "@/lib/player";
import { setAvatar } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET() {
  const player = await getOrCreatePlayer();
  return NextResponse.json(await getPlayerState(player.id));
}

/** POST { avatar: ownedCardId | null } -> { ok, state }: one of my cards as profile picture */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const { avatar } = await readJson(req);
  return playerAction(player.id, async () => {
    await setAvatar(player.id, avatar ? String(avatar) : null);
    return { ok: true };
  });
}
