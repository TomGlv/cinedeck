import type { CardData, Rarity } from "./cards";
import { finishMultiplier } from "./finishes";
import type { PlayerState } from "./packs";

/* ------------------------------------------------------------------ */
/*  Prices (client-safe)                                               */
/* ------------------------------------------------------------------ */

/** Instant sale to the game. Tuned so a premium pack roughly breaks even when fully quick-sold. */
const QUICK_SELL_BASE: Record<Rarity, number> = { Common: 5, Rare: 20, Legendary: 80, Mythic: 250 };
/** Fair market value relative to quick sell, before sales history kicks in. */
const MARKET_MULTIPLIER = 2.5;
/** EA-style tax taken from the seller on every market sale. */
export const MARKET_TAX = 0.05;
export const MAX_PRICE = 1_000_000;

export const LISTING_DURATIONS = [
  { label: "5 min", minutes: 5 },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "24 hours", minutes: 1440 },
] as const;

type Priced = Pick<CardData, "rarity" | "rating"> & { finish?: string | null };

/** Better-rated cards are worth more within their rarity (x0.6 .. x1.5). */
function ratingFactor(rating: number): number {
  return Math.min(1.5, Math.max(0.6, 0.75 + (rating - 7) * 0.25));
}

/** Rounds to "market-looking" steps: 5 under 100, 10 under 1k, 50 above. */
export function roundPrice(n: number): number {
  const step = n < 100 ? 5 : n < 1000 ? 10 : 50;
  return Math.max(step, Math.round(n / step) * step);
}

export function quickSellPrice(card: Priced): number {
  return Math.max(1, Math.round(QUICK_SELL_BASE[card.rarity] * ratingFactor(card.rating) * finishMultiplier(card.finish)));
}

export function baseMarketValue(card: Priced): number {
  return roundPrice(quickSellPrice(card) * MARKET_MULTIPLIER);
}

export function bidIncrement(current: number): number {
  if (current < 100) return 5;
  if (current < 1000) return 10;
  if (current < 10_000) return 50;
  return 100;
}

export function minNextBid(l: { startPrice: number; currentBid: number | null }): number {
  return l.currentBid == null ? l.startPrice : l.currentBid + bidIncrement(l.currentBid);
}

export function afterTax(price: number): number {
  return Math.floor(price * (1 - MARKET_TAX));
}

/** Reward cards like the Holocron can't be sold. */
export function isTradeable(cardId: string): boolean {
  return !cardId.startsWith("special-");
}

/* ------------------------------------------------------------------ */
/*  API payloads                                                       */
/* ------------------------------------------------------------------ */

export type Trend = -1 | 0 | 1;

export interface ListingDTO {
  id: string;
  card: CardData;
  sellerName: string;
  isMine: boolean;
  startPrice: number;
  buyNowPrice: number;
  currentBid: number | null;
  bidderName: string | null;
  bidCount: number;
  iAmHighest: boolean;
  /** My hidden max bid (held in escrow) while I lead */
  myMax: number | null;
  /** I bid on this auction and someone is now above me */
  outbid: boolean;
  /** Ended and someone else won it after I bid */
  lost: boolean;
  minBid: number;
  endsAt: string;
  status: "active" | "sold" | "expired" | "cancelled";
  soldPrice: number | null;
  buyerName: string | null;
  iWon: boolean;
  marketValue: number;
  trend: Trend;
}

export interface SaleDTO {
  id: string;
  cardId: string;
  title: string;
  rarity: Rarity;
  poster: string | null;
  price: number;
  buyerName: string | null;
  soldAt: string;
}

export interface BidDTO {
  bidderName: string;
  isMe: boolean;
  amount: number;
  auto: boolean;
  createdAt: string;
}

export interface MarketStats {
  active: number;
  sales24h: number;
  volume24h: number;
}

export interface MarketDTO {
  browse: ListingDTO[];
  mine: ListingDTO[];
  bids: ListingDTO[];
  recentSales: SaleDTO[];
  stats: MarketStats;
  state: PlayerState;
}

export interface OwnedGroupDTO {
  card: CardData;
  /** Copy ids; `listed` copies are on the market */
  copies: { id: string; listed: boolean }[];
  marketValue: number;
  quickSell: number;
  trend: Trend;
  tradeable: boolean;
  lastPulledAt: string;
}

export interface SetProgressDTO {
  slug: string;
  name: string;
  cards: { card: CardData; owned: boolean }[];
  owned: number;
  total: number;
  complete: boolean;
  claimed: boolean;
  bonus: { coinReward: number; coinBoost: number; banner: boolean; rewardCard?: { name: string; description: string } };
}

export interface ComboProgressDTO {
  slug: string;
  name: string;
  description: string;
  rarity: Rarity;
  progress: number;
  target: number;
  reward: number;
  claimed: boolean;
}

export interface CollectionDTO {
  groups: OwnedGroupDTO[];
  sets: SetProgressDTO[];
  combos: ComboProgressDTO[];
  state: PlayerState;
}

/* ------------------------------------------------------------------ */
/*  Upgrader & battles                                                 */
/* ------------------------------------------------------------------ */

export const UPGRADE_MAX_INPUTS = 8;
/** Share of the staked value the upgrader pays back on average. */
const UPGRADE_EDGE = 0.9;
export const UPGRADE_MAX_CHANCE = 0.75;

/** Win probability (0..1) when staking `stake` coins of cards on a card worth `target`. */
export function upgradeChance(stake: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(UPGRADE_MAX_CHANCE, (stake / target) * UPGRADE_EDGE);
}

/** Packs that can be battled (the free pack can't). */
export const BATTLE_PACKS = ["premium", "blockbuster"] as const;
export type BattlePack = (typeof BATTLE_PACKS)[number];
/** classic: highest total value wins · underdog: lowest total value wins */
export type BattleMode = "classic" | "underdog";

/** bot: instant vs a bot · open: public lobby, a random player (or a bot after 90s) joins · friend: private challenge */
export type BattleOpponent = "bot" | "open" | "friend";

export interface BattleSide {
  name: string;
  cards: { card: CardData; value: number }[];
  total: number;
}

export interface BattleDTO {
  id: string;
  pack: BattlePack;
  mode: BattleMode;
  status: "open" | "done" | "cancelled";
  creatorName: string;
  opponentName: string | null;
  invitedName: string | null;
  isCreator: boolean;
  isInvited: boolean;
  createdAt: string;
  finishedAt: string | null;
  /** Only once done, from the viewer's point of view */
  you?: BattleSide;
  opponent?: BattleSide;
  won?: boolean;
}

export interface BattlesDTO {
  /** Public lobbies anyone can join */
  open: BattleDTO[];
  /** Friend challenges waiting for me */
  invites: BattleDTO[];
  /** My lobbies waiting for an opponent */
  waiting: BattleDTO[];
  /** My finished battles, newest first */
  recent: BattleDTO[];
  friends: string[];
  state: PlayerState;
}
