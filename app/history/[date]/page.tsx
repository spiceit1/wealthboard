import { PagePlaceholder } from "@/components/shared/page-placeholder";

type Props = {
  params: Promise<{ date: string }>;
};

export default async function HistoryDetailPage({ params }: Props) {
  const { date } = await params;

  return (
    <PagePlaceholder
      title={`History Detail: ${date}`}
      description="Snapshot drill-down will be implemented in Phase 4."
    />
  );
}
