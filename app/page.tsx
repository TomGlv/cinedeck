import { Suspense } from "react";
import { MarketView } from "@/components/market/MarketView";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Suspense>
        <MarketView />
      </Suspense>
    </main>
  );
}
