import type { Rarity } from "./cards";
import type { Finish } from "./finishes";

/* ------------------------------------------------------------------ */
/*  Pack definitions & economy (client-safe)                           */
/* ------------------------------------------------------------------ */

export type PackType = "free" | "premium" | "blockbuster" | "halloween" | "holidays" | "quickie" | "boxoffice" | "halloffame";

/** Relative weights per rarity for one card slot. */
export type Odds = Record<Rarity, number>;

/** Limited-time pack drawn from one TMDB genre. Dates repeat every year, both ends included. */
export interface PackEvent {
  name: string;
  /** [month 1-12, day] */
  from: [number, number];
  to: [number, number];
  /** TMDB movie genre id the cards come from */
  genre: number;
}

export interface PackDef {
  type: PackType;
  name: string;
  tagline: string;
  cost: number;
  /** One entry per card, in draw order */
  slots: Odds[];
  /** Only sold during this event */
  event?: PackEvent;
  /** Multiplies the chance of special finishes (foil, polychrome...) */
  finishBoost?: number;
  /** Only opened in booster battles, never sold in the shop */
  battleOnly?: true;
}

/*
 * Per-pack odds of at least one Legendary+ / Mythic (see chanceAtLeast):
 *   Daily Reel     ~5% / ~0.3%   (free every 15 min, so a Legendary every ~5h of play)
 *   Director's Cut ~22% / ~1.1%
 *   Blockbuster    100% / ~3.2%
 *   Box Office     100% / ~4.9%
 *   Hall of Fame   100% / ~9.6%
 */
const STANDARD: Odds = { Common: 88, Rare: 11.4, Legendary: 0.55, Mythic: 0.05 };
const RARE_PLUS: Odds = { Common: 0, Rare: 97.4, Legendary: 2.5, Mythic: 0.1 };
const PREMIUM: Odds = { Common: 75, Rare: 22.5, Legendary: 2.35, Mythic: 0.15 };
const PREMIUM_HIT: Odds = { Common: 0, Rare: 86, Legendary: 13.5, Mythic: 0.5 };
const BLOCKBUSTER: Odds = { Common: 35, Rare: 58, Legendary: 6.7, Mythic: 0.3 };
const LEGENDARY_PLUS: Odds = { Common: 0, Rare: 0, Legendary: 98, Mythic: 2 };

export const PACKS: Record<PackType, PackDef> = {
  free: {
    type: "free",
    name: "Daily Reel",
    tagline: "5 cards · 1 guaranteed Rare or better",
    cost: 0,
    slots: [STANDARD, STANDARD, STANDARD, STANDARD, RARE_PLUS],
  },
  premium: {
    type: "premium",
    name: "Director's Cut",
    tagline: "5 cards · 1 boosted Rare or better",
    cost: 250,
    slots: [PREMIUM, PREMIUM, PREMIUM, PREMIUM, PREMIUM_HIT],
  },
  blockbuster: {
    type: "blockbuster",
    name: "Blockbuster",
    tagline: "5 cards · 1 guaranteed Legendary or better",
    cost: 600,
    slots: [BLOCKBUSTER, BLOCKBUSTER, BLOCKBUSTER, BLOCKBUSTER, LEGENDARY_PLUS],
  },
  halloween: {
    type: "halloween",
    name: "Fright Night",
    tagline: "5 horror cards · 1 Rare or better · x3 special finishes",
    cost: 400,
    slots: [PREMIUM, PREMIUM, PREMIUM, PREMIUM, PREMIUM_HIT],
    event: { name: "Halloween", from: [10, 15], to: [11, 3], genre: 27 },
    finishBoost: 3,
  },
  holidays: {
    type: "holidays",
    name: "Holiday Reel",
    tagline: "5 family classics · 1 Rare or better · x3 special finishes",
    cost: 400,
    slots: [PREMIUM, PREMIUM, PREMIUM, PREMIUM, PREMIUM_HIT],
    event: { name: "Holidays", from: [12, 10], to: [1, 6], genre: 10751 },
    finishBoost: 3,
  },
  quickie: {
    type: "quickie",
    name: "Matinee",
    tagline: "5 cards · 1 guaranteed Rare or better",
    cost: 100,
    slots: [STANDARD, STANDARD, STANDARD, STANDARD, RARE_PLUS],
    battleOnly: true,
  },
  boxoffice: {
    type: "boxoffice",
    name: "Box Office",
    tagline: "5 cards · 2 guaranteed Legendary or better",
    cost: 1500,
    slots: [BLOCKBUSTER, BLOCKBUSTER, BLOCKBUSTER, LEGENDARY_PLUS, LEGENDARY_PLUS],
    battleOnly: true,
  },
  halloffame: {
    type: "halloffame",
    name: "Hall of Fame",
    tagline: "5 cards · all Legendary or better",
    cost: 5000,
    slots: [LEGENDARY_PLUS, LEGENDARY_PLUS, LEGENDARY_PLUS, LEGENDARY_PLUS, LEGENDARY_PLUS],
    battleOnly: true,
  },
};

