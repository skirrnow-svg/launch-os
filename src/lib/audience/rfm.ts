/**
 * Customer Analytics & Audience agent — RFM segmentation + churn scoring.
 *
 * Pure, deterministic functions (no I/O), so they run anywhere and are easy to
 * test. The tenant provides a customer export (CSV); we compute Recency /
 * Frequency / Monetary quintile scores (1–5), map each customer to a standard
 * RFM segment, and derive a churn-risk score. No database, no external calls —
 * the "agent" here is the analysis itself.
 */

export type RawCustomer = {
  email: string;
  /** Days since the customer's last order (lower = more recent). */
  recencyDays: number;
  /** Number of orders / purchases. */
  frequency: number;
  /** Total spend / lifetime value. */
  monetary: number;
};

export type ScoredCustomer = RawCustomer & {
  r: number; // 1–5 (5 = most recent)
  f: number; // 1–5 (5 = most frequent)
  m: number; // 1–5 (5 = highest spend)
  segment: Segment;
  churnRisk: "Low" | "Medium" | "High";
  churnScore: number; // 0–100
};

export type Segment =
  | "Champions"
  | "Loyal"
  | "Potential Loyalist"
  | "New Customers"
  | "Needs Attention"
  | "At Risk"
  | "Can't Lose Them"
  | "About to Sleep"
  | "Hibernating"
  | "Lost";

export type RfmSummary = {
  total: number;
  totalMonetary: number;
  avgMonetary: number;
  segments: { segment: Segment; count: number; monetary: number; pct: number }[];
  churn: { Low: number; Medium: number; High: number };
  warnings: string[];
};

export type RfmResult = { customers: ScoredCustomer[]; summary: RfmSummary };

// ── CSV parsing ─────────────────────────────────────────────────────────────

/** Minimal CSV line splitter that honours double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const HEADER_ALIASES: Record<keyof RawCustomer | "lastOrderDate", string[]> = {
  email: ["email", "e-mail", "customer_email", "contact", "customer"],
  recencyDays: ["recency_days", "recency", "days_since_last_order", "days_since_order"],
  lastOrderDate: ["last_order_date", "last_order", "last_purchase", "last_purchase_date", "last_seen", "last_active"],
  frequency: ["frequency", "orders", "order_count", "num_orders", "purchases", "transactions", "count"],
  monetary: ["monetary", "spend", "total_spent", "total", "revenue", "ltv", "amount", "sales"],
};

function matchColumn(headers: string[], aliases: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  for (const alias of aliases) {
    const idx = norm.indexOf(alias);
    if (idx >= 0) return idx;
  }
  // loose contains-match fallback
  for (let i = 0; i < norm.length; i++) {
    if (aliases.some((a) => norm[i].includes(a))) return i;
  }
  return -1;
}

function toNumber(v: string): number {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function daysSince(dateStr: string, now: number): number {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return NaN;
  return Math.max(0, Math.round((now - t) / 86_400_000));
}

/** Parse a customer CSV into RawCustomers, collecting human-readable warnings. */
export function parseAudienceCsv(text: string, now = Date.now()): { rows: RawCustomer[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], warnings: ["Need a header row plus at least one customer row."] };
  }
  const headers = splitCsvLine(lines[0]);
  const col = {
    email: matchColumn(headers, HEADER_ALIASES.email),
    recencyDays: matchColumn(headers, HEADER_ALIASES.recencyDays),
    lastOrderDate: matchColumn(headers, HEADER_ALIASES.lastOrderDate),
    frequency: matchColumn(headers, HEADER_ALIASES.frequency),
    monetary: matchColumn(headers, HEADER_ALIASES.monetary),
  };
  if (col.email < 0) warnings.push("No 'email' column found — using row number as the id.");
  if (col.recencyDays < 0 && col.lastOrderDate < 0) warnings.push("No recency column (recency_days or last_order_date) — recency defaults to neutral.");
  if (col.frequency < 0) warnings.push("No frequency/orders column — frequency defaults to 1.");
  if (col.monetary < 0) warnings.push("No monetary/spend column — spend defaults to 0.");

  const rows: RawCustomer[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const email = col.email >= 0 ? cells[col.email] : `row-${i}`;
    if (!email) { skipped++; continue; }

    let recencyDays = NaN;
    if (col.recencyDays >= 0) recencyDays = toNumber(cells[col.recencyDays]);
    if (Number.isNaN(recencyDays) && col.lastOrderDate >= 0) recencyDays = daysSince(cells[col.lastOrderDate], now);

    const frequency = col.frequency >= 0 ? toNumber(cells[col.frequency]) : 1;
    const monetary = col.monetary >= 0 ? toNumber(cells[col.monetary]) : 0;

    rows.push({
      email,
      recencyDays: Number.isNaN(recencyDays) ? -1 : recencyDays, // -1 = unknown → neutral later
      frequency: Number.isNaN(frequency) ? 1 : Math.max(0, frequency),
      monetary: Number.isNaN(monetary) ? 0 : Math.max(0, monetary),
    });
  }
  if (skipped) warnings.push(`Skipped ${skipped} row(s) with no email.`);
  return { rows, warnings };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Assign a 1–5 quintile score to each value. `ascendingIsBetter=false` (recency)
 * flips it so the smallest values score highest. Uses rank position so ties and
 * skewed distributions still spread across buckets.
 */
