import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // Railway injects PORT; SERVER_PORT is our local-only fallback (see DECISIONS.md).
  PORT: z.coerce.number().int().positive().optional(),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  PORT: parsedEnv.PORT ?? parsedEnv.SERVER_PORT,
};
