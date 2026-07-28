import { protectedProcedure, publicProcedure } from "./procedures";
import { meOutputSchema } from "./schemas/me";
import { pingInputSchema, pingOutputSchema } from "./schemas/ping";

const ping = publicProcedure
  .input(pingInputSchema)
  .output(pingOutputSchema)
  .handler(({ input }) => {
    return {
      message: input?.message ?? "pong",
      receivedAt: new Date().toISOString(),
    };
  });

const me = protectedProcedure.output(meOutputSchema).handler(({ context }) => {
  return { userId: context.auth.userId };
});

export const router = {
  ping,
  me,
};

export type AppRouter = typeof router;
