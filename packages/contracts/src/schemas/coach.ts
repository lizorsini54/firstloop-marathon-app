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
 *
 * Collapsing those two into one state actively misleads whoever is debugging:
 * "the coach isn't configured" is the wrong thing to tell someone who just
 * configured it correctly.
 */
export const getCoachFeedbackOutputSchema = z.object({
  status: z.enum(["ok", "unavailable", "failed", "no_plan"]),
  guidance: z.string().nullable(),
  concern: z.string().nullable(),
});

export type GetCoachFeedbackOutput = z.infer<typeof getCoachFeedbackOutputSchema>;
