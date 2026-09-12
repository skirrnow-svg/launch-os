import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF-guarded landing-page scraper for the free Product-to-Ad generator.
 *
 * A visitor hands us an arbitrary URL, so we must NOT let the server fetch
 * internal resources. We only allow http/https, resolve the hostname and reject
 * any private / loopback / link-local address (including the cloud metadata IP),
 * re-validate on each redirect hop, cap the body size, and time out. The result
 * is a compact text summary (title, description, headings, visible copy) for the
 * copy model to work from.
 */
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;
const MAX_HOPS = 3;

export type ScrapeResult = { url: string; title: string; summary: string };

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true; // 10.0.0.0/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 169 && p[1] === 254) return true; // link-local + metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    return false;
  }
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true; // loopback / unspecified
  if (low.startsWith("fe80")) return true; // link-local
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
  if (low.startsWith("::ffff:")) return isBlockedIp(low.slice(7)); // v4-mapped
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That address isn't reachable.");
  }
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new Error("That address isn't reachable.");
  }
  const records = await dns.lookup(host, { all: true }).catch(() => {
    throw new Error("We couldn't resolve that website. Check the URL and try again.");
  });
  if (!records.length || records.some((r) => isBlockedIp(r.address))) {
    throw new Error("That address isn't reachable.");
  }
}

/** Normalize user input into an http(s) URL (default https, strip fragments). */
export function normalizeUrl(input: string): string {
  let raw = String(input || "").trim();
  if (!raw) throw new Error("Enter your website URL.");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }
  u.hash = "";
  return u.toString();
}

function extractText(html: string, url: string): { title: string; summary: string } {
  const pick = (re: RegExp) => (html.match(re)?.[1] || "").trim();
  const meta = (name: string) =>
    pick(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i")) ||
    pick(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, "i"));

  const title = pick(/<title[^>]*>([^<]*)<\/title>/i) || meta("og:title") || new URL(url).hostname;
  const description = meta("description") || meta("og:description") || "";

  const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12);

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2500);

  const summary = [
    title && `Title: ${title}`,
    description && `Description: ${description}`,
    headings.length && `Headings: ${headings.join(" | ")}`,
    body && `Page text: ${body}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { title, summary };
}

async function guardedFetch(startUrl: string): Promise<{ finalUrl: string; html: string }> {
  let current = startUrl;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const u = new URL(current);
    await assertPublicHost(u.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": "SkirrNowBot/1.0 (+https://skirrnow.app)", Accept: "text/html" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("We couldn't read that website.");
      current = new URL(loc, current).toString();
      continue; // re-validate the new host on the next loop
    }
    if (!res.ok) throw new Error("We couldn't read that website (it returned an error).");
    const buf = Buffer.from(await res.arrayBuffer());
    const html = buf.subarray(0, MAX_BYTES).toString("utf8");
    return { finalUrl: current, html };
  }
  throw new Error("That website redirected too many times.");
}

export async function scrapeSite(input: string): Promise<ScrapeResult> {
  const url = normalizeUrl(input);
  const { finalUrl, html } = await guardedFetch(url);
  const { title, summary } = extractText(html, finalUrl);
  if (summary.replace(/\s+/g, "").length < 40) {
    throw new Error("We couldn't read enough from that page. Try a different URL.");
  }
  return { url: finalUrl, title, summary };
}
