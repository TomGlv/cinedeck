import { Suspense } from "react";
import { TradesView } from "@/components/trades/TradesView";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Trades · CineDeck" };

export default function TradesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader kicker="Social" title="Trades" className="mb-8">
        Swap cards and coins directly with your friends. No tax, no bots.
      </PageHeader>
      <Suspense>
        <TradesView />
      </Suspense>
    </main>
  );
}
