import "server-only";
import type { OwnedCard, Trade, TradeItem } from "@prisma/client";
import { prisma } from "./db";
import { snapshotToCard, type CardData } from "./cards";
import { isTradeable } from "./economy";
import { cardKey } from "./finishes";
import { MarketError, getMarketValues } from "./market";
import { notify } from "./notifications";
import { displayName } from "./player";
import { areFriends } from "./social";

/* ------------------------------------------------------------------ */
/*  Direct trades between friends                                      */
/* ------------------------------------------------------------------ */

export const TRADE_MAX_CARDS = 10;
export const TRADE_MAX_COINS = 1_000_000;

export interface TradeCardDTO {
  ownedCardId: string;
  card: CardData;
  value: number;
}

export interface TradeDTO {
  id: string;
  incoming: boolean;
  otherName: string;
  /** Cards the sender gives / asks for */
  offer: TradeCardDTO[];
  request: TradeCardDTO[];
  offerCoins: number;
  requestCoins: number;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "failed";
  /** Pending only: every card is still owned, unlisted, by the right player */
  valid: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

/** Tradeable copies of one card print in someone's collection. */
export interface InventoryGroupDTO {
  key: string;
  card: CardData;
  value: number;
  /** Unlisted copy ids */
  copies: string[];
}

async function requireUser(playerId: string) {
  const p = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!p.username) throw new MarketError("Create an account to trade with friends");
  return p;
}

async function requireFriend(playerId: string, username: string) {
  const them = await prisma.player.findUnique({ where: { usernameKey: username.trim().toLowerCase() } });
  if (!them || them.isBot || !(await areFriends(playerId, them.id))) throw new MarketError("You can only trade with your friends");
  return them;
}

/** Copies that can change hands: owned, not on the market, not a reward card. */
const tradeableWhere = (playerId: string) => ({ playerId, listing: { is: null }, NOT: { cardId: { startsWith: "special-" } } });

async function inventory(playerId: string): Promise<InventoryGroupDTO[]> {
  const copies = await prisma.ownedCard.findMany({ where: tradeableWhere(playerId), orderBy: { pulledAt: "desc" } });
  const values = await getMarketValues(copies);
  const groups = new Map<string, InventoryGroupDTO>();
  for (const c of copies) {
    const key = cardKey(c);
    const g = groups.get(key);
    if (g) g.copies.push(c.id);
    else groups.set(key, { key, card: snapshotToCard(c), value: values.get(key)?.value ?? 0, copies: [c.id] });
  }
  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}

/** My tradeable cards, and my friend's when `username` is given. */
export async function getTradeInventory(playerId: string, username?: string) {
  await requireUser(playerId);
  const friend = username ? await requireFriend(playerId, username) : null;
  const [mine, theirs] = await Promise.all([inventory(playerId), friend ? inventory(friend.id) : Promise.resolve([])]);
  return { mine, theirs };
}

function snapshotFields(c: OwnedCard) {
  return {
    ownedCardId: c.id,
    cardId: c.cardId,
    tmdbId: c.tmdbId,
    title: c.title,
    poster: c.poster,
    type: c.type,
    rating: c.rating,
    year: c.year,
    franchise: c.franchise,
    rarity: c.rarity,
    finish: c.finish,
  };
}

async function loadCopies(ownerId: string, ids: string[]) {
  const unique = Array.from(new Set(ids));
  const copies = await prisma.ownedCard.findMany({ where: { id: { in: unique }, ...tradeableWhere(ownerId) } });
  if (copies.length !== unique.length) throw new MarketError("Some of these cards can't be traded anymore");
  return copies;
}

function coinsOf(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > TRADE_MAX_COINS) throw new MarketError("Invalid coin amount");
  return n;
}

