import Link from "next/link";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

const routes = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/accounts", label: "Accounts" },
  { href: "/holdings", label: "Holdings" },
  { href: "/connections", label: "Connections" },
  { href: "/sync-logs", label: "Sync Logs" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <nav className="flex flex-wrap gap-2">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            {route.label}
          </Link>
        ))}
      </nav>
      <DashboardOverview />
    </main>
  );
}
