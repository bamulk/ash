"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) in production. Skipped
 * in dev because Next/Turbopack's HMR fights with cached chunks; do
 * `npm run build && npm start` to test SW behavior locally.
 *
 * When a new SW version activates, we reload once so installed PWAs
 * pick up the new app shell without the user having to swipe-close
 * the app. Guarded by a session flag so we never loop.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // On first install there's no existing controller; a reload
        // here would just repeat the fresh render we already did.
        if (!navigator.serviceWorker.controller) return;
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Network blip or first-load race — the next visit retries.
      });

    const onControllerChange = () => {
      if (sessionStorage.getItem("ash:sw-reloaded") === "1") return;
      sessionStorage.setItem("ash:sw-reloaded", "1");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Belt-and-suspenders: the SW also posts a message on activate.
    // Honor it the same way, in case controllerchange misses.
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined;
      if (data?.type === "sw-updated") onControllerChange();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);
  return null;
}
