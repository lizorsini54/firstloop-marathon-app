import { UserButton } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { orpc } from "../lib/orpc";

type MeState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; userId: string };

export function Dashboard() {
  const [me, setMe] = useState<MeState>({ status: "loading" });

  useEffect(() => {
    orpc
      .me()
      .then((result) => {
        setMe({ status: "success", ...result });
      })
      .catch((error: unknown) => {
        setMe({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="rounded-lg border border-border bg-muted px-8 py-6 text-center">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {me.status === "loading" && (
          <p className="mt-2 text-muted-foreground">Loading…</p>
        )}
        {me.status === "error" && (
          <p className="mt-2 text-red-500">Error: {me.error}</p>
        )}
        {me.status === "success" && (
          <p className="mt-2 text-muted-foreground">
            Signed in as <span className="font-mono">{me.userId}</span>
          </p>
        )}
      </div>
      <UserButton />
    </main>
  );
}
