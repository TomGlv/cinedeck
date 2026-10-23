import { Suspense } from "react";
import { TradesView } from "@/components/trades/TradesView";

export const metadata = { title: "Trades · CineDeck" };

export default function TradesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-400 to-amber-300 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Trades
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Swap cards and coins directly with your friends. No tax, no bots.</p>
      </header>
      <Suspense>
        <TradesView />
      </Suspense>
    </main>
  );
}
