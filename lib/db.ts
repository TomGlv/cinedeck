import { PrismaClient } from "@prisma/client";

/**
 * Netlify Database hands the connection string to functions through `Netlify.env`
 * (what @netlify/database reads), which can hold values that aren't in process.env.
 * Copied into process.env so the Postgres schema's env("NETLIFY_DB_URL") resolves.
 * Local dev (SQLite) and DATABASE_URL setups are untouched.
 */
function resolveNetlifyDatabaseUrl() {
  if (process.env.NETLIFY_DB_URL) return;
  const netlifyEnv = (globalThis as { Netlify?: { env?: { get(key: string): string | undefined } } }).Netlify?.env;
  const url = netlifyEnv?.get("NETLIFY_DB_URL");
  if (url) process.env.NETLIFY_DB_URL = url;
  else if (process.env.NETLIFY) console.warn("[db] NETLIFY_DB_URL not found in process.env nor Netlify.env");
}

resolveNetlifyDatabaseUrl();

// Reuse one client across hot reloads in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
