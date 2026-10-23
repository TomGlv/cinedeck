"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Store } from "lucide-react";
import { postJson } from "./ui";

/** Star a card to be told when it goes on sale, plus a shortcut to its listings. */
export function FavoriteButton({ cardId }: { cardId: string }) {
  const [favorite, setFavorite] = useState<boolean | null>(null);

  useEffect(() => {
    setFavorite(null);
    void fetch(`/api/favorites?cardId=${encodeURIComponent(cardId)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ favorite: boolean }>)
      .then((d) => setFavorite(d.favorite));
  }, [cardId]);

  async function toggle() {
    setFavorite((f) => !f);
    const res = await postJson<{ favorite?: boolean }>("/api/favorites", { cardId });
    if (res.favorite != null) setFavorite(res.favorite);
  }

  if (!cardId.startsWith("star-")) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={toggle}
        disabled={favorite == null}
        aria-pressed={!!favorite}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ring-1 transition active:scale-[0.98] disabled:opacity-50 ${
          favorite ? "bg-amber-400/15 text-amber-200 ring-amber-400/40" : "bg-white/5 text-zinc-200 ring-white/10 hover:bg-white/10"
        }`}
      >
        <Star className={`h-4 w-4 ${favorite ? "fill-amber-300 text-amber-300" : ""}`} />
        {favorite ? "In your favorites" : "Add to favorites"}
      </button>
      <Link
        href={`/market?card=${encodeURIComponent(cardId)}`}
        className="flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10"
      >
        <Store className="h-4 w-4" /> See on the market
      </Link>
    </div>
  );
}
