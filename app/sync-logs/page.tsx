import { AppNav } from "@/components/shared/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDemoUserId, getSyncRuns } from "@/services/dashboardData";

export const dynamic = "force-dynamic";

export default async function SyncLogsPage() {
  const userId = await getDemoUserId();
  const runs = userId ? await getSyncRuns(userId) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sync Logs</h1>
        <p className="text-sm text-muted-foreground">
          Persisted sync run history with trigger, status, and latest event.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Trigger</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2 pr-4">Latest Event</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b">
                    <td className="py-2 pr-4">{new Date(run.startedAt).toLocaleString()}</td>
                    <td className="py-2 pr-4 capitalize">{run.trigger}</td>
                    <td
                      className={`py-2 pr-4 capitalize ${
                        run.status === "completed"
                          ? "text-emerald-600"
                          : run.status === "failed"
                            ? "text-red-500"
                            : "text-amber-600"
                      }`}
                    >
                      {run.status}
                    </td>
                    <td className="py-2 pr-4">
                      {run.completedAt ? new Date(run.completedAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-2 pr-4">{run.lastEvent ?? run.errorMessage ?? "-"}</td>
                  </tr>
                ))}
                {!runs.length && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={5}>
                      No sync runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
