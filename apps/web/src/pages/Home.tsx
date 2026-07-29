import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight text-foreground">
          CADENZA
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Training, by the numbers
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
          <UserButton />
        </SignedIn>
      </div>

      <div className="rounded-md border border-border bg-card px-6 py-4 text-center text-sm">
        {ping.status === "loading" && <p className="text-muted-foreground">Pinging server…</p>}
        {ping.status === "error" && <p className="text-destructive">Error: {ping.error}</p>}
        {ping.status === "success" && (
          <p className="font-mono text-muted-foreground">
            {ping.message} · {ping.receivedAt}
          </p>
        )}
      </div>
    </main>
  );
}
