import { type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { createCheckout } from "@/lib/payments";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/** POST { pack } -> { url } of the NOWPayments invoice page */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const { pack } = await readJson(req);
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  return playerAction(player.id, async () => ({ url: await createCheckout(player.id, String(pack ?? ""), origin) }));
}
