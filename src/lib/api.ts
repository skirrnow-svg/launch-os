import { NextResponse } from "next/server";

/**
 * Wrap an API route handler so any thrown error becomes a JSON `{ error }`
 * 500 response instead of an HTML error page. Without this, an uncaught
 * exception on the edge returns HTML, which the client's `res.json()` chokes
 * on as: Unexpected token '<', "<!DOCTYPE"... is not valid JSON.
 */
export function withErrors<C>(
  fn: (req: Request, ctx: C) => Promise<Response>,
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Server error.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
