import "server-only";
import { Prisma, type Listing } from "@prisma/client";
import { prisma } from "./db";
import { snapshotToCard, type CardSnapshot, type Rarity } from "./cards";
import {
  LISTING_DURATIONS,
  MAX_PRICE,
  afterTax,
  baseMarketValue,
  bidIncrement,
  isTradeable,
  minNextBid,
  quickSellPrice,
  roundPrice,
  type BidDTO,
  type ListingDTO,
  type MarketStats,
  type SaleDTO,
  type Trend,
} from "./economy";
import { cardKey, finishMultiplier, finishOf } from "./finishes";
import { notifyWatchers } from "./favorites";
import { notify } from "./notifications";
import { displayNameOf } from "./player";
import { getCardPool } from "./pool";

/** User-facing failure (bad bid, not enough coins...). Routes turn it into a 400. */
export class MarketError extends Error {}

type Tx = Prisma.TransactionClient;

/* ------------------------------------------------------------------ */
/*  Names                                                              */
/* ------------------------------------------------------------------ */

const BOT_NAMES = [
  "PopcornKing", "NolanStan", "GhibliGuru", "ReelDeal", "CinephileX", "JediTrader",
  "SpoilerAlert", "FinalCut", "BoxOfficeBoss", "AnimeOracle", "DirectorDan", "TwistEnding",
  "SilverScreen", "MidnightMatinee", "PlotArmor", "CreditsScene", "DolbyDave", "CultClassic",
  "KubrickFan", "MontageMaster", "JumpCutJess", "TarantinoTom", "OscarBait", "LateNightReel",
];

export function botName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}


const rand = (min: number, max: number) => min + Math.random() * (max - min);

/* ------------------------------------------------------------------ */
/*  Market values ("bourse")                                           */
/* ------------------------------------------------------------------ */

export interface MarketValue {
  value: number;
  trend: Trend;
  lastSale: number | null;
}

type Valued = { cardId: string; rarity: string; rating: number; finish?: string | null };

/** Key of a card's print in a getMarketValues() map. */
export const valueKey = (item: { cardId: string; finish?: string | null }) => cardKey(item);

