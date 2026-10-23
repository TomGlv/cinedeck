import { NextResponse, type NextRequest } from "next/server";
import { sweepBattles } from "@/lib/battle";
import { marketTick } from "@/lib/market";

export const dynamic = "force-dynamic";

/**
 * Advances the market and battle lobbies without any visitor (bots bid, auctions settle,
 * the house restocks). Called every few minutes by netlify/functions/market-tick.mjs.
 * Protected by CRON_SECRET when it is set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  await marketTick();
  await sweepBattles();
  return NextResponse.json({ ok: true, ms: Date.now() - started });
}
