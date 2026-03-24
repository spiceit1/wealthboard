import { getDemoUserId } from "@/services/dashboardData";
import { domainsForRunFinish, domainsForRunStart } from "@/lib/sync-domain-mapping";
import { getLatestSyncRunForUser } from "@/lib/sync-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSse(data: unknown, event = "message") {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const userId = await getDemoUserId();
  if (!userId) {
    return new Response("Demo user not found.", { status: 404 });
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  let maxLife: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let previousId: string | null = null;
      let previousStatus: string | null = null;

      const sendSnapshot = async () => {
        const latest = await getLatestSyncRunForUser(userId);
        const changed =
          (latest?.id ?? null) !== previousId || (latest?.status ?? null) !== previousStatus;

        if (changed) {
          const affectedDomains =
            latest == null
              ? []
              : latest.status === "running" || latest.status === "pending"
                ? domainsForRunStart()
                : domainsForRunFinish(latest.trigger);
          controller.enqueue(
            encoder.encode(
              encodeSse({
                latest,
                affectedDomains,
              }),
            ),
          );
          previousId = latest?.id ?? null;
          previousStatus = latest?.status ?? null;
        } else {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }
      };

      void sendSnapshot();
      timer = setInterval(() => {
        void sendSnapshot();
      }, 2000);

      const close = () => {
        if (timer !== null) clearInterval(timer);
        controller.close();
      };

      // Auto-close long-lived connection to encourage clean reconnects.
      maxLife = setTimeout(close, 60_000);

      controller.enqueue(encoder.encode(encodeSse({ connected: true }, "connected")));
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (maxLife !== null) clearTimeout(maxLife);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

