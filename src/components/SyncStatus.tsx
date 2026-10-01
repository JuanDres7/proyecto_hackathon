"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { startSyncWorker, syncPending } from "@/lib/sync";

export function SyncStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [queued, setQueued] = useState(0);
  const [last, setLast] = useState<string>("");

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
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(id);
      stop();
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`}
      />
      <span className="text-slate-300">
        {online ? "En línea" : "Offline"} · cola {queued}
      </span>
      <button
        type="button"
        className="rounded border border-white/20 px-2 py-0.5 text-slate-200 hover:bg-white/10"
        onClick={async () => {
          const result = await syncPending();
          setLast(`${result.synced} ok / ${result.failed} error`);
          setQueued(await db.outbox.count());
        }}
      >
        Sincronizar
      </button>
      {last ? <span className="text-slate-400">{last}</span> : null}
    </div>
  );
}
