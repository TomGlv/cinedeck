import { NextResponse } from "next/server";
import { MarketError } from "@/lib/market";
import { getOrCreatePlayer } from "@/lib/player";
import { getProfile } from "@/lib/social";

export const dynamic = "force-dynamic";

/** GET /api/players/:username -> ProfileDTO */
export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const viewer = await getOrCreatePlayer();
  try {
    return NextResponse.json(await getProfile(viewer.id, decodeURIComponent(params.username)));
  } catch (err) {
    if (err instanceof MarketError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
