import { router } from "@firstloop/contracts";
import { RPCHandler } from "@orpc/server/node";
import cors from "cors";
import express from "express";
import { env } from "./env";

const app = express();
app.use(cors({ origin: env.WEB_ORIGIN }));

const handler = new RPCHandler(router);

app.use(async (req, res, next) => {
  const { matched } = await handler.handle(req, res, {
    prefix: "/rpc",
    context: {},
  });
  if (matched) return;
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(env.SERVER_PORT, () => {
  console.log(`server listening on http://localhost:${env.SERVER_PORT}`);
});
