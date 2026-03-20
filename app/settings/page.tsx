import { AppNav } from "@/components/shared/app-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeEastern } from "@/lib/formatters";
import { env } from "@/lib/env";
import { getDemoUserId, getSettingsOverview } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getDemoUserId();
  const data = userId ? await getSettingsOverview(userId) : null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Scheduler health, security controls, and runtime mode.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scheduler</CardTitle>
            <CardDescription>Daily auto-refresh target: 9:00 AM America/New_York.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Latest scheduled run:{" "}
              <span className="font-medium capitalize">
                {data?.latestScheduled?.status ?? "none"}
              </span>
            </p>
            <p>
              Started at:{" "}
              <span className="font-medium">
                {data?.latestScheduled?.startedAt
                  ? new Date(data.latestScheduled.startedAt).toLocaleString()
                  : "-"}
              </span>
            </p>
            <p>
              Next expected run (NY):{" "}
              <span className="font-medium">
                {formatDateTimeEastern(data?.nextExpectedNyNine)}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Server-side runtime flags and protections.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Mode: <span className="font-medium">{env.MOCK_MODE ? "Mock" : "Real"}</span>
            </p>
            <p>
              Internal token set:{" "}
              <span className="font-medium">{env.INTERNAL_SYNC_TOKEN ? "Yes" : "No"}</span>
            </p>
            <p>
              Latest manual run:{" "}
              <span className="font-medium capitalize">{data?.latestManual?.status ?? "none"}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
