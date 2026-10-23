import "server-only";
import { prisma } from "./db";
import { snapshotToCard, type CardData, type Rarity } from "./cards";
import { UPGRADE_MAX_INPUTS, isTradeable, upgradeChance } from "./economy";
import { cardKey, parseCardKey } from "./finishes";
import { HOUSE_ID, MarketError, ensureHouse, getMarketValues } from "./market";

/* ------------------------------------------------------------------ */
/*  Upgrader: burn cards for a chance at a pricier one                 */
/* ------------------------------------------------------------------ */

export interface UpgradeTarget {
  /** cardKey(): one target per card print */
  key: string;
  card: CardData;
  value: number;
  /** Copies the house can hand out */
  stock: number;
}

/** House copies that aren't listed: supply is limited, so only these can be won. */
const winnable = { playerId: HOUSE_ID, listing: { is: null } } as const;

/** Every card print the house holds, with its market value, cheapest first. */
export async function getUpgradeTargets(): Promise<UpgradeTarget[]> {
  await ensureHouse();
  const copies = await prisma.ownedCard.findMany({ where: winnable });
  const stock = new Map<string, { copy: (typeof copies)[number]; count: number }>();
  for (const c of copies) {
    const entry = stock.get(cardKey(c));
    if (entry) entry.count++;
    else stock.set(cardKey(c), { copy: c, count: 1 });
  }
  const values = await getMarketValues(copies);
  return Array.from(stock.values())
    .map(({ copy, count }) => ({ key: cardKey(copy), card: snapshotToCard(copy), value: values.get(cardKey(copy))?.value ?? 0, stock: count }))
    .filter((t) => t.value > 0)
    .sort((a, b) => a.value - b.value);
}

/**
 * Hands the staked copies to the house and rolls for the target. The chance is the value
 * staked over the target's value, minus a 10% house edge, capped at 75%. The roll is
 * returned so the wheel can land exactly where the server decided.
 */
export async function upgrade(playerId: string, ownedCardIds: string[], targetKey: string) {
  const ids = Array.from(new Set(ownedCardIds));
  if (ids.length === 0) throw new MarketError("Pick at least one card to upgrade");
  if (ids.length > UPGRADE_MAX_INPUTS) throw new MarketError(`At most ${UPGRADE_MAX_INPUTS} cards per upgrade`);

  await ensureHouse();
  const { cardId, finish } = parseCardKey(targetKey);
  const prize = await prisma.ownedCard.findFirst({ where: { ...winnable, cardId, finish } });
  if (!prize) throw new MarketError("No copy of that card is left");

  const copies = await prisma.ownedCard.findMany({ where: { id: { in: ids }, playerId, listing: { is: null } } });
  if (copies.length !== ids.length) throw new MarketError("Some of these cards are no longer available");
  if (!copies.every((c) => isTradeable(c.cardId))) throw new MarketError("Reward cards can't be upgraded");

  const values = await getMarketValues([...copies, prize]);
  const stake = copies.reduce((sum, c) => sum + (values.get(cardKey(c))?.value ?? 0), 0);
  const targetValue = values.get(cardKey(prize))?.value ?? 0;
  if (targetValue <= stake) throw new MarketError("Pick a target worth more than what you put in");

  const chance = upgradeChance(stake, targetValue);
  const roll = Math.random();
  const won = roll < chance;

  await prisma.$transaction(async (tx) => {
    const staked = await tx.ownedCard.updateMany({
      where: { id: { in: ids }, playerId, listing: { is: null } },
      data: { playerId: HOUSE_ID },
    });
    if (staked.count !== ids.length) throw new MarketError("Some of these cards are no longer available");
    if (won) {
      const moved = await tx.ownedCard.updateMany({
        where: { id: prize.id, ...winnable },
        data: { playerId, pulledAt: new Date() },
      });
      if (moved.count === 0) throw new MarketError("Someone just took the last copy, try again");
    }
  });

  return { won, chance, roll, stake, targetValue, target: snapshotToCard(prize), rarity: prize.rarity as Rarity };
}
