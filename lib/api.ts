import "server-only";
import { NextResponse } from "next/server";
import { MarketError } from "./market";
import { getPlayerState } from "./player";

/** Runs a player action; MarketError becomes a 400 with the fresh player state attached. */
export async function playerAction<T extends object>(playerId: string, action: () => Promise<T>) {
  try {
    const result = await action();
    return NextResponse.json({ ...result, state: await getPlayerState(playerId) });
  } catch (err) {
    if (err instanceof MarketError) {
      return NextResponse.json({ error: err.message, state: await getPlayerState(playerId) }, { status: 400 });
    }
    throw err;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}
