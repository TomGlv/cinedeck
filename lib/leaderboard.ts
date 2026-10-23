import "server-only";
import { prisma } from "./db";
import { isTradeable } from "./economy";
import { getFranchise } from "./franchises";
import { getMarketValues, valueKey } from "./market";
import type { AvatarDTO } from "./packs";
import { avatarsOf } from "./player";

/* ------------------------------------------------------------------ */
/*  Leaderboards (registered players only)                             */
/* ------------------------------------------------------------------ */

export type Board = "value" | "sets" | "battles";

export interface LeaderRow {
  rank: number;
  username: string;
  avatar: AvatarDTO | null;
  score: number;
  /** Secondary figure shown in small: unique cards, combos, battles played */
  detail: number;
  isMe: boolean;
}

export interface LeaderboardDTO {
  board: Board;
  rows: LeaderRow[];
  /** My row when I'm outside the top, null for guests */
  me: LeaderRow | null;
  updatedAt: string;
}

const TOP = 50;
/** Rankings are recomputed at most this often (collection value scans every card). */
const CACHE_MS = 60_000;
const cache = new Map<Board, { at: number; scores: Score[] }>();

interface Score {
  playerId: string;
  username: string;
  score: number;
  detail: number;
}

async function computeScores(board: Board): Promise<Score[]> {
  const players = await prisma.player.findMany({ where: { isBot: false, username: { not: null } }, select: { id: true, username: true } });
  const ids = players.map((p) => p.id);
  const scores = new Map(players.map((p) => [p.id, { playerId: p.id, username: p.username!, score: 0, detail: 0 }]));

  if (board === "value") {
    const copies = await prisma.ownedCard.findMany({
      where: { playerId: { in: ids } },
      select: { playerId: true, cardId: true, rarity: true, rating: true, finish: true },
    });
    const values = await getMarketValues(copies);
    const unique = new Map<string, Set<string>>();
    for (const c of copies) {
      const s = scores.get(c.playerId)!;
      if (isTradeable(c.cardId)) s.score += values.get(valueKey(c))?.value ?? 0;
      unique.set(c.playerId, (unique.get(c.playerId) ?? new Set()).add(c.cardId));
    }
    for (const [id, set] of Array.from(unique)) scores.get(id)!.detail = set.size;
  } else if (board === "sets") {
    // Score = franchise sets completed, detail = rarity combos
    const done = await prisma.completedSet.findMany({ where: { playerId: { in: ids } }, select: { playerId: true, slug: true } });
    for (const d of done) {
      const s = scores.get(d.playerId)!;
      if (getFranchise(d.slug)) s.score++;
      else s.detail++;
    }
  } else {
    const battles = await prisma.battle.findMany({
      where: { status: "done", OR: [{ creatorId: { in: ids } }, { opponentId: { in: ids } }] },
      select: { creatorId: true, opponentId: true, winner: true },
    });
    for (const b of battles) {
      const creator = scores.get(b.creatorId);
      const opponent = b.opponentId ? scores.get(b.opponentId) : undefined;
      if (creator) {
        creator.detail++;
        if (b.winner === "creator") creator.score++;
      }
      if (opponent) {
        opponent.detail++;
        if (b.winner === "opponent") opponent.score++;
      }
    }
  }

  return Array.from(scores.values())
    .filter((s) => s.score > 0 || s.detail > 0)
    .sort((a, b) => b.score - a.score || b.detail - a.detail || a.username.localeCompare(b.username));
}

export async function getLeaderboard(board: Board, viewerId: string): Promise<LeaderboardDTO> {
  let entry = cache.get(board);
  if (!entry || Date.now() - entry.at > CACHE_MS) {
    entry = { at: Date.now(), scores: await computeScores(board) };
    cache.set(board, entry);
  }
  const myIndex = entry.scores.findIndex((s) => s.playerId === viewerId);
  const shown = [...entry.scores.slice(0, TOP), ...(myIndex >= TOP ? [entry.scores[myIndex]] : [])];
  const avatars = await avatarsOf(shown.map((s) => s.playerId));
  const row = (s: Score, i: number): LeaderRow => ({
    rank: i + 1,
    username: s.username,
    avatar: avatars.get(s.playerId) ?? null,
    score: s.score,
    detail: s.detail,
    isMe: s.playerId === viewerId,
  });
  const rows = entry.scores.slice(0, TOP).map(row);

  return {
    board,
    rows,
    me: myIndex >= TOP ? row(entry.scores[myIndex], myIndex) : null,
    updatedAt: new Date(entry.at).toISOString(),
  };
}
