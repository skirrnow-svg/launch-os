/**
 * Claude API client (STUB) — AI orchestration for asset briefs, copy, and
 * prompt generation that feeds Higgsfield. Reads CLAUDE_API_KEY from the env.
 * TODO(phase-2): implement with @anthropic-ai/sdk (model: claude-opus-4-1 per
 * 00-PROJECT-HANDOFF.md; verify the current model id at build time).
 */

export interface GenerateTextParams {
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export async function generateText(_params: GenerateTextParams): Promise<string> {
  // TODO(phase-2): call Anthropic Messages API and return the text.
  throw new Error("TODO(phase-2): Claude generateText() not implemented");
}
