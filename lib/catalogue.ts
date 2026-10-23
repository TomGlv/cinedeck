import "server-only";
import { RARITY_ORDER, cardScore, type CardData, type Rarity } from "./cards";
import { prisma } from "./db";
import { getFavoriteIds } from "./favorites";
import { getCardPool } from "./pool";

/* ------------------------------------------------------------------ */
/*  Catalogue: every card that can drop, searchable, for the showcase  */
/* ------------------------------------------------------------------ */

export interface CatalogueEntry {
  card: CardData;
  favorite: boolean;
  /** Active listings of this card right now, and the cheapest Buy Now */
  market: { count: number; lowest: number | null };
}

export interface CatalogueDTO {
  entries: CatalogueEntry[];
  total: number;
}

export interface CatalogueQuery {
  q?: string;
  rarity?: Rarity | "all";
  favorites?: boolean;
  offset?: number;
  limit?: number;
}

const MAX_LIMIT = 96;

/** Lowercase, no accents or punctuation: "Amélie" and "amelie" match. */
function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Pool cards, rarest and best known first, with the viewer's favorites and what's on the market. */
export async function getCatalogue(playerId: string, query: CatalogueQuery): Promise<CatalogueDTO> {
  const [favorites, pool] = await Promise.all([getFavoriteIds(playerId), getCardPool()]);
  const key = query.q ? searchKey(query.q) : "";
  const matching = pool.cards
    .filter((c) => !key || searchKey(c.title).includes(key))
    .filter((c) => !query.rarity || query.rarity === "all" || c.rarity === query.rarity)
    .filter((c) => !query.favorites || favorites.has(c.id))
    .sort(
      (a, b) =>
        RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] ||
        cardScore(b.type, b.voteCount, b.rating) - cardScore(a.type, a.voteCount, a.rating) ||
        a.id.localeCompare(b.id),
    );

  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? 48));
  const offset = Math.max(0, query.offset ?? 0);
  const cards = matching.slice(offset, offset + limit);

  const listings = await prisma.listing.findMany({
    where: { status: "active", endsAt: { gt: new Date() }, cardId: { in: cards.map((c) => c.id) } },
    select: { cardId: true, buyNowPrice: true },
  });
  const market = new Map<string, { count: number; lowest: number | null }>();
  for (const l of listings) {
    const m = market.get(l.cardId) ?? { count: 0, lowest: null };
    m.count++;
    m.lowest = m.lowest == null ? l.buyNowPrice : Math.min(m.lowest, l.buyNowPrice);
    market.set(l.cardId, m);
  }

  return {
    total: matching.length,
    entries: cards.map((card) => ({ card, favorite: favorites.has(card.id), market: market.get(card.id) ?? { count: 0, lowest: null } })),
  };
}
