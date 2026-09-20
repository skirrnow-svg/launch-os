"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Brand Studio (free wedge) — stamp any IMAGE or VIDEO with a brand overlay,
 * entirely in the browser: no upload, no server, no AI credits.
 *
 * One overlay recipe shared by both media (rendered on a <canvas>):
 *   • Bar layout   → full-width brand bar (top or bottom) with an accent line.
 *   • Corner layout→ a compact rounded brand block in any of the four corners.
 * Image → composited + downloaded as PNG. Video → the overlay is rendered to a
 * transparent PNG, previewed live as a CSS layer over the <video>, then baked in
 * with ffmpeg.wasm (a simple `overlay` composite) and downloaded as MP4.
 *
 * Downloads are gated by email verification (Resend); phone OTP is the next
 * factor once a provider is wired (SN77).
 */

const DEFAULT_COLOR = "#BEF264"; // SkirrNow lime
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;

type Layout = "bar-bottom" | "bar-top" | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br";
const LAYOUTS: { id: Layout; label: string }[] = [
  { id: "bar-bottom", label: "Bottom bar" },
  { id: "bar-top", label: "Top bar" },
  { id: "corner-tl", label: "Top-left" },
  { id: "corner-tr", label: "Top-right" },
  { id: "corner-bl", label: "Bottom-left" },
  { id: "corner-br", label: "Bottom-right" },
];

const FONTS: { label: string; css: string }[] = [
  { label: "Sans (Arial)", css: "Arial, sans-serif" },
  { label: "Display (Arial Black)", css: "'Arial Black', Impact, sans-serif" },
  { label: "Impact", css: "Impact, 'Arial Narrow', sans-serif" },
  { label: "Serif (Georgia)", css: "Georgia, serif" },
  { label: "Times", css: "'Times New Roman', serif" },
  { label: "Rounded (Trebuchet)", css: "'Trebuchet MS', sans-serif" },
  { label: "Mono (Courier)", css: "'Courier New', monospace" },
  { label: "Verdana", css: "Verdana, sans-serif" },
];

type LogoDraw = { src: CanvasImageSource; w: number; h: number };
type BrandOpts = {
  brandName: string;
  tagline: string;
  color: string;
  layout: Layout;
  nameFont: string;
  tagFont: string;
  logo: LogoDraw | null;
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw the brand overlay (bar or corner block) at w×h. */
function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, o: BrandOpts) {
  const pad = Math.round(w * 0.03);
  const name = o.brandName.trim();
  const tag = o.tagline.trim();

  if (o.layout === "bar-bottom" || o.layout === "bar-top") {
    const barH = Math.max(64, Math.round(h * 0.16));
    const top = o.layout === "bar-top";
    const barY = top ? 0 : h - barH;
    ctx.fillStyle = "rgba(10,12,16,0.5)";
    ctx.fillRect(0, barY, w, barH);
    ctx.fillStyle = o.color;
    ctx.fillRect(0, top ? barH - 4 : barY, w, 4);
    ctx.textBaseline = "alphabetic";
    if (name) {
      ctx.font = `700 ${Math.round(barH * 0.42)}px ${o.nameFont}`;
      ctx.fillStyle = o.color;
      ctx.fillText(name, pad, barY + Math.round(barH * (tag ? 0.5 : 0.62)));
    }
    if (tag) {
      ctx.font = `400 ${Math.round(barH * 0.22)}px ${o.tagFont}`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(tag, pad, barY + Math.round(barH * 0.82));
    }
    if (o.logo) {
      const lh = Math.round(h * 0.1);
      const lw = Math.round(lh * (o.logo.w / o.logo.h));
      ctx.drawImage(o.logo.src, w - lw - pad, top ? h - lh - Math.round(pad * 0.6) : Math.round(pad * 0.6), lw, lh);
    }
    return;
  }

  // Corner block.
  const nameSize = Math.round(h * 0.058);
  const tagSize = Math.round(h * 0.032);
  const gap = Math.round(h * 0.013);
  const inner = Math.round(h * 0.024);
  const stripe = Math.max(3, Math.round(w * 0.006));
  const logoH = o.logo ? Math.round(h * 0.11) : 0;
  const logoW = o.logo ? Math.round(logoH * (o.logo.w / o.logo.h)) : 0;

  ctx.font = `700 ${nameSize}px ${o.nameFont}`;
  const nameW = name ? ctx.measureText(name).width : 0;
  ctx.font = `400 ${tagSize}px ${o.tagFont}`;
  const tagW = tag ? ctx.measureText(tag).width : 0;

  const contentW = Math.max(nameW, tagW, logoW);
  const boxW = Math.round(contentW + inner * 2 + stripe);
  const textH = (name ? nameSize : 0) + (name && tag ? gap : 0) + (tag ? tagSize : 0);
  const boxH = Math.round((logoH ? logoH + gap : 0) + textH + inner * 2);

  const left = o.layout === "corner-tl" || o.layout === "corner-bl";
  const topC = o.layout === "corner-tl" || o.layout === "corner-tr";
  const bx = left ? pad : w - boxW - pad;
  const by = topC ? pad : h - boxH - pad;
  const r = Math.round(h * 0.016);

  roundRectPath(ctx, bx, by, boxW, boxH, r);
  ctx.fillStyle = "rgba(10,12,16,0.55)";
  ctx.fill();
  roundRectPath(ctx, bx, by, stripe + r, boxH, r);
  ctx.fillStyle = o.color;
  ctx.save();
  roundRectPath(ctx, bx, by, boxW, boxH, r);
  ctx.clip();
  ctx.fillRect(bx, by, stripe, boxH);
  ctx.restore();

  const cx = bx + inner + stripe;
  let cy = by + inner;
  ctx.textBaseline = "top";
  if (o.logo) { ctx.drawImage(o.logo.src, cx, cy, logoW, logoH); cy += logoH + gap; }
  if (name) { ctx.font = `700 ${nameSize}px ${o.nameFont}`; ctx.fillStyle = o.color; ctx.fillText(name, cx, cy); cy += nameSize + gap; }
  if (tag) { ctx.font = `400 ${tagSize}px ${o.tagFont}`; ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillText(tag, cx, cy); }
}

