import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { AppNav } from "@/components/shared/app-nav";

export default function DashboardPage() {
  return (
    <main className="space-y-6">
      <AppNav />
      <DashboardOverview />
    </main>
  );
}
