/**
 * Brand Studio draft persistence.
 *
 * When a signed-out visitor has done their branding and clicks Download, we
 * save their work here, send them to sign up, and restore it when they return
 * signed in — so nothing is lost across the auth redirect. Settings (small) go
 * in localStorage; the uploaded media + logo (large, e.g. a 60 MB video) go in
 * IndexedDB, which is origin-scoped and survives the navigation. Everything is
 * best-effort and wrapped in try/catch so private mode or blocked storage never
 * breaks the tool.
 */

export type BrandDraft = {
  brandName: string;
  tagline: string;
  color: string;
  layout: string;
  nameFont: string;
  tagFont: string;
  logoTransparent: boolean;
  pending: "image" | "video" | null;
  mediaName?: string;
  mediaMime?: string;
  logoName?: string;
  logoMime?: string;
  savedAt: number;
};

const SETTINGS_KEY = "sn_brand_draft_v1";
const DB_NAME = "sn_brand";
const STORE = "files";
const TTL_MS = 60 * 60 * 1000; // ignore drafts older than an hour

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  const out = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as Blob | undefined);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return out;
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export async function saveDraft(
  draft: Omit<BrandDraft, "savedAt" | "mediaName" | "mediaMime" | "logoName" | "logoMime">,
  media: File | null,
  logo: File | null,
): Promise<void> {
  const meta: BrandDraft = {
    ...draft,
    savedAt: Date.now(),
    mediaName: media?.name,
    mediaMime: media?.type,
    logoName: logo?.name,
    logoMime: logo?.type,
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(meta)); } catch { /* private mode */ }
  try {
    if (media) await idbPut("media", media); else await idbDel("media");
    if (logo) await idbPut("logo", logo); else await idbDel("logo");
  } catch { /* storage blocked — settings alone still restore */ }
}

export async function loadDraft(): Promise<
  { draft: BrandDraft; media?: File; logo?: File } | null
> {
  let draft: BrandDraft;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    draft = JSON.parse(raw) as BrandDraft;
  } catch {
    return null;
  }
  if (!draft || typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > TTL_MS) {
    await clearDraft();
    return null;
  }
  let media: File | undefined;
  let logo: File | undefined;
  try {
    const mb = await idbGet("media");
    if (mb) media = new File([mb], draft.mediaName || "upload", { type: draft.mediaMime || mb.type });
    const lb = await idbGet("logo");
    if (lb) logo = new File([lb], draft.logoName || "logo", { type: draft.logoMime || lb.type });
  } catch { /* files gone — settings still restore */ }
  return { draft, media, logo };
}

export async function clearDraft(): Promise<void> {
  try { localStorage.removeItem(SETTINGS_KEY); } catch { /* private mode */ }
  try { await idbDel("media"); await idbDel("logo"); } catch { /* ignore */ }
}
