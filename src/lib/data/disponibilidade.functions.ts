import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/external-config";

export type DisponibilidadeKind = "motorista" | "frete";

export interface DisponibilidadeItem {
  id: string;
  kind: DisponibilidadeKind;
  title: string;
  lines: string[];
  createdAt: number;
}

const SETTING_KEY = "disponibilidades";

function apiHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  const isNew = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  if (!isNew) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function serviceKey(): string {
  const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Configuração do servidor incompleta.");
  return key;
}

async function requireStaffId(): Promise<string> {
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
  const profRes = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${authUser.id}&select=type`,
    { headers: apiHeaders(serviceKey()) },
  );
  const rows = profRes.ok ? ((await profRes.json()) as Array<{ type?: string }>) : [];
  const type = rows[0]?.type;
  if (type !== "admin" && type !== "colaborador") {
    throw new Error("Apenas a equipe pode editar as disponibilidades.");
  }
  return authUser.id;
}

export const listDisponibilidades = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/app_settings?key=eq.${SETTING_KEY}&select=value`,
    { headers: apiHeaders(serviceKey()) },
  );
  if (!res.ok) return { items: [] as DisponibilidadeItem[] };
  const rows = (await res.json()) as Array<{ value?: string }>;
  try {
    const parsed = JSON.parse(rows[0]?.value ?? "[]") as DisponibilidadeItem[];
    return { items: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { items: [] as DisponibilidadeItem[] };
  }
});

export const saveDisponibilidades = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        items: z
          .array(
            z.object({
              id: z.string().min(1),
              kind: z.enum(["motorista", "frete"]),
              title: z.string().trim().min(1).max(200),
              lines: z.array(z.string().trim().max(1000)).max(1000),
              createdAt: z.number(),
            }),
          )
          .max(300),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireStaffId();
    const res = await fetch(`${EXT_SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        ...apiHeaders(serviceKey()),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ key: SETTING_KEY, value: JSON.stringify(data.items) }]),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Não foi possível salvar. ${text}`.trim());
    }
    return { ok: true as const, items: data.items };
  });
