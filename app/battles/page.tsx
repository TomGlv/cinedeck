import { Suspense } from "react";
import { BoosterBattle } from "@/components/battle/BoosterBattle";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Booster Battles · CineDeck" };

export default function BattlesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader kicker="Play" title="Booster Battles" className="mb-8">
        Fight a bot, a random player or a friend. Same pack, five rounds, the best pull takes everything.
      </PageHeader>
      <Suspense>
        <BoosterBattle />
      </Suspense>
    </main>
  );
}
