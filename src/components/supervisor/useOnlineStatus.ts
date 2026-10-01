"use client";

import { useSyncExternalStore } from "react";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function onlineNow() {
  return navigator.onLine;
}

function onlineOnServer() {
  return true;
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribeOnline, onlineNow, onlineOnServer);
}
