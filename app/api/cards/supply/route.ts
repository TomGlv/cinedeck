import { NextResponse, type NextRequest } from "next/server";
import { getSupply } from "@/lib/market";

export const dynamic = "force-dynamic";

/** GET ?id=movie-11 -> { total, house, players, holders, listed } */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const supply = await getSupply([id]);
  return NextResponse.json(supply.get(id));
}
