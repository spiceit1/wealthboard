import { AppNav } from "@/components/shared/app-nav";
import { SettingsOverview } from "@/components/settings/settings-overview";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <SettingsOverview />
    </main>
  );
}
