"use client";
import { useEffect } from "react";

// Registers the service worker in production only (it needs HTTPS, which
// Vercel provides). In `npm run dev` it stays off so it can't cache
// anything while you're developing.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
