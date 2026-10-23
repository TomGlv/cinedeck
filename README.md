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

- **Packs**: Daily Reel (free every 15 min), Director's Cut, Blockbuster, plus **event packs** sold only during
  their window (Fright Night: horror films, Oct 15 to Nov 3 · Holiday Reel: family films, Dec 10 to Jan 6).
  Events live in `lib/packs.ts` (`event: { from, to, genre }`), add one there.
- **Special prints**: any card can come out Foil (4%, x2 value), Polychrome (0.8%, x5) or Film Negative (0.12%, x15).
  Event packs print them 3x more often. See `lib/finishes.ts`.
- **Collection**: sets and rarity combos with coin rewards, quick sell.
- **Market**: eBay-style auctions with proxy max bids, Buy Now, 5% tax, bots with hidden demand cycles, price history.
- **Upgrade** (stake cards for a pricier one) and **Booster battles** (vs bot, open lobby or friend).
- **Accounts, friends, trades**: direct card + coin swaps between friends (`/trades`), checked atomically on accept.
- **Notifications**: outbid, auction won / sold / expired, battle invites and results, friend requests, trade offers.
  The navbar bell polls every 15 s.
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
2. Set `TMDB_API_KEY` and `CRON_SECRET` (any long random string) in the same place.
3. Push the repo to GitHub and import it in Netlify, or `npx netlify deploy --prod`. Netlify picks up `netlify.toml`.

`netlify/functions/market-tick.mjs` is a scheduled function that calls `/api/cron/tick` every 5 minutes, so auctions
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
