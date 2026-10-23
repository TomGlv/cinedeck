/* ------------------------------------------------------------------ */
/*  Collectible sets ("binders") and their completion rewards          */
/* ------------------------------------------------------------------ */

/** Where the full card list of a set comes from on TMDB. */
export type FranchiseSource =
  | { kind: "collection"; collectionId: number; extraMovieIds?: number[] }
  | { kind: "company"; companyId: number }
  | { kind: "director"; personId: number };

export interface FranchiseBonus {
  /** One-time CineCoins payout when the set is claimed */
  coinReward: number;
  /** Multiplier on free CineCoins generation, e.g. 0.5 = +50% */
  coinBoost: number;
  /** Gold animated profile banner */
  banner: boolean;
  /** Special card variant granted on completion */
  rewardCard?: { name: string; description: string };
}

export interface Franchise {
  slug: string;
  name: string;
  source: FranchiseSource;
  bonus: FranchiseBonus;
}

export const FRANCHISES: Franchise[] = [
  {
    slug: "star-wars",
    name: "The Complete Star Wars Saga",
    // Episodes I–IX live in the Star Wars Collection; Rogue One and Solo are added by hand
    source: { kind: "collection", collectionId: 10, extraMovieIds: [330459, 348350] },
    bonus: {
      coinReward: 6000,
      coinBoost: 0.5,
      banner: true,
      rewardCard: {
        name: "The Holocron",
        description: "Legendary animated variant. Proof you mastered the whole saga.",
      },
    },
  },
  {
    slug: "harry-potter",
    name: "Harry Potter",
    source: { kind: "collection", collectionId: 1241 },
    bonus: { coinReward: 4000, coinBoost: 0.2, banner: true },
  },
  {
    slug: "lord-of-the-rings",
    name: "The Lord of the Rings",
    source: { kind: "collection", collectionId: 119 },
    bonus: { coinReward: 2500, coinBoost: 0.15, banner: true },
  },
  {
    slug: "dark-knight",
    name: "The Dark Knight Trilogy",
    source: { kind: "collection", collectionId: 263 },
    bonus: { coinReward: 1500, coinBoost: 0.1, banner: false },
  },
  {
    slug: "ghibli",
    name: "Studio Ghibli",
    source: { kind: "company", companyId: 10342 },
    bonus: { coinReward: 5000, coinBoost: 0.25, banner: true },
  },
  {
    slug: "nolan",
    name: "Christopher Nolan",
    source: { kind: "director", personId: 525 },
    bonus: { coinReward: 4000, coinBoost: 0.2, banner: true },
  },
];

export function getFranchise(slug: string): Franchise | undefined {
  return FRANCHISES.find((f) => f.slug === slug);
}

/** Maps a TMDB `belongs_to_collection.id` back to one of our sets. */
export function franchiseForCollection(collectionId: number): string | null {
  return (
    FRANCHISES.find((f) => f.source.kind === "collection" && f.source.collectionId === collectionId)
      ?.slug ?? null
  );
}
