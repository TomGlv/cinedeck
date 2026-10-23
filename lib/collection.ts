import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { snapshotToCard, type MediaType, type Rarity } from "./cards";
import { COMBOS, comboProgress, getCombo, type OwnedSummary } from "./combos";
import { isTradeable, quickSellPrice, type CollectionDTO, type OwnedGroupDTO } from "./economy";
import { FRANCHISES, getFranchise } from "./franchises";
import { cardKey, finishOf } from "./finishes";
import { MarketError, getMarketValues } from "./market";
import { getPlayerState } from "./player";
import { getSetCards } from "./sets";

export async function getCollection(playerId: string): Promise<CollectionDTO> {
  const [copies, claimedRows, setCards, state] = await Promise.all([
    prisma.ownedCard.findMany({
      where: { playerId },
      include: { listing: { select: { id: true } } },
      orderBy: { pulledAt: "desc" },
    }),
    prisma.completedSet.findMany({ where: { playerId }, select: { slug: true } }),
    getSetCards(),
    getPlayerState(playerId),
  ]);
  const claimed = new Set(claimedRows.map((r) => r.slug));

  // One group per distinct card print (a foil copy is its own group); copies are newest first
  const groupsById = new Map<string, OwnedGroupDTO>();
  for (const c of copies) {
    let group = groupsById.get(cardKey(c));
    if (!group) {
      const card = snapshotToCard(c);
      group = {
        card,
        copies: [],
        marketValue: 0,
        quickSell: quickSellPrice(card),
        trend: 0,
        tradeable: isTradeable(c.cardId),
        lastPulledAt: c.pulledAt.toISOString(),
      };
      groupsById.set(cardKey(c), group);
    }
    // Older copies may predate the poster: show the group with any copy's poster
    if (!group.card.poster && c.poster) group.card = { ...group.card, poster: c.poster };
    group.copies.push({ id: c.id, listed: c.listing != null });
  }
  const groups = Array.from(groupsById.values());

  const values = await getMarketValues(copies);
  for (const g of groups) {
    const v = values.get(cardKey(g.card));
    g.marketValue = g.tradeable ? (v?.value ?? 0) : 0;
    g.trend = v?.trend ?? 0;
  }

  const ownedIds = new Set(copies.map((c) => c.cardId));
  const sets = FRANCHISES.map((f) => {
    const cards = (setCards.get(f.slug) ?? []).map((card) => ({ card, owned: ownedIds.has(card.id) }));
    const owned = cards.filter((c) => c.owned).length;
    return {
      slug: f.slug,
      name: f.name,
      description: f.description,
      cards,
      owned,
      total: cards.length,
      complete: cards.length > 0 && owned === cards.length,
      claimed: claimed.has(f.slug),
      bonus: f.bonus,
    };
  }).filter((s) => s.total > 0);

  const summaries: OwnedSummary[] = groups.map((g) => ({ cardId: g.card.id, rarity: g.card.rarity, type: g.card.type, finish: g.card.finish }));
  // The chain: everything up to the first unclaimed combo is open, the rest is locked
  const current = COMBOS.findIndex((c) => !claimed.has(c.slug));
  const combos = COMBOS.map((c, i) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    rarity: c.rarity,
    progress: comboProgress(c, summaries),
    target: c.target,
    reward: c.reward,
    claimed: claimed.has(c.slug),
    locked: current !== -1 && i > current,
  }));

  return { groups, sets, combos, state };
}

/** Verifies a set or combo is complete, then pays out once. */
export async function claimReward(playerId: string, slug: string): Promise<{ coins: number; rewardCard: string | null }> {
  const franchise = getFranchise(slug);
  const combo = getCombo(slug);
  if (!franchise && !combo) throw new MarketError("Unknown set");

  // Every copy, not one per card: a print combo needs to see the foil next to the normal copy
  const copies = await prisma.ownedCard.findMany({
    where: { playerId },
    select: { cardId: true, rarity: true, type: true, finish: true },
  });
  const owned = new Set(copies.map((c) => c.cardId));

  if (franchise) {
    const cards = (await getSetCards()).get(slug) ?? [];
    if (cards.length === 0 || !cards.every((c) => owned.has(c.id))) throw new MarketError("Set not complete yet");
  } else if (combo) {
    const done = new Set((await prisma.completedSet.findMany({ where: { playerId }, select: { slug: true } })).map((r) => r.slug));
    const before = COMBOS.slice(0, COMBOS.indexOf(combo));
    if (before.some((c) => !done.has(c.slug))) throw new MarketError("Claim the previous combos first");
    const summaries = copies.map((c) => ({ cardId: c.cardId, rarity: c.rarity as Rarity, type: c.type as MediaType, finish: finishOf(c.finish) }));
    if (comboProgress(combo, summaries) < combo.target) throw new MarketError("Combo not complete yet");
  }

  const coins = franchise ? franchise.bonus.coinReward : combo!.reward;
  const rewardCard = franchise?.bonus.rewardCard;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.completedSet.create({ data: { playerId, slug } });
      await tx.player.update({ where: { id: playerId }, data: { cineCoins: { increment: coins } } });
      if (rewardCard) {
        await tx.ownedCard.create({
          data: {
            playerId,
            cardId: `special-${slug}`,
            tmdbId: 0,
            title: rewardCard.name,
            poster: null,
            type: "Movie",
            rating: 10,
            year: null,
            franchise: slug,
            rarity: "Mythic",
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new MarketError("Reward already claimed");
    }
    throw err;
  }

  return { coins, rewardCard: rewardCard?.name ?? null };
}
