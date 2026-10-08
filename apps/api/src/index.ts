import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import {
  prisma,
  ensureAdminUser,
  pruneExpiredSessions,
} from "@status-page/database";
import { loadConfig } from "./config.js";
import { formatError, HttpError } from "./errors.js";
import { registerAuth } from "./auth.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAdminServices } from "./admin/services.js";
import { registerAdminIncidents } from "./admin/incidents.js";

const config = loadConfig();

const app = Fastify({
  logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
  },
  trustProxy: true,
});

app.decorate("config", config);
app.decorate("prisma", prisma);

await app.register(cors, {
  origin: config.CORS_ORIGIN,
  credentials: true,
});

await app.register(cookie);

registerAuth(app, config);
await registerPublicRoutes(app);
await registerAuthRoutes(app);
await registerAdminServices(app);
await registerAdminIncidents(app);

app.setErrorHandler((error, request, reply) => {
  const statusCode =
    error instanceof HttpError
      ? error.statusCode
      : ((error as any).statusCode ?? 500);
  reply.code(statusCode).send(formatError(error as any, request.id));
});

app.get("/healthz", async () => ({ status: "ok" }));

async function start() {
  try {
    await ensureAdminUser(config.ADMIN_USERNAME, config.ADMIN_PASSWORD);
    setInterval(
      () => {
        pruneExpiredSessions().catch((err) =>
          app.log.warn({ err }, "failed to prune sessions"),
        );
      },
      60 * 60 * 1000,
    );

    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`API listening on http://${config.HOST}:${config.PORT}`);
  } catch (error) {
    app.log.fatal({ error: error as any }, "failed to start api");
    process.exit(1);
  }
}

start();