/** Whether `date` falls in the event's yearly window (handles windows over New Year). */
function inWindow(event: PackEvent, date: Date): boolean {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  const from = event.from[0] * 100 + event.from[1];
  const to = event.to[0] * 100 + event.to[1];
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** Whether the shop sells `pack` right now. */
export function isPackAvailable(pack: PackDef, date = new Date()): boolean {
  return !pack.battleOnly && (!pack.event || inWindow(pack.event, date));
}

/** End of the current window as a Date (end of the `to` day), for "ends in" countdowns. */
export function eventEndsAt(event: PackEvent, date = new Date()): Date {
  const year = date.getMonth() + 1 > event.to[0] ? date.getFullYear() + 1 : date.getFullYear();
  return new Date(year, event.to[0] - 1, event.to[1], 23, 59, 59);
}

/** Packs on sale right now, events first. */
export function availablePacks(date = new Date()): PackDef[] {
  const all = Object.values(PACKS).filter((p) => isPackAvailable(p, date));
  return [...all.filter((p) => p.event), ...all.filter((p) => !p.event)];
}

export const FREE_PACK_COOLDOWN_MS = 15 * 60 * 1000;
/** CineCoins granted with each free pack, before set-completion boosts. */
export const FREE_PACK_COINS = 50;

/** Chance (%) that a slot rolls at least `rarity`, for display. */
export function chanceAtLeast(odds: Odds, rarity: Rarity): number {
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  const order: Rarity[] = ["Mythic", "Legendary", "Rare", "Common"];
  const hits = order.slice(0, order.indexOf(rarity) + 1).reduce((sum, r) => sum + odds[r], 0);
  return (hits / total) * 100;
}

/* ------------------------------------------------------------------ */
/*  Player state shared by API and UI                                  */
/* ------------------------------------------------------------------ */

/** Profile picture: one of the player's own cards, to show off. */
export interface AvatarDTO {
  title: string;
  poster: string | null;
  rarity: Rarity;
  finish: Finish;
}

export interface PlayerState {
  /** null for guests */
  username: string | null;
  avatar: AvatarDTO | null;
  /** Username, or Guest-XXXX */
  displayName: string;
  coins: number;
  /** Redeemed the unlimited code: the balance refills after every spend */
  unlimited: boolean;
  /** ISO date when the next free pack unlocks; null or past = available now */
  nextFreePackAt: string | null;
  cardCount: number;
  uniqueCount: number;
  /** Incoming friend requests awaiting an answer */
  friendRequests: number;
  /** Battle invites plus finished battles the player hasn't watched */
  battleAlerts: number;
  /** Unread notifications */
  notifications: number;
  /** Trade offers waiting for my answer */
  tradeOffers: number;
}

/** Chance (%) that a whole pack contains at least one card of `rarity` or better. */
export function packChanceAtLeast(pack: PackDef, rarity: Rarity): number {
  const miss = pack.slots.reduce((p, odds) => p * (1 - chanceAtLeast(odds, rarity) / 100), 1);
  return (1 - miss) * 100;
}
