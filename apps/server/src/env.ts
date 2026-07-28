import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  CLERK_SECRET_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
