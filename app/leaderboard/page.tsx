import { LeaderboardView } from "@/components/LeaderboardView";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Leaderboards · CineDeck" };

export default function LeaderboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader kicker="Rankings" title="Leaderboards" className="mb-8">
        The richest collections, the most sets completed and the best battlers.
      </PageHeader>
      <LeaderboardView />
    </main>
  );
}
