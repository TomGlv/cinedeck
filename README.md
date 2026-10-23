# CineDeck

A collectible card game built on TMDB: movies, series and anime as cards. Open packs, complete sets,
trade on an auction market against bots and other players, battle boosters, trade with friends.

Stack: Next.js 14 (App Router), Tailwind, Framer Motion, Prisma. SQLite locally, PostgreSQL in production (Netlify).

## Run locally

```bash
npm install
cp .env.example .env        # then paste your TMDB key in TMDB_API_KEY
npx prisma db push          # creates prisma/dev.db
npm run dev
```

Without a TMDB key the game falls back to a few bundled sample cards (no posters).

On Windows, stop `npm run dev` before running a Prisma command, or `prisma generate` fails with EPERM.

## Features

- **Showcase** (home page): every card that can drop, Mythic and Legendary tiers first, searchable, with a favorite
  star (you're notified when a favorite goes on sale) and a link to its listings (`/api/catalogue`, `/api/favorites`).
- **Packs**: Daily Reel (free every 15 min), Director's Cut, Blockbuster, plus **event packs** sold only during
  their window (Fright Night: horror films, Oct 15 to Nov 3 · Holiday Reel: family films, Dec 10 to Jan 6).
  Events live in `lib/packs.ts` (`event: { from, to, genre }`), add one there. Matinee, Box Office and Hall of Fame
  are battle-only packs. Packs are 3D foil boosters, cut open by swiping across the screen; card backs match the pack.
- **Special prints**: any card can come out Foil (4%, x2 value), Polychrome (0.8%, x5) or Negative (0.12%, x15).
  Event packs print them 3x more often. See `lib/finishes.ts`.
- **Collection**: sets with fixed coin rewards, a chain of nine combos (each unlocks the next), quick sell.
- **Market** (`/market`): eBay-style auctions with proxy max bids, Buy Now, 5% tax, bot bidders with hidden demand
  cycles, price history, print filter. The house (`CineDeck Market`) lists every card players let go of (quick sells,
  upgrade stakes, bot battle wins) at market price; it never mints cards.
- **Upgrade** (stake cards for a pricier one, unbid house listings included) and **Booster battles** (vs bot, open
  lobby or friend; a tie spins a roulette, the result stays hidden until you watch the replay).
- **Accounts, friends, trades**: direct card + coin swaps between friends (`/trades`), checked atomically on accept.
  Pick one of your cards as your profile picture from the profile page.
- **CineCoins**: promo codes (`lib/codes.ts`) and coin packs sold in crypto through NOWPayments (`lib/payments.ts`,
  `lib/coinPacks.ts`), credited by the IPN webhook. Needs `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`.
- **Notifications**: outbid, auction won / sold / expired, battle invites and results, friend requests, trade offers,
  favorites on sale. The navbar bell polls every 60 s.
- **First-visit guide**, reopened from the navbar's help button.
- **Leaderboards**: collection value, sets completed, battles won (registered players, refreshed every minute).

## Deploy on Netlify

SQLite can't live on serverless functions, so production uses PostgreSQL. `prisma/schema.prisma` stays on SQLite
for local dev; the Netlify build (`netlify.toml`) generates `prisma/postgres.prisma` from it with
`scripts/postgres-schema.mjs`, builds the Prisma client for it and syncs the tables with `prisma db push`.

1. **Database.** Either:
   - **Netlify DB** (Neon, managed by Netlify): `npx netlify db init` in the linked project. It sets
     `NETLIFY_DATABASE_URL` and `NETLIFY_DATABASE_URL_UNPOOLED` for you, or
   - a free **Neon** (neon.tech) or **Supabase** project: set `DATABASE_URL` (pooled connection string) and
     `DIRECT_URL` (direct one) in *Site configuration > Environment variables*.
2. Set `TMDB_API_KEY` and `CRON_SECRET` (any long random string) in the same place, plus the NOWPayments keys to
   sell CineCoins.
3. Push the repo to GitHub and import it in Netlify, or `npx netlify deploy --prod`. Netlify picks up `netlify.toml`.

`netlify/functions/market-tick.mjs` is a scheduled function that calls `/api/cron/tick` every 15 minutes, so auctions
settle and bots keep trading when nobody is on the site.

If the build ever refuses a schema change because it would delete data, `prisma db push` stops the deploy rather
than dropping anything: handle that change by hand.

### Move your local data to production (optional)

Copies every row of `prisma/dev.db` (accounts, cards, market history) into the Postgres database:

```bash
# with DATABASE_URL / DIRECT_URL pointing at Postgres in your shell (not in .env, which stays on SQLite)
node scripts/postgres-schema.mjs
npx prisma generate --schema prisma/postgres.prisma
npx prisma db push --schema prisma/postgres.prisma --skip-generate
node scripts/copy-sqlite-to-postgres.mjs
npx prisma generate          # back to the SQLite client for local dev
```

The copy script needs Node 22.5+ (built-in `node:sqlite`).
