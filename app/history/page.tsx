import { AppNav } from "@/components/shared/app-nav";
import { HistoryOverview } from "@/components/history/history-overview";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <HistoryOverview />
    </main>
  );
}
