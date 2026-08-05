import type { GetSessionHistoryOutput } from "@firstloop/contracts";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatUTCDate } from "../lib/date";
import { titleCase } from "../lib/format";
import { orpc } from "../lib/orpc";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: GetSessionHistoryOutput };

type SessionLogRow = GetSessionHistoryOutput["sessionLogs"][number];

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export function History() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Which row is mid-confirm. An inline two-step rather than a modal: the app
  // has no dialog primitive anywhere, and introducing one for a single
  // confirmation would be disproportionate.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
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

  useEffect(load, [load]);

  function startEdit(s: SessionLogRow) {
    // The log form does the editing. It already handles every field including
    // the exercise rows, so it prefills from what history already returned —
    // no second fetch, and no second version of that form to keep in step.
    void navigate("/log", {
      state: {
        plannedWorkoutId: s.plannedWorkoutId ?? undefined,
        type: s.type,
        editing: {
          sessionLogId: s.id,
          date: s.date.toISOString().slice(0, 10),
          distanceMiles: s.distanceMiles,
          durationMin: s.durationMin,
          rpe: s.rpe,
          notes: s.notes,
          setLog: s.setLog,
        },
      },
    });
  }

  async function confirmDelete(id: string) {
    setActionError(null);
    setDeletingId(id);
    try {
      await orpc.deleteSessionLog({ sessionLogId: id });
      setConfirmingId(null);
      load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn't delete that session.");
    } finally {
      setDeletingId(null);
    }
  }

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

      {actionError && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{actionError}</p>
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
            <li key={s.id} className="px-4 py-2.5 text-sm">
              <div className="grid grid-cols-[6rem_4rem_1fr_auto] items-center gap-2">
                <span className="font-mono">{formatUTCDate(s.date)}</span>
                <span>{titleCase(s.type)}</span>
                <span className="text-right font-mono text-muted-foreground">
                  {s.setLog && s.setLog.length > 0
                    ? `${s.setLog.length} exercises logged · RPE ${s.rpe}`
                    : `${s.distanceMiles ? `${s.distanceMiles}mi · ` : ""}${s.durationMin}min · RPE ${s.rpe}`}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit session on ${formatUTCDate(s.date)}`}
                    onClick={() => {
                      startEdit(s);
                    }}
                  >
                    Edit
                  </Button>
                  {confirmingId !== s.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete session on ${formatUTCDate(s.date)}`}
                      onClick={() => {
                        setActionError(null);
                        setConfirmingId(s.id);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </span>
              </div>

              {confirmingId === s.id && (
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                  <span>Delete this session? It won't be recoverable.</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmingId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deletingId === s.id}
                    onClick={() => {
                      void confirmDelete(s.id);
                    }}
                  >
                    {deletingId === s.id ? "Deleting…" : "Yes, delete"}
                  </Button>
                </div>
              )}
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