function quintileScores(values: number[], ascendingIsBetter: boolean): number[] {
  const n = values.length;
  if (n === 0) return [];
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const rankScore = new Array<number>(n);
  order.forEach((entry, rank) => {
    // rank 0..n-1 → bucket 1..5 (higher rank = higher raw value)
    let bucket = Math.floor((rank / n) * 5) + 1;
    if (bucket > 5) bucket = 5;
    rankScore[entry.i] = ascendingIsBetter ? bucket : 6 - bucket;
  });
  return rankScore;
}

function segmentFor(r: number, f: number): Segment {
  if (r >= 4 && f >= 4) return "Champions";
  if (r >= 3 && f >= 3) return "Loyal";
  if (r >= 4 && f <= 1) return "New Customers";
  if (r >= 3 && f >= 1) return "Potential Loyalist";
  if (r === 3 && f === 3) return "Needs Attention";
  if (r <= 1 && f >= 4) return "Can't Lose Them";
  if (r <= 2 && f >= 3) return "At Risk";
  if (r === 2 && f <= 2) return "About to Sleep";
  if (r <= 1 && f <= 1) return "Lost";
  return "Hibernating";
}

function churnFor(r: number, f: number): { risk: ScoredCustomer["churnRisk"]; score: number } {
  // Recency dominates churn; frequency softens it.
  const score = Math.round(((5 - r) / 4) * 70 + ((5 - f) / 4) * 30);
  const risk = score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";
  return { risk, score };
}

const ALL_SEGMENTS: Segment[] = [
  "Champions", "Loyal", "Potential Loyalist", "New Customers", "Needs Attention",
  "At Risk", "Can't Lose Them", "About to Sleep", "Hibernating", "Lost",
];

export function analyzeRfm(rows: RawCustomer[], warnings: string[] = []): RfmResult {
  const n = rows.length;
  // Neutral recency (median-ish) for unknowns so they don't skew the quintiles.
  const known = rows.map((c) => c.recencyDays).filter((d) => d >= 0);
  const neutralRecency = known.length ? known.sort((a, b) => a - b)[Math.floor(known.length / 2)] : 30;
  const recency = rows.map((c) => (c.recencyDays >= 0 ? c.recencyDays : neutralRecency));

  const rScores = quintileScores(recency, false); // fewer days = better
  const fScores = quintileScores(rows.map((c) => c.frequency), true);
  const mScores = quintileScores(rows.map((c) => c.monetary), true);

  const customers: ScoredCustomer[] = rows.map((c, i) => {
    const r = rScores[i] ?? 3;
    const f = fScores[i] ?? 3;
    const m = mScores[i] ?? 3;
    const { risk, score } = churnFor(r, f);
    return { ...c, r, f, m, segment: segmentFor(r, f), churnRisk: risk, churnScore: score };
  });

  const totalMonetary = customers.reduce((s, c) => s + c.monetary, 0);
  const bySeg = new Map<Segment, { count: number; monetary: number }>();
  for (const s of ALL_SEGMENTS) bySeg.set(s, { count: 0, monetary: 0 });
  const churn = { Low: 0, Medium: 0, High: 0 };
  for (const c of customers) {
    const e = bySeg.get(c.segment)!;
    e.count++;
    e.monetary += c.monetary;
    churn[c.churnRisk]++;
  }

  const segments = ALL_SEGMENTS
    .map((segment) => {
      const e = bySeg.get(segment)!;
      return { segment, count: e.count, monetary: e.monetary, pct: n ? Math.round((e.count / n) * 100) : 0 };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    customers,
    summary: {
      total: n,
      totalMonetary,
      avgMonetary: n ? Math.round(totalMonetary / n) : 0,
      segments,
      churn,
      warnings,
    },
  };
}

/** Convenience: CSV text → full analysis. */
export function analyzeCsv(text: string, now = Date.now()): RfmResult {
  const { rows, warnings } = parseAudienceCsv(text, now);
  return analyzeRfm(rows, warnings);
}
