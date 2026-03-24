import { AppNav } from "@/components/shared/app-nav";
import { SyncLogsOverview } from "@/components/sync-logs/sync-logs-overview";

export default function SyncLogsPage() {
  return (
    <main className="space-y-6">
      <AppNav />
      <SyncLogsOverview />
    </main>
  );
}
