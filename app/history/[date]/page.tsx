import { AppNav } from "@/components/shared/app-nav";
import { HistoryDetailOverview } from "@/components/history/history-detail-overview";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ date: string }>;
};

export default async function HistoryDetailPage({ params }: Props) {
  const { date } = await params;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <HistoryDetailOverview date={date} />
    </main>
  );
}
