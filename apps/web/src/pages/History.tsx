import type { GetSessionHistoryOutput } from "@firstloop/contracts";
import { useEffect, useState } from "react";
import { formatUTCDate } from "../lib/date";
import { titleCase } from "../lib/format";
import { orpc } from "../lib/orpc";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: GetSessionHistoryOutput };

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export function History() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    orpc
      .getSessionHistory()
      .then((data) => setState({ status: "success", data }))
      .catch((error: unknown) =>
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Session history</h1>
      <p className="mt-1 text-muted-foreground">Every session you've logged, most recent first.</p>

      {state.status === "loading" && <p className="mt-6 text-muted-foreground">Loading…</p>}

      {state.status === "error" && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p>Couldn't load your history: {state.error}</p>
        </div>
      )}

      {state.status === "success" && state.data.sessionLogs.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing logged yet — your first session will show up here.
        </p>
      )}

      {state.status === "success" && state.data.sessionLogs.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-md border border-border bg-card">
          {state.data.sessionLogs.map((s) => (
            <li
              key={s.id}
              className="grid grid-cols-[6rem_4rem_1fr] items-center gap-2 px-4 py-2.5 text-sm"
            >
              <span className="font-mono">{formatUTCDate(s.date)}</span>
              <span>{titleCase(s.type)}</span>
              <span className="text-right font-mono text-muted-foreground">
                {s.setLog && s.setLog.length > 0
                  ? `${s.setLog.length} exercises logged · RPE ${s.rpe}`
                  : `${s.distanceMiles ? `${s.distanceMiles}mi · ` : ""}${s.durationMin}min · RPE ${s.rpe}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {state.status === "success" && (
        <p className={`mt-4 ${labelClass}`}>
          {state.data.sessionLogs.length} session{state.data.sessionLogs.length === 1 ? "" : "s"} logged
        </p>
      )}
    </div>
  );
}
