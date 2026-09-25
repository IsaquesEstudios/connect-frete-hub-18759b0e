import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

const opt = z.string().trim().max(2000).optional().nullable();

export type ChatLead = {
  id: string;
  kind: "motorista" | "carga";
  nome: string;
  whatsapp: string;
  origem: string | null;
  destino: string | null;
  tipo_veiculo: string | null;
  carroceria: string | null;
  peso: string | null;
  valor: string | null;
  material: string | null;
  forma_pagamento: string | null;
  info_extra: string | null;
  created_at: string;
};

async function requireStaff(serviceKey: string, fallbackToken?: string) {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : (fallbackToken ?? "");
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");
  const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) throw new Error("Sessão inválida. Faça login novamente.");
  const authUser = (await userRes.json()) as { id?: string };
  if (!authUser.id) throw new Error("Sessão inválida. Faça login novamente.");
  const profileRes = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=type,active&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const profiles = profileRes.ok ? ((await profileRes.json()) as { type: string; active: boolean | null }[]) : [];
  const profile = profiles[0];
  if (!profile || profile.active === false) throw new Error("Sua conta está desativada.");
  if (profile.type !== "admin" && profile.type !== "colaborador") throw new Error("Acesso restrito à equipe.");
}

const leadSchema = z.object({
  kind: z.enum(["motorista", "carga"]),
  nome: z.string().trim().min(2).max(200),
  whatsapp: z.string().trim().min(10).max(30),
  origem: opt,
  destino: opt,
  tipo_veiculo: opt,
  carroceria: opt,
  peso: opt,
  valor: opt,
  material: opt,
  forma_pagamento: opt,
  info_extra: opt,
});

export type ChatLeadInput = z.infer<typeof leadSchema>;

export const submitChatLead = createServerFn({ method: "POST" })
  .inputValidator(leadSchema)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return { ok: false, error: "Servidor não configurado." };
    try {
      const res = await fetch(`${EXT_SUPABASE_URL}/rest/v1/chat_leads`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error("chat_leads insert failed", res.status, await res.text().catch(() => ""));
        return { ok: false, error: "Não foi possível salvar agora. Tente novamente." };
      }
      return { ok: true };
    } catch (e) {
      console.error("chat_leads insert error", e);
      return { ok: false, error: "Falha de conexão. Tente novamente." };
    }
  });

export const listChatLeads = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ accessToken: z.string().optional(), kind: z.enum(["motorista", "carga"]).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<ChatLead[]> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Servidor não configurado.");
    await requireStaff(key, data.accessToken);
    const kindFilter = data.kind ? `&kind=eq.${data.kind}` : "";
    const res = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/chat_leads?select=*&order=created_at.desc&limit=2000${kindFilter}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error("Não foi possível carregar os contatos.");
    return (await res.json()) as ChatLead[];
  });

export const deleteChatLead = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid(), accessToken: z.string().optional() }).parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Servidor não configurado.");
    await requireStaff(key, data.accessToken);
    const res = await fetch(`${EXT_SUPABASE_URL}/rest/v1/chat_leads?id=eq.${data.id}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error("Não foi possível excluir.");
    return { ok: true };
  });
