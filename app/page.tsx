import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Showcase } from "@/components/Showcase";

/** Home: every card by rarity, search and favorites. */
export default function Home({ searchParams }: { searchParams: { tab?: string } }) {
  // Older notification links pointed market tabs at the home page
  if (searchParams.tab) redirect(`/market?tab=${encodeURIComponent(searchParams.tab)}`);
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader kicker="Catalogue" title="Every card" className="mb-10">
        Movies, series and anime: the best loved and most watched titles are the rarest. Star a card to be told the moment
        it goes on sale.
      </PageHeader>
      <Showcase />
    </main>
  );
}