export async function createTrade(
  playerId: string,
  input: { to: string; offer: string[]; request: string[]; offerCoins: unknown; requestCoins: unknown; message?: string },
) {
  const me = await requireUser(playerId);
  const them = await requireFriend(playerId, input.to);
  const offerCoins = coinsOf(input.offerCoins);
  const requestCoins = coinsOf(input.requestCoins);
  if (input.offer.length > TRADE_MAX_CARDS || input.request.length > TRADE_MAX_CARDS) {
    throw new MarketError(`At most ${TRADE_MAX_CARDS} cards per side`);
  }
  if (input.offer.length + input.request.length === 0) throw new MarketError("Add at least one card to the trade");
  if (offerCoins > me.cineCoins) throw new MarketError("You don't have that many CineCoins");

  const [offer, request] = await Promise.all([loadCopies(me.id, input.offer), loadCopies(them.id, input.request)]);
  const message = (input.message ?? "").trim().slice(0, 140);

  const trade = await prisma.$transaction(async (tx) => {
    const created = await tx.trade.create({
      data: {
        senderId: me.id,
        receiverId: them.id,
        offerCoins,
        requestCoins,
        message,
        items: {
          create: [
            ...offer.map((c) => ({ side: "offer", ...snapshotFields(c) })),
            ...request.map((c) => ({ side: "request", ...snapshotFields(c) })),
          ],
        },
      },
    });
    const gives = offer.length ? `${offer.length} card${offer.length > 1 ? "s" : ""}` : "";
    const wants = request.length ? `${request.length} of yours` : "";
    await notify(tx, them.id, {
      kind: "trade_offer",
      title: `${me.username} sent you a trade offer`,
      body: [gives && `Offers ${gives}`, offerCoins && `${offerCoins.toLocaleString("en-US")} coins`, wants && `for ${wants}`]
        .filter(Boolean)
        .join(" · "),
      link: "/trades",
    });
    return created;
  });
  return { tradeId: trade.id };
}

/** The receiver accepts or declines. Accepting swaps everything atomically, or fails if anything moved. */
export async function respondTrade(playerId: string, tradeId: string, accept: boolean) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true, sender: { select: { id: true, username: true } }, receiver: { select: { id: true, username: true } } },
  });
  if (!trade || trade.receiverId !== playerId || trade.status !== "pending") throw new MarketError("This offer is no longer pending");
  const receiverName = trade.receiver.username ?? "Your friend";

  if (!accept) {
    await prisma.$transaction(async (tx) => {
      const ok = await tx.trade.updateMany({ where: { id: trade.id, status: "pending" }, data: { status: "declined", resolvedAt: new Date() } });
      if (ok.count === 0) throw new MarketError("This offer is no longer pending");
      await notify(tx, trade.senderId, { kind: "trade_declined", title: `${receiverName} declined your trade offer`, link: "/trades" });
    });
    return { message: "Offer declined" };
  }

  const offer = trade.items.filter((i) => i.side === "offer");
  const request = trade.items.filter((i) => i.side === "request");

  try {
    await prisma.$transaction(async (tx) => {
      const ok = await tx.trade.updateMany({ where: { id: trade.id, status: "pending" }, data: { status: "accepted", resolvedAt: new Date() } });
      if (ok.count === 0) throw new MarketError("This offer is no longer pending");

      const move = async (items: TradeItem[], from: string, to: string) => {
        if (items.length === 0) return;
        const moved = await tx.ownedCard.updateMany({
          where: { id: { in: items.map((i) => i.ownedCardId) }, ...tradeableWhere(from) },
          data: { playerId: to, pulledAt: new Date() },
        });
        if (moved.count !== items.length) throw new TradeFailed();
      };
      await move(offer, trade.senderId, trade.receiverId);
      await move(request, trade.receiverId, trade.senderId);

      const pay = async (from: string, to: string, amount: number) => {
        if (amount === 0) return;
        const paid = await tx.player.updateMany({ where: { id: from, cineCoins: { gte: amount } }, data: { cineCoins: { decrement: amount } } });
        if (paid.count === 0) throw new TradeFailed(from === playerId ? "You don't have enough CineCoins" : undefined);
        await tx.player.update({ where: { id: to }, data: { cineCoins: { increment: amount } } });
      };
      await pay(trade.senderId, trade.receiverId, trade.offerCoins);
      await pay(trade.receiverId, trade.senderId, trade.requestCoins);

      await notify(tx, trade.senderId, {
        kind: "trade_accepted",
        title: `${receiverName} accepted your trade`,
        body: `${request.length} card${request.length === 1 ? "" : "s"} received${trade.requestCoins ? ` + ${trade.requestCoins.toLocaleString("en-US")} coins` : ""}.`,
        link: "/collection",
      });
    });
  } catch (err) {
    if (!(err instanceof TradeFailed)) throw err;
    await prisma.trade.updateMany({ where: { id: trade.id, status: "pending" }, data: { status: "failed", resolvedAt: new Date() } });
    throw new MarketError(err.message || "Some cards or coins in this offer moved since it was sent. The offer was closed.");
  }
  return { message: "Trade complete! The cards are in your collection." };
}

