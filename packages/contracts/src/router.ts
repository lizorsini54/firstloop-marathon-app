import { os } from "@orpc/server";
import { pingInputSchema, pingOutputSchema } from "./schemas/ping";

const ping = os
  .input(pingInputSchema)
  .output(pingOutputSchema)
  .handler(({ input }) => {
    return {
      message: input?.message ?? "pong",
      receivedAt: new Date().toISOString(),
    };
  });

export const router = {
  ping,
};

export type AppRouter = typeof router;
