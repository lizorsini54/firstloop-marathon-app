import type { AppRouter } from "@firstloop/contracts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | undefined;

export function setClerkTokenGetter(fn: TokenGetter) {
  getToken = fn;
}

const link = new RPCLink({
  url: `${import.meta.env.VITE_API_URL}/rpc`,
  headers: async () => {
    const token = await getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

export const orpc: RouterClient<AppRouter> = createORPCClient(link);