/** Color-key a logo's background (sampled from its top-left pixel) to alpha. */
function keyOutLogoBackground(img: HTMLImageElement): LogoDraw {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  ctx.drawImage(img, 0, 0);
  try {
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const kr = d[0], kg = d[1], kb = d[2];
    const tol = 52 * 52 * 3;
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb;
      if (dr * dr + dg * dg + db * db < tol) d[i + 3] = 0;
    }
    ctx.putImageData(id, 0, 0);
  } catch { /* tainted canvas — leave as-is */ }
  return { src: c, w: c.width, h: c.height };
}

function useImageFromFile() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  function load(file: File | null | undefined) {
    if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type)) return;
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = URL.createObjectURL(file);
  }
  return { img, load, clear: () => setImg(null) };
}

const inputCls =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export default function BrandStudio({ isSignedIn }: { isSignedIn: boolean }) {
  const logo = useImageFromFile();
  const [brandName, setBrandName] = useState("SkirrNow");
  const [tagline, setTagline] = useState("AI Agentic Marketing Platform");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [layout, setLayout] = useState<Layout>("bar-bottom");
  const [nameFont, setNameFont] = useState(FONTS[0].css);
  const [tagFont, setTagFont] = useState(FONTS[0].css);
  const [logoTransparent, setLogoTransparent] = useState(false);
  const [logoDraw, setLogoDraw] = useState<LogoDraw | null>(null);

  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number; dur: number } | null>(null);
  const [err, setErr] = useState("");

  const [overlayUrl, setOverlayUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  // Ladder: signed out → verify email (pin) → 1 free download per email; a 2nd
  // needs a free account (no card); signed in → unlimited.
  const [needSignup, setNeedSignup] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false); // signed-in, AI tokens exhausted
  const [freeUsed, setFreeUsed] = useState(false); // this browser already claimed its 1 free
  const [gate, setGate] = useState<"closed" | "email" | "code">("closed");
  const [gEmail, setGEmail] = useState("");
  const [gCode, setGCode] = useState("");
  const [gToken, setGToken] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const [gErr, setGErr] = useState("");
  const pendingRef = useRef<"image" | "video" | null>(null);
  useEffect(() => { try { setFreeUsed(Boolean(localStorage.getItem("sn_brand_free_used"))); } catch { /* private mode */ } }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Prepare the logo to draw (optionally with its background keyed out).
  useEffect(() => {
    if (!logo.img) { setLogoDraw(null); return; }
    setLogoDraw(logoTransparent
      ? keyOutLogoBackground(logo.img)
      : { src: logo.img, w: logo.img.naturalWidth, h: logo.img.naturalHeight });
  }, [logo.img, logoTransparent]);

  function loadFile(file: File | null | undefined) {
    setErr("");
    if (!file) return;
    if (/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      const image = new Image();
      image.onload = () => { setImageEl(image); setMediaType("image"); setVideoUrl(""); setVideoFile(null); setVideoDims(null); };
      image.src = URL.createObjectURL(file);
    } else if (/^video\/(mp4|webm|quicktime)$/.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name)) {
      if (file.size > MAX_VIDEO_BYTES) { setErr("Video is too large — keep it under 60 MB."); return; }
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        if (v.duration > MAX_VIDEO_SECONDS + 0.5) { setErr(`Video is too long — keep it under ${MAX_VIDEO_SECONDS}s.`); URL.revokeObjectURL(url); return; }
        setVideoDims({ w: v.videoWidth, h: v.videoHeight, dur: v.duration });
        setVideoUrl(url); setVideoFile(file); setMediaType("video"); setImageEl(null);
      };
      v.src = url;
    } else {
      setErr("Use an image (PNG/JPG/WEBP) or a video (MP4/WEBM/MOV).");
    }
  }

  // Image preview: base image + overlay onto the visible canvas.
  useEffect(() => {
    if (mediaType !== "image" || !imageEl) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const scale = Math.min(1, 1280 / imageEl.naturalWidth);
    const w = Math.max(1, Math.round(imageEl.naturalWidth * scale));
    const h = Math.max(1, Math.round(imageEl.naturalHeight * scale));
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imageEl, 0, 0, w, h);
    drawOverlay(ctx, w, h, { brandName, tagline, color, layout, nameFont, tagFont, logo: logoDraw });
  }, [mediaType, imageEl, brandName, tagline, color, layout, nameFont, tagFont, logoDraw]);

  // Video: transparent overlay PNG at native size (for live preview + ffmpeg).
  useEffect(() => {
    if (mediaType !== "video" || !videoDims) return;
    const cv = document.createElement("canvas");
    cv.width = videoDims.w; cv.height = videoDims.h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, videoDims.w, videoDims.h);
    drawOverlay(ctx, videoDims.w, videoDims.h, { brandName, tagline, color, layout, nameFont, tagFont, logo: logoDraw });
    setOverlayUrl(cv.toDataURL("image/png"));
  }, [mediaType, videoDims, brandName, tagline, color, layout, nameFont, tagFont, logoDraw]);

  function downloadImage() {
    const cv = canvasRef.current;
    if (!cv || !imageEl) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(brandName.trim() || "branded").replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  const brandVideo = useCallback(async () => {
    if (!videoFile || !videoDims || !overlayUrl) return;
    setErr(""); setBusy(true); setPct(0);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => setPct(Math.min(99, Math.round(progress * 100))));
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      const inName = /\.webm$/i.test(videoFile.name) ? "in.webm" : "in.mp4";
      await ffmpeg.writeFile(inName, await fetchFile(videoFile));
      await ffmpeg.writeFile("ovl.png", await fetchFile(overlayUrl));
      await ffmpeg.exec([
        "-i", inName, "-i", "ovl.png",
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto[v]",
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "out.mp4",
      ]);
      const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
      const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(brandName.trim() || "branded").replace(/\s+/g, "-").toLowerCase()}.mp4`;
      a.click();
      setPct(100);
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      setErr(e instanceof Error ? `Could not brand the video: ${e.message}` : "Could not brand the video.");
    } finally {
      setBusy(false);
    }
  }, [videoFile, videoDims, overlayUrl, brandName]);

  function runPending() {
    const k = pendingRef.current;
    pendingRef.current = null;
    if (k === "image") downloadImage();
    else if (k === "video") void brandVideo();
  }
  async function requestDownload(kind: "image" | "video") {
    pendingRef.current = kind;
    if (isSignedIn) {
      // Meter the creation against the account's AI-token allowance.
      setNeedsUpgrade(false);
      try {
        const r = await fetch("/api/brand/meter", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media: kind }),
        });
        if (r.status === 402) { setNeedsUpgrade(true); return; } // out of tokens → upgrade
      } catch { /* fail open — never block a creation on a metering hiccup */ }
      runPending();
      return;
    }
    if (freeUsed) { setNeedSignup(true); return; }      // used the 1 free → sign up for more
    setGErr(""); setNeedSignup(false); setGate("email"); // otherwise verify email for the 1 free
  }
  async function sendGateCode() {
    setGErr("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gEmail.trim())) { setGErr("Enter a valid email address."); return; }
    setGBusy(true);
    try {
      const r = await fetch("/api/public/free/code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: gEmail.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not send the code.");
      setGToken(d.token); setGate("code");
    } catch (e) { setGErr(e instanceof Error ? e.message : "Could not send the code."); }
    finally { setGBusy(false); }
  }
  async function verifyGate() {
    setGErr(""); setGBusy(true);
    try {
      const r = await fetch("/api/public/brand/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: gEmail.trim(), code: gCode.trim(), token: gToken, media: pendingRef.current ?? "image" }),
      });
      const d = await r.json();
      // Email verified but this address already used its 1 free → sign up for more.
      if (r.status === 403 && d.needsSignup) {
        try { localStorage.setItem("sn_brand_free_used", gEmail.trim().toLowerCase()); } catch { /* private mode */ }
        setFreeUsed(true); setGate("closed"); setNeedSignup(true);
        return;
      }
      if (!r.ok) throw new Error(d.error || "That code is incorrect or has expired.");
      // 1 free download granted for this email.
      try { localStorage.setItem("sn_brand_free_used", gEmail.trim().toLowerCase()); } catch { /* private mode */ }
      setFreeUsed(true); setGate("closed");
      runPending();
    } catch (e) { setGErr(e instanceof Error ? e.message : "That code is incorrect."); }
    finally { setGBusy(false); }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* Controls */}
      <div className="space-y-4">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center hover:border-accent"
        >
          <span className="text-sm font-semibold text-slate-700">{mediaType ? "Change media" : "Drop an image or video, or click to upload"}</span>
          <span className="mt-0.5 text-[11px] text-slate-400">Image (PNG/JPG/WEBP) or video (MP4/WEBM/MOV, ≤60 MB, ≤30s)</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
        </label>
        {err && <p className="text-xs text-rose-600">{err}</p>}

        <div>
          <span className="text-xs font-semibold text-slate-600">Brand name</span>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand" className={`mt-1 ${inputCls}`} />
          <select value={nameFont} onChange={(e) => setNameFont(e.target.value)} className={`mt-1 ${inputCls}`} aria-label="Brand name font">
            {FONTS.map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-600">Tagline (optional)</span>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Your tagline" className={`mt-1 ${inputCls}`} />
          <select value={tagFont} onChange={(e) => setTagFont(e.target.value)} className={`mt-1 ${inputCls}`} aria-label="Tagline font">
            {FONTS.map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}
          </select>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-600">Brand color</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
            <span className="font-mono text-xs text-slate-500">{color}</span>
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-600">Placement</span>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" onClick={() => setLayout(l.id)}
                className={`rounded border px-2 py-1.5 text-[11px] font-semibold transition-colors ${layout === l.id ? "border-accent bg-accent text-white" : "border-slate-300 bg-white text-slate-600 hover:border-accent"}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-300 bg-white p-3">
          <label className="flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">{logo.img ? "Change logo" : "Add a logo (optional)"}</span>
            {logo.img && <button type="button" onClick={(e) => { e.preventDefault(); logo.clear(); }} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button>}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => logo.load(e.target.files?.[0])} />
          </label>
          {logo.img && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={logoTransparent} onChange={(e) => setLogoTransparent(e.target.checked)} />
              Make logo background transparent (removes a solid backdrop)
            </label>
          )}
        </div>

        {mediaType === "video" ? (
          <div>
            <button type="button" onClick={() => requestDownload("video")} disabled={busy}
              className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
              {busy ? `Branding video… ${pct}%` : "Brand & download video"}
            </button>
            {busy && <p className="mt-1 text-[11px] text-slate-400">Rendering in your browser — first run downloads the encoder (~30 MB), then a few seconds per second of video.</p>}
          </div>
        ) : (
          <button type="button" onClick={() => requestDownload("image")} disabled={mediaType !== "image"}
            className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
            Download branded image
          </button>
        )}

        {gate !== "closed" && (
          <div className="rounded-lg border border-accent bg-accent/5 p-4">
            <div className="text-sm font-semibold text-slate-900">Verify your email for your free branded download</div>
            {gate === "email" ? (
              <div className="mt-2 space-y-2">
                <input type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
                <div className="flex gap-2">
                  <button type="button" onClick={sendGateCode} disabled={gBusy} className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40">{gBusy ? "Sending…" : "Email me a code"}</button>
                  <button type="button" onClick={() => setGate("closed")} className="px-3 py-2 text-sm font-semibold text-slate-500 hover:underline">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-500">We emailed a 6-digit code to <b>{gEmail}</b>.</p>
                <input inputMode="numeric" value={gCode} onChange={(e) => setGCode(e.target.value)} placeholder="123456" className={inputCls} />
                <div className="flex gap-2">
                  <button type="button" onClick={verifyGate} disabled={gBusy} className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40">{gBusy ? "Verifying…" : "Verify & download"}</button>
                  <button type="button" onClick={() => setGate("email")} className="px-3 py-2 text-sm font-semibold text-slate-500 hover:underline">Change email</button>
                </div>
              </div>
            )}
            {gErr && <p className="mt-2 text-xs text-rose-600">{gErr}</p>}
            <p className="mt-2 text-[11px] text-slate-400">1 free branded download, no account needed. Sign up (no card) for unlimited.</p>
          </div>
        )}
        {needSignup && !isSignedIn && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-slate-900">You&apos;ve used your free branded download 🎉</div>
            <p className="mt-1 text-xs text-slate-600">
              Create a free account (no credit card) to brand <span className="font-medium text-slate-800">unlimited</span> images
              and videos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/sign-up?redirect_url=/brand-studio" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">Sign up free →</Link>
              <Link href="/sign-in?redirect_url=/brand-studio" className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">I have an account</Link>
            </div>
          </div>
        )}
        {needsUpgrade && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-slate-900">You&apos;re out of SkirrNow AI tokens</div>
            <p className="mt-1 text-xs text-slate-600">
              Each branded creation draws from your monthly AI-token allowance, and it&apos;s used up for this cycle.
              Upgrade to keep creating, or wait for your next reset.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/#pricing" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover">See paid plans →</Link>
              <Link href="/dashboard/usage" className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">View my usage</Link>
            </div>
          </div>
        )}
        {isSignedIn && !needsUpgrade && <p className="text-[11px] font-semibold text-emerald-700">✓ Signed in — each creation draws from your SkirrNow AI tokens</p>}

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Want more?</span> Save this brand kit once and it auto-applies
          across SkirrNow — plus generate full AI ads.{" "}
          <Link href="/get-started" className="font-semibold text-accent hover:underline">See what a free account unlocks →</Link>
        </div>
      </div>

      {/* Live preview */}
      <div className="min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">Live preview</div>
          {mediaType === "image" && <canvas ref={canvasRef} className="h-auto w-full rounded-lg" />}
          {mediaType === "video" && (
            <div className="relative overflow-hidden rounded-lg">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={videoUrl} controls loop muted playsInline className="block h-auto w-full" />
              {overlayUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={overlayUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
              )}
            </div>
          )}
          {!mediaType && (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-center text-sm text-slate-400">
              Upload an image or video to see it branded here
            </div>
          )}
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">Everything runs in your browser · no upload · no AI credits</p>
      </div>
    </div>
  );
}
