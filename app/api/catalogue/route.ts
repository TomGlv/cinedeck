import { NextResponse, type NextRequest } from "next/server";
import { RARITY_ORDER, type Rarity } from "@/lib/cards";
import { getCatalogue } from "@/lib/catalogue";
import { getOrCreatePlayer } from "@/lib/player";

export const dynamic = "force-dynamic";

/** GET ?q=&rarity=&favorites=1&offset=&limit= -> CatalogueDTO */
export async function GET(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const p = req.nextUrl.searchParams;
  const rarity = p.get("rarity");
  return NextResponse.json(
    await getCatalogue(player.id, {
      q: p.get("q") ?? undefined,
      rarity: rarity && Object.hasOwn(RARITY_ORDER, rarity) ? (rarity as Rarity) : "all",
      favorites: p.get("favorites") === "1",
      offset: Number(p.get("offset")) || 0,
      limit: Number(p.get("limit")) || undefined,
    }),
  );
}
