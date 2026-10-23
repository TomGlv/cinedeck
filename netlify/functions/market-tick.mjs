// Netlify Scheduled Function: wakes the market every 5 minutes even when nobody is on the
// site, so auctions settle, bots bid, the house restocks and lobbies get their bot.
// It only pings /api/cron/tick; the work runs in the Next.js app.

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (!base) return new Response("No site URL", { status: 500 });

  const headers = process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
  const res = await fetch(`${base}/api/cron/tick`, { headers });
  console.log(`[market-tick] ${res.status} ${await res.text()}`);
  return new Response(null, { status: res.ok ? 200 : 502 });
};

export const config = {
  schedule: "*/5 * * * *",
};
