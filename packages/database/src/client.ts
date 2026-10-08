import { Prisma, PrismaClient } from "@prisma/client";

export * from "@prisma/client";
export { Prisma };

const isProduction = process.env.NODE_ENV === "production";

/**
 * A single Prisma client per process. In development the instance is cached on
 * `globalThis` so `tsx watch` reloads do not exhaust the connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["warn", "error"] : ["warn", "error"],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

/** Fails fast with a clear message when DATABASE_URL is missing. */
export function assertDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env first.",
    );
  }
}
