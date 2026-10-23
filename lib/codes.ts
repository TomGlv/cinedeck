import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { MarketError } from "./market";

/** Balance an unlimited player is topped back up to. Stays well under the 32-bit Int limit. */
export const UNLIMITED_BALANCE = 1_000_000_000;

/** Balance left after the unlimited mode is switched off, same as a new player. */
const STOP_UNLIMITED_BALANCE = 1000;

/** `maxUses`: times each player can redeem the code (default 1). */
type CodeReward = ({ coins: number } | { unlimited: true } | { stopUnlimited: true }) & { maxUses?: number };

/** Promo codes, typed case-insensitively. */
const CODES: Record<string, CodeReward> = {
  SINGE: { coins: 1000, maxUses: 10 },
  HENRIGAY: { coins: 20000 },
  CINEDECKINFINI: { unlimited: true },
  STOPINFINI: { stopUnlimited: true, maxUses: Infinity },
};

export async function redeemCode(playerId: string, raw: string): Promise<{ coins: number; unlimited: boolean }> {
  const code = raw.trim().toUpperCase();
  const reward = CODES[code];
  if (!reward) throw new MarketError("Invalid code");

  const maxUses = reward.maxUses ?? 1;
  try {
    return await prisma.$transaction(async (tx) => {
      const { uses } = await tx.redeemedCode.upsert({
        where: { playerId_code: { playerId, code } },
        create: { playerId, code },
        update: { uses: { increment: 1 } },
      });
      if (uses > maxUses) throw new MarketError(maxUses === 1 ? "Code already used" : `Code already used ${maxUses} times`);
      if ("unlimited" in reward) {
        await tx.player.update({ where: { id: playerId }, data: { unlimitedCoins: true } });
        await topUp(playerId, tx);
        return { coins: 0, unlimited: true };
      }
      if ("stopUnlimited" in reward) {
        const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { unlimitedCoins: true } });
        if (!player.unlimitedCoins) throw new MarketError("Unlimited CineCoins aren't on");
        await tx.player.update({ where: { id: playerId }, data: { unlimitedCoins: false, cineCoins: STOP_UNLIMITED_BALANCE } });
        return { coins: 0, unlimited: false };
      }
      await tx.player.update({ where: { id: playerId }, data: { cineCoins: { increment: reward.coins } } });
      return { coins: reward.coins, unlimited: false };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new MarketError("Code already used");
    throw err;
  }
}

/** Refills an unlimited player's balance after spending. No-op for everyone else. */
export async function topUp(playerId: string, db: Prisma.TransactionClient = prisma) {
  await db.player.updateMany({
    where: { id: playerId, unlimitedCoins: true, cineCoins: { lt: UNLIMITED_BALANCE } },
    data: { cineCoins: UNLIMITED_BALANCE },
  });
}
