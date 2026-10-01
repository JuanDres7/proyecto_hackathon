"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PwaRegister() {
  const { user } = useAuth();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "CAMPO_SYNC") {
        void import("@/lib/sync").then((m) => m.syncPending());
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!user || !("Notification" in window) || !("serviceWorker" in navigator)) return;
    void (async () => {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const keyRes = await fetch("/api/push", { credentials: "include" });
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    })().catch(() => undefined);
  }, [user]);

  return null;
}
