import { AppNav } from "@/components/shared/app-nav";
import { CreditCardOverview } from "@/components/credit-card/credit-card-overview";
export const dynamic = "force-dynamic";
export default function CreditCardPage() { return <main className="space-y-6"><AppNav /><CreditCardOverview /></main>; }
