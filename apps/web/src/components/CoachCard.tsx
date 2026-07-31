import type { GetCoachFeedbackOutput } from "@firstloop/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { orpc } from "../lib/orpc";

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

type CoachState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "loaded"; data: GetCoachFeedbackOutput };

/**
 * Button-triggered rather than fetched with the rest of the dashboard: this is
 * the one place in the app that costs money per call, so asking for it is an
 * explicit act (see DECISIONS.md, Checkpoint 14).
 */
export function CoachCard() {
  const [state, setState] = useState<CoachState>({ status: "idle" });

  function ask() {
    setState({ status: "loading" });
    orpc
      .getCoachFeedback()
      .then((data) => setState({ status: "loaded", data }))
      .catch((error: unknown) =>
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
  }

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={labelClass}>Coach</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={ask}
          disabled={state.status === "loading"}
        >
          {state.status === "loading"
            ? "Reading your last two weeks…"
            : state.status === "idle"
              ? "Ask the coach"
              : "Ask again"}
        </Button>
      </div>

      <div className="mt-2 rounded-md border border-border bg-card p-4">
        <CoachBody state={state} />
      </div>
    </section>
  );
}

function CoachBody({ state }: { state: CoachState }) {
  if (state.status === "idle") {
    return (
      <p className="text-sm text-muted-foreground">
        Get a short read on how your last two weeks of training actually went.
      </p>
    );
  }

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Thinking…</p>;
  }

  if (state.status === "error") {
    return <p className="text-sm text-destructive">Error: {state.error}</p>;
  }

  if (state.data.status === "unavailable") {
    return (
      <p className="text-sm text-muted-foreground">
        The coach isn't configured in this environment. Set ANTHROPIC_API_KEY on the server to turn
        it on.
      </p>
    );
  }

  if (state.data.status === "failed") {
    return (
      <p className="text-sm text-muted-foreground">
        The coach is configured but couldn't be reached just now. The server log has the reason —
        an expired key and an exhausted credit balance both land here.
      </p>
    );
  }

  if (state.data.status === "no_plan") {
    return (
      <p className="text-sm text-muted-foreground">
        There's no plan to review yet — set your goal first.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-foreground">{state.data.guidance}</p>
      {state.data.concern && (
        <div className="mt-3 rounded-md border border-flare/40 bg-flare-bg p-3">
          <p className={labelClass}>Worth a look</p>
          <p className="mt-1 text-sm">{state.data.concern}</p>
        </div>
      )}
    </>
  );
}
