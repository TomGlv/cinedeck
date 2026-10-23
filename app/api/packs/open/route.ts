import { NextResponse, type NextRequest } from "next/server";
import { cardToSnapshot } from "@/lib/cards";
import { prisma } from "@/lib/db";
import { FREE_PACK_COINS, FREE_PACK_COOLDOWN_MS, PACKS, isPackAvailable, type PackType } from "@/lib/packs";
import { getCoinBoost, getOrCreatePlayer, getPlayerState } from "@/lib/player";
import { drawPack, getPoolFor } from "@/lib/pool";

export const dynamic = "force-dynamic";

/** POST { type: PackType } -> { cards (with isNew), coinsEarned, state } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { type?: string };
  if (!body.type || !Object.hasOwn(PACKS, body.type)) {
    return NextResponse.json({ error: "Unknown pack type" }, { status: 400 });
  }
  const type = body.type as PackType;
  if (!isPackAvailable(PACKS[type])) {
    return NextResponse.json({ error: "This event pack isn't on sale right now" }, { status: 400 });
  }
  const player = await getOrCreatePlayer();

  // Build the pool before charging, so a slow TMDB call never leaves a paid pack unopened
  const pool = await getPoolFor(type);
  let coinsEarned = 0;

  // Conditional updates make double-clicks and parallel requests safe
  if (type === "free") {
    coinsEarned = Math.round(FREE_PACK_COINS * (1 + (await getCoinBoost(player.id))));
    const cutoff = new Date(Date.now() - FREE_PACK_COOLDOWN_MS);
    const claimed = await prisma.player.updateMany({
      where: { id: player.id, OR: [{ lastFreePackAt: null }, { lastFreePackAt: { lte: cutoff } }] },
      data: { lastFreePackAt: new Date(), cineCoins: { increment: coinsEarned } },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "Your free pack isn't ready yet", state: await getPlayerState(player.id) },
        { status: 429 },
      );
    }
  } else {
    const cost = PACKS[type].cost;
    const paid = await prisma.player.updateMany({
      where: { id: player.id, cineCoins: { gte: cost } },
      data: { cineCoins: { decrement: cost } },
    });
    if (paid.count === 0) {
      return NextResponse.json(
        { error: "Not enough CineCoins", state: await getPlayerState(player.id) },
        { status: 402 },
      );
    }
  }

  const cards = drawPack(pool, type);
  const alreadyOwned = await prisma.ownedCard.findMany({
    where: { playerId: player.id, cardId: { in: cards.map((c) => c.id) } },
    distinct: ["cardId"],
    select: { cardId: true },
  });
  const owned = new Set(alreadyOwned.map((o) => o.cardId));

  await prisma.ownedCard.createMany({ data: cards.map((c) => ({ playerId: player.id, ...cardToSnapshot(c) })) });

  return NextResponse.json({
    cards: cards.map((c) => ({ ...c, isNew: !owned.has(c.id) })),
    coinsEarned,
    state: await getPlayerState(player.id),
  });
}
