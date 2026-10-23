import { RARITY_ORDER, type MediaType, type Rarity } from "./cards";
import type { Finish } from "./finishes";

/* ------------------------------------------------------------------ */
/*  Rarity combos: one-time coin rewards for high-tier collections     */
/* ------------------------------------------------------------------ */

export interface OwnedSummary {
  cardId: string;
  rarity: Rarity;
  type: MediaType;
  finish?: Finish;
}

export interface Combo {
  slug: string;
  name: string;
  description: string;
  /** Colour theme in the UI */
  rarity: Rarity;
  target: number;
  reward: number;
  /** Counts matching distinct cards */
  matches: (card: OwnedSummary) => boolean;
}

const atLeast = (card: OwnedSummary, rarity: Rarity) => RARITY_ORDER[card.rarity] >= RARITY_ORDER[rarity];
const special = (card: OwnedSummary) => !!card.finish && card.finish !== "normal";

/**
 * A chain, easiest first: only the first unclaimed combo is active, claiming it unlocks the
 * next one (lib/collection.ts enforces the order). Kept slugs keep their old claims.
 */
export const COMBOS: Combo[] = [
  {
    slug: "combo-any-25",
    name: "Starter Binder",
    description: "Own 25 different cards",
    rarity: "Common",
    target: 25,
    reward: 500,
    matches: () => true,
  },
  {
    slug: "combo-rare-10",
    name: "Rising Stars",
    description: "Own 10 different Rare cards",
    rarity: "Rare",
    target: 10,
    reward: 800,
    matches: (c) => c.rarity === "Rare",
  },
  {
    slug: "combo-prints-3",
    name: "Shiny Hunter",
    description: "Own 3 different cards in a special print (Foil or better)",
    rarity: "Rare",
    target: 3,
    reward: 1200,
    matches: special,
  },
  {
    slug: "combo-legendary-5",
    name: "Golden Age",
    description: "Own 5 different Legendary cards",
    rarity: "Legendary",
    target: 5,
    reward: 1500,
    matches: (c) => c.rarity === "Legendary",
  },
  {
    slug: "combo-series-8",
    name: "Binge Master",
    description: "Own 8 different TV Series cards of Rare rarity or better",
    rarity: "Rare",
    target: 8,
    reward: 2000,
    matches: (c) => c.type === "TV Series" && atLeast(c, "Rare"),
  },
  {
    slug: "combo-mythic-3",
    name: "Mythic Trio",
    description: "Own 3 different Mythic cards",
    rarity: "Mythic",
    target: 3,
    reward: 3000,
    matches: (c) => c.rarity === "Mythic",
  },
  {
    slug: "combo-legendary-20",
    name: "Walk of Fame",
    description: "Own 20 different Legendary cards",
    rarity: "Legendary",
    target: 20,
    reward: 6000,
    matches: (c) => c.rarity === "Legendary",
  },
  {
    slug: "combo-anime-5",
    name: "Otaku Elite",
    description: "Own 5 different Anime cards of Legendary rarity or better",
    rarity: "Legendary",
    target: 5,
    reward: 8000,
    matches: (c) => c.type === "Anime" && atLeast(c, "Legendary"),
  },
  {
    slug: "combo-mythic-10",
    name: "Hall of Legends",
    description: "Own 10 different Mythic cards",
    rarity: "Mythic",
    target: 10,
    reward: 15000,
    matches: (c) => c.rarity === "Mythic",
  },
];

export function getCombo(slug: string): Combo | undefined {
  return COMBOS.find((c) => c.slug === slug);
}

/** Distinct matching cards, capped at the target. */
export function comboProgress(combo: Combo, owned: OwnedSummary[]): number {
  const ids = new Set(owned.filter(combo.matches).map((c) => c.cardId));
  return Math.min(ids.size, combo.target);
}
