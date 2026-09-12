"use client";

import { useEffect, useRef, useState } from "react";

/**
 * White-label branding (agency feature). Set a brand name + accent color and
 * upload a logo; these render on the client-facing surfaces (reports header,
 * sidebar) so an agency presents the workspace as their own. Non-agency orgs
 * see an upsell — the differentiator the end-user tier doesn't get.
 */
type OrgInfo = {
  isAdmin: boolean;
  org: { name: string; accountType: string; brandName: string | null; brandColor: string | null; logoUrl: string | null };
};

const MAX_LOGO_BYTES = 400_000;

export default function BrandPage() {
  const [info, setInfo] = useState<OrgInfo | null>(null);
  const [brandName, setBrandName] = useState("");
  const [brandColor, setBrandColor] = useState("#BEF264");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/org").then((r) => r.json()).then((d: OrgInfo) => {
      if (!active) return;
      setInfo(d);
      setBrandName(d.org?.brandName || "");
      setBrandColor(d.org?.brandColor || "#BEF264");
      setLogoUrl(d.org?.logoUrl || null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml|gif)$/.test(file.type)) {
      setStatus("error"); setMessage("Upload a PNG, JPG, SVG or WebP image."); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (url.length > MAX_LOGO_BYTES) { setStatus("error"); setMessage("That logo is too large (max ~300KB)."); return; }
      setLogoUrl(url); setStatus("idle"); setMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setStatus("saving"); setMessage("");
    try {
      const res = await fetch("/api/org/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, brandColor, logoUrl: logoUrl ?? "", clearLogo: logoUrl === null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save branding.");
      setStatus("saved"); setMessage("Saved. Your branding now shows on reports and the sidebar.");
    } catch (err) {
      setStatus("error"); setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (!info) return <div className="max-w-xl text-slate-500">Loading…</div>;

  const allowed = info.org.accountType === "agency" || info.isAdmin;
  if (!allowed) {
    return (
      <div className="max-w-xl">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">White-label</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Brand this workspace as your own</h1>
        <div className="mt-6 rounded border border-slate-200 bg-white p-6">
          <p className="text-slate-600">
            White-label branding — your own logo, name and accent color on client-facing reports — is an
            <span className="font-semibold text-slate-900"> agency</span> feature. Your workspace is currently on the
            <span className="font-mono text-accent"> {info.org.accountType}</span> plan.
          </p>
          <p className="mt-3 text-sm text-slate-500">Ask an admin to switch your workspace to the agency plan to unlock it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">White-label</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Your brand</h1>
      <p className="mt-1 text-sm text-slate-500">
        Applied to client-facing surfaces — the reports header and the sidebar — so clients see your agency, not SkirrNow.
      </p>

      <div className="mt-6 grid gap-5 rounded border border-slate-200 bg-white p-6">
        {/* Logo */}
        <div className="grid gap-2">
          <span className="text-sm font-semibold text-slate-800">Logo</span>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded border border-slate-200 bg-slate-50">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo preview" className="max-h-full max-w-full" />
              ) : (
                <span className="font-mono text-[10px] uppercase text-slate-400">none</span>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                Upload logo
              </button>
              {logoUrl && (
                <button type="button" onClick={() => setLogoUrl(null)} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-slate-100">
                  Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" onChange={onFile} className="hidden" />
            </div>
          </div>
          <span className="text-xs text-slate-400">PNG, JPG, SVG or WebP · max ~300KB.</span>
        </div>

        {/* Brand name */}
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-800">Brand name</span>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Northbeam Agency"
            maxLength={80}
            className="rounded border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>

        {/* Brand color */}
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-800">Accent color</span>
          <div className="flex items-center gap-3">
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-transparent" aria-label="Accent color" />
            <input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#BEF264"
              className="w-32 rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <button onClick={save} disabled={status === "saving"} className="justify-self-start rounded bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50">
          {status === "saving" ? "Saving…" : "Save branding"}
        </button>
        {message && <p role="status" className={`text-sm ${status === "error" ? "text-danger" : "text-success"}`}>{message}</p>}
      </div>
    </div>
  );
}
