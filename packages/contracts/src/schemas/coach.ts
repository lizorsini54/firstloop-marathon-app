import { z } from "zod";

/**
 * Flat rather than a discriminated union so the client can render it without
 * narrowing gymnastics. "unavailable" is a normal, expected state (no
 * ANTHROPIC_API_KEY configured, or the call failed) — not an error the client
 * has to treat as a broken request.
 */
export const getCoachFeedbackOutputSchema = z.object({
  status: z.enum(["ok", "unavailable", "no_plan"]),
  guidance: z.string().nullable(),
  concern: z.string().nullable(),
});

export type GetCoachFeedbackOutput = z.infer<typeof getCoachFeedbackOutputSchema>;
