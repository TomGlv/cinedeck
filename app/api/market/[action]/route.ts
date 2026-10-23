import { NextResponse, type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { buyNow, cancelListing, createListing, placeBid } from "@/lib/market";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/**
 * POST /api/market/list   { ownedCardId, startPrice, buyNowPrice, durationMin }
 * POST /api/market/bid    { listingId, max }  -> { leading, price }
 * POST /api/market/buy    { listingId }
 * POST /api/market/cancel { listingId }
 */
export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const player = await getOrCreatePlayer();
  const body = await readJson(req);
  const listingId = String(body.listingId ?? "");

  switch (params.action) {
    case "list":
      return playerAction(player.id, async () => ({
        listing: await createListing(player.id, {
          ownedCardId: String(body.ownedCardId ?? ""),
          startPrice: Number(body.startPrice),
          buyNowPrice: Number(body.buyNowPrice),
          durationMin: Number(body.durationMin),
        }),
      }));
    case "bid":
      return playerAction(player.id, () => placeBid(player.id, listingId, Number(body.max ?? body.amount)));
    case "buy":
      return playerAction(player.id, async () => {
        await buyNow(player.id, listingId);
        return { ok: true };
      });
    case "cancel":
      return playerAction(player.id, async () => {
        await cancelListing(player.id, listingId);
        return { ok: true };
      });
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
}
