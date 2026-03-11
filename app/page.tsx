import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { AppNav } from "@/components/shared/app-nav";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <DashboardOverview />
    </main>
  );
}
