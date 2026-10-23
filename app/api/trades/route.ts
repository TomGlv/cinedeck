import { NextResponse, type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { getOrCreatePlayer, getPlayerState } from "@/lib/player";
import { cancelTrade, createTrade, getTradeInventory, listTrades, respondTrade } from "@/lib/trades";

export const dynamic = "force-dynamic";

const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

/** GET -> { incoming, outgoing, history, state } · GET ?inventory=1&with=username -> { mine, theirs } */
export async function GET(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const params = req.nextUrl.searchParams;
  if (params.get("inventory")) {
    return playerAction(player.id, () => getTradeInventory(player.id, params.get("with") ?? undefined));
  }
  const [trades, state] = await Promise.all([listTrades(player.id), getPlayerState(player.id)]);
  return NextResponse.json({ ...trades, state });
}

/**
 * POST { action: "create", to, offer: ownedCardId[], request: ownedCardId[], offerCoins, requestCoins, message }
 * POST { action: "accept" | "decline" | "cancel", tradeId }
 */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const body = await readJson(req);
  const tradeId = String(body.tradeId ?? "");

  return playerAction(player.id, async () => {
    switch (body.action) {
      case "create":
        return createTrade(player.id, {
          to: String(body.to ?? ""),
          offer: ids(body.offer),
          request: ids(body.request),
          offerCoins: body.offerCoins,
          requestCoins: body.requestCoins,
          message: body.message ? String(body.message) : "",
        });
      case "accept":
      case "decline":
        return respondTrade(player.id, tradeId, body.action === "accept");
      case "cancel":
        return cancelTrade(player.id, tradeId);
      default:
        return { message: "" };
    }
  });
}
