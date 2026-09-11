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

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // On Node (no global WebSocket), supply `ws`. On the edge, WebSocket is
  // native. Use an indirect require so the edge bundler never tries to include
  // `ws`. Done here (not at import) so the polyfill loads only when the client
  // is actually constructed.
  if (process.env.NEXT_RUNTIME !== "edge" && typeof WebSocket === "undefined") {
    // eslint-disable-next-line no-eval
    const nodeRequire = eval("require") as NodeRequire;
    neonConfig.webSocketConstructor = nodeRequire("ws");
  }
  // Route single-shot pool queries over Neon's HTTP fetch path instead of a
  // WebSocket. On the Cloudflare Pages edge, WebSocket-backed writes were
  // failing (reads worked), surfacing as HTML 500s in the UI; the fetch path
  // is the supported, reliable transport in the Workers runtime.
  neonConfig.poolQueryViaFetch = true;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  const client = globalForPrisma.prisma ?? createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

/**
 * Lazy Prisma client. The Neon `Pool` (and, on Node, the `ws` polyfill) is
 * constructed on first property access — NOT at module import. Routes and the
 * middleware bundle that import this module but don't touch the DB on a given
 * request therefore pay nothing at cold start, which keeps the Cloudflare Pages
 * edge Worker inside the free-tier CPU/memory budget (avoids the 1102 spike).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
