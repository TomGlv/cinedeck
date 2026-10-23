import "server-only";
import type { CardData } from "./cards";
import { FRANCHISES } from "./franchises";
import { SAMPLE_CARDS } from "./sample-cards";
import { getFranchiseCards } from "./tmdb";

/* ------------------------------------------------------------------ */
/*  Full card list of every franchise set                              */
/* ------------------------------------------------------------------ */

const TTL_MS = 60 * 60 * 1000;
let cached: { sets: Map<string, CardData[]>; expires: number } | null = null;

export async function getSetCards(): Promise<Map<string, CardData[]>> {
  if (cached && cached.expires > Date.now()) return cached.sets;

  const entries = await Promise.all(
    FRANCHISES.map(async (f): Promise<[string, CardData[]]> => {
      try {
        return [f.slug, await getFranchiseCards(f.slug)];
      } catch {
        return [f.slug, SAMPLE_CARDS.filter((c) => c.franchise === f.slug)];
      }
    }),
  );
  const sets = new Map(entries);
  cached = { sets, expires: Date.now() + TTL_MS };
  return sets;
}
