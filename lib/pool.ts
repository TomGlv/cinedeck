import "server-only";
import { RARITY_ORDER, type CardData, type Rarity } from "./cards";
import { rollFinish } from "./finishes";
import { FRANCHISES } from "./franchises";
import { PACKS, type Odds, type PackType } from "./packs";
import { SAMPLE_CARDS } from "./sample-cards";
import { getFranchiseCards, getGenreMovies, getPopular, getTopRated, getTrending } from "./tmdb";

/* ------------------------------------------------------------------ */
/*  Card pool: every card that can drop from a pack                    */
/* ------------------------------------------------------------------ */

export interface CardPool {
  cards: CardData[];
  byRarity: Record<Rarity, CardData[]>;
  source: "live" | "sample";
}

const MIN_VOTES = 20;
const LIVE_TTL_MS = 60 * 60 * 1000;
const SAMPLE_TTL_MS = 60 * 1000;
let cached: { pool: CardPool; expires: number } | null = null;

async function fetchLiveCards(): Promise<CardData[]> {
  const queries: Promise<CardData[]>[] = [
    getTrending("day"),
    getTrending("week"),
    ...[1, 2, 3, 4, 5].map((p) => getTopRated("movie", p)),
    ...[1, 2, 3].map((p) => getTopRated("tv", p)),
    ...[1, 2, 3].map((p) => getPopular("movie", p)),
    ...[1, 2].map((p) => getPopular("tv", p)),
    // Every set must be completable, so all franchise entries are always in the pool
    ...FRANCHISES.map((f) => getFranchiseCards(f.slug)),
  ];

  const results = await Promise.allSettled(queries);
  const ok = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (ok.length === 0) {
    const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstError?.reason ?? new Error("TMDB returned no cards");
  }

  // Dedupe; a franchise-tagged copy wins over an untagged one
  const byId = new Map<string, CardData>();
  for (const card of ok) {
    const existing = byId.get(card.id);
    if (!existing || (!existing.franchise && card.franchise)) byId.set(card.id, card);
  }
  // Drop titles nobody has rated yet (franchise entries stay so sets remain completable)
  return Array.from(byId.values()).filter((c) => c.poster && (c.franchise || c.voteCount >= MIN_VOTES));
}

export async function getCardPool(): Promise<CardPool> {
  if (cached && cached.expires > Date.now()) return cached.pool;

  let cards: CardData[];
  let source: CardPool["source"];
  try {
    cards = await fetchLiveCards();
    source = "live";
  } catch (err) {
    console.warn(`[pool] ${err instanceof Error ? err.message : err}, using sample cards`);
    cards = SAMPLE_CARDS;
    source = "sample";
  }

  const pool = buildPool(cards, source);
  cached = { pool, expires: Date.now() + (source === "live" ? LIVE_TTL_MS : SAMPLE_TTL_MS) };
  return pool;
}

function buildPool(cards: CardData[], source: CardPool["source"]): CardPool {
  const byRarity: CardPool["byRarity"] = { Mythic: [], Legendary: [], Rare: [], Common: [] };
  for (const card of cards) byRarity[card.rarity].push(card);
  return { cards, byRarity, source };
}

const eventCache = new Map<number, { pool: CardPool; expires: number }>();

/** Cards of one genre for an event pack; falls back to the main pool if TMDB is down. */
async function getGenrePool(genre: number): Promise<CardPool> {
  const hit = eventCache.get(genre);
  if (hit && hit.expires > Date.now()) return hit.pool;

  const results = await Promise.allSettled([
    ...[1, 2, 3, 4, 5].map((p) => getGenreMovies(genre, p)),
    ...[1, 2].map((p) => getGenreMovies(genre, p, "popularity.desc")),
  ]);
  const byId = new Map<string, CardData>();
  for (const r of results) if (r.status === "fulfilled") for (const c of r.value) if (c.poster && c.voteCount >= MIN_VOTES) byId.set(c.id, c);

  if (byId.size < 20) return getCardPool();
  const pool = buildPool(Array.from(byId.values()), "live");
  eventCache.set(genre, { pool, expires: Date.now() + LIVE_TTL_MS });
  return pool;
}

/** The pool a pack draws from: its event genre, or every card. */
export async function getPoolFor(type: PackType): Promise<CardPool> {
  const event = PACKS[type].event;
  return event ? getGenrePool(event.genre) : getCardPool();
}

/* ------------------------------------------------------------------ */
/*  Drawing                                                            */
/* ------------------------------------------------------------------ */

const RARITIES_DESC: Rarity[] = ["Mythic", "Legendary", "Rare", "Common"];

function rollRarity(odds: Odds): Rarity {
  const total = RARITIES_DESC.reduce((sum, r) => sum + odds[r], 0);
  let roll = Math.random() * total;
  for (const rarity of RARITIES_DESC) {
    roll -= odds[rarity];
    if (roll < 0) return rarity;
  }
  return "Common";
}

/** Picks an unused card of `rarity`; if that bucket is empty, steps down, then up. */
function pickCard(pool: CardPool, rarity: Rarity, used: Set<string>): CardData {
  const idx = RARITIES_DESC.indexOf(rarity);
  const search = [...RARITIES_DESC.slice(idx), ...RARITIES_DESC.slice(0, idx).reverse()];
  for (const r of search) {
    const candidates = pool.byRarity[r].filter((c) => !used.has(c.id));
    if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];
  }
  // Pool smaller than a pack: allow duplicates
  return pool.cards[Math.floor(Math.random() * pool.cards.length)];
}

/** Draws a pack, each card with its rolled finish, sorted so the best card is revealed last. */
export function drawPack(pool: CardPool, type: PackType): CardData[] {
  const pack = PACKS[type];
  const used = new Set<string>();
  const cards = pack.slots.map((odds) => {
    const card = pickCard(pool, rollRarity(odds), used);
    used.add(card.id);
    return { ...card, finish: rollFinish(pack.finishBoost) };
  });
  // A special finish is a bigger moment than one rarity step, so it goes last within its rarity
  const special = (c: CardData) => (c.finish && c.finish !== "normal" ? 1 : 0);
  return cards.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || special(a) - special(b));
}
