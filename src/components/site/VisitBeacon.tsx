"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget visit ping for the free-tool funnel. Records one anonymous
 * visit per tool per day (throttled in localStorage) so the admin can see daily
 * reach. Uses a browser-generated id — no cookies, no PII. Renders nothing.
 */
export default function VisitBeacon({ path }: { path: string }) {
  useEffect(() => {
    try {
      let id = localStorage.getItem("sn_anon_id");
      if (!id) {
        id = (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("sn_anon_id", id);
      }
      const key = `sn_visit_${path}`;
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(key) === today) return; // already counted today
      localStorage.setItem(key, today);
      const body = JSON.stringify({ anonId: id, path });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/public/visit", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/public/visit", {
          method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true,
        }).catch(() => {});
      }
    } catch { /* private mode / blocked storage — skip silently */ }
  }, [path]);
  return null;
}
