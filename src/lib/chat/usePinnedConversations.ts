import { useCallback, useEffect, useState } from "react";

export const MAX_PINNED = 10;

function storageKey(scope: string) {
  return `sv:pinned-conversations:${scope}`;
}

function read(scope: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, MAX_PINNED) : [];
  } catch {
    return [];
  }
}

/** Pinned conversations persisted per logged-in user (frontend only). */
export function usePinnedConversations(scope: string) {
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    setPinned(read(scope));
  }, [scope]);

  const persist = useCallback(
    (next: string[]) => {
      setPinned(next);
      try {
        localStorage.setItem(storageKey(scope), JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [scope],
  );

  const isPinned = useCallback((id: string) => pinned.includes(id), [pinned]);

  const toggle = useCallback(
    (id: string): { ok: boolean; reason?: "limit" } => {
      if (pinned.includes(id)) {
        persist(pinned.filter((x) => x !== id));
        return { ok: true };
      }
      if (pinned.length >= MAX_PINNED) return { ok: false, reason: "limit" };
      persist([id, ...pinned]);
      return { ok: true };
    },
    [pinned, persist],
  );

  return { pinned, isPinned, toggle, max: MAX_PINNED };
}
