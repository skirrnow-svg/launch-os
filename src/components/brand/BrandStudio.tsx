"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Brand Studio (free wedge) — stamp any IMAGE or VIDEO with a brand overlay,
 * entirely in the browser: no upload, no server, no AI credits.
 *
 * Both media share one overlay recipe (a lower/upper brand bar + accent line +
 * wordmark + tagline + optional logo):
 *   • Image → composited on a <canvas>, downloaded as PNG.
 *   • Video → the overlay is rendered to a transparent PNG (same canvas code),
 *     previewed live as a CSS layer over the <video>, then baked in on demand
 *     with ffmpeg.wasm (a simple `overlay` composite — no drawtext/freetype
 *     dependency) and downloaded as MP4.
 *
 * A brand-clean base + overlay also sidesteps Higgsfield's ip_detected filter.
 * The email + phone-OTP lead gate wraps the download once the OTP provider is
 * wired (SN77); today the tools are open so the wedge can be exercised.
 */

const DEFAULT_COLOR = "#BEF264"; // SkirrNow lime
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB
const MAX_VIDEO_SECONDS = 30;

type BrandOpts = {
  brandName: string;
  tagline: string;
  color: string;
  position: "bottom" | "top";
  logo: HTMLImageElement | null;
};

/** Draw the brand overlay (bar, accent, wordmark, tagline, logo) at w×h. */
function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, o: BrandOpts) {
  const barH = Math.max(64, Math.round(h * 0.16));
  const barY = o.position === "top" ? 0 : h - barH;
  ctx.fillStyle = "rgba(10,12,16,0.5)";
  ctx.fillRect(0, barY, w, barH);
  ctx.fillStyle = o.color;
  ctx.fillRect(0, o.position === "top" ? barH - 4 : barY, w, 4);

  const padX = Math.round(w * 0.03);
  ctx.textBaseline = "alphabetic";
  if (o.brandName.trim()) {
    ctx.font = `700 ${Math.round(barH * 0.42)}px Arial, sans-serif`;
    ctx.fillStyle = o.color;
    ctx.fillText(o.brandName.trim(), padX, barY + Math.round(barH * (o.tagline.trim() ? 0.5 : 0.62)));
  }
  if (o.tagline.trim()) {
    ctx.font = `400 ${Math.round(barH * 0.22)}px Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(o.tagline.trim(), padX, barY + Math.round(barH * 0.82));
  }
  if (o.logo) {
    const lh = Math.round(h * 0.1);
    const lw = Math.round(lh * (o.logo.naturalWidth / o.logo.naturalHeight));
    const lx = w - lw - padX;
    const ly = o.position === "top" ? h - lh - Math.round(padX * 0.6) : Math.round(padX * 0.6);
    ctx.drawImage(o.logo, lx, ly, lw, lh);
  }
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

export default function BrandStudio() {
  const logo = useImageFromFile();
  const [brandName, setBrandName] = useState("SkirrNow");
  const [tagline, setTagline] = useState("AI Agentic Marketing Platform");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");

  // Uploaded media.
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number; dur: number } | null>(null);
  const [err, setErr] = useState("");

  const [overlayUrl, setOverlayUrl] = useState(""); // transparent overlay PNG (video preview + ffmpeg)
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const opts: BrandOpts = { brandName, tagline, color, position, logo: logo.img };

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

  // Image preview: composite base image + overlay onto the visible canvas.
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
    drawOverlay(ctx, w, h, opts);
  }, [mediaType, imageEl, brandName, tagline, color, position, logo.img]);

  // Video: render the transparent overlay PNG at the video's native size.
  useEffect(() => {
    if (mediaType !== "video" || !videoDims) return;
    const cv = document.createElement("canvas");
    cv.width = videoDims.w; cv.height = videoDims.h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, videoDims.w, videoDims.h);
    drawOverlay(ctx, videoDims.w, videoDims.h, opts);
    setOverlayUrl(cv.toDataURL("image/png"));
  }, [mediaType, videoDims, brandName, tagline, color, position, logo.img]);

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
        "-i", inName,
        "-i", "ovl.png",
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto[v]",
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "out.mp4",
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

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* Controls */}
      <div className="space-y-4">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center hover:border-accent"
        >
          <span className="text-sm font-semibold text-slate-700">
            {mediaType ? "Change media" : "Drop an image or video, or click to upload"}
          </span>
          <span className="mt-0.5 text-[11px] text-slate-400">Image (PNG/JPG/WEBP) or video (MP4/WEBM/MOV, ≤60 MB, ≤30s)</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0])} />
        </label>
        {err && <p className="text-xs text-rose-600">{err}</p>}

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

        {mediaType === "video" ? (
          <div>
            <button type="button" onClick={brandVideo} disabled={busy}
              className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
              {busy ? `Branding video… ${pct}%` : "Brand & download video"}
            </button>
            {busy && <p className="mt-1 text-[11px] text-slate-400">Rendering in your browser — first run downloads the encoder (~30 MB), then a few seconds per second of video.</p>}
          </div>
        ) : (
          <button type="button" onClick={downloadImage} disabled={mediaType !== "image"}
            className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
            Download branded image
          </button>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Want more?</span> Save this brand kit once and it auto-applies
          across SkirrNow — plus generate full AI ads.{" "}
          <Link href="/get-started" className="font-semibold text-accent hover:underline">Create a free account →</Link>
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
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Everything runs in your browser · no upload · no AI credits
        </p>
      </div>
    </div>
  );
}
