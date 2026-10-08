/**
 * Shared domain types and constants.
 *
 * These types are the contract between the API, the monitoring worker and the
 * React frontend. Database enums (Prisma) use SCREAMING_CASE, the API uses
 * lower case strings, the conversion helpers live in `status.ts`.
 */

export const SERVICE_STATUSES = ["operational", "degraded", "outage"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const INCIDENT_STATUSES = [
  "INVESTIGATING",
  "IDENTIFIED",
  "MONITORING",
  "RESOLVED",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const UPTIME_PERIODS = ["24h", "7d", "30d", "90d"] as const;
export type UptimePeriod = (typeof UPTIME_PERIODS)[number];

export interface ServiceSummary {
  id: string;
  name: string;
  description: string | null;
  status: ServiceStatus;
  /** Uptime percentage over the 30 day period. */
  uptime: number;
  /** Average response time in ms over the 30 day period. */
  responseTime: number | null;
}

export interface OverallStatus {
  status: ServiceStatus;
  updatedAt: string;
}

export interface MonitorCheckDto {
  id: string;
  serviceId: string;
  success: boolean;
  statusCode: number | null;
  responseTime: number | null;
  error: string | null;
  checkedAt: string;
}

export interface UptimeBucket {
  /** ISO timestamp of the first check inside the bucket. */
  start: string;
  /** Uptime percentage inside the bucket, or null when no data exists. */
  uptime: number | null;
  averageResponseTime: number | null;
  totalChecks: number;
}

export interface UptimeReport {
  serviceId: string;
  period: UptimePeriod;
  uptime: number;
  averageResponseTime: number | null;
  totalChecks: number;
  buckets: UptimeBucket[];
}

export interface MetricsReport {
  serviceId: string;
  period: UptimePeriod;
  uptime: number;
  averageResponseTime: number | null;
  totalChecks: number;
  checks: MonitorCheckDto[];
}

export interface IncidentUpdateDto {
  id: string;
  message: string;
  status: IncidentStatus;
  createdAt: string;
}

export interface IncidentDto {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  title: string;
  description: string | null;
  status: IncidentStatus;
  severity: IncidentSeverity;
  /** True when the incident was created by the monitoring worker. */
  autoCreated: boolean;
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updates?: IncidentUpdateDto[];
}

export interface AdminServiceDto {
  id: string;
  name: string;
  description: string | null;
  url: string;
  enabled: boolean;
  checkInterval: number;
  timeout: number;
  status: ServiceStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  lastResponseTime: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminServiceDetail extends AdminServiceDto {
  recentChecks: MonitorCheckDto[];
  openIncidentId: string | null;
}

export interface SessionUser {
  id: string;
  username: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
