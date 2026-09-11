import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";

/**
 * Prisma client singleton, backed by the Neon serverless driver adapter.
 *
 * The adapter lets Prisma run on the Cloudflare Pages edge runtime (no TCP
 * sockets) and works on Node too. On Node we give Neon's Pool a WebSocket
 * implementation; on the edge the platform provides one natively.
 *
 * Reads DATABASE_URL from the environment (the Neon pooled connection string).
 * In dev we cache the client on globalThis so hot-reload doesn't exhaust
 * connections.
 */

// On Node (no global WebSocket), supply `ws`. On the edge, WebSocket is native.
// Use an indirect require so the edge bundler never tries to include `ws`.
if (process.env.NEXT_RUNTIME !== "edge" && typeof WebSocket === "undefined") {
  // eslint-disable-next-line no-eval
  const nodeRequire = eval("require") as NodeRequire;
  neonConfig.webSocketConstructor = nodeRequire("ws");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
