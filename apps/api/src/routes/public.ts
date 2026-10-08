import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  overallStatus,
  toServiceStatus,
  type ServiceStatus,
  isUptimePeriod,
  PERIOD_CONFIG,
  buildUptimeSeries,
  type UptimePeriod,
} from "@status-page/shared";
import { formatZodError, parseId } from "../utils.js";

const uptimeParams = z.object({ period: z.string().default("30d") });

const incidentsQuery = z
  .object({
    status: z.string().optional(),
    service: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .strict();

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/api/services", async () => {
    const services = await app.prisma.service.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" },
    });

    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const reports = await Promise.all(
      services.map(async (service) => {
        const checks = await app.prisma.monitorCheck.findMany({
          where: { serviceId: service.id, checkedAt: { gte: cutoff } },
          select: { success: true, responseTime: true },
        });

        const totalChecks = checks.length;
        const successfulChecks = checks.filter((check) => check.success).length;
        const uptime =
          totalChecks === 0 ? 100 : (successfulChecks / totalChecks) * 100;
        const times = checks
          .map((check) => check.responseTime)
          .filter((time): time is number => time !== null && time >= 0);
        const averageResponseTime =
          times.length > 0
            ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
            : null;

        return {
          id: service.id,
          name: service.name,
          description: service.description,
          status: toServiceStatus(service.status) as ServiceStatus,
          uptime: Math.round(uptime * 100) / 100,
          responseTime: averageResponseTime,
        };
      }),
    );

    return reports;
  });

  app.get("/api/status", async () => {
    const services = await app.prisma.service.findMany({
      where: { enabled: true },
      select: { status: true, lastCheckedAt: true },
    });

    const statuses = services.map((service) => toServiceStatus(service.status));
    const lastChecked = services
      .map((service) => service.lastCheckedAt)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    return {
      status: overallStatus(statuses),
      updatedAt: (lastChecked[0] ?? new Date()).toISOString(),
    };
  });

  app.get("/api/services/:id/uptime", async (request, reply) => {
    const id = parseId((request.params as any)?.id);
    const parsed = uptimeParams.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send(formatZodError(parsed.error));
      return;
    }
    const period = parsed.data.period;
    if (!isUptimePeriod(period)) {
      reply.code(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid period" },
      });
      return;
    }

    const service = await app.prisma.service.findUnique({ where: { id } });
    if (!service) {
      reply.code(404).send({
        error: { code: "SERVICE_NOT_FOUND", message: "Service not found" },
      });
      return;
    }

    const now = new Date();
    const periodStart = new Date(
      now.getTime() - PERIOD_CONFIG[period].durationMs,
    );
    const aggregates = (await app.prisma.$queryRawUnsafe(
      `SELECT date_trunc('minute', "checkedAt") AS "bucketStart",
              COUNT(*)::int AS "totalChecks",
              SUM(CASE WHEN success THEN 1 ELSE 0 END)::int AS "successfulChecks",
              AVG(CASE WHEN "responseTime" IS NOT NULL THEN "responseTime"::float END)::float8 AS "averageResponseTime"
       FROM "monitor_checks"
       WHERE "serviceId" = $1 AND "checkedAt" >= $2
       GROUP BY 1
       ORDER BY 1`,
      id,
      periodStart,
    )) as any;

    const series = buildUptimeSeries(
      aggregates as Array<{
        bucketStart: Date;
        totalChecks: number;
        successfulChecks: number;
        averageResponseTime: number | null;
      }>,
      period as UptimePeriod,
      now,
    );

    const totalChecks = series.reduce(
      (sum, bucket) => sum + bucket.totalChecks,
      0,
    );
    const successfulChecks = series.reduce((sum, bucket) => {
      if (bucket.uptime === null) return sum;
      return sum + Math.round((bucket.uptime / 100) * bucket.totalChecks);
    }, 0);
    const uptime =
      totalChecks === 0 ? 100 : (successfulChecks / totalChecks) * 100;
    const times = series
      .map((bucket) => bucket.averageResponseTime)
      .filter((time): time is number => time !== null);
    const averageResponseTime =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : null;

    return {
      serviceId: id,
      period,
      uptime: Math.round(uptime * 100) / 100,
      averageResponseTime,
      totalChecks,
      buckets: series,
    };
  });
  app.get("/api/services/:id/metrics", async (request, reply) => {
    const id = parseId((request.params as any)?.id);
    const parsed = uptimeParams.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send(formatZodError(parsed.error));
      return;
    }
    const period = parsed.data.period;
    if (!isUptimePeriod(period)) {
      reply.code(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid period" },
      });
      return;
    }

    const service = await app.prisma.service.findUnique({ where: { id } });
    if (!service) {
      reply.code(404).send({
        error: { code: "SERVICE_NOT_FOUND", message: "Service not found" },
      });
      return;
    }

    const now = new Date();
    const periodStart = new Date(
      now.getTime() - PERIOD_CONFIG[period].durationMs,
    );
    const checks = await app.prisma.monitorCheck.findMany({
      where: { serviceId: id, checkedAt: { gte: periodStart } },
      orderBy: { checkedAt: "asc" },
    });

    const totalChecks = checks.length;
    const successfulChecks = checks.filter((check) => check.success).length;
    const uptime =
      totalChecks === 0 ? 100 : (successfulChecks / totalChecks) * 100;
    const times = checks
      .map((check) => check.responseTime)
      .filter((time): time is number => time !== null && time >= 0);
    const averageResponseTime =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : null;

    return {
      serviceId: id,
      period,
      uptime: Math.round(uptime * 100) / 100,
      averageResponseTime,
      totalChecks,
      checks: checks.map((check) => ({
        id: check.id,
        serviceId: check.serviceId,
        success: check.success,
        statusCode: check.statusCode,
        responseTime: check.responseTime,
        error: check.error,
        checkedAt: check.checkedAt.toISOString(),
      })),
    };
  });
  app.get("/api/incidents", async (request, reply) => {
    const parsed = incidentsQuery.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send(formatZodError(parsed.error));
      return;
    }
    const where: Record<string, unknown> = {};
    if (parsed.data.status) where.status = parsed.data.status as unknown;
    if (parsed.data.service)
      where.serviceId = parsed.data.service as unknown as string;
    if (parsed.data.from || parsed.data.to) {
      const startedAt: any = {};
      if (parsed.data.from) {
        const from = new Date(parsed.data.from);
        if (!Number.isNaN(from.getTime())) startedAt.gte = from;
      }
      if (parsed.data.to) {
        const to = new Date(parsed.data.to);
        if (!Number.isNaN(to.getTime())) startedAt.lte = to;
      }
      if (Object.keys(startedAt).length > 0)
        (where as any).startedAt = startedAt;
    }
    const incidents = await app.prisma.incident.findMany({
      where,
      include: {
        service: { select: { name: true } },
        updates: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ resolvedAt: "asc" }, { startedAt: "desc" }],
      take: 100,
    });
    return incidents.map((incident) => ({
      id: incident.id,
      serviceId: incident.serviceId,
      serviceName: incident.service?.name ?? null,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      severity: incident.severity,
      autoCreated: incident.autoCreated,
      startedAt: incident.startedAt.toISOString(),
      resolvedAt: incident.resolvedAt
        ? incident.resolvedAt.toISOString()
        : null,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
      updates: incident.updates.map((u) => ({
        id: u.id,
        message: u.message,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
      })),
    }));
  });

  app.get("/api/incidents/:id", async (request, reply) => {
    const id = parseId((request.params as any)?.id);
    const incident = await app.prisma.incident.findUnique({
      where: { id },
      include: {
        service: { select: { name: true } },
        updates: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!incident) {
      reply
        .code(404)
        .send({ error: { code: "NOT_FOUND", message: "Incident not found" } });
      return;
    }
    return {
      id: incident.id,
      serviceId: incident.serviceId,
      serviceName: incident.service?.name ?? null,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      severity: incident.severity,
      autoCreated: incident.autoCreated,
      startedAt: incident.startedAt.toISOString(),
      resolvedAt: incident.resolvedAt
        ? incident.resolvedAt.toISOString()
        : null,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
      updates: incident.updates.map((u) => ({
        id: u.id,
        message: u.message,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });
}
