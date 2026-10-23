import { NextResponse, type NextRequest } from "next/server";
import { getBidHistory, getPriceHistory } from "@/lib/market";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/** GET ?cardId=...&finish=...&listingId=... -> { sales, bids } (bids only when a listing is given) */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const cardId = params.get("cardId") ?? "";
  const listingId = params.get("listingId");
  const player = await getOrCreatePlayer();
  const [sales, bids] = await Promise.all([
    getPriceHistory(cardId, params.get("finish")),
    listingId ? getBidHistory(listingId, player.id) : Promise.resolve([]),
  ]);
  return NextResponse.json({ sales, bids });
}
