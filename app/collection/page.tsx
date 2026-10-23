import { CollectionView } from "@/components/collection/CollectionView";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Collection · CineDeck" };

export default function CollectionPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader kicker="Your cards" title="My Collection" className="mb-8">
        Every card you own. Complete sets and combos to earn CineCoins.
      </PageHeader>
      <CollectionView />
    </main>
  );
}
