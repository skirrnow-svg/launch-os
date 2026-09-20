"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Brand Studio (free wedge) — stamp any image with a brand overlay entirely in
 * the browser: no server round-trip, no AI credits. Upload an image, set the
 * brand name / tagline / color and an optional logo, and download the branded
 * PNG. Video branding (same overlay recipe, run on the server with ffmpeg) is
 * the next slice; the email + phone-OTP lead gate wraps the download once the
 * OTP provider is wired.
 */

const DEFAULT_COLOR = "#BEF264"; // SkirrNow lime

function useImageFromFile() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("");
  function load(file: File | null | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    setName(file.name);
  }
  return { img, name, load, clear: () => { setImg(null); setName(""); } };
}

const inputCls =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export default function BrandStudio() {
  const base = useImageFromFile();
  const logo = useImageFromFile();
  const [brandName, setBrandName] = useState("SkirrNow");
  const [tagline, setTagline] = useState("AI Agentic Marketing Platform");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Redraw whenever any input changes.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !base.img) return;
    const image = base.img;
    const maxW = 1280;
    const scale = Math.min(1, maxW / image.naturalWidth);
    const w = Math.max(1, Math.round(image.naturalWidth * scale));
    const h = Math.max(1, Math.round(image.naturalHeight * scale));
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0, w, h);

    const barH = Math.max(64, Math.round(h * 0.16));
    const barY = position === "top" ? 0 : h - barH;
    ctx.fillStyle = "rgba(10,12,16,0.5)";
    ctx.fillRect(0, barY, w, barH);

    ctx.fillStyle = color;
    ctx.fillRect(0, position === "top" ? barH - 4 : barY, w, 4);

    const padX = Math.round(w * 0.03);
    ctx.textBaseline = "alphabetic";
    if (brandName.trim()) {
      ctx.font = `700 ${Math.round(barH * 0.42)}px Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(brandName.trim(), padX, barY + Math.round(barH * (tagline.trim() ? 0.5 : 0.62)));
    }
    if (tagline.trim()) {
      ctx.font = `400 ${Math.round(barH * 0.22)}px Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(tagline.trim(), padX, barY + Math.round(barH * 0.82));
    }
    if (logo.img) {
      const lh = Math.round(h * 0.1);
      const lw = Math.round(lh * (logo.img.naturalWidth / logo.img.naturalHeight));
      const lx = w - lw - padX;
      const ly = position === "top" ? h - lh - Math.round(padX * 0.6) : Math.round(padX * 0.6);
      ctx.drawImage(logo.img, lx, ly, lw, lh);
    }
  }, [base.img, logo.img, brandName, tagline, color, position]);

  function download() {
    const cv = canvasRef.current;
    if (!cv || !base.img) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(brandName.trim() || "branded").replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* Controls */}
      <div className="space-y-4">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); base.load(e.dataTransfer.files?.[0]); }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center hover:border-accent"
        >
          <span className="text-sm font-semibold text-slate-700">
            {base.img ? "Change image" : "Drop an image, or click to upload"}
          </span>
          <span className="mt-0.5 text-[11px] text-slate-400">PNG, JPG or WEBP</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => base.load(e.target.files?.[0])} />
        </label>

        <div>
          <span className="text-xs font-semibold text-slate-600">Brand name</span>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-600">Tagline (optional)</span>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Your tagline" className={`mt-1 ${inputCls}`} />
        </div>

        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-600">Brand color</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
              <span className="font-mono text-xs text-slate-500">{color}</span>
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600">Brand bar</span>
            <div className="mt-1 flex gap-1">
              {(["bottom", "top"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPosition(p)}
                  className={`rounded border px-3 py-1.5 text-xs font-semibold capitalize ${position === p ? "border-accent bg-accent text-white" : "border-slate-300 bg-white text-slate-600 hover:border-accent"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:border-accent">
          <span className="font-semibold text-slate-700">{logo.img ? "Change logo" : "Add a logo (optional)"}</span>
          {logo.img && (
            <button type="button" onClick={(e) => { e.preventDefault(); logo.clear(); }} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => logo.load(e.target.files?.[0])} />
        </label>

        <button type="button" onClick={download} disabled={!base.img}
          className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
          Download branded image
        </button>

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Want more?</span> Save this brand kit once and it auto-applies
          across SkirrNow — plus brand your <b>videos</b> and generate full AI ads.{" "}
          <Link href="/get-started" className="font-semibold text-accent hover:underline">Create a free account →</Link>
        </div>
      </div>

      {/* Live preview */}
      <div className="min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">Live preview</div>
          {base.img ? (
            <canvas ref={canvasRef} className="h-auto w-full rounded-lg" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">
              Upload an image to see it branded here
            </div>
          )}
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Everything runs in your browser · no upload · no AI credits
        </p>
      </div>
    </div>
  );
}
