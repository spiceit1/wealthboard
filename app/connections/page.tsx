import { AppNav } from "@/components/shared/app-nav";
import { ConnectionsOverview } from "@/components/connections/connections-overview";

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <ConnectionsOverview />
    </main>
  );
}
