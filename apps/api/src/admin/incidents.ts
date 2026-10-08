import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from "@status-page/shared";
import { formatZodError, parseId } from "../utils.js";

const incidentCreateSchema = z.object({
  serviceId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(INCIDENT_SEVERITIES).default("MAJOR"),
  status: z.enum(INCIDENT_STATUSES).default("INVESTIGATING"),
  startedAt: z.string().optional(),
});

const incidentUpdateSchema = incidentCreateSchema.partial().extend({
  resolvedAt: z.string().nullable().optional(),
});

const updateCreateSchema = z.object({
  message: z.string().min(1),
  status: z.enum(INCIDENT_STATUSES),
});

const updatePatchSchema = updateCreateSchema.partial();

export async function registerAdminIncidents(app: FastifyInstance) {
  app.get(
    "/api/admin/incidents",
    { preHandler: [app.requireAuth] },
    async () => {
      const incidents = await app.prisma.incident.findMany({
        include: {
          service: { select: { name: true } },
          updates: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ resolvedAt: "asc" }, { startedAt: "desc" }],
        take: 200,
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
      }));
    },
  );

  app.post(
    "/api/admin/incidents",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const parsed = incidentCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send(formatZodError(parsed.error));
        return;
      }
      const data: any = {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        severity: parsed.data.severity,
        status: parsed.data.status,
        autoCreated: false,
      };
      if (parsed.data.serviceId) data.serviceId = parsed.data.serviceId;
      if (parsed.data.startedAt) {
        const d = new Date(parsed.data.startedAt);
        if (!Number.isNaN(d.getTime())) data.startedAt = d;
      }
      const incident = await app.prisma.incident.create({ data });
      return incident;
    },
  );

  app.get(
    "/api/admin/incidents/:id",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string) as string;
      const incident = await app.prisma.incident.findUnique({
        where: { id },
        include: {
          service: { select: { name: true } },
          updates: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!incident) {
        reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Incident not found" },
        });
        return;
      }
      return {
        ...incident,
        startedAt: incident.startedAt.toISOString(),
        resolvedAt: incident.resolvedAt
          ? incident.resolvedAt.toISOString()
          : null,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        updates: incident.updates.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        })),
      };
    },
  );

  app.patch(
    "/api/admin/incidents/:id",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string) as string;
      const parsed = incidentUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send(formatZodError(parsed.error));
        return;
      }
      const data: any = {};
      if (parsed.data.title !== undefined) data.title = parsed.data.title;
      if (parsed.data.description !== undefined)
        data.description = parsed.data.description;
      if (parsed.data.severity !== undefined)
        data.severity = parsed.data.severity;
      if (parsed.data.status !== undefined) data.status = parsed.data.status;
      if (parsed.data.serviceId !== undefined)
        data.serviceId = parsed.data.serviceId || null;
      if (parsed.data.startedAt !== undefined) {
        const d = new Date(parsed.data.startedAt);
        if (!Number.isNaN(d.getTime())) data.startedAt = d;
      }
      if (parsed.data.resolvedAt !== undefined) {
        if (parsed.data.resolvedAt === null) data.resolvedAt = null;
        else {
          const d = new Date(parsed.data.resolvedAt);
          if (!Number.isNaN(d.getTime())) data.resolvedAt = d;
        }
      }
      try {
        const incident = await app.prisma.incident.update({
          where: { id },
          data,
        });
        return {
          ...incident,
          startedAt: incident.startedAt.toISOString(),
          resolvedAt: incident.resolvedAt?.toISOString() ?? null,
        };
      } catch (err: any) {
        if (err.code === "P2025") {
          reply.code(404).send({
            error: { code: "NOT_FOUND", message: "Incident not found" },
          });
          return;
        }
        throw err;
      }
    },
  );

  app.delete(
    "/api/admin/incidents/:id",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string) as string;
      try {
        await app.prisma.incident.delete({ where: { id } });
        return { ok: true };
      } catch (err: any) {
        if (err.code === "P2025") {
          reply.code(404).send({
            error: { code: "NOT_FOUND", message: "Incident not found" },
          });
          return;
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/admin/incidents/:id/updates",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string) as string;
      const parsed = updateCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send(formatZodError(parsed.error));
        return;
      }
      const incident = await app.prisma.incident.findUnique({ where: { id } });
      if (!incident) {
        reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Incident not found" },
        });
        return;
      }
      const update = await app.prisma.incidentUpdate.create({
        data: {
          incidentId: id,
          message: parsed.data.message,
          status: parsed.data.status,
        },
      });
      await app.prisma.incident.update({
        where: { id },
        data: { status: parsed.data.status, updatedAt: new Date() },
      });
      return { ...update, createdAt: update.createdAt.toISOString() };
    },
  );

  app.patch(
    "/api/admin/incidents/:id/updates/:updateId",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const id = parseId((request.params as any)?.id as string) as string;
      const updateId = parseId((request.params as any)?.updateId) as string;
      const parsed = updatePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send(formatZodError(parsed.error));
        return;
      }
      const data: any = {};
      if (parsed.data.message !== undefined) data.message = parsed.data.message;
      if (parsed.data.status !== undefined) data.status = parsed.data.status;
      try {
        const update = await app.prisma.incidentUpdate.update({
          where: { id: updateId },
          data,
        });
        if (parsed.data.status !== undefined) {
          await app.prisma.incident.update({
            where: { id },
            data: { status: parsed.data.status },
          });
        }
        return { ...update, createdAt: update.createdAt.toISOString() };
      } catch (err: any) {
        if (err.code === "P2025") {
          reply.code(404).send({
            error: { code: "NOT_FOUND", message: "Update not found" },
          });
          return;
        }
        throw err;
      }
    },
  );

  app.delete(
    "/api/admin/incidents/:id/updates/:updateId",
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const updateId = parseId((request.params as any)?.updateId) as string;
      try {
        await app.prisma.incidentUpdate.delete({ where: { id: updateId } });
        return { ok: true };
      } catch (err: any) {
        if (err.code === "P2025") {
          reply.code(404).send({
            error: { code: "NOT_FOUND", message: "Update not found" },
          });
          return;
        }
        throw err;
      }
    },
  );
}
