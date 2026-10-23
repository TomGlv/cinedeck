/* ------------------------------------------------------------------ */
/*  Card finishes (client-safe)                                        */
/* ------------------------------------------------------------------ */

/**
 * Any card, whatever its rarity, can come out of a pack with a special finish.
 * Same card, rarer print: worth `multiplier` times a normal copy.
 */
export type Finish = "normal" | "foil" | "polychrome" | "negative";

export interface FinishDef {
  id: Finish;
  name: string;
  /** Chance per card, in % */
  chance: number;
  multiplier: number;
  tagline: string;
}

export const FINISHES: Record<Finish, FinishDef> = {
  normal: { id: "normal", name: "Normal", chance: 0, multiplier: 1, tagline: "" },
  foil: { id: "foil", name: "Foil", chance: 4, multiplier: 2, tagline: "Silver foil print" },
  polychrome: { id: "polychrome", name: "Polychrome", chance: 0.8, multiplier: 5, tagline: "Shifting rainbow print" },
  negative: { id: "negative", name: "Film Negative", chance: 0.12, multiplier: 15, tagline: "Inverted, one in a thousand" },
};

/** Rarest first, the order the roll checks them in. */
export const SPECIAL_FINISHES: Finish[] = ["negative", "polychrome", "foil"];

export function isFinish(value: unknown): value is Finish {
  return typeof value === "string" && Object.hasOwn(FINISHES, value);
}

export function finishOf(value: string | null | undefined): Finish {
  return isFinish(value) ? value : "normal";
}

export function finishMultiplier(value: string | null | undefined): number {
  return FINISHES[finishOf(value)].multiplier;
}

/** `boost` multiplies every special chance (event packs print more of them). */
export function rollFinish(boost = 1): Finish {
  let roll = Math.random() * 100;
  for (const f of SPECIAL_FINISHES) {
    roll -= FINISHES[f].chance * boost;
    if (roll < 0) return f;
  }
  return "normal";
}

/** Identifies a card *and* its print: "movie-11" or "movie-11~polychrome". */
export function cardKey(card: { id: string; finish?: Finish } | { cardId: string; finish?: string | null }): string {
  const id = "id" in card ? card.id : card.cardId;
  const finish = finishOf(card.finish);
  return finish === "normal" ? id : `${id}~${finish}`;
}

export function parseCardKey(key: string): { cardId: string; finish: Finish } {
  const [cardId, finish] = key.split("~");
  return { cardId, finish: finishOf(finish) };
}
