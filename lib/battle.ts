import "server-only";
import type { Battle, Player, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { cardToSnapshot, type CardData } from "./cards";
import { BATTLE_PACKS, type BattleDTO, type BattleMode, type BattleOpponent, type BattlePack, type BattleSide } from "./economy";
import { cardKey } from "./finishes";
import { HOUSE_ID, MarketError, botName, ensureHouse, getMarketValues } from "./market";
import { notify } from "./notifications";
import { PACKS } from "./packs";
import { displayName, displayNameOf } from "./player";
import { drawPack, getCardPool } from "./pool";
import { areFriends } from "./social";

/* ------------------------------------------------------------------ */
/*  Booster battles: both sides open the same pack, winner takes all   */
/* ------------------------------------------------------------------ */

/** A public lobby nobody joined gets a bot opponent after this long. */
const OPEN_LOBBY_TIMEOUT_MS = 90_000;
/** Unanswered friend challenges are refunded after this long. */
const INVITE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

type Opponent = { id: string | null; name: string };
type FullBattle = Battle & {
  creator: Pick<Player, "id" | "username">;
  invited: Pick<Player, "id" | "username"> | null;
};
const include = {
  creator: { select: { id: true, username: true } },
  invited: { select: { id: true, username: true } },
} as const;

async function charge(tx: Prisma.TransactionClient, playerId: string, pack: BattlePack) {
  const paid = await tx.player.updateMany({
    where: { id: playerId, cineCoins: { gte: PACKS[pack].cost } },
    data: { cineCoins: { decrement: PACKS[pack].cost } },
  });
  if (paid.count === 0) throw new MarketError("Not enough CineCoins");
}

/**
 * Opens the second pack and settles the battle. The higher total market value wins
 * (lower in underdog mode), a tie is a coin flip shown as a roulette. All 10 cards are minted for the
 * winner, or go to the house when a bot wins. `payer` joins and pays inside the same
 * transaction, so a double join can't charge twice.
 */
async function resolve(b: Battle, opponent: Opponent, payer: string | null) {
  await ensureHouse();
  const pack = b.pack as BattlePack;
  const creatorCards = JSON.parse(b.creatorCards) as CardData[];
  const opponentCards = drawPack(await getCardPool(), pack);
  const values = await getMarketValues(
    [...creatorCards, ...opponentCards].map((c) => ({ cardId: c.id, rarity: c.rarity, rating: c.rating, finish: c.finish })),
  );
  const valuesOf = (cards: CardData[]) => cards.map((c) => values.get(cardKey(c))?.value ?? 0);
  const creatorValues = valuesOf(creatorCards);
  const opponentValues = valuesOf(opponentCards);
  const creatorTotal = creatorValues.reduce((a, v) => a + v, 0);
  const opponentTotal = opponentValues.reduce((a, v) => a + v, 0);
  const creatorWins =
    creatorTotal === opponentTotal
      ? Math.random() < 0.5
      : b.mode === "underdog"
        ? creatorTotal < opponentTotal
        : creatorTotal > opponentTotal;
  const winnerId = creatorWins ? b.creatorId : (opponent.id ?? HOUSE_ID);

  await prisma.$transaction(async (tx) => {
    if (payer) await charge(tx, payer, pack);
    const done = await tx.battle.updateMany({
      where: { id: b.id, status: "open" },
      data: {
        status: "done",
        opponentId: opponent.id,
        opponentName: opponent.name,
        opponentCards: JSON.stringify(opponentCards),
        creatorValues: JSON.stringify(creatorValues),
        opponentValues: JSON.stringify(opponentValues),
        creatorTotal,
        opponentTotal,
        winner: creatorWins ? "creator" : "opponent",
        finishedAt: new Date(),
      },
    });
    if (done.count === 0) throw new MarketError("This battle already started");
    await tx.ownedCard.createMany({
      data: [...creatorCards, ...opponentCards].map((c) => ({ playerId: winnerId, ...cardToSnapshot(c) })),
    });
    // Instant bot battles are watched live; the creator of any other battle watches the replay
    // later, so the notification keeps the result secret
    if (!b.creatorSeen) {
      await notify(tx, b.creatorId, {
        kind: "battle_result",
        title: `${opponent.name} accepted your battle`,
        body: `${PACKS[pack].name} · watch the replay to find out who won.`,
        link: "/battles",
      });
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export async function createBattle(playerId: string, input: { pack: string; mode: string; opponent: string; friend?: string }) {
  if (!BATTLE_PACKS.includes(input.pack as BattlePack)) throw new MarketError("This pack can't be battled");
  if (input.mode !== "classic" && input.mode !== "underdog") throw new MarketError("Unknown battle mode");
  const opponent = input.opponent as BattleOpponent;
  if (!["bot", "open", "friend"].includes(opponent)) throw new MarketError("Unknown opponent");
  const pack = input.pack as BattlePack;

  let invitedId: string | null = null;
  if (opponent === "friend") {
    const friend = await prisma.player.findUnique({ where: { usernameKey: (input.friend ?? "").trim().toLowerCase() } });
    if (!friend || !(await areFriends(playerId, friend.id))) throw new MarketError("Pick one of your friends");
    invitedId = friend.id;
  }

  const cards = drawPack(await getCardPool(), pack);
  const battle = await prisma.$transaction(async (tx) => {
    await charge(tx, playerId, pack);
    const created = await tx.battle.create({
      data: {
        pack,
        mode: input.mode,
        creatorId: playerId,
        invitedId,
        creatorCards: JSON.stringify(cards),
        // Watched live right after, so no "new result" badge or notification
        creatorSeen: opponent === "bot",
      },
    });
    if (invitedId) {
      await notify(tx, invitedId, {
        kind: "battle_invite",
        title: `${await displayNameOf(playerId, tx)} challenged you to a battle`,
        body: `${PACKS[pack].name} · ${input.mode === "classic" ? "highest" : "lowest"} total wins · ${PACKS[pack].cost} coins to accept.`,
        link: "/battles",
      });
    }
    return created;
  });

  if (opponent === "bot") await resolve(battle, { id: null, name: botName() }, null);
  return { battle: await getBattle(playerId, battle.id) };
}

export async function joinBattle(playerId: string, battleId: string) {
  const b = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!b || b.status !== "open") throw new MarketError("This battle already started");
  if (b.creatorId === playerId) throw new MarketError("You can't join your own battle");
  if (b.invitedId && b.invitedId !== playerId) throw new MarketError("This is a private challenge");

  await resolve(b, { id: playerId, name: await displayNameOf(playerId) }, playerId);
  return { battle: await getBattle(playerId, b.id) };
}

/** The creator stops waiting and lets a bot take the other seat. */
export async function fillWithBot(playerId: string, battleId: string) {
  const b = await prisma.battle.findFirst({ where: { id: battleId, creatorId: playerId, status: "open" } });
  if (!b) throw new MarketError("This battle already started");
  await resolve(b, { id: null, name: botName() }, null);
  return { battle: await getBattle(playerId, b.id) };
}

/** Creator cancels a waiting lobby, or the invited friend declines: the creator is refunded. */
export async function cancelBattle(playerId: string, battleId: string) {
  await prisma.$transaction(async (tx) => {
    const b = await tx.battle.findUnique({ where: { id: battleId } });
    if (!b || b.status !== "open" || (b.creatorId !== playerId && b.invitedId !== playerId)) {
      throw new MarketError("This battle can't be cancelled");
    }
    const ok = await tx.battle.updateMany({ where: { id: b.id, status: "open" }, data: { status: "cancelled", finishedAt: new Date() } });
    if (ok.count === 0) throw new MarketError("This battle already started");
    await tx.player.update({ where: { id: b.creatorId }, data: { cineCoins: { increment: PACKS[b.pack as BattlePack].cost } } });
  });
}

export async function markSeen(playerId: string, battleId: string) {
  await prisma.battle.updateMany({ where: { id: battleId, creatorId: playerId }, data: { creatorSeen: true } });
}

/** Bots fill public lobbies nobody joined; old friend challenges get refunded. */
export async function sweepBattles() {
  const now = Date.now();
  const stale = await prisma.battle.findMany({
    where: { status: "open", invitedId: null, createdAt: { lt: new Date(now - OPEN_LOBBY_TIMEOUT_MS) } },
  });
  for (const b of stale) {
    await resolve(b, { id: null, name: botName() }, null).catch((err) => {
      if (!(err instanceof MarketError)) throw err;
    });
  }
  const expired = await prisma.battle.findMany({
    where: { status: "open", invitedId: { not: null }, createdAt: { lt: new Date(now - INVITE_TIMEOUT_MS) } },
  });
  for (const b of expired) await cancelBattle(b.creatorId, b.id).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

function side(name: string, cardsJson: string | null, valuesJson: string | null, total: number | null): BattleSide {
  const cards = JSON.parse(cardsJson ?? "[]") as CardData[];
  const values = JSON.parse(valuesJson ?? "[]") as number[];
  return { name, cards: cards.map((card, i) => ({ card, value: values[i] ?? 0 })), total: total ?? 0 };
}

function toDTO(b: FullBattle, viewerId: string): BattleDTO {
  const isCreator = b.creatorId === viewerId;
  const dto: BattleDTO = {
    id: b.id,
    pack: b.pack as BattlePack,
    mode: b.mode as BattleMode,
    status: b.status as BattleDTO["status"],
    creatorName: displayName(b.creator),
    opponentName: b.opponentName,
    invitedName: b.invited ? displayName(b.invited) : null,
    isCreator,
    isInvited: b.invitedId === viewerId,
    createdAt: b.createdAt.toISOString(),
    finishedAt: b.finishedAt?.toISOString() ?? null,
  };
  // Cards stay hidden until the battle is played
  if (b.status === "done" && (isCreator || b.opponentId === viewerId)) {
    const creator = side(dto.creatorName, b.creatorCards, b.creatorValues, b.creatorTotal);
    const opponent = side(b.opponentName ?? "?", b.opponentCards, b.opponentValues, b.opponentTotal);
    dto.you = isCreator ? creator : opponent;
    dto.opponent = isCreator ? opponent : creator;
    dto.won = (b.winner === "creator") === isCreator;
    dto.unseen = isCreator && !b.creatorSeen;
    dto.tie = b.creatorTotal === b.opponentTotal;
  }
  return dto;
}

export async function getBattle(playerId: string, battleId: string): Promise<BattleDTO> {
  const b = await prisma.battle.findUnique({ where: { id: battleId }, include });
  if (!b) throw new MarketError("Battle not found");
  return toDTO(b, playerId);
}

export async function listBattles(playerId: string) {
  await sweepBattles();
  const [open, invites, waiting, recent, friendships] = await Promise.all([
    prisma.battle.findMany({
      where: { status: "open", invitedId: null, creatorId: { not: playerId } },
      include,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.battle.findMany({ where: { status: "open", invitedId: playerId }, include, orderBy: { createdAt: "desc" } }),
    prisma.battle.findMany({ where: { status: "open", creatorId: playerId }, include, orderBy: { createdAt: "desc" } }),
    prisma.battle.findMany({
      where: { status: "done", OR: [{ creatorId: playerId }, { opponentId: playerId }] },
      include,
      orderBy: { finishedAt: "desc" },
      take: 12,
    }),
    prisma.friendship.findMany({
      where: { status: "accepted", OR: [{ requesterId: playerId }, { addresseeId: playerId }] },
      include: { requester: { select: { username: true } }, addressee: { select: { username: true } } },
    }),
  ]);

  const dto = (b: FullBattle) => toDTO(b, playerId);
  return {
    open: open.map(dto),
    invites: invites.map(dto),
    waiting: waiting.map(dto),
    recent: recent.map(dto),
    friends: friendships
      .map((f) => (f.requesterId === playerId ? f.addressee.username : f.requester.username))
      .filter((u): u is string => !!u)
      .sort(),
  };
}
