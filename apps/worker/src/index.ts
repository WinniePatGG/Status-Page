import { prisma, assertDatabaseUrl } from "@status-page/database";
import { createNotifier } from "@status-page/shared";
import { loadConfig } from "./config.js";
import { performCheck } from "./checker.js";

const config = loadConfig();

async function main() {
  assertDatabaseUrl();
  const notify = createNotifier(config.DISCORD_WEBHOOK_URL);

  let running = true;

  process.on("SIGINT", () => {
    running = false;
  });

  process.on("SIGTERM", () => {
    running = false;
  });

  const tick = async () => {
    try {
      const services = await prisma.service.findMany({
        where: { enabled: true },
        orderBy: { name: "asc" },
      });

      for (const service of services) {
        const now = new Date();
        const due =
          !service.lastCheckedAt ||
          service.lastCheckedAt.getTime() + service.checkInterval * 1000 <=
            now.getTime();
        if (!due) {
          continue;
        }

        const result = await performCheck(service);

        await prisma.monitorCheck.create({
          data: {
            serviceId: service.id,
            success: result.success,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            error: result.error,
          },
        });

        let consecutiveFailures = service.consecutiveFailures;
        let consecutiveSuccesses = service.consecutiveSuccesses;
        let newStatus = service.status;

        if (result.success) {
          consecutiveFailures = 0;
          consecutiveSuccesses = consecutiveSuccesses + 1;

          if (consecutiveSuccesses >= config.MONITOR_RECOVERY_THRESHOLD) {
            if (service.status === "OUTAGE" || service.status === "DEGRADED") {
              newStatus = "OPERATIONAL";
              consecutiveSuccesses = 0;
              await notify({
                title: `${service.name} has recovered`,
                description: "The service is responding normally again.",
                level: "success",
                footer: service.name,
              });
              const openIncident = await prisma.incident.findFirst({
                where: { serviceId: service.id, resolvedAt: null },
              });
              if (openIncident) {
                await prisma.incident.update({
                  where: { id: openIncident.id },
                  data: { status: "RESOLVED", resolvedAt: now },
                });
                await prisma.incidentUpdate.create({
                  data: {
                    incidentId: openIncident.id,
                    message: "Service has recovered.",
                    status: "RESOLVED",
                  },
                });
                await notify({
                  title: `${service.name} incident resolved`,
                  description: "Incident marked as resolved.",
                  level: "success",
                  footer: service.name,
                });
              }
            } else {
              newStatus = "OPERATIONAL";
            }
          } else {
            newStatus = "OPERATIONAL";
          }
        } else {
          consecutiveSuccesses = 0;
          consecutiveFailures = consecutiveFailures + 1;

          if (consecutiveFailures >= config.MONITOR_FAILURE_THRESHOLD) {
            if (service.status !== "OUTAGE") {
              newStatus = "OUTAGE";
              consecutiveFailures = 0;
              await notify({
                title: `${service.name} is experiencing an outage`,
                description: result.error ?? "Request failed.",
                level: "error",
                footer: service.name,
              });
              const existing = await prisma.incident.findFirst({
                where: { serviceId: service.id, resolvedAt: null },
              });
              if (!existing) {
                await prisma.incident.create({
                  data: {
                    serviceId: service.id,
                    title: `${service.name} is experiencing an outage`,
                    description:
                      result.error ?? "Automatic detection of service outage.",
                    status: "INVESTIGATING",
                    severity: "MAJOR",
                    autoCreated: true,
                  },
                });
                await notify({
                  title: `New incident: ${service.name}`,
                  description:
                    "Automatic incident created due to repeated failures.",
                  level: "warning",
                  footer: service.name,
                });
              }
            } else {
              newStatus = "OUTAGE";
            }
          } else {
            newStatus = service.status;
          }
        }

        await prisma.service.update({
          where: { id: service.id },
          data: {
            lastCheckedAt: now,
            lastStatusCode: result.statusCode,
            lastResponseTime: result.responseTime,
            lastError: result.error,
            consecutiveFailures,
            consecutiveSuccesses,
            status: newStatus,
          },
        });
      }

      const retentionCutoff = new Date(
        Date.now() - config.MONITOR_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      await prisma.monitorCheck.deleteMany({
        where: { checkedAt: { lt: retentionCutoff } },
      });
    } catch (error) {
      console.error("[worker] tick failed", error);
    }
  };

  await tick();
  if (!running) return;
  const interval = setInterval(async () => {
    if (!running) {
      clearInterval(interval);
      return;
    }
    await tick();
  }, config.WORKER_TICK_MS);

  process.on("exit", () => clearInterval(interval));
}

main().catch((error) => {
  console.error("worker fatal", error);
  process.exit(1);
});
