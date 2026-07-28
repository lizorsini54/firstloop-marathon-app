import type { AppRouter } from "@firstloop/contracts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

const link = new RPCLink({
  url: `${import.meta.env.VITE_API_URL}/rpc`,
});

export const orpc: RouterClient<AppRouter> = createORPCClient(link);
