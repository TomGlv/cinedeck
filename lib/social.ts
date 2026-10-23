import "server-only";
import { prisma } from "./db";
import { RARITY_ORDER, snapshotToCard, type CardData, type Rarity } from "./cards";
import { isTradeable } from "./economy";
import { cardKey } from "./finishes";
import { MarketError, getMarketValues } from "./market";
import { notify } from "./notifications";

/* ------------------------------------------------------------------ */
/*  Friends                                                            */
/* ------------------------------------------------------------------ */

export interface FriendDTO {
  username: string;
  since: string;
}

export interface FriendsDTO {
  friends: FriendDTO[];
  incoming: { id: string; username: string; sentAt: string }[];
  outgoing: { id: string; username: string; sentAt: string }[];
}

async function requireAccount(playerId: string) {
  const me = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!me.username) throw new MarketError("Create an account to add friends");
  return me;
}

async function findByUsername(username: string) {
  const p = await prisma.player.findUnique({ where: { usernameKey: username.trim().toLowerCase() } });
  if (!p || p.isBot) throw new MarketError(`No player called "${username}"`);
  return p;
}

/** Accepted friendship between two players, in either direction. */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const f = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  return f != null;
}

export async function getFriends(playerId: string): Promise<FriendsDTO> {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: playerId }, { addresseeId: playerId }] },
    include: { requester: { select: { username: true } }, addressee: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
  });
  const other = (r: (typeof rows)[number]) => (r.requesterId === playerId ? r.addressee.username : r.requester.username) ?? "?";

  return {
    friends: rows
      .filter((r) => r.status === "accepted")
      .map((r) => ({ username: other(r), since: r.createdAt.toISOString() }))
      .sort((a, b) => a.username.localeCompare(b.username)),
    incoming: rows
      .filter((r) => r.status === "pending" && r.addresseeId === playerId)
      .map((r) => ({ id: r.id, username: other(r), sentAt: r.createdAt.toISOString() })),
    outgoing: rows
      .filter((r) => r.status === "pending" && r.requesterId === playerId)
      .map((r) => ({ id: r.id, username: other(r), sentAt: r.createdAt.toISOString() })),
  };
}

/** Sends a request; if they already asked us, this accepts theirs instead. */
export async function sendFriendRequest(playerId: string, username: string): Promise<string> {
  const me = await requireAccount(playerId);
  const them = await findByUsername(username);
  if (them.id === me.id) throw new MarketError("You can't add yourself");

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: me.id, addresseeId: them.id },
        { requesterId: them.id, addresseeId: me.id },
      ],
    },
  });
  if (existing?.status === "accepted") throw new MarketError(`You're already friends with ${them.username}`);
  if (existing && existing.requesterId === me.id) throw new MarketError("Request already sent");
  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.friendship.update({ where: { id: existing.id }, data: { status: "accepted" } });
      await notify(tx, them.id, { kind: "friend_accepted", title: `${me.username} accepted your friend request`, link: `/u/${me.username}` });
    });
    return `You and ${them.username} are now friends`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.friendship.create({ data: { requesterId: me.id, addresseeId: them.id } });
    await notify(tx, them.id, { kind: "friend_request", title: `${me.username} sent you a friend request`, link: "/friends" });
  });
  return `Friend request sent to ${them.username}`;
}

export async function answerFriendRequest(playerId: string, requestId: string, accept: boolean) {
  const req = await prisma.friendship.findFirst({
    where: { id: requestId, addresseeId: playerId, status: "pending" },
    include: { addressee: { select: { username: true } } },
  });
  if (!req) throw new MarketError("This request no longer exists");
  if (accept) {
    await prisma.$transaction(async (tx) => {
      await tx.friendship.update({ where: { id: req.id }, data: { status: "accepted" } });
      const name = req.addressee.username;
      await notify(tx, req.requesterId, { kind: "friend_accepted", title: `${name} accepted your friend request`, link: `/u/${name}` });
    });
  } else await prisma.friendship.delete({ where: { id: req.id } });
}

/** Removes a friend, or cancels a request we sent. */
export async function removeFriend(playerId: string, username: string) {
  const them = await findByUsername(username);
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: playerId, addresseeId: them.id },
        { requesterId: them.id, addresseeId: playerId },
      ],
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Profiles                                                           */
/* ------------------------------------------------------------------ */

export interface ProfileDTO {
  username: string;
  joinedAt: string;
  isMe: boolean;
  /** none | friends | sent | received */
  relation: "none" | "friends" | "sent" | "received";
  stats: {
    cards: number;
    unique: number;
    value: number;
    mythics: number;
    legendaries: number;
    battlesWon: number;
    battlesPlayed: number;
  };
  showcase: { card: CardData; value: number; copies: number }[];
}

export async function getProfile(viewerId: string, username: string): Promise<ProfileDTO> {
  const p = await findByUsername(username);
  const [copies, battles, friendship] = await Promise.all([
    prisma.ownedCard.findMany({ where: { playerId: p.id } }),
    prisma.battle.findMany({
      where: { status: "done", OR: [{ creatorId: p.id }, { opponentId: p.id }] },
      select: { creatorId: true, winner: true },
    }),
    prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: p.id },
          { requesterId: p.id, addresseeId: viewerId },
        ],
      },
    }),
  ]);

  const values = await getMarketValues(copies);
  const groups = new Map<string, { card: CardData; value: number; copies: number }>();
  for (const c of copies) {
    const key = cardKey(c);
    const g = groups.get(key);
    if (g) g.copies++;
    else groups.set(key, { card: snapshotToCard(c), value: isTradeable(c.cardId) ? (values.get(key)?.value ?? 0) : 0, copies: 1 });
  }
  const all = Array.from(groups.values());
  const count = (r: Rarity) => all.filter((g) => g.card.rarity === r).length;

  return {
    username: p.username!,
    joinedAt: p.createdAt.toISOString(),
    isMe: p.id === viewerId,
    relation: !friendship
      ? "none"
      : friendship.status === "accepted"
        ? "friends"
        : friendship.requesterId === viewerId
          ? "sent"
          : "received",
    stats: {
      cards: copies.length,
      unique: all.length,
      value: all.reduce((sum, g) => sum + g.value * g.copies, 0),
      mythics: count("Mythic"),
      legendaries: count("Legendary"),
      battlesPlayed: battles.length,
      battlesWon: battles.filter((b) => (b.creatorId === p.id ? b.winner === "creator" : b.winner === "opponent")).length,
    },
    showcase: all
      .sort((a, b) => b.value - a.value || RARITY_ORDER[b.card.rarity] - RARITY_ORDER[a.card.rarity])
      .slice(0, 10),
  };
}
