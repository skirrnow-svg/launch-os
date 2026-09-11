import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withErrors } from "@/lib/api";

export const runtime = "edge";

/**
 * GET /api/leads — the inbound pipeline for the active org.
 *
 * Returns each lead with its provisioned client profile → project, and that
 * project's sample email campaigns + generated assets, so the pipeline UI can
 * render verification status and the sample creative in one payload.
 */
export const GET = withErrors<unknown>(async () => {
  const { org } = await getContext();
  const leads = await prisma.lead.findMany({
    where: { org_id: org.id },
    orderBy: { created_at: "desc" },
    include: {
      client_profile: {
        include: {
          project: {
            include: {
              email_campaigns: {
                orderBy: { created_at: "desc" },
                select: { id: true, name: true, subject: true, template_html: true, status: true },
              },
              assets: {
                where: { type: "video" },
                orderBy: { created_at: "desc" },
                select: { id: true, name: true, url: true, status: true, metadata: true },
              },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({ leads });
});
