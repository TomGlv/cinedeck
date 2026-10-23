import { NextResponse, type NextRequest } from "next/server";
import { TmdbError, getCardDetails } from "@/lib/tmdb";

/** GET ?id=movie-11 -> CardDetails */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    return NextResponse.json(await getCardDetails(id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: err instanceof TmdbError ? 404 : 502 });
  }
}
