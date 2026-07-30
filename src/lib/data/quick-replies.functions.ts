import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/external-config";

export interface QuickReply {
  id: string;
  title: string;
  body: string;
}

function apiHeaders(key: string, bearer?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  const isNew = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else if (!isNew) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function requireUserId(): Promise<string> {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");
  const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: EXT_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) throw new Error("Sessão inválida.");
  const authUser = (await userRes.json()) as { id?: string };
  if (!authUser.id) throw new Error("Sessão inválida.");
  return authUser.id;
}

function settingKey(userId: string) {
  return `quick_replies:${userId}`;
}

function serviceKey(): string {
  const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Configuração do servidor incompleta.");
  return key;
}

export const listQuickReplies = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const res = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/app_settings?key=eq.${encodeURIComponent(settingKey(userId))}&select=value`,
    { headers: apiHeaders(serviceKey()) },
  );
  if (!res.ok) return { items: [] as QuickReply[] };
  const rows = (await res.json()) as Array<{ value?: string }>;
  try {
    const parsed = JSON.parse(rows[0]?.value ?? "[]") as QuickReply[];
    return { items: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { items: [] as QuickReply[] };
  }
});

export const saveQuickReplies = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        items: z
          .array(
            z.object({
              id: z.string().min(1),
              title: z.string().trim().min(1, "Informe um título").max(80),
              body: z.string().trim().min(1, "Informe a mensagem").max(4000),
            }),
          )
          .max(100),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const res = await fetch(`${EXT_SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        ...apiHeaders(serviceKey()),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ key: settingKey(userId), value: JSON.stringify(data.items) }]),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Não foi possível salvar. ${text}`.trim());
    }
    return { ok: true as const, items: data.items };
  });
