import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { hashSessionToken, verifyPassword } from "@status-page/shared";
import type { AppConfig } from "./config.js";

export interface SessionContext {
  user: { id: string; username: string };
}

declare module "fastify" {
  interface FastifyRequest {
    session?: SessionContext;
  }
}

const COOKIE_NAME = "sp_session";
const TOKEN_LENGTH = 32;

export function registerAuth(app: FastifyInstance, config: AppConfig) {
  app.decorate(
    "requireAuth",
    async function (request: FastifyRequest, reply: FastifyReply) {
      const token = request.cookies[COOKIE_NAME];

      if (!token) {
        reply
          .code(401)
          .send({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
        return;
      }

      const tokenHash = hashSessionToken(token);
      const session = await app.prisma.session.findFirst({
        where: { tokenHash, expiresAt: { gt: new Date() } },
        include: { user: true },
      });

      if (!session) {
        reply
          .code(401)
          .clearCookie(COOKIE_NAME, getCookieOptions(config))
          .send({
            error: { code: "UNAUTHORIZED", message: "Unauthorized" },
          });
        return;
      }

      request.session = {
        user: { id: session.user.id, username: session.user.username },
      };
    },
  );
}

export function getCookieOptions(config: AppConfig) {
  const secure = config.COOKIE_SECURE || config.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  };
}

export async function createSessionToken(): Promise<string> {
  return randomBytes(TOKEN_LENGTH).toString("hex");
}

export async function verifyCredentials(
  username: string,
  password: string,
  prisma: typeof import("@status-page/database").prisma,
) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    return null;
  }

  return user;
}
