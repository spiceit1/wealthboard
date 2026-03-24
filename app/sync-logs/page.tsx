import { AppNav } from "@/components/shared/app-nav";
import { SyncLogsOverview } from "@/components/sync-logs/sync-logs-overview";

export const dynamic = "force-dynamic";

export default function SyncLogsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <SyncLogsOverview />
    </main>
  );
}
