import { NextResponse, type NextRequest } from "next/server";
import { getLeaderboard, type Board } from "@/lib/leaderboard";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

const BOARDS: Board[] = ["value", "sets", "battles"];

/** GET ?board=value|sets|battles -> LeaderboardDTO */
export async function GET(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const asked = req.nextUrl.searchParams.get("board") as Board;
  return NextResponse.json(await getLeaderboard(BOARDS.includes(asked) ? asked : "value", player.id));
}
