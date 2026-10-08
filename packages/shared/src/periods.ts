import type { UptimeBucket, UptimePeriod } from "./types.js";
import { UPTIME_PERIODS } from "./types.js";
import { uptimePercentage } from "./status.js";

export interface PeriodConfig {
  /** Length of the whole period in milliseconds. */
  durationMs: number;
  /** How many bars the frontend renders for this period. */
  buckets: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const PERIOD_CONFIG: Record<UptimePeriod, PeriodConfig> = {
  "24h": { durationMs: DAY, buckets: 24 },
  "7d": { durationMs: 7 * DAY, buckets: 7 },
  "30d": { durationMs: 30 * DAY, buckets: 30 },
  "90d": { durationMs: 90 * DAY, buckets: 30 },
};

export function isUptimePeriod(value: unknown): value is UptimePeriod {
  return (
    typeof value === "string" &&
    (UPTIME_PERIODS as readonly string[]).includes(value)
  );
}

export function periodStart(period: UptimePeriod, now: Date): Date {
  return new Date(now.getTime() - PERIOD_CONFIG[period].durationMs);
}

/** Result of one aggregated database row, see `buildUptimeSeries`. */
export interface CheckAggregate {
  bucketStart: Date;
  totalChecks: number;
  successfulChecks: number;
  averageResponseTime: number | null;
}

/**
 * Turns per bucket database aggregates into a dense, gap free series that the
 * frontend can render as uptime bars. Buckets without any check get
 * `uptime: null` so they can be rendered as "no data".
 */
export function buildUptimeSeries(
  aggregates: CheckAggregate[],
  period: UptimePeriod,
  now: Date,
): UptimeBucket[] {
  const { durationMs, buckets } = PERIOD_CONFIG[period];
  const bucketMs = durationMs / buckets;
  const start = periodStart(period, now);

  const totals = Array.from({ length: buckets }, () => ({
    total: 0,
    successful: 0,
    time: 0,
  }));

  for (const aggregate of aggregates) {
    const offset = aggregate.bucketStart.getTime() - start.getTime();
    if (offset < 0 || offset >= durationMs) {
      continue;
    }

    const index = Math.floor(offset / bucketMs);
    const bucket = totals[index];
    if (!bucket) {
      continue;
    }

    bucket.total += aggregate.totalChecks;
    bucket.successful += aggregate.successfulChecks;

    if (aggregate.averageResponseTime !== null) {
      // Weight the average by the number of checks so a partially filled
      // bucket is not skewed by a single slow check.
      bucket.time += aggregate.averageResponseTime * aggregate.totalChecks;
    }
  }

  return totals.map((bucket, index) => {
    const bucketStart = new Date(start.getTime() + index * bucketMs);

    if (bucket.total === 0) {
      return {
        start: bucketStart.toISOString(),
        uptime: null,
        averageResponseTime: null,
        totalChecks: 0,
      };
    }

    return {
      start: bucketStart.toISOString(),
      uptime: uptimePercentage(bucket.total, bucket.successful),
      averageResponseTime: Math.round(bucket.time / bucket.total),
      totalChecks: bucket.total,
    };
  });
}
