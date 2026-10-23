import { Upgrader } from "@/components/upgrade/Upgrader";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Upgrader · CineDeck" };

export default function UpgradePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader kicker="Risk it" title="Upgrader" className="mb-8">
        Stake cheap cards for a shot at a better one. Win and it&apos;s yours, miss and they&apos;re gone.
      </PageHeader>
      <Upgrader />
    </main>
  );
}
