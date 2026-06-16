"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) in production. Skipped
 * in dev because Next/Turbopack's HMR fights with cached chunks; do
 * `npm run build && npm start` to test SW behavior locally.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Network blip or first-load race — the next visit retries.
      });
  }, []);
  return null;
}
