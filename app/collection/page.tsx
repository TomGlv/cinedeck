import { CollectionView } from "@/components/collection/CollectionView";

export const metadata = { title: "Collection · CineDeck" };

export default function CollectionPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-fuchsia-400 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          My Collection
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Every card you own. Complete sets and combos to earn CineCoins.</p>
      </header>
      <CollectionView />
    </main>
  );
}
