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
