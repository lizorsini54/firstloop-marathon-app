import { z } from "zod";

export const meOutputSchema = z.object({
  userId: z.string(),
});

export type MeOutput = z.infer<typeof meOutputSchema>;
