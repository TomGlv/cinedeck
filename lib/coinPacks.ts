/** CineCoin packs sold through NOWPayments (price in euro cents). Shared by the shop popover and the API. */
export const COIN_PACKS = [
  { id: "1k", coins: 1_000, cents: 199 },
  { id: "2k", coins: 2_000, cents: 349 },
  { id: "5k", coins: 5_000, cents: 799 },
  { id: "20k", coins: 20_000, cents: 1999 },
] as const;
