import { Suspense } from "react";
import { MarketView } from "@/components/market/MarketView";

export const metadata = { title: "Market · CineDeck" };

export default function MarketPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Suspense>
        <MarketView />
      </Suspense>
    </main>
  );
}
