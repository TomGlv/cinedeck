import { NextResponse, type NextRequest } from "next/server";
import { getFranchiseCards, getTopRated, getTrending, withFallback } from "@/lib/tmdb";

/**
 * GET /api/cards                       -> trending today
 * GET /api/cards?list=top_rated&kind=tv
 * GET /api/cards?franchise=star-wars   -> every card in a set
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const franchise = params.get("franchise");
  const list = params.get("list");
  const kind = params.get("kind") === "tv" ? "tv" : "movie";

  const result = await withFallback(() => {
    if (franchise) return getFranchiseCards(franchise);
    if (list === "top_rated") return getTopRated(kind);
    return getTrending("day");
  });
  return NextResponse.json(result);
}
