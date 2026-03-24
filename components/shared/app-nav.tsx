"use client";

import Link from "next/link";
import { LiveUpdatesBadge } from "@/components/shared/live-updates-badge";

const routes = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/accounts", label: "Accounts" },
  { href: "/holdings", label: "Holdings" },
  { href: "/connections", label: "Connections" },
  { href: "/sync-logs", label: "Sync Logs" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
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
      <LiveUpdatesBadge />
    </div>
  );
}
