import { RARITY_ORDER, type MediaType, type Rarity } from "./cards";

/* ------------------------------------------------------------------ */
/*  Rarity combos: one-time coin rewards for high-tier collections     */
/* ------------------------------------------------------------------ */

export interface OwnedSummary {
  cardId: string;
  rarity: Rarity;
  type: MediaType;
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

export const COMBOS: Combo[] = [
  {
    slug: "combo-legendary-5",
    name: "Golden Age",
    description: "Own 5 different Legendary cards",
    rarity: "Legendary",
    target: 5,
    reward: 1200,
    matches: (c) => c.rarity === "Legendary",
  },
  {
    slug: "combo-legendary-20",
    name: "Walk of Fame",
    description: "Own 20 different Legendary cards",
    rarity: "Legendary",
    target: 20,
    reward: 5000,
    matches: (c) => c.rarity === "Legendary",
  },
  {
    slug: "combo-mythic-3",
    name: "Mythic Trio",
    description: "Own 3 different Mythic cards",
    rarity: "Mythic",
    target: 3,
    reward: 2000,
    matches: (c) => c.rarity === "Mythic",
  },
  {
    slug: "combo-mythic-10",
    name: "Hall of Legends",
    description: "Own 10 different Mythic cards",
    rarity: "Mythic",
    target: 10,
    reward: 10000,
    matches: (c) => c.rarity === "Mythic",
  },
  {
    slug: "combo-anime-5",
    name: "Otaku Elite",
    description: "Own 5 different Anime cards of Legendary rarity or better",
    rarity: "Legendary",
    target: 5,
    reward: 2500,
    matches: (c) => c.type === "Anime" && atLeast(c, "Legendary"),
  },
  {
    slug: "combo-series-8",
    name: "Binge Master",
    description: "Own 8 different TV Series cards of Legendary rarity or better",
    rarity: "Legendary",
    target: 8,
    reward: 3000,
    matches: (c) => c.type === "TV Series" && atLeast(c, "Legendary"),
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
