import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  CORS_ORIGIN: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0)
        : ["http://localhost:5173"],
    ),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters long"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1).default("change-me"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DISCORD_WEBHOOK_URL: z.string().optional(),
  MONITOR_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),
  MONITOR_RECOVERY_THRESHOLD: z.coerce.number().int().positive().default(3),
  MONITOR_DEGRADED_RESPONSE_TIME_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(2000),
  MONITOR_DEFAULT_CHECK_INTERVAL: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  MONITOR_DEFAULT_TIMEOUT: z.coerce.number().int().positive().default(10000),
  MONITOR_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
});

export type AppConfig = z.infer<typeof envSchema> & { sessionTtlMs: number };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    sessionTtlMs: parsed.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}
