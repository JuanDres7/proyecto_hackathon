"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { startSyncWorker, syncPending } from "@/lib/sync";

export function SyncStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [queued, setQueued] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const stop = startSyncWorker();
    const tick = async () => {
      setQueued(await db.outbox.count());
    };
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(id);
      stop();
    };
  }, []);

  async function handleSync() {
    setIsSyncing(true);
    try {
      const result = await syncPending();
      setLastMessage(`${result.synced} ok`);
      setQueued(await db.outbox.count());
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container rounded-full border border-border-subtle text-xs">
        <span
          className={`w-2 h-2 rounded-full ${
            online ? "bg-status-online animate-pulse" : "bg-status-warning"
          }`}
        />
        <span className="font-mono text-[11px] text-text-secondary">
          {online ? "Edge Synced" : "Dexie Offline"}
        </span>
        {queued > 0 && (
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-status-warning/20 text-status-warning font-mono text-[10px] font-semibold">
            {queued} en cola
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={isSyncing}
        onClick={handleSync}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright border border-border-subtle text-text-primary text-xs font-mono transition-colors disabled:opacity-50"
        title="Forzar sincronización inmediata"
      >
        <span
          className={`material-symbols-outlined text-[14px] text-primary ${
            isSyncing ? "animate-spin" : ""
          }`}
        >
          sync
        </span>
        <span className="hidden sm:inline">Sync</span>
      </button>

      {lastMessage && (
        <span className="text-[11px] font-mono text-secondary hidden md:inline">
          {lastMessage}
        </span>
      )}
    </div>
  );
}
