"use client";

import { FormEvent, useState } from "react";

type Fields = { name: string; email: string; company: string; metro: string; phone: string; message: string };
const EMPTY: Fields = { name: "", email: "", company: "", metro: "", phone: "", message: "" };

/** Public lead-capture form → POST /api/public/get-started → inbound pipeline. */
export default function GetStartedForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/public/get-started", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-xl text-accent">✓</div>
        <h2 className="text-xl font-bold text-slate-900">You&apos;re in the pipeline.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Thanks{f.name ? `, ${f.name.split(" ")[0]}` : ""} — our agency is qualifying your details now and
          preparing sample creative. We&apos;ll be in touch at <span className="font-medium">{f.email}</span>.
        </p>
      </div>
    );
  }

  const input =
    "w-full rounded border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const label = "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={submit} className="rounded border border-slate-200 bg-white p-6 sm:p-8">
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="gs-name">Your name</label>
          <input id="gs-name" className={input} value={f.name} onChange={set("name")} placeholder="Jane Doe" />
        </div>
        <div>
          <label className={label} htmlFor="gs-email">Work email *</label>
          <input id="gs-email" type="email" required className={input} value={f.email} onChange={set("email")} placeholder="jane@company.com" />
        </div>
        <div>
          <label className={label} htmlFor="gs-company">Company</label>
          <input id="gs-company" className={input} value={f.company} onChange={set("company")} placeholder="Apex Roofing" />
        </div>
        <div>
          <label className={label} htmlFor="gs-metro">Metro area</label>
          <input id="gs-metro" className={input} value={f.metro} onChange={set("metro")} placeholder="Austin, TX" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="gs-phone">Phone</label>
          <input id="gs-phone" className={input} value={f.phone} onChange={set("phone")} placeholder="+1 512 555 0148" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="gs-message">What do you sell? *</label>
          <textarea
            id="gs-message"
            required
            rows={4}
            className={input}
            value={f.message}
            onChange={set("message")}
            placeholder="Residential roof replacement and storm-damage repair. Interested in seeing sample ads."
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Request sample creative"}
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">
        By submitting you agree to be contacted. No spam — one reply with your samples.
      </p>
    </form>
  );
}
