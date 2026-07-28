import { z } from "zod";

export const pingInputSchema = z
  .object({
    message: z.string().min(1).optional(),
  })
  .optional();

export const pingOutputSchema = z.object({
  message: z.string(),
  receivedAt: z.string(),
});

export type PingInput = z.infer<typeof pingInputSchema>;
export type PingOutput = z.infer<typeof pingOutputSchema>;
