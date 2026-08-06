import { z } from "zod";

/**
 * Flat rather than a discriminated union so the client can render it without
 * narrowing gymnastics. None of these are errors the client treats as a broken
 * request — but they are kept distinct on purpose:
 *
 * - "unavailable": no ANTHROPIC_API_KEY configured. Fix is a config change.
 * - "failed": a key is configured but the call didn't succeed (bad key, no
 *   credit, upstream outage, malformed response). Fix is elsewhere, and the
 *   server log has the reason.
 * - "timed_out": the call was still outstanding after COACH_TIMEOUT_MS. Nothing
 *   is misconfigured and nothing failed — it was simply slow. The fix is to try
 *   again, which is why it isn't folded into "failed": that copy sends the
 *   reader to the server log for a cause that isn't there.
 * - "no_plan": the caller has no training plan, so there is nothing to review.
 *   Reachable through this API but **not currently through the UI**: `CoachCard`
 *   renders only on the dashboard, and since Checkpoint 17 the dashboard
 *   redirects to `/intake` whenever `plan` is null. Kept rather than removed —
 *   dropping it would make this procedure lie to a plan-less caller, and the
 *   card's branch is retained so a routing change can't produce an unhandled
 *   state. Flagged as dead in the second persona review (#60); it isn't, and
 *   Checkpoint 28 recorded why instead of deleting it.
 *
 * Collapsing these into one state actively misleads whoever is debugging:
 * "the coach isn't configured" is the wrong thing to tell someone who just
 * configured it correctly.
 */
export const getCoachFeedbackOutputSchema = z.object({
  status: z.enum(["ok", "unavailable", "failed", "timed_out", "no_plan"]),
  guidance: z.string().nullable(),
  concern: z.string().nullable(),
});

export type GetCoachFeedbackOutput = z.infer<typeof getCoachFeedbackOutputSchema>;
