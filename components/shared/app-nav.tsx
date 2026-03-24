"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveUpdatesBadge } from "@/components/shared/live-updates-badge";
import { cn } from "@/lib/utils";

const routes = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/accounts", label: "Accounts" },
  { href: "/holdings", label: "Holdings" },
  { href: "/connections", label: "Connections" },
  { href: "/sync-logs", label: "Sync Logs" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          WealthBoard
        </h2>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <nav className="flex flex-wrap gap-1">
          {routes.map((route) => {
            const active = isActive(pathname, route.href);
            return (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {route.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <LiveUpdatesBadge />
    </header>
  );
}
