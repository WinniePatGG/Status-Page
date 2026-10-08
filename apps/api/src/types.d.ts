import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import type { AppConfig } from "./config.js";
import type { PrismaClient } from "@status-page/database";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    prisma: PrismaClient;
    requireAuth: preHandlerAsyncHookHandler;
  }
}
