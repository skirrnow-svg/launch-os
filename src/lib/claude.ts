import { getOrgKey } from "./settings";
import { MissingKeyError } from "./errors";

/**
 * Claude API client — AI orchestration for asset briefs, copy, and the image/
 * video prompts that feed Higgsfield.
 *
 * The key is resolved per-org via getOrgKey() (admin-stored, encrypted), then
 * the process env fallback. Calls the Anthropic Messages API directly over
 * fetch (no SDK dependency). Set CLAUDE_MODEL to pin the model id.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Exact ids rotate — pin via CLAUDE_MODEL in the environment for production.
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";

export interface GenerateTextParams {
  /** Org whose stored CLAUDE_API_KEY should be used. */
  orgId: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

/** True if the org (or env) has a Claude key configured. */
export async function claudeConfigured(orgId: string): Promise<boolean> {
  return (await getOrgKey(orgId, "CLAUDE_API_KEY")) != null;
}

export async function generateText(params: GenerateTextParams): Promise<string> {
  const apiKey = await getOrgKey(params.orgId, "CLAUDE_API_KEY");
  if (!apiKey) throw new MissingKeyError("CLAUDE_API_KEY");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: params.model || DEFAULT_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      ...(params.system ? { system: params.system } : {}),
      messages: [{ role: "user", content: params.prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("")
    .trim();
}
