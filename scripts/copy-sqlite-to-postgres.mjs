// One-off: copies every row of prisma/dev.db (local SQLite) into the Postgres database,
// so your local account, cards and market history go live with you.
//
// The Prisma client must be generated for Postgres first (see README, "Move your local data"):
//   node scripts/postgres-schema.mjs
//   npx prisma generate --schema prisma/postgres.prisma
//   npx prisma db push --schema prisma/postgres.prisma --skip-generate
//   node scripts/copy-sqlite-to-postgres.mjs        (add --force to copy into a non-empty database)
//   npx prisma generate                             (back to the SQLite client for local dev)
import { DatabaseSync } from "node:sqlite";
import { Prisma, PrismaClient } from "@prisma/client";

const SQLITE_FILE = "prisma/dev.db";
// Parents before children, so foreign keys are satisfied
const ORDER = [
  "Player",
  "Session",
  "Friendship",
  "Battle",
  "OwnedCard",
  "CompletedSet",
  "Listing",
  "Bid",
  "Sale",
  "Notification",
  "Trade",
  "TradeItem",
  "Clock",
  "RedeemedCode",
  "Favorite",
];

const prisma = new PrismaClient();
const sqlite = new DatabaseSync(SQLITE_FILE, { readOnly: true });
const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

const delegate = (model) => prisma[model[0].toLowerCase() + model.slice(1)];

/** SQLite stores DateTime as epoch ms and Boolean as 0/1. */
function convert(model, row) {
  const out = {};
  for (const field of models.get(model).fields) {
    if (field.kind !== "scalar" || !(field.name in row)) continue;
    const v = row[field.name];
    if (v == null) out[field.name] = null;
    else if (field.type === "DateTime") out[field.name] = new Date(typeof v === "string" && !/^\d+$/.test(v) ? v : Number(v));
    else if (field.type === "Boolean") out[field.name] = Boolean(v);
    else if (field.type === "Float") out[field.name] = Number(v);
    else out[field.name] = v;
  }
  return out;
}

async function main() {
  if (!process.argv.includes("--force") && (await prisma.player.count()) > 0) {
    console.error("The Postgres database already has players. Re-run with --force to copy anyway (duplicates are skipped).");
    process.exit(1);
  }

  for (const model of ORDER) {
    let rows;
    try {
      rows = sqlite.prepare(`SELECT * FROM "${model}"`).all();
    } catch {
      console.log(`${model}: no table in ${SQLITE_FILE}, skipped`);
      continue;
    }
    const data = rows.map((r) => convert(model, r));
    let copied = 0;
    for (let i = 0; i < data.length; i += 500) {
      const res = await delegate(model).createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
      copied += res.count;
    }
    console.log(`${model}: ${copied}/${rows.length} rows copied`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
