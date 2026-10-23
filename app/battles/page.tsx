import { Suspense } from "react";
import { BoosterBattle } from "@/components/battle/BoosterBattle";

export const metadata = { title: "Booster Battles · CineDeck" };

export default function BattlesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-rose-300 via-amber-300 to-fuchsia-400 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Booster Battles
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Fight a bot, a random player or a friend. Same pack, five rounds, the best pull takes everything.</p>
      </header>
      <Suspense>
        <BoosterBattle />
      </Suspense>
    </main>
  );
}
