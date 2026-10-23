import { finishOf, type Finish } from "./finishes";

/* ------------------------------------------------------------------ */
/*  Card domain model (client-safe, no server imports)                 */
/* ------------------------------------------------------------------ */

export type MediaType = "Movie" | "TV Series" | "Anime";
export type Rarity = "Mythic" | "Legendary" | "Rare" | "Common";

export const RARITY_ORDER: Record<Rarity, number> = {
  Mythic: 3,
  Legendary: 2,
  Rare: 1,
  Common: 0,
};

export interface CardData {
  /** Unique across media: "movie-11", "tv-1399" (TMDB ids collide between movie and tv) */
  id: string;
  tmdbId: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  type: MediaType;
  /** TMDB vote average, 0..10, one decimal */
  rating: number;
  voteCount: number;
  popularity: number;
  /** Release year, or null when unreleased/unknown */
  releaseDate: number | null;
  overview: string;
  /** Slug of a set in lib/franchises.ts, or null */
  franchise: string | null;
  rarity: Rarity;
  /** Print of this copy; missing = normal (catalogue cards have none) */
  finish?: Finish;
}

/** Extra TMDB facts shown when a card is opened. Money is in USD, 0/null = unknown. */
export interface CardDetails {
  overview: string;
  tagline: string | null;
  genres: string[];
  rating: number;
  voteCount: number;
  releaseDate: string | null;
  /** Minutes (movies) or typical episode length (series) */
  runtime: number | null;
  budget: number | null;
  revenue: number | null;
  seasons: number | null;
  episodes: number | null;
  /** Directors for films, creators for series */
  makers: string[];
  cast: string[];
  networks: string[];
  backdrop: string | null;
  status: string | null;
}

/* ------------------------------------------------------------------ */
/*  Rarity                                                             */
/* ------------------------------------------------------------------ */

/** Average TMDB rating a title is pulled towards when it has few votes. */
const PRIOR_RATING = 6.6;
/** How many votes it takes before a title's own rating outweighs the prior. */
const PRIOR_VOTES = 1500;
/** TV/anime collect roughly a third of the votes a film of similar stature gets on TMDB. */
const TV_VOTE_FACTOR = 0.35;

function normalisedVotes(type: MediaType, voteCount: number): number {
  return type === "Movie" ? voteCount : voteCount / TV_VOTE_FACTOR;
}

/**
 * Bayesian weighted rating (the IMDb Top 250 formula).
 * A 10/10 from 5 voters lands around 6.6, while a 8.5 from 30k voters stays near 8.5.
 */
export function weightedRating(type: MediaType, voteCount: number, rating: number): number {
  const v = normalisedVotes(type, voteCount);
  return (v / (v + PRIOR_VOTES)) * rating + (PRIOR_VOTES / (v + PRIOR_VOTES)) * PRIOR_RATING;
}

/**
 * Quality x fame. Roughly: obscure titles < 15, solid hits 21-29,
 * beloved blockbusters 29-34, all-time icons 34+.
 */
export function cardScore(type: MediaType, voteCount: number, rating: number): number {
  return weightedRating(type, voteCount, rating) * Math.log10(normalisedVotes(type, voteCount) + 1);
}

/**
 * Mythic    -> icons: huge audience AND weighted rating >= 8 (Interstellar, Spirited Away, Breaking Bad)
 * Legendary -> beloved blockbusters (Harry Potter, Avatar, Rogue One)
 * Rare      -> well-known, well-liked titles
 * Common    -> everything else, including new releases and tiny-sample "perfect" scores
 */
export function computeRarity(type: MediaType, voteCount: number, rating: number): Rarity {
  const wr = weightedRating(type, voteCount, rating);
  const score = cardScore(type, voteCount, rating);

  if (score >= 34 && wr >= 8.0) return "Mythic";
  if (score >= 29 && wr >= 7.2) return "Legendary";
  if (score >= 21) return "Rare";
  return "Common";
}

/* ------------------------------------------------------------------ */
/*  Stored snapshots (OwnedCard / Listing rows) -> CardData            */
/* ------------------------------------------------------------------ */

export interface CardSnapshot {
  cardId: string;
  tmdbId: number;
  title: string;
  poster: string | null;
  type: string;
  rating: number;
  year: number | null;
  franchise: string | null;
  rarity: string;
  finish?: string;
}

export function snapshotToCard(s: CardSnapshot): CardData {
  return {
    id: s.cardId,
    tmdbId: s.tmdbId,
    title: s.title,
    poster: s.poster,
    backdrop: null,
    type: s.type as MediaType,
    rating: s.rating,
    voteCount: 0,
    popularity: 0,
    releaseDate: s.year,
    overview: "",
    franchise: s.franchise,
    rarity: s.rarity as Rarity,
    finish: finishOf(s.finish),
  };
}

export function cardToSnapshot(c: CardData): CardSnapshot {
  return {
    cardId: c.id,
    tmdbId: c.tmdbId,
    title: c.title,
    poster: c.poster,
    type: c.type,
    rating: c.rating,
    year: c.releaseDate,
    franchise: c.franchise,
    rarity: c.rarity,
    finish: finishOf(c.finish),
  };
}
