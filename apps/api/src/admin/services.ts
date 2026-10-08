import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toServiceStatus, type ServiceStatus } from "@status-page/shared";
import { formatZodError, parseId } from "../utils.js";

const serviceCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url(),
  enabled: z.boolean().default(true),
  checkInterval: z.coerce.number().int().positive().default(60),
  timeout: z.coerce.number().int().positive().default(10000),
});

const serviceUpdateSchema = serviceCreateSchema.partial();

export async function registerAdminServices(app: FastifyInstance) {
  app.get(
    "/api/admin/services",
    { preHandler: [app.requireAuth] },
    async () => {
      const services = await app.prisma.service.findMany({
        orderBy: { createdAt: "desc" },
      });

      return services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        url: service.url,
        enabled: service.enabled,
        checkInterval: service.checkInterval,
        timeout: service.timeout,
        status: toServiceStatus(service.status) as ServiceStatus,
        consecutiveFailures: service.consecutiveFailures,
        consecutiveSuccesses: service.consecutiveSuccesses,
        lastCheckedAt: service.lastCheckedAt
          ? service.lastCheckedAt.toISOString()
          : null,
        lastStatusCode: service.lastStatusCode,
        lastResponseTime: service.lastResponseTime,
        lastError: service.lastError,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      }));
    },
  );

  app.post(
    "/api/admin/services",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const parsed = serviceCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send(formatZodError(parsed.error));
        return;
      }

      const service = await app.prisma.service.create({ data: parsed.data });
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        url: service.url,
        enabled: service.enabled,
        checkInterval: service.checkInterval,
        timeout: service.timeout,
        status: toServiceStatus(service.status) as ServiceStatus,
        consecutiveFailures: service.consecutiveFailures,
        consecutiveSuccesses: service.consecutiveSuccesses,
        lastCheckedAt: service.lastCheckedAt
          ? service.lastCheckedAt.toISOString()
          : null,
        lastStatusCode: service.lastStatusCode,
        lastResponseTime: service.lastResponseTime,
        lastError: service.lastError,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      };
    },
  );

  app.get(
    "/api/admin/services/:id",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string);
      const service = await app.prisma.service.findUnique({
        where: { id },
        include: {
          checks: { take: 20, orderBy: { checkedAt: "desc" } },
          incidents: { where: { resolvedAt: null }, take: 1 },
        },
      });
      if (!service) {
        reply
          .code(404)
          .send({
            error: { code: "SERVICE_NOT_FOUND", message: "Service not found" },
          });
        return;
      }
      const openIncident = service.incidents[0] ?? null;
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        url: service.url,
        enabled: service.enabled,
        checkInterval: service.checkInterval,
        timeout: service.timeout,
        status: toServiceStatus(service.status) as ServiceStatus,
        consecutiveFailures: service.consecutiveFailures,
        consecutiveSuccesses: service.consecutiveSuccesses,
        lastCheckedAt: service.lastCheckedAt
          ? service.lastCheckedAt.toISOString()
          : null,
        lastStatusCode: service.lastStatusCode,
        lastResponseTime: service.lastResponseTime,
        lastError: service.lastError,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
        recentChecks: service.checks.map((c) => ({
          id: c.id,
          serviceId: c.serviceId,
          success: c.success,
          statusCode: c.statusCode,
          responseTime: c.responseTime,
          error: c.error,
          checkedAt: c.checkedAt.toISOString(),
        })),
        openIncidentId: openIncident?.id ?? null,
      };
    },
  );

  app.patch(
    "/api/admin/services/:id",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string);
      const parsed = serviceUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send(formatZodError(parsed.error));
        return;
      }
      try {
        const service = await app.prisma.service.update({
          where: { id },
          data: parsed.data,
        });
        return {
          id: service.id,
          name: service.name,
          description: service.description,
          url: service.url,
          enabled: service.enabled,
          checkInterval: service.checkInterval,
          timeout: service.timeout,
          status: toServiceStatus(service.status) as ServiceStatus,
          consecutiveFailures: service.consecutiveFailures,
          consecutiveSuccesses: service.consecutiveSuccesses,
          lastCheckedAt: service.lastCheckedAt
            ? service.lastCheckedAt.toISOString()
            : null,
          lastStatusCode: service.lastStatusCode,
          lastResponseTime: service.lastResponseTime,
          lastError: service.lastError,
          createdAt: service.createdAt.toISOString(),
          updatedAt: service.updatedAt.toISOString(),
        };
      } catch (err: any) {
        if (err.code === "P2025") {
          reply
            .code(404)
            .send({
              error: {
                code: "SERVICE_NOT_FOUND",
                message: "Service not found",
              },
            });
          return;
        }
        throw err;
      }
    },
  );

  app.delete(
    "/api/admin/services/:id",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string);
      try {
        await app.prisma.service.delete({ where: { id } });
        return { ok: true };
      } catch (err: any) {
        if (err.code === "P2025") {
          reply
            .code(404)
            .send({
              error: {
                code: "SERVICE_NOT_FOUND",
                message: "Service not found",
              },
            });
          return;
        }
        throw err;
      }
    },
  );
}
