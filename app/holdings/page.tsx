import { AppNav } from "@/components/shared/app-nav";
import { HoldingsOverview } from "@/components/holdings/holdings-overview";

export const dynamic = "force-dynamic";

export default function HoldingsPage() {
  return (
    <main className="space-y-6">
      <AppNav />
      <HoldingsOverview />
    </main>
  );
}
