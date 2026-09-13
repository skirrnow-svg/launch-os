"use client";

import { FormEvent, useState } from "react";
import { LEGAL } from "@/lib/legal";

/**
 * Contact form that composes a pre-filled email to the support address and
 * opens the visitor's mail client. No backend or stored inbox is required, so
 * it works reliably on any host with no secrets — a stored ticketing inbox is
 * a later enhancement.
 */
const TOPICS = [
  "General enquiry",
  "Product support",
  "Sales & plans",
  "Billing & refunds",
  "Privacy & data request",
  "Report abuse",
] as const;

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const subject = `[SkirrNow] ${topic}${name ? ` — ${name}` : ""}`;
    const body =
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Topic: ${topic}\n\n` +
      `${message}\n`;
    const href = `mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cf-name" className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Your name</label>
            <input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label htmlFor="cf-email" className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Your email</label>
            <input id="cf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
          </div>
        </div>
        <div>
          <label htmlFor="cf-topic" className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Topic</label>
          <select id="cf-topic" value={topic} onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none">
            {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cf-message" className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Message</label>
          <textarea id="cf-message" value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} maxLength={5000}
            placeholder="How can we help?"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!name.trim() || !email.trim() || !message.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
          Send message
        </button>
        <span className="text-xs text-slate-400">Opens your email app, pre-filled to {LEGAL.contactEmail}.</span>
      </div>
      {sent && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Your email app should have opened with the message ready to send. If it did not, email us directly at{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium underline">{LEGAL.contactEmail}</a>.
        </p>
      )}
    </form>
  );
}
