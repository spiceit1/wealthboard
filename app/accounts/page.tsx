import Link from "next/link";
import { AppNav } from "@/components/shared/app-nav";
import { AccountsOverview } from "@/components/accounts/accounts-overview";

export default function AccountsPage() {
  return (
    <main className="space-y-6">
      <AppNav />
      <section className="space-y-1">
        <h1 className="wb-page-title">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Bank and investment accounts, with cash and investments shown separately.
        </p>
      </section>
      <Link href="/bank-transactions" className="inline-block underline">View bank transactions →</Link>
      <AccountsOverview />
    </main>
  );
}
