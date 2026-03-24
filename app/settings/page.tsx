import { AppNav } from "@/components/shared/app-nav";
import { SettingsOverview } from "@/components/settings/settings-overview";

export default function SettingsPage() {
  return (
    <main className="space-y-6">
      <AppNav />
      <SettingsOverview />
    </main>
  );
}
