import { useEffect, useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { repo } from "@/lib/data";

/**
 * WhatsApp-style sync screen. Only appears when the repository is
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
  const remaining = Math.max(0, state.total - state.done);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageSquareText className="h-7 w-7" />
        </div>

        <h2 className="mt-4 text-base font-semibold text-foreground">
          Sincronizando mensagens
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixando as mensagens recebidas enquanto você esteve fora. Isso pode
          levar alguns instantes.
        </p>

        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {state.done} de {state.total}
          </span>
          <span>{pct}%</span>
        </div>

        {remaining > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {remaining} {remaining === 1 ? "mensagem restante" : "mensagens restantes"}
          </p>
        )}
      </div>
    </div>
  );
}
