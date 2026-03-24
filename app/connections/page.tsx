import { AppNav } from "@/components/shared/app-nav";
import { ConnectionsOverview } from "@/components/connections/connections-overview";

export default function ConnectionsPage() {
  return (
    <main className="space-y-6">
      <AppNav />
      <ConnectionsOverview />
    </main>
  );
}
