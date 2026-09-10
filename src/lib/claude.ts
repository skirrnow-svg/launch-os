import { spawn } from "child_process";
import { MissingKeyError } from "./errors";

/**
 * Claude text generation — driven by the local `claude` CLI in print mode
 * (`claude -p`), which uses the host's Claude Code SUBSCRIPTION auth. No
 * Anthropic API key and no per-token API billing: copy/briefs/prompts are
 * generated the same way media is (the `higgsfield` CLI). Mirrors the
 * generate-via-CLI pattern.
 *
 * Requires the `claude` CLI installed + logged in on the host. Runs where the
 * CLI lives (local/dev or a job-runner) — NOT on Cloudflare Pages; move to a
 * worker for production. Set CLAUDE_CODE_MODEL to pin the model (default sonnet).
 */

const BIN = "claude";
const DEFAULT_MODEL = process.env.CLAUDE_CODE_MODEL || "sonnet";
const TIMEOUT_MS = 120_000;

export interface GenerateTextParams {
  /** Kept for call-site compatibility; not needed by the CLI path. */
  orgId?: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

/** True if the `claude` CLI is available on the host. */
export async function claudeConfigured(): Promise<boolean> {
  try {
    await runClaude("Reply with: OK", { model: DEFAULT_MODEL, timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

export async function generateText(params: GenerateTextParams): Promise<string> {
  const full = params.system ? `${params.system}\n\n${params.prompt}` : params.prompt;
  return runClaude(full, { model: params.model || DEFAULT_MODEL });
}

/** Pipe the prompt to `claude -p` over stdin (avoids arg-quoting issues). */
function runClaude(
  prompt: string,
  opts: { model: string; timeout?: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--max-turns", "1", "--model", opts.model];
    // shell:true so the npm .cmd shim resolves on Windows.
    const child = spawn(BIN, args, { shell: true, windowsHide: true });

    let stdout = "";
    let stderr = "";
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error("Claude CLI timed out.")));
    }, opts.timeout ?? TIMEOUT_MS);

    child.on("error", (e) => {
      // CLI missing / not runnable → treated as "not configured" by callers.
      finish(() => reject(new MissingKeyError("CLAUDE_CODE_CLI")));
      void e;
    });
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      finish(() => {
        const text = stdout.trim();
        if (code === 0 && text) resolve(text);
        else reject(new Error(stderr.trim() || `Claude CLI exited ${code}.`));
      });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