/** Rolls the accept transaction back; the offer is then closed as failed. */
class TradeFailed extends Error {
  constructor(message = "") {
    super(message);
  }
}

export async function cancelTrade(playerId: string, tradeId: string) {
  const ok = await prisma.trade.updateMany({
    where: { id: tradeId, senderId: playerId, status: "pending" },
    data: { status: "cancelled", resolvedAt: new Date() },
  });
  if (ok.count === 0) throw new MarketError("This offer is no longer pending");
  return { message: "Offer cancelled" };
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

type FullTrade = Trade & {
  items: TradeItem[];
  sender: { id: string; username: string | null };
  receiver: { id: string; username: string | null };
};

export async function listTrades(playerId: string) {
  const include = {
    items: true,
    sender: { select: { id: true, username: true } },
    receiver: { select: { id: true, username: true } },
  } as const;
  const [pending, history] = await Promise.all([
    prisma.trade.findMany({
      where: { status: "pending", OR: [{ senderId: playerId }, { receiverId: playerId }] },
      include,
      orderBy: { createdAt: "desc" },
    }),
    prisma.trade.findMany({
      where: { status: { not: "pending" }, OR: [{ senderId: playerId }, { receiverId: playerId }] },
      include,
      orderBy: { resolvedAt: "desc" },
      take: 20,
    }),
  ]);

  const all = [...pending, ...history];
  const items = all.flatMap((t) => t.items);
  const [values, still] = await Promise.all([
    getMarketValues(items),
    // Which pending copies are still where the offer expects them
    prisma.ownedCard.findMany({
      where: { id: { in: pending.flatMap((t) => t.items.map((i) => i.ownedCardId)) }, listing: { is: null } },
      select: { id: true, playerId: true },
    }),
  ]);
  const ownerOf = new Map(still.map((c) => [c.id, c.playerId]));

  const dto = (t: FullTrade): TradeDTO => {
    const incoming = t.receiverId === playerId;
    const card = (i: TradeItem): TradeCardDTO => ({
      ownedCardId: i.ownedCardId,
      card: snapshotToCard(i),
      value: isTradeable(i.cardId) ? (values.get(cardKey(i))?.value ?? 0) : 0,
    });
    const valid =
      t.status === "pending" &&
      t.items.every((i) => ownerOf.get(i.ownedCardId) === (i.side === "offer" ? t.senderId : t.receiverId));
    return {
      id: t.id,
      incoming,
      otherName: displayName(incoming ? t.sender : t.receiver),
      offer: t.items.filter((i) => i.side === "offer").map(card),
      request: t.items.filter((i) => i.side === "request").map(card),
      offerCoins: t.offerCoins,
      requestCoins: t.requestCoins,
      message: t.message,
      status: t.status as TradeDTO["status"],
      valid,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
    };
  };

  return {
    incoming: pending.filter((t) => t.receiverId === playerId).map(dto),
    outgoing: pending.filter((t) => t.senderId === playerId).map(dto),
    history: history.map(dto),
  };
}
