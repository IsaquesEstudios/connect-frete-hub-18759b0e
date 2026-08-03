import { useCallback, useEffect, useState } from "react";
import { listQuickReplies, saveQuickReplies, type QuickReply } from "@/lib/data/quick-replies.functions";

const LS_KEY = "quick_replies_cache";

// Ordena por título em ordem alfabética/numérica natural (1, 2, 10 e A, B, C).
function sortReplies(items: QuickReply[]): QuickReply[] {
  return [...items].sort((a, b) =>
    a.title.localeCompare(b.title, "pt-BR", { numeric: true, sensitivity: "base" }),
  );
}

function readCache(): QuickReply[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as QuickReply[]) : [];
    return Array.isArray(parsed) ? sortReplies(parsed) : [];
  } catch {
    return [];
  }
}

function writeCache(items: QuickReply[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("quick-replies-changed"));
}

export function useQuickReplies() {
  const [items, setItems] = useState<QuickReply[]>(() => readCache());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listQuickReplies()
      .then((res) => {
        if (cancelled) return;
        setItems(sortReplies(res.items));
        writeCache(sortReplies(res.items));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const onChanged = () => setItems(readCache());
    window.addEventListener("quick-replies-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("quick-replies-changed", onChanged);
    };
  }, []);

  const save = useCallback(async (next: QuickReply[]) => {
    const ordered = sortReplies(next);
    setItems(ordered);
    writeCache(ordered);
    await saveQuickReplies({ data: { items: ordered } });
  }, []);

  return { items, loading, save };
}

export type { QuickReply };
