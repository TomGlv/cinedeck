import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { MarketError } from "./market";
import { COIN_PACKS } from "./coinPacks";

/** Crypto payments through NOWPayments: hosted invoice page, coins credited by the IPN callback. */
const API = "https://api.nowpayments.io/v1";

/** Creates an invoice for one coin pack; returns the payment page to send the player to. */
export async function createCheckout(playerId: string, packId: string, origin: string): Promise<string> {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new MarketError("Payments aren't set up yet");
  const pack = COIN_PACKS.find((p) => p.id === packId);
  if (!pack) throw new MarketError("Unknown pack");
  const res = await fetch(`${API}/invoice`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: pack.cents / 100,
      price_currency: "eur",
      // Read back by the IPN: who to credit and with which pack
      order_id: `${playerId}:${pack.id}:${randomBytes(4).toString("hex")}`,
      order_description: `${pack.coins.toLocaleString("en-US")} CineCoins`,
      ipn_callback_url: `${origin}/api/checkout/webhook`,
      success_url: `${origin}/?checkout=pending`,
      cancel_url: `${origin}/`,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.invoice_url) throw new Error(`NOWPayments invoice: ${json.message ?? res.status}`);
  return json.invoice_url;
}

/** Keys sorted at every level, as NOWPayments signs the IPN body. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted((value as Record<string, unknown>)[k])]));
  }
  return value;
}

/** Checks the x-nowpayments-sig header (HMAC-SHA512 of the sorted JSON with the IPN secret). */
export function verifyIpn(body: unknown, header: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha512", secret).update(JSON.stringify(sorted(body))).digest();
  const sig = Buffer.from(header, "hex");
  return sig.length === expected.length && timingSafeEqual(sig, expected);
}

/** Credits a finished payment once (its order id is stored as a redeemed "code"). Returns the coins added. */
export async function fulfill(orderId: string): Promise<number> {
  const [playerId, packId] = orderId.split(":");
  const pack = COIN_PACKS.find((p) => p.id === packId);
  if (!playerId || !pack) throw new Error(`Unknown order ${orderId}`);
  try {
    await prisma.$transaction([
      prisma.redeemedCode.create({ data: { playerId, code: `PAY:${orderId}` } }),
      prisma.player.update({ where: { id: playerId }, data: { cineCoins: { increment: pack.coins } } }),
    ]);
    return pack.coins;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return 0;
    throw err;
  }
}
