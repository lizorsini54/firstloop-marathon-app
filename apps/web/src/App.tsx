import { useEffect, useState } from "react";
import { orpc } from "./lib/orpc";

type PingState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; message: string; receivedAt: string };

export function App() {
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
    <main className="flex min-h-screen items-center justify-center">
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
    </main>
  );
}
