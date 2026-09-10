import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * In dev, Next.js hot-reload would otherwise create a new client on every
 * reload and exhaust connections, so we cache it on globalThis.
 *
 * Reads DATABASE_URL from the environment (see .env.example). The Prisma
 * models are generated from the database via `prisma db pull` once the Neon
 * branch has been provisioned with db/schema.sql — see prisma/schema.prisma.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
