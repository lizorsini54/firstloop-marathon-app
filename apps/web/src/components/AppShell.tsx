import { UserButton } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/plan", label: "Plan" },
  { to: "/log", label: "Log" },
  { to: "/history", label: "History" },
  { to: "/progress", label: "Progress" },
  { to: "/nutrition", label: "Fueling" },
  { to: "/intake", label: "Goal" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className="rounded-sm font-display text-lg font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            CADENZA
          </Link>
          <div className="flex items-center gap-5">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "rounded-sm border-b-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
                    (active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <UserButton />
      </nav>
      <main>{children}</main>
    </div>
  );
}
