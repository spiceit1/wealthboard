import { AppNav } from "@/components/shared/app-nav";
import { AccountsOverview } from "@/components/accounts/accounts-overview";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AppNav />
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Connected bank cash accounts (checking and savings).
        </p>
      </section>
      <AccountsOverview />
    </main>
  );
}
