import { LeaderboardView } from "@/components/LeaderboardView";

export const metadata = { title: "Leaderboards · CineDeck" };

export default function LeaderboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-fuchsia-400 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Leaderboards
        </h1>
        <p className="mt-2 text-sm text-zinc-400">The richest collections, the most sets completed and the best battlers.</p>
      </header>
      <LeaderboardView />
    </main>
  );
}
