import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  MONITOR_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),
  MONITOR_RECOVERY_THRESHOLD: z.coerce.number().int().positive().default(3),
  MONITOR_DEGRADED_RESPONSE_TIME_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(2000),
  WORKER_TICK_MS: z.coerce.number().int().positive().default(5000),
  MONITOR_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  DISCORD_WEBHOOK_URL: z.string().optional(),
});

export type WorkerConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return envSchema.parse(env);
}
