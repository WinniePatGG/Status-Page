import type { ServiceStatus } from "./types.js";
import { SERVICE_STATUSES } from "./types.js";

/** Converts a Prisma enum value (or anything unknown) to an API status. */
export function toServiceStatus(value: unknown): ServiceStatus {
  if (typeof value === "string") {
    const normalized = value.toLowerCase() as ServiceStatus;
    if (SERVICE_STATUSES.includes(normalized)) {
      return normalized;
    }
  }

  return "operational";
}

/**
 * Overall page status:
 * any outage -> outage, any degraded -> degraded, otherwise operational.
 */
export function overallStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.includes("outage")) {
    return "outage";
  }

  if (statuses.includes("degraded")) {
    return "degraded";
  }

  return "operational";
}

/** Worst of two statuses, used when a single service changes state. */
export function worstStatus(
  current: ServiceStatus,
  next: ServiceStatus,
): ServiceStatus {
  const rank: Record<ServiceStatus, number> = {
    operational: 0,
    degraded: 1,
    outage: 2,
  };

  return rank[next] > rank[current] ? next : current;
}

/** successful checks / total checks * 100, rounded to two decimals. */
export function uptimePercentage(
  totalChecks: number,
  successfulChecks: number,
): number {
  if (totalChecks <= 0) {
    return 100;
  }

  const percentage = (successfulChecks / totalChecks) * 100;
  return Math.round(percentage * 100) / 100;
}
