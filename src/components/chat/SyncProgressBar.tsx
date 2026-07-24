import { useEffect, useState } from "react";
import { repo } from "@/lib/data";

/**
 * WhatsApp-style sync indicator. Only appears when the repository is
 * downloading a batch of new messages that arrived while the user was
 * offline. Stays hidden during normal realtime activity.
 */
export function SyncProgressBar() {
  const [state, setState] = useState(() => repo.getSyncState());

  useEffect(() => {
    const unsub = repo.subscribeSync((s) => setState(s));
    return () => {
      unsub();
    };
  }, []);

  if (state.phase !== "syncing" || state.total <= 0) return null;

  const pct = Math.min(100, Math.round((state.done / state.total) * 100));

  return (
    <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 animate-fade-in">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2 text-sm">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground">
              Sincronizando mensagens novas...
            </span>
            <span className="tabular-nums text-muted-foreground">
              {state.done} / {state.total} · {pct}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