/** Small deterministic hash so every card gets its own demand cycle. */
function hash(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Hidden demand for a card, roughly x0.7..x1.3: a slow wave over 2-5 days plus a faster
 * one over 5-11 hours, with a per-card phase. Bots pay according to it, so sale prices
 * rise and fall over time and the displayed market value (built from sales) lags behind:
 * that lag is what lets players buy low and sell high.
 */
export function demandFactor(cardId: string, at = Date.now()): number {
  const slow = (48 + hash(cardId, 1) * 72) * HOUR_MS;
  const fast = (5 + hash(cardId, 2) * 6) * HOUR_MS;
  const wave = (period: number, salt: number) => Math.sin((2 * Math.PI * at) / period + hash(cardId, salt) * 2 * Math.PI);
  return 1 + 0.2 * wave(slow, 3) + 0.08 * wave(fast, 4);
}

/** What the card is "really" worth to bots right now. Never shown to players. */
function fundamentalValue(item: Valued, at = Date.now()): number {
  return baseMarketValue({ rarity: item.rarity as Rarity, rating: item.rating, finish: item.finish }) * demandFactor(item.cardId, at);
}

const VALUE_WINDOW = 5;
const VALUE_LOOKBACK_MS = 7 * 24 * HOUR_MS;

/**
 * Market value = the formula price blended with the average of the last 5 sales.
 * Sales weigh up to 80% once there are 5 of them, so the value follows real trading.
 * Trend compares the last sale with the ones before it (+/-3% dead zone).
 * Every print of a card shares one history: special finish sales count divided by their
 * multiplier, and a print's value is the normal value times its multiplier.
 * The map is keyed by valueKey(item).
 */
export async function getMarketValues(items: Valued[]): Promise<Map<string, MarketValue>> {
  const ids = Array.from(new Set(items.map((i) => i.cardId)));
  const sales = ids.length
    ? await prisma.sale.findMany({
        where: { cardId: { in: ids }, soldAt: { gte: new Date(Date.now() - VALUE_LOOKBACK_MS) } },
        orderBy: { soldAt: "desc" },
        select: { cardId: true, price: true, finish: true },
      })
    : [];

  const recentByCard = new Map<string, number[]>();
  for (const s of sales) {
    const recent = recentByCard.get(s.cardId) ?? [];
    if (recent.length < VALUE_WINDOW) recent.push(s.price / finishMultiplier(s.finish));
    recentByCard.set(s.cardId, recent);
  }

  const values = new Map<string, MarketValue>();
  for (const item of items) {
    const key = valueKey(item);
    if (values.has(key)) continue;
    const mult = finishMultiplier(item.finish);
    const base = baseMarketValue({ rarity: item.rarity as Rarity, rating: item.rating });
    const recent = recentByCard.get(item.cardId) ?? [];
    const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : base;
    const weight = 0.8 * (recent.length / VALUE_WINDOW);
    const before = recent.length >= 2 ? recent.slice(1).reduce((a, b) => a + b, 0) / (recent.length - 1) : null;
    const delta = before ? (recent[0] - before) / before : 0;
    values.set(key, {
      value: roundPrice((base * (1 - weight) + avg * weight) * mult),
      trend: Math.abs(delta) < 0.03 ? 0 : (Math.sign(delta) as Trend),
      lastSale: recent[0] != null ? roundPrice(recent[0] * mult) : null,
    });
  }
  return values;
}

/**
 * Claims a periodic job: returns the ms since it last ran and marks it as run now, or null
 * when it ran less than `minMs` ago or another server instance just claimed it.
 * The first claim returns 0. Stored in the DB so serverless instances share it.
 */
async function claimClock(key: string, now: Date, minMs: number): Promise<number | null> {
  const prev = await prisma.clock.findUnique({ where: { key } });
  if (!prev) {
    await prisma.clock.create({ data: { key, at: now } }).catch(() => {});
    return 0;
  }
  const elapsed = now.getTime() - prev.at.getTime();
  if (elapsed < minMs) return null;
  const ok = await prisma.clock.updateMany({ where: { key, at: prev.at }, data: { at: now } });
  return ok.count ? elapsed : null;
}

/** Off-book trades between bots on house cards, about 3 a minute, so prices keep moving. */
const BACKGROUND_TRADES_PER_S = 0.05;

async function backgroundTrades(now: Date) {
  const claimed = await claimClock("background-trades", now, 2000);
  if (!claimed) return;
  const elapsed = Math.min(600, claimed / 1000);
  // Poisson draw: how many trades happened since the last tick
  let count = 0;
  for (let t = -Math.log(Math.random()); t < elapsed * BACKGROUND_TRADES_PER_S; t -= Math.log(Math.random())) count++;
  if (count === 0) return;

  // Only cards that exist can trade
  const held = await prisma.ownedCard.findMany({ where: { playerId: HOUSE_ID }, distinct: ["cardId"], take: 400 });
  if (held.length === 0) return;
  await prisma.sale.createMany({
    data: Array.from({ length: count }, () => {
      const c = held[Math.floor(Math.random() * held.length)];
      return {
        cardId: c.cardId,
        price: roundPrice(fundamentalValue(c, now.getTime()) * rand(0.88, 1.08)),
        title: c.title,
        rarity: c.rarity,
        finish: c.finish,
        poster: c.poster,
        buyerName: botName(),
        soldAt: new Date(now.getTime() - Math.random() * elapsed * 1000),
      };
    }),
  });
}

const HISTORY_SEED_COUNT = 24;
const HISTORY_SEED_SPAN_MS = 72 * HOUR_MS;

/** First time a card's chart is opened with too little history, backfill 3 days of bot trades. */
async function seedHistory(card: Valued & { title: string; poster: string | null }) {
  const [existing, copies] = await Promise.all([
    prisma.sale.count({ where: { cardId: card.cardId } }),
    prisma.ownedCard.count({ where: { cardId: card.cardId } }),
  ]);
  if (existing >= 8 || copies === 0) return;
  const now = Date.now();
  await prisma.sale.createMany({
    data: Array.from({ length: HISTORY_SEED_COUNT - existing }, () => {
      const at = now - Math.random() * HISTORY_SEED_SPAN_MS;
      return {
        cardId: card.cardId,
        price: roundPrice(fundamentalValue(card, at) * rand(0.88, 1.08)),
        title: card.title,
        rarity: card.rarity,
        poster: card.poster,
        buyerName: botName(),
        soldAt: new Date(at),
      };
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  House: the bots' shared inventory (limited supply)                 */
/* ------------------------------------------------------------------ */

/**
 * Cards only exist once a booster created them. Bots don't conjure cards: they all
 * share one inventory, the "house" player, which grows by opening free packs at a
 * steady pace and by buying cards (quick sells, auctions, lost battles). Buy every
 * copy of a card and it disappears from the market until someone pulls it again.
 */
/**
 * The house holds every card players let go of: quick sells, upgrade stakes and the cards
 * bots win in battles. It never mints cards; it puts all of them on the market.
 */
export const HOUSE_ID = "house";
/** Seller name on the house's listings */
export const HOUSE_SELLER = "CineDeck Market";
/** House listings stay up this long, then come back and get relisted at the new market price. */
const HOUSE_LISTING_MS = 6 * HOUR_MS;
/** Copies listed per tick, so a big quick sell doesn't stall one request. */
const HOUSE_LISTINGS_PER_TICK = 40;

let houseReady: Promise<void> | null = null;

/** House copies that aren't on the market. */
const houseStock = { playerId: HOUSE_ID, listing: { is: null } } satisfies Prisma.OwnedCardWhereInput;

/** Creates the house and gives pre-supply bot listings a real card. Call before moving cards to it. */
export function ensureHouse(): Promise<void> {
  houseReady ??= (async () => {
    await prisma.player.upsert({ where: { id: HOUSE_ID }, create: { id: HOUSE_ID, isBot: true, cineCoins: 0 }, update: {} });

    const legacy = await prisma.listing.findMany({ where: { status: "active", sellerId: null, ownedCardId: null } });
    for (const l of legacy) {
      const card = await prisma.ownedCard.create({ data: { playerId: HOUSE_ID, ...snapshotOf(l) } });
      await prisma.listing.update({ where: { id: l.id }, data: { ownedCardId: card.id } });
    }
  })().catch((err) => {
    houseReady = null;
    throw err;
  });
  return houseReady;
}

/** How many copies of each card exist, who holds them and how many are listed. */
export async function getSupply(cardIds: string[]) {
  const [byOwner, listed] = await Promise.all([
    prisma.ownedCard.groupBy({ by: ["cardId", "playerId"], where: { cardId: { in: cardIds } }, _count: true }),
    prisma.listing.groupBy({ by: ["cardId"], where: { cardId: { in: cardIds }, status: "active" }, _count: true }),
  ]);
  const supply = new Map<string, { total: number; house: number; players: number; holders: number; listed: number }>();
  for (const id of cardIds) supply.set(id, { total: 0, house: 0, players: 0, holders: 0, listed: 0 });
  for (const row of byOwner) {
    const s = supply.get(row.cardId)!;
    s.total += row._count;
    if (row.playerId === HOUSE_ID) s.house += row._count;
    else {
      s.players += row._count;
      s.holders++;
    }
  }
  for (const row of listed) supply.get(row.cardId)!.listed = row._count;
  return supply;
}

/* ------------------------------------------------------------------ */
/*  Core transfer                                                      */
/* ------------------------------------------------------------------ */

function snapshotOf(l: CardSnapshot): CardSnapshot {
  return {
    cardId: l.cardId,
    tmdbId: l.tmdbId,
    title: l.title,
    poster: l.poster,
    type: l.type,
    rating: l.rating,
    year: l.year,
    franchise: l.franchise,
    rarity: l.rarity,
    finish: finishOf(l.finish),
  };
}

/** Coins a human leader has locked in the auction: their whole max bid. */
function escrowOf(l: Listing): number {
  return l.maxBid ?? l.currentBid ?? 0;
}

/**
 * Closes a listing as sold: pays the seller (minus tax), moves the copy to the buyer, records the sale.
 * `auction` = won when the auction ended (notifies the buyer; a Buy Now buyer already knows).
 */
async function completeSale(tx: Tx, l: Listing, price: number, buyer: { id: string | null; name: string }, auction = false) {
  const closed = await tx.listing.updateMany({
    where: { id: l.id, status: "active" },
    data: { status: "sold", soldPrice: price, buyerId: buyer.id, buyerName: buyer.name, ownedCardId: null },
  });
  if (closed.count === 0) throw new MarketError("This listing is no longer available");

  if (l.sellerId) {
    await tx.player.update({ where: { id: l.sellerId }, data: { cineCoins: { increment: afterTax(price) } } });
    await notify(tx, l.sellerId, {
      kind: "sold",
      title: `${l.title} sold for ${price.toLocaleString("en-US")}`,
      body: `${buyer.name} bought it. You received ${afterTax(price).toLocaleString("en-US")} coins after tax.`,
      link: "/market?tab=mine",
    });
  }
  if (auction && buyer.id) {
    await notify(tx, buyer.id, {
      kind: "won",
      title: `You won ${l.title}`,
      body: `Auction won for ${price.toLocaleString("en-US")} coins. It's in your collection.`,
      link: "/collection",
    });
  }

  if (l.ownedCardId) {
    // Bots buy for the house, so the copy stays in circulation
    await tx.ownedCard.update({ where: { id: l.ownedCardId }, data: { playerId: buyer.id ?? HOUSE_ID, pulledAt: new Date() } });
  } else if (buyer.id) {
    await tx.ownedCard.create({ data: { playerId: buyer.id, ...snapshotOf(l) } });
  }

  await tx.sale.create({
    data: { cardId: l.cardId, price, title: l.title, rarity: l.rarity, finish: l.finish, poster: l.poster, buyerName: buyer.name },
  });
}

/** Tells the leading human bidder they lost the lead (outbid) or the card (bought outright). */
async function notifyOutbid(tx: Tx, l: Listing, by: string, boughtOut: boolean) {
  if (!l.bidderId) return;
  await notify(tx, l.bidderId, {
    kind: "outbid",
    title: boughtOut ? `${l.title} was bought outright` : `Outbid on ${l.title}`,
    body: boughtOut ? `${by} paid the Buy Now price. Your coins were refunded.` : `${by} took the lead. Your coins were refunded.`,
    link: "/market?tab=bids",
  });
}

async function refund(tx: Tx, playerId: string | null, amount: number | null) {
  if (playerId && amount) {
    await tx.player.update({ where: { id: playerId }, data: { cineCoins: { increment: amount } } });
  }
}

/** Bids shorter than this before the end push the deadline back (anti-snipe). */
const ANTI_SNIPE_MS = 30_000;

interface Bidder {
  /** null = bot */
  id: string | null;
  name: string;
}

/**
 * eBay-style proxy bidding. Every bidder submits a max; the visible price only rises
 * to one increment above the runner-up, and the leader's max auto-defends their lead.
 * A human leader's whole max sits in escrow, the unused part comes back when the auction ends.
 */
async function applyBid(tx: Tx, l: Listing, bidder: Bidder, max: number, now: Date, extend = true) {
  const required = minNextBid(l);
  if (max < required) throw new MarketError(`Minimum bid is ${required}`);

  const leaderMax = l.currentBid == null ? null : escrowOf(l);
  const leader: Bidder = { id: l.bidderId, name: l.bidderName ?? "" };
  const rows: { bidder: Bidder; amount: number; auto: boolean }[] = [];
  let leading: boolean;
  let price: number;

  if (leaderMax == null) {
    leading = true;
    price = required;
    rows.push({ bidder, amount: price, auto: false });
  } else if (max > leaderMax) {
    leading = true;
    price = Math.max(required, Math.min(max, leaderMax + bidIncrement(leaderMax)));
    // The previous leader's proxy fought up to its ceiling before giving way
    if (leaderMax > (l.currentBid ?? 0)) rows.push({ bidder: leader, amount: leaderMax, auto: true });
    rows.push({ bidder, amount: price, auto: false });
  } else {
    leading = false;
    price = Math.min(leaderMax, max + bidIncrement(max));
    rows.push({ bidder, amount: max, auto: false });
    rows.push({ bidder: leader, amount: price, auto: true });
  }

  const closeToEnd = extend && l.endsAt.getTime() - now.getTime() < ANTI_SNIPE_MS;
  const ok = await tx.listing.updateMany({
    where: { id: l.id, status: "active", currentBid: l.currentBid, maxBid: l.maxBid, bidderName: l.bidderName },
    data: {
      currentBid: price,
      bidCount: { increment: rows.length },
      ...(leading && { maxBid: max, bidderId: bidder.id, bidderName: bidder.name }),
      ...(closeToEnd && { endsAt: new Date(now.getTime() + ANTI_SNIPE_MS) }),
    },
  });
  if (ok.count === 0) throw new MarketError("Someone bid just before you, try again");

  if (leading) {
    if (bidder.id) {
      const paid = await tx.player.updateMany({
        where: { id: bidder.id, cineCoins: { gte: max } },
        data: { cineCoins: { decrement: max } },
      });
      if (paid.count === 0) throw new MarketError("Not enough CineCoins");
    }
    await refund(tx, l.bidderId, leaderMax);
    if (l.bidderId && l.bidderId !== bidder.id) await notifyOutbid(tx, l, bidder.name, false);
  }

  await tx.bid.createMany({
    data: rows.map((r) => ({ listingId: l.id, bidderId: r.bidder.id, bidderName: r.bidder.name, amount: r.amount, auto: r.auto })),
  });
  return { leading, price };
}

/* ------------------------------------------------------------------ */
/*  Bots                                                               */
/* ------------------------------------------------------------------ */

/** A bot watching one auction. `max` is fixed for the auction's whole life, so bots bid coherently. */
interface BotInterest {
  name: string;
  max: number;
  /** 0..1, how early in the auction the bot starts bidding */
  eagerness: number;
}

const BOT_BASE_INTEREST: Record<Rarity, number> = { Common: 1, Rare: 2, Legendary: 3, Mythic: 4 };

/**
 * Rolls the bots interested in an auction. Each values the card at 60%-125% of its current
 * fundamental value (centred a bit under it), so a fairly priced card ends near it, an
 * overpriced one draws nobody and a cheap start price draws a crowd.
 */
function makeBotInterest(value: number, rarity: Rarity, startPrice: number, exclude: string): BotInterest[] {
  let count = BOT_BASE_INTEREST[rarity] + Math.floor(Math.random() * 3);
  if (startPrice < value * 0.6) count += 1;
  if (startPrice > value * 1.1) count -= 2;

  const names = BOT_NAMES.filter((n) => n !== exclude).sort(() => Math.random() - 0.5);
  return names.slice(0, Math.max(0, count)).map((name) => ({
    name,
    max: Math.max(1, Math.floor(value * (0.6 + 0.65 * ((Math.random() + Math.random()) / 2)))),
    eagerness: Math.random(),
  }));
}

function parseBots(l: Listing): BotInterest[] {
  try {
    return l.bots ? (JSON.parse(l.bots) as BotInterest[]) : [];
  } catch {
    return [];
  }
}

/** Average seconds before a bot acts: they mostly wait, then pile in near the end. */
function botMeanInterval(remainingS: number, eagerness: number): number {
  if (remainingS < 30) return 5;
  if (remainingS < 120) return 15;
  if (remainingS < 600) return 60;
  return 300 * (1.6 - eagerness);
}

async function botBuyNow(l: Listing, name: string) {
  await prisma.$transaction(async (tx) => {
    await refund(tx, l.bidderId, escrowOf(l));
    await notifyOutbid(tx, l, name, true);
    await completeSale(tx, l, l.buyNowPrice, { id: null, name });
  });
}

/**
 * One bot move. Live bots snipe underpriced Buy Nows and raise in steps rather than
 * showing their whole budget; in the `final` round they bid their full max at once.
 * Returns the updated listing, or null once it sold.
 */
async function botAct(l: Listing, bot: BotInterest, now: Date, final = false): Promise<Listing | null> {
  if (l.bidderId == null && l.bidderName === bot.name) return l;
  if (!final && l.buyNowPrice <= bot.max * 0.9) {
    await botBuyNow(l, bot.name);
    return null;
  }

  const required = minNextBid(l);
  const ceiling = Math.min(bot.max, l.buyNowPrice - 1);
  if (required > ceiling) return l;
  const step = final
    ? ceiling
    : Math.min(ceiling, Math.max(required, roundPrice((l.currentBid ?? l.startPrice) * rand(1.03, 1.15))));

  return prisma.$transaction(async (tx) => {
    await applyBid(tx, l, { id: null, name: bot.name }, step, now, !final);
    return tx.listing.findUniqueOrThrow({ where: { id: l.id } });
  });
}

/** Gives older listings (created before bot interest existed) their bots. */
async function backfillBots(listings: Listing[]) {
  const missing = listings.filter((l) => l.bots == null);
  if (missing.length === 0) return;
  for (const l of missing) {
    l.bots = JSON.stringify(makeBotInterest(fundamentalValue(l), l.rarity as Rarity, l.startPrice, l.sellerName));
    await prisma.listing.update({ where: { id: l.id }, data: { bots: l.bots } });
  }
}

/** Lets every interested bot act on every live auction, more often as the deadline nears. */
async function simulateBots(now: Date) {
  const listings = await prisma.listing.findMany({ where: { status: "active", endsAt: { gt: now } } });
  if (listings.length === 0) return;
  await backfillBots(listings);

  for (const l of listings) {
    const elapsed = (now.getTime() - l.lastBotCheck.getTime()) / 1000;
    const remaining = (l.endsAt.getTime() - now.getTime()) / 1000;
    let current: Listing | null = l;

    for (const bot of parseBots(l).sort(() => Math.random() - 0.5)) {
      if (!current) break;
      if (Math.random() >= 1 - Math.exp(-elapsed / botMeanInterval(remaining, bot.eagerness))) continue;
      try {
        current = await botAct(current, bot, now);
      } catch (err) {
        if (!(err instanceof MarketError)) throw err;
        break;
      }
    }
  }

  await prisma.listing.updateMany({
    where: { id: { in: listings.map((l) => l.id) }, status: "active" },
    data: { lastBotCheck: now },
  });
}

/**
 * Nobody watched the last minute of this auction (the market only ticks on requests),
 * so play out the bidding war the bots would have had: every bot bids its full max.
 */
async function finalRound(l: Listing, now: Date): Promise<Listing> {
  let current = l;
  for (const bot of parseBots(l).sort((a, b) => a.max - b.max)) {
    try {
      current = (await botAct(current, bot, now, true)) ?? current;
    } catch (err) {
      if (!(err instanceof MarketError)) throw err;
    }
  }
  return current;
}

/** Puts every unlisted house copy on sale at its market value (Buy Now = market price). */
async function listHouseStock(now: Date) {
  const stock = await prisma.ownedCard.findMany({ where: houseStock, take: HOUSE_LISTINGS_PER_TICK });
  if (stock.length === 0) return;
  const values = await getMarketValues(stock);
  for (const c of stock) {
    const price = Math.max(1, roundPrice(values.get(valueKey(c))?.value ?? 50));
    try {
      await notifyWatchers(prisma, c, price, null);
      await prisma.listing.create({
        data: {
          ...snapshotOf(c),
          ownedCardId: c.id,
          sellerName: HOUSE_SELLER,
          startPrice: price,
          buyNowPrice: price,
          bots: "[]",
          endsAt: new Date(now.getTime() + HOUSE_LISTING_MS),
        },
      });
    } catch (err) {
      // Another tick listed this copy first
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  }
}

/** Ends expired auctions: the leader wins at the current price and gets the rest of their max back. */
async function settleExpired(now: Date) {
  const expired = await prisma.listing.findMany({ where: { status: "active", endsAt: { lte: now } } });
  for (const l of expired) {
    try {
      const last = l.lastBotCheck.getTime() < l.endsAt.getTime() - 60_000 ? await finalRound(l, now) : l;
      await prisma.$transaction(async (tx) => {
        if (last.currentBid != null) {
          await refund(tx, last.bidderId, escrowOf(last) - last.currentBid);
          await completeSale(tx, last, last.currentBid, { id: last.bidderId, name: last.bidderName ?? botName() }, true);
        } else {
          const closed = await tx.listing.updateMany({
            where: { id: last.id, status: "active" },
            data: { status: "expired", ownedCardId: null },
          });
          if (closed.count && last.sellerId) {
            await notify(tx, last.sellerId, {
              kind: "expired",
              title: `${last.title} didn't sell`,
              body: "Nobody bid. The card is back in your collection.",
              link: "/collection",
            });
          }
        }
      });
    } catch (err) {
      if (!(err instanceof MarketError)) throw err;
    }
  }
}

let lastTick = 0;
let ticking: Promise<void> | null = null;

/** Lazily advances the market. Called by market and collection requests, at most every 2s. */
export async function marketTick(): Promise<void> {
  if (ticking) return ticking;
  if (Date.now() - lastTick < 2000) return;
  lastTick = Date.now();
  ticking = (async () => {
    const now = new Date();
    await ensureHouse();
    await simulateBots(now);
    await settleExpired(now);
    await listHouseStock(now);
    await backgroundTrades(now);
  })().finally(() => {
    ticking = null;
  });
  return ticking;
}

/* ------------------------------------------------------------------ */
/*  Player actions                                                     */
/* ------------------------------------------------------------------ */

export async function createListing(
  playerId: string,
  input: { ownedCardId: string; startPrice: number; buyNowPrice: number; durationMin: number },
) {
  const { ownedCardId, startPrice, buyNowPrice, durationMin } = input;
  if (!Number.isInteger(startPrice) || startPrice < 1) throw new MarketError("Start price must be at least 1");
  if (!Number.isInteger(buyNowPrice) || buyNowPrice <= startPrice) throw new MarketError("Buy Now must be higher than the start price");
  if (buyNowPrice > MAX_PRICE) throw new MarketError(`Prices are capped at ${MAX_PRICE.toLocaleString("en-US")}`);
  if (!LISTING_DURATIONS.some((d) => d.minutes === durationMin)) throw new MarketError("Invalid duration");

  return prisma.$transaction(async (tx) => {
    const owned = await tx.ownedCard.findFirst({ where: { id: ownedCardId, playerId }, include: { listing: true } });
    if (!owned) throw new MarketError("You don't own this card");
    if (owned.listing) throw new MarketError("This copy is already on the market");
    if (!isTradeable(owned.cardId)) throw new MarketError("Reward cards can't be traded");

    const sellerName = await displayNameOf(playerId, tx);
    await notifyWatchers(tx, owned, buyNowPrice, playerId);
    return tx.listing.create({
      data: {
        cardId: owned.cardId,
        ownedCardId: owned.id,
        sellerId: playerId,
        sellerName,
        tmdbId: owned.tmdbId,
        title: owned.title,
        poster: owned.poster,
        type: owned.type,
        rating: owned.rating,
        year: owned.year,
        franchise: owned.franchise,
        rarity: owned.rarity,
        finish: owned.finish,
        startPrice,
        buyNowPrice,
        bots: JSON.stringify(makeBotInterest(fundamentalValue(owned), owned.rarity as Rarity, startPrice, sellerName)),
        endsAt: new Date(Date.now() + durationMin * 60_000),
      },
    });
  });
}

export async function cancelListing(playerId: string, listingId: string) {
  const res = await prisma.listing.updateMany({
    where: { id: listingId, sellerId: playerId, status: "active", currentBid: null },
    data: { status: "cancelled", ownedCardId: null },
  });
  if (res.count === 0) throw new MarketError("Only active listings without bids can be cancelled");
}

/**
 * `max` is the most the player is willing to pay. It's held in escrow while they lead;
 * the auction only charges one increment above the runner-up. A leader can raise their max.
 */
export async function placeBid(playerId: string, listingId: string, max: number): Promise<{ leading: boolean; price: number }> {
  return prisma.$transaction(async (tx) => {
    const l = await tx.listing.findUnique({ where: { id: listingId } });
    if (!l || l.status !== "active" || l.endsAt <= new Date()) throw new MarketError("This auction has ended");
    if (l.sellerId === playerId) throw new MarketError("You can't bid on your own listing");
    if (!Number.isInteger(max)) throw new MarketError("Invalid amount");
    if (max >= l.buyNowPrice) throw new MarketError("That's at or above Buy Now, just buy it");

    if (l.bidderId === playerId) {
      const held = escrowOf(l);
      if (max <= held) throw new MarketError(`Your max bid is already ${held.toLocaleString("en-US")}`);
      const paid = await tx.player.updateMany({
        where: { id: playerId, cineCoins: { gte: max - held } },
        data: { cineCoins: { decrement: max - held } },
      });
      if (paid.count === 0) throw new MarketError("Not enough CineCoins");
      const ok = await tx.listing.updateMany({ where: { id: l.id, bidderId: playerId, maxBid: l.maxBid }, data: { maxBid: max } });
      if (ok.count === 0) throw new MarketError("Someone bid just before you, try again");
      return { leading: true, price: l.currentBid ?? max };
    }

    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { cineCoins: true } });
    if (player.cineCoins < max) throw new MarketError("Not enough CineCoins");
    return applyBid(tx, l, { id: playerId, name: await displayNameOf(playerId, tx) }, max, new Date());
  });
}

export async function buyNow(playerId: string, listingId: string) {
  await prisma.$transaction(async (tx) => {
    const l = await tx.listing.findUnique({ where: { id: listingId } });
    if (!l || l.status !== "active" || l.endsAt <= new Date()) throw new MarketError("This auction has ended");
    if (l.sellerId === playerId) throw new MarketError("You can't buy your own listing");

    // If we're the top bidder, our max is already in escrow
    const escrowed = l.bidderId === playerId ? escrowOf(l) : 0;
    const due = l.buyNowPrice - escrowed;
    const paid = await tx.player.updateMany({
      where: { id: playerId, cineCoins: { gte: due } },
      data: { cineCoins: { decrement: due } },
    });
    if (paid.count === 0) throw new MarketError("Not enough CineCoins");

    const name = await displayNameOf(playerId, tx);
    if (l.bidderId !== playerId) {
      await refund(tx, l.bidderId, escrowOf(l));
      await notifyOutbid(tx, l, name, true);
    }
    await completeSale(tx, l, l.buyNowPrice, { id: playerId, name });
  });
}

/** Sells copies straight to the house. Listed and reward cards are skipped. */
export async function quickSell(playerId: string, ownedCardIds: string[]): Promise<{ sold: number; coins: number }> {
  await ensureHouse();
  return prisma.$transaction(async (tx) => {
    const copies = await tx.ownedCard.findMany({
      where: { id: { in: ownedCardIds }, playerId, listing: { is: null } },
    });
    const sellable = copies.filter((c) => isTradeable(c.cardId));
    if (sellable.length === 0) throw new MarketError("Nothing to sell");

    const coins = sellable.reduce((sum, c) => sum + quickSellPrice({ rarity: c.rarity as Rarity, rating: c.rating, finish: c.finish }), 0);
    // The house buys them, so they stay in circulation
    await tx.ownedCard.updateMany({ where: { id: { in: sellable.map((c) => c.id) } }, data: { playerId: HOUSE_ID } });
    await tx.player.update({ where: { id: playerId }, data: { cineCoins: { increment: coins } } });
    return { sold: sellable.length, coins };
  });
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

function toDTO(l: Listing, playerId: string, values: Map<string, MarketValue>, myBids: Set<string>): ListingDTO {
  const value = values.get(valueKey(l));
  const iAmHighest = l.bidderId === playerId;
  const iWon = l.status === "sold" && l.buyerId === playerId;
  const iBid = myBids.has(l.id) || iAmHighest;
  return {
    id: l.id,
    card: snapshotToCard(snapshotOf(l)),
    sellerName: l.sellerName,
    isMine: l.sellerId === playerId,
    startPrice: l.startPrice,
    buyNowPrice: l.buyNowPrice,
    currentBid: l.currentBid,
    bidderName: l.bidderName,
    bidCount: l.bidCount,
    iAmHighest,
    myMax: iAmHighest && l.status === "active" ? escrowOf(l) : null,
    outbid: iBid && l.status === "active" && !iAmHighest,
    lost: iBid && l.status !== "active" && !iWon,
    minBid: minNextBid(l),
    endsAt: l.endsAt.toISOString(),
    status: l.status as ListingDTO["status"],
    soldPrice: l.soldPrice,
    buyerName: l.buyerName,
    iWon,
    marketValue: value?.value ?? l.startPrice,
    trend: value?.trend ?? 0,
  };
}

export async function getMarket(playerId: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [browse, mine, bids, myBidRows, recent, active, volume] = await Promise.all([
    prisma.listing.findMany({
      // Bot listings have a NULL seller, which a plain NOT would filter out
      where: { status: "active", endsAt: { gt: now }, OR: [{ sellerId: null }, { sellerId: { not: playerId } }] },
      orderBy: { endsAt: "asc" },
      take: 80,
    }),
    prisma.listing.findMany({
      where: { sellerId: playerId, OR: [{ status: "active" }, { updatedAt: { gte: dayAgo } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.listing.findMany({
      where: {
        AND: [
          { OR: [{ bidderId: playerId }, { history: { some: { bidderId: playerId } } }] },
          { OR: [{ status: "active" }, { updatedAt: { gte: dayAgo } }] },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.bid.findMany({ where: { bidderId: playerId }, distinct: ["listingId"], select: { listingId: true } }),
    prisma.sale.findMany({ orderBy: { soldAt: "desc" }, take: 20 }),
    prisma.listing.count({ where: { status: "active", endsAt: { gt: now } } }),
    prisma.sale.aggregate({ where: { soldAt: { gte: dayAgo } }, _count: true, _sum: { price: true } }),
  ]);

  const myBids = new Set(myBidRows.map((b) => b.listingId));
  const values = await getMarketValues([...browse, ...mine, ...bids]);
  const dto = (l: Listing) => toDTO(l, playerId, values, myBids);
  const recentSales: SaleDTO[] = recent.map((s) => ({
    id: s.id,
    cardId: s.cardId,
    title: s.title,
    rarity: s.rarity as Rarity,
    poster: s.poster,
    price: s.price,
    buyerName: s.buyerName,
    soldAt: s.soldAt.toISOString(),
  }));
  const stats: MarketStats = { active, sales24h: volume._count, volume24h: volume._sum.price ?? 0 };
  return { browse: browse.map(dto), mine: mine.map(dto), bids: bids.map(dto), recentSales, stats };
}

/** Sales of the last 7 days, oldest first, for the price chart, at the scale of `finish`. */
export async function getPriceHistory(cardId: string, finish?: string | null) {
  const pool = await getCardPool();
  const card = pool.cards.find((c) => c.id === cardId);
  if (card) await seedHistory({ cardId, rarity: card.rarity, rating: card.rating, title: card.title, poster: card.poster });

  const sales = await prisma.sale.findMany({
    where: { cardId, soldAt: { gte: new Date(Date.now() - VALUE_LOOKBACK_MS) } },
    orderBy: { soldAt: "desc" },
    take: 150,
    select: { price: true, soldAt: true, finish: true },
  });
  // Every print shares one history, rescaled to the print being looked at
  const scale = finishMultiplier(finish);
  return sales.reverse().map((s) => ({ price: roundPrice((s.price / finishMultiplier(s.finish)) * scale), soldAt: s.soldAt.toISOString() }));
}

export async function getBidHistory(listingId: string, playerId: string): Promise<BidDTO[]> {
  const bids = await prisma.bid.findMany({ where: { listingId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 });
  return bids.map((b) => ({
    bidderName: b.bidderName,
    isMe: b.bidderId === playerId,
    amount: b.amount,
    auto: b.auto,
    createdAt: b.createdAt.toISOString(),
  }));
}
