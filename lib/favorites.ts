import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { notify } from "./notifications";

/* ------------------------------------------------------------------ */
/*  Favorites: cards a player watches for the market                   */
/* ------------------------------------------------------------------ */

export async function getFavoriteIds(playerId: string): Promise<Set<string>> {
  const rows = await prisma.favorite.findMany({ where: { playerId }, select: { cardId: true } });
  return new Set(rows.map((r) => r.cardId));
}

/** Adds or removes the card; returns whether it's a favorite now. */
export async function toggleFavorite(playerId: string, cardId: string): Promise<{ favorite: boolean }> {
  const removed = await prisma.favorite.deleteMany({ where: { playerId, cardId } });
  if (removed.count > 0) return { favorite: false };
  await prisma.favorite.create({ data: { playerId, cardId } });
  return { favorite: true };
}

/**
 * Tells everyone watching the card that it just went on sale. Only when it wasn't on the
 * market already, so a card that's relisted or sold by several players doesn't spam them.
 * Call it before creating the listing, inside the same transaction.
 */
export async function notifyWatchers(db: Prisma.TransactionClient, card: { cardId: string; title: string }, price: number, sellerId: string | null) {
  const already = await db.listing.count({ where: { cardId: card.cardId, status: "active" } });
  if (already > 0) return;
  const watchers = await db.favorite.findMany({ where: { cardId: card.cardId }, select: { playerId: true } });
  for (const w of watchers) {
    if (w.playerId === sellerId) continue;
    await notify(db, w.playerId, {
      kind: "favorite_listed",
      title: `${card.title} is on the market`,
      body: `One of your favorites just went on sale, Buy Now ${price.toLocaleString("en-US")} CineCoins.`,
      link: `/market?card=${encodeURIComponent(card.cardId)}`,
    });
  }
}
