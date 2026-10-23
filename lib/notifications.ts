import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/* ------------------------------------------------------------------ */
/*  In-app notifications                                               */
/* ------------------------------------------------------------------ */

export type NotificationKind =
  | "outbid"
  | "won"
  | "sold"
  | "expired"
  | "battle_invite"
  | "battle_result"
  | "friend_request"
  | "friend_accepted"
  | "trade_offer"
  | "trade_accepted"
  | "trade_declined";

export interface NotificationDTO {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** Bots and the house never get notifications. */
const BOT_IDS = new Set(["house"]);
/** Older notifications are pruned when new ones arrive. */
const KEEP = 60;

/** Queues a notification; pass the transaction so it only exists if the action commits. */
export async function notify(
  db: Prisma.TransactionClient,
  playerId: string | null | undefined,
  n: { kind: NotificationKind; title: string; body?: string; link?: string },
) {
  if (!playerId || BOT_IDS.has(playerId)) return;
  await db.notification.create({ data: { playerId, kind: n.kind, title: n.title, body: n.body ?? "", link: n.link ?? null } });
}

export async function getNotifications(playerId: string): Promise<{ items: NotificationDTO[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { playerId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { playerId, read: false } }),
  ]);

  // Prune the tail now and then
  if (rows.length === 30) {
    const old = await prisma.notification.findMany({
      where: { playerId },
      orderBy: { createdAt: "desc" },
      skip: KEEP,
      select: { id: true },
    });
    if (old.length) await prisma.notification.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  return {
    unread,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind as NotificationKind,
      title: r.title,
      body: r.body,
      link: r.link,
      read: r.read,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function markRead(playerId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: { playerId, read: false, ...(ids && { id: { in: ids } }) },
    data: { read: true },
  });
}
