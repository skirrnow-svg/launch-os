import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";


/**
 * Admin integration settings.
 *
 * API keys are no longer used: copy generates on the Claude Code subscription
 * (`claude -p`) and media on the Higgsfield subscription — both via the runner.
 * This endpoint is kept so the Admin page renders, but stores nothing. (The
 * old encrypted integration_tokens path used node:crypto, which the edge
 * runtime can't bundle.)
 */
export async function GET() {
  const { org } = await getContext();
  return NextResponse.json({
    org: org.name,
    settings: {},
    note: "No API keys needed — generation runs on your Claude Code + Higgsfield subscriptions.",
  });
}

export async function PATCH() {
  return NextResponse.json(
    { error: "API keys are no longer used — generation runs on subscriptions." },
    { status: 400 },
  );
}
