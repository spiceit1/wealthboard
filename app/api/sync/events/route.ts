export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(
    JSON.stringify({
      message: "SSE live sync events are disabled. Poll /api/sync/latest instead.",
    }),
    {
      status: 410,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

