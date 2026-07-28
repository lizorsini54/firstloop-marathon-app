import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { orpc } from "../lib/orpc";

type PingState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; message: string; receivedAt: string };

export function Home() {
  const [ping, setPing] = useState<PingState>({ status: "loading" });

  useEffect(() => {
    orpc
      .ping({ message: "hello from the web app" })
      .then((result) => {
        setPing({ status: "success", ...result });
      })
      .catch((error: unknown) => {
        setPing({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="rounded-lg border border-border bg-muted px-8 py-6 text-center">
        <h1 className="text-xl font-semibold">FirstLoop</h1>
        {ping.status === "loading" && (
          <p className="mt-2 text-muted-foreground">Pinging server…</p>
        )}
        {ping.status === "error" && (
          <p className="mt-2 text-red-500">Error: {ping.error}</p>
        )}
        {ping.status === "success" && (
          <p className="mt-2 text-muted-foreground">
            {ping.message} · {ping.receivedAt}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
        <SignedIn>
          <Link to="/dashboard" className="text-sm underline underline-offset-4">
            Go to dashboard
          </Link>
          <UserButton />
        </SignedIn>
      </div>
    </main>
  );
}
