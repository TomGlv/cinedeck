import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { Prisma, type Player } from "@prisma/client";
import { prisma } from "./db";
import { getFranchise } from "./franchises";
import { FREE_PACK_COOLDOWN_MS, type PlayerState } from "./packs";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** Session token cookie. */
const COOKIE = "cinedeck_session";
/** Pre-accounts cookie that held the raw player id; migrated to a session on sight. */
const LEGACY_COOKIE = "cinedeck_player";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** User-facing auth failure. Routes turn it into a 400. */
export class AuthError extends Error {}

/* ------------------------------------------------------------------ */
/*  Names                                                              */
/* ------------------------------------------------------------------ */

/** Public name: the username, or Guest-XXXX for players without an account. */
export function displayName(p: Pick<Player, "id" | "username">): string {
  return p.username ?? `Guest-${p.id.slice(-4).toUpperCase()}`;
}

export async function displayNameOf(playerId: string, db: Prisma.TransactionClient = prisma): Promise<string> {
  const p = await db.player.findUniqueOrThrow({ where: { id: playerId }, select: { id: true, username: true } });
  return displayName(p);
}

/* ------------------------------------------------------------------ */
/*  Sessions                                                           */
/* ------------------------------------------------------------------ */

async function startSession(playerId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({ data: { token, playerId } });
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: ONE_YEAR });
}

/**
 * Current player from the session cookie; a guest is created on first visit.
 * Route handlers only (it may set cookies).
 */
export async function getOrCreatePlayer(): Promise<Player> {
  const jar = cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const session = await prisma.session.findUnique({ where: { token }, include: { player: true } });
    if (session) return session.player;
  }

  // Old cookie with a raw id: only guests can be resumed this way, accounts need their password
  const legacyId = jar.get(LEGACY_COOKIE)?.value;
  if (legacyId) {
    jar.delete(LEGACY_COOKIE);
    const legacy = await prisma.player.findUnique({ where: { id: legacyId } });
    if (legacy && !legacy.passwordHash && !legacy.isBot) {
      await startSession(legacy.id);
      return legacy;
    }
  }

  const player = await prisma.player.create({ data: {} });
  await startSession(player.id);
  return player;
}

/* ------------------------------------------------------------------ */
/*  Accounts                                                           */
/* ------------------------------------------------------------------ */

const USERNAME = /^[a-zA-Z0-9_]{3,16}$/;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(key, expected);
}

/** Turns the current guest into an account, keeping all its cards and coins. */
export async function register(username: string, password: string): Promise<Player> {
  if (!USERNAME.test(username)) throw new AuthError("Username: 3-16 letters, digits or _");
  if (password.length < 6) throw new AuthError("Password must be at least 6 characters");

  const player = await getOrCreatePlayer();
  if (player.passwordHash) throw new AuthError("You're already signed in. Log out to create another account.");

  try {
    return await prisma.player.update({
      where: { id: player.id },
      data: { username, usernameKey: username.toLowerCase(), passwordHash: await hashPassword(password) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AuthError("That username is taken");
    throw err;
  }
}

export async function login(username: string, password: string): Promise<Player> {
  const player = await prisma.player.findUnique({ where: { usernameKey: username.trim().toLowerCase() } });
  if (!player?.passwordHash || !(await verifyPassword(password, player.passwordHash))) {
    throw new AuthError("Wrong username or password");
  }
  const current = cookies().get(COOKIE)?.value;
  if (current) await prisma.session.deleteMany({ where: { token: current } });
  await startSession(player.id);
  return player;
}

export async function logout() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  cookies().delete(COOKIE);
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export async function getCoinBoost(playerId: string): Promise<number> {
  const sets = await prisma.completedSet.findMany({ where: { playerId }, select: { slug: true } });
  return sets.reduce((sum, s) => sum + (getFranchise(s.slug)?.bonus.coinBoost ?? 0), 0);
}

export async function getPlayerState(playerId: string): Promise<PlayerState> {
  const [player, cardCount, unique, coinBoost, friendRequests, battleInvites, battleResults, notifications, tradeOffers] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: playerId } }),
    prisma.ownedCard.count({ where: { playerId } }),
    prisma.ownedCard.findMany({ where: { playerId }, distinct: ["cardId"], select: { cardId: true } }),
    getCoinBoost(playerId),
    prisma.friendship.count({ where: { addresseeId: playerId, status: "pending" } }),
    prisma.battle.count({ where: { invitedId: playerId, status: "open" } }),
    prisma.battle.count({ where: { creatorId: playerId, status: "done", creatorSeen: false } }),
    prisma.notification.count({ where: { playerId, read: false } }),
    prisma.trade.count({ where: { receiverId: playerId, status: "pending" } }),
  ]);

  return {
    username: player.username,
    displayName: displayName(player),
    coins: player.cineCoins,
    nextFreePackAt: player.lastFreePackAt
      ? new Date(player.lastFreePackAt.getTime() + FREE_PACK_COOLDOWN_MS).toISOString()
      : null,
    cardCount,
    uniqueCount: unique.length,
    coinBoost,
    friendRequests,
    battleAlerts: battleInvites + battleResults,
    notifications,
    tradeOffers,
  };
}
