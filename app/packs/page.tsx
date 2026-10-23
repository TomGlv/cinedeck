import { PackOpener } from "@/components/pack/PackOpener";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Packs · CineDeck" };

export default function PacksPage() {
  return (
    <main className="mx-auto max-w-6xl overflow-x-clip px-4 py-10 sm:px-6">
      <PageHeader kicker="Shop" title="Booster Packs" className="mb-10">
        A free pack every 15 minutes, limited event packs, and the best card always revealed last.
      </PageHeader>
      <PackOpener />
    </main>
  );
}
