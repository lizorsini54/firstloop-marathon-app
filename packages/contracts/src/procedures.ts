import { ORPCError, os } from "@orpc/server";
import type { AppContext } from "./context";

export const publicProcedure = os.$context<AppContext>();

export const protectedProcedure = publicProcedure.use(({ context, next }) => {
  if (!context.auth) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({ context: { auth: context.auth } });
});
