import { AppNav } from "@/components/shared/app-nav";
import { HoldingsOverview } from "@/components/holdings/holdings-overview";

export const dynamic = "force-dynamic";

export default function HoldingsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <HoldingsOverview />
    </main>
  );
}
