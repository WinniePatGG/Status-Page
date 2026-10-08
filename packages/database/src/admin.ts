import { hashPassword, verifyPassword } from "@status-page/shared";
import { prisma } from "./client.js";

/**
 * Creates the admin user from the ADMIN_USERNAME / ADMIN_PASSWORD environment
 * variables. Runs on every API start: a missing user is created and a changed
 * password is applied (existing sessions are invalidated in that case).
 */
export async function ensureAdminUser(
  username: string,
  password: string,
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await prisma.user.findUnique({ where: { username } });

  if (!existing) {
    await prisma.user.create({
      data: { username, passwordHash: await hashPassword(password) },
    });

    return "created";
  }

  const valid = await verifyPassword(password, existing.passwordHash);

  if (valid) {
    return "unchanged";
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.session.deleteMany({ where: { userId: existing.id } }),
  ]);

  return "updated";
}

/** Removes expired sessions, called periodically by the API. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return result.count;
}
