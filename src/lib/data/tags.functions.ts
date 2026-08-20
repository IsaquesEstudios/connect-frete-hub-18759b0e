import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

// As tabelas conversation_tags e broadcast_messages ficam no banco externo com
// RLS restrita (private.is_staff), que não libera leitura/escrita pelo cliente.
// Estas server functions validam a sessão (somente admin/colaborador) e usam a
// chave de serviço para ler e gravar as etiquetas e o histórico de envios.

type StaffProfile = { id: string; type: string; active: boolean | null };

export type BroadcastRecord = {
  id: string;
  body: string;
  audience: string;
  tag_id: string | null;
  sent_at: string;
  recipient_count: number;
};

function apiHeaders(key: string, bearer?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else if (!isOpaque) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `Erro ${res.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string; details?: string; hint?: string };
    return [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(" ");
  } catch {
    return text;
  }
}

function serviceKey(): string {
  const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Configuração do servidor ausente: EXT_SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

async function requireStaff(key: string, fallbackToken?: string): Promise<StaffProfile> {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  // O header pode não chegar (middleware do cliente falhou ou token renovado
  // no meio da requisição); nesse caso usamos o token enviado no payload.
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : (fallbackToken ?? "");
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");

  const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, { headers: apiHeaders(key, token) });
  if (!userRes.ok) throw new Error("Sessão inválida. Faça login novamente.");
  const authUser = (await userRes.json()) as { id?: string };
  if (!authUser.id) throw new Error("Sessão inválida. Faça login novamente.");

  const res = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,type,active`,
    { headers: apiHeaders(key) },
  );
  if (!res.ok) throw new Error(`Não foi possível validar seu perfil. ${await readError(res)}`.trim());
  const profile = ((await res.json()) as StaffProfile[])[0];
  if (!profile) throw new Error("Perfil do usuário não encontrado.");
  if (profile.active === false) throw new Error("Sua conta está desativada.");
  if (profile.type !== "admin" && profile.type !== "colaborador") {
    throw new Error("Apenas equipe administrativa pode gerenciar etiquetas.");
  }
  return profile;
}

export const listStaffTagData = createServerFn({ method: "GET" }).handler(async () => {
  const empty = { convTags: [] as Array<{ conversationId: string; tagId: string }>, broadcasts: [] as BroadcastRecord[] };
  const key = serviceKey();
  // Leitura opcional: sem sessão válida ou sem permissão de equipe apenas
  // devolvemos vazio — lançar aqui derruba a página com erro de runtime.
  try {
    await requireStaff(key);
  } catch {
    return empty;
  }


  // select=* + 500 linhas com corpo pesado (imagens em base64) estourava o
  // statement timeout do Postgres. Pedimos só as colunas usadas e menos linhas,
  // e o histórico é opcional: se falhar, a página continua funcionando.
  const [tagsRes, broadcastRes] = await Promise.all([
    fetch(`${EXT_SUPABASE_URL}/rest/v1/conversation_tags?select=conversation_id,tag_id`, {
      headers: apiHeaders(key),
    }),
    fetch(
      `${EXT_SUPABASE_URL}/rest/v1/broadcast_messages?select=id,body,audience,tag_id,sent_at,recipient_count&order=sent_at.desc&limit=100`,
      { headers: apiHeaders(key) },
    ).catch(() => null),
  ]);
  if (!tagsRes.ok) throw new Error(`Não foi possível carregar as etiquetas. ${await readError(tagsRes)}`.trim());

  const convTags = (await tagsRes.json()) as Array<{ conversation_id: string; tag_id: string }>;
  const broadcasts =
    broadcastRes && broadcastRes.ok ? ((await broadcastRes.json()) as BroadcastRecord[]) : [];

  return {
    convTags: convTags.map((c) => ({ conversationId: c.conversation_id, tagId: c.tag_id })),
    broadcasts,
  };
});

export const saveConversationTags = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        conversationId: z.string().min(1),
        tagIds: z.array(z.string().uuid()).max(50),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = serviceKey();
    await requireStaff(key);

    const del = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/conversation_tags?conversation_id=eq.${encodeURIComponent(data.conversationId)}`,
      { method: "DELETE", headers: apiHeaders(key) },
    );
    if (!del.ok) throw new Error(`Não foi possível salvar as etiquetas. ${await readError(del)}`.trim());

    if (data.tagIds.length > 0) {
      const ins = await fetch(`${EXT_SUPABASE_URL}/rest/v1/conversation_tags`, {
        method: "POST",
        headers: apiHeaders(key),
        body: JSON.stringify(
          data.tagIds.map((tag_id) => ({ conversation_id: data.conversationId, tag_id })),
        ),
      });
      if (!ins.ok) throw new Error(`Não foi possível salvar as etiquetas. ${await readError(ins)}`.trim());
    }
    return { ok: true };
  });

export const clearConversationTags = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        conversationIds: z.array(z.string().min(1)).default([]),
        tagId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = serviceKey();
    await requireStaff(key);

    const targets = Array.from(new Set(data.conversationIds));
    for (const conversationId of targets) {
      const res = await fetch(
        `${EXT_SUPABASE_URL}/rest/v1/conversation_tags?conversation_id=eq.${encodeURIComponent(conversationId)}`,
        { method: "DELETE", headers: apiHeaders(key) },
      );
      if (!res.ok) throw new Error(`Não foi possível remover as etiquetas. ${await readError(res)}`.trim());
    }
    if (data.tagId) {
      const res = await fetch(
        `${EXT_SUPABASE_URL}/rest/v1/conversation_tags?tag_id=eq.${encodeURIComponent(data.tagId)}`,
        { method: "DELETE", headers: apiHeaders(key) },
      );
      if (!res.ok) throw new Error(`Não foi possível remover as etiquetas. ${await readError(res)}`.trim());
    }
    return { ok: true };
  });

export const recordBroadcast = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        body: z.string().min(1),
        audience: z.string().min(1),
        tagId: z.string().uuid().nullable().optional(),
        recipientCount: z.number().int().min(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = serviceKey();
    await requireStaff(key);

    const res = await fetch(`${EXT_SUPABASE_URL}/rest/v1/broadcast_messages`, {
      method: "POST",
      headers: { ...apiHeaders(key), Prefer: "return=representation" },
      body: JSON.stringify({
        body: data.body,
        audience: data.audience,
        tag_id: data.tagId ?? null,
        recipient_count: data.recipientCount,
      }),
    });
    if (!res.ok) throw new Error(`Não foi possível registrar o envio em massa. ${await readError(res)}`.trim());
    const rows = (await res.json()) as BroadcastRecord[];
    return rows[0] ?? null;
  });
