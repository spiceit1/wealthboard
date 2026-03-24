import { AppNav } from "@/components/shared/app-nav";
import { HistoryOverview } from "@/components/history/history-overview";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return (
    <main className="space-y-6">
      <AppNav />
      <HistoryOverview />
    </main>
  );
}
