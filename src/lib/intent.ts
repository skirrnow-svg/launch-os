/**
 * Inbound-email intent classification (regex/keyword, edge-safe — no CLI).
 * Used by the inbound webhook to triage a prospect reply before the runner
 * does the deeper `claude -p` extraction.
 */
export type Intent = "INTERESTED" | "QUESTION" | "UNSUBSCRIBE";

const POSITIVE = [
  /\binterested\b/i,
  /\bsend (me )?samples?\b/i,
  /\bsamples?\b/i,
  /\bpricing\b/i,
  /\bquote\b/i,
  /\bsign ?up\b/i,
  /\bget started\b/i,
];
const UNSUB = [/\bunsubscribe\b/i, /\bopt[- ]?out\b/i, /\bremove me\b/i, /\bstop\b/i];

/** Classify a reply. Order: unsubscribe > positive interest > question. */
export function classifyIntent(subject: string, body: string): Intent {
  const text = `${subject}\n${body}`;
  if (UNSUB.some((re) => re.test(text))) return "UNSUBSCRIBE";
  if (POSITIVE.some((re) => re.test(text))) return "INTERESTED";
  return "QUESTION";
}
