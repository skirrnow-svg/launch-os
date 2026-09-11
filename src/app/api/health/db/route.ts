import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "edge";

/**
 * TEMPORARY diagnostic — public (see middleware). Reproduces the exact edge
 * read + write that the UI performs, and returns any error as JSON so we can
 * see the real cause instead of an HTML 500. Remove once the edge DB path is
 * confirmed working.
 */
export async function GET() {
  const out: Record<string, unknown> = { runtime: "edge" };

  try {
    out.readCount = await prisma.social_posts.count();
    out.read = "ok";
  } catch (e) {
    out.read = "FAIL";
    out.readErr = e instanceof Error ? e.message : String(e);
  }

  try {
    const created = await prisma.social_posts.create({
      data: {
        project_id: "d076b869-4d6c-4eb5-bc84-5c111db47d47",
        created_by: "6ce3d62d-9592-4763-95d9-9d95bed78d93",
        content: "__healthcheck__",
        platforms: [],
        status: "draft",
      },
    });
    await prisma.social_posts.delete({ where: { id: created.id } });
    out.write = "ok";
  } catch (e) {
    out.write = "FAIL";
    out.writeErr = e instanceof Error ? e.message : String(e);
    out.writeName = e instanceof Error ? e.name : undefined;
  }

  return NextResponse.json(out);
}
