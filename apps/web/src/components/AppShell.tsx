import { UserButton } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/log", label: "Log" },
  { to: "/intake", label: "Plan" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Cadenza</span>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={
                location.pathname === item.to
                  ? "text-sm font-medium underline underline-offset-4"
                  : "text-sm text-muted-foreground hover:underline hover:underline-offset-4"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
        <UserButton />
      </nav>
      <main>{children}</main>
    </div>
  );
}
