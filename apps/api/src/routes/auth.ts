import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashSessionToken } from "@status-page/shared";
import {
  createSessionToken as createRawToken,
  getCookieOptions,
  verifyCredentials,
} from "../auth.js";
import { formatZodError } from "../utils.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send(formatZodError(parsed.error));
      return;
    }

    const { username, password } = parsed.data;
    const user = await verifyCredentials(username, password, app.prisma);

    if (!user) {
      reply
        .code(401)
        .send({
          error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
        });
      return;
    }

    const token = await createRawToken();
    const expiresAt = new Date(Date.now() + app.config.sessionTtlMs);

    await app.prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt,
      },
    });

    reply.setCookie("sp_session", token, getCookieOptions(app.config));
    return { user: { id: user.id, username: user.username } };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies.sp_session;
    if (token) {
      await app.prisma.session.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      });
    }
    reply.clearCookie("sp_session", getCookieOptions(app.config));
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies.sp_session;
    if (!token) {
      return reply
        .code(401)
        .send({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    }
    const session = await app.prisma.session.findFirst({
      where: {
        tokenHash: hashSessionToken(token),
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!session) {
      reply.clearCookie("sp_session", getCookieOptions(app.config));
      return reply
        .code(401)
        .send({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    }
    return { user: { id: session.user.id, username: session.user.username } };
  });
}
