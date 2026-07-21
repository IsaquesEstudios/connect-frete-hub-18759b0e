import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

type ProfileForMessage = {
  id: string;
  user_number: string;
  type: "admin" | "colaborador" | "empresa" | "motorista";
  active: boolean | null;
};

function apiHeaders(key: string, bearer?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else if (!isOpaque) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function isStaff(profile: ProfileForMessage): boolean {
  return profile.type === "admin" || profile.type === "colaborador";
}

function messageConversationId(from: ProfileForMessage, to: ProfileForMessage): string {
  const fromStaff = isStaff(from);
  const toStaff = isStaff(to);
  if (fromStaff && toStaff) return [from.user_number, to.user_number].sort().join("__");
  const staff = fromStaff ? from : to;
  const nonStaff = fromStaff ? to : from;
  return `${nonStaff.user_number}__${staff.user_number}`;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `Erro ${res.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string; details?: string; hint?: string; code?: string };
    return [parsed.message, parsed.details, parsed.hint, parsed.code ? `Código: ${parsed.code}` : ""]
      .filter(Boolean)
      .join(" ");
  } catch {
    return text;
  }
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        toUserId: z.string().uuid(),
        body: z.string().trim().min(1, "Mensagem vazia."),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("Configuração do servidor ausente.");

    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) throw new Error("Sessão inválida. Faça login novamente.");

    const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
      headers: apiHeaders(serviceKey, token),
    });
    if (!userRes.ok) throw new Error("Sessão inválida. Faça login novamente.");
    const authUser = (await userRes.json()) as { id?: string };
    if (!authUser.id) throw new Error("Sessão inválida. Faça login novamente.");

    const ids = [authUser.id, data.toUserId].map(encodeURIComponent).join(",");
    const profilesRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=in.(${ids})&select=id,user_number,type,active`,
      { headers: apiHeaders(serviceKey) },
    );
    if (!profilesRes.ok) {
      throw new Error(`Não foi possível validar os participantes. ${await readError(profilesRes)}`.trim());
    }

    const profiles = (await profilesRes.json()) as ProfileForMessage[];
    const from = profiles.find((p) => p.id === authUser.id);
    const to = profiles.find((p) => p.id === data.toUserId);
    if (!from) throw new Error("Perfil do remetente não encontrado.");
    if (!to) throw new Error("Destinatário não encontrado.");
    if (from.active === false) throw new Error("Sua conta está desativada.");
    if (to.active === false) throw new Error("Este destinatário está desativado.");
    if (!isStaff(from) && !isStaff(to)) {
      throw new Error("Usuários só podem enviar mensagens para o atendimento.");
    }

    const fromStaff = isStaff(from);
    const insertRes = await fetch(`${EXT_SUPABASE_URL}/rest/v1/messages`, {
      method: "POST",
      headers: {
        ...apiHeaders(serviceKey),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        conversation_id: messageConversationId(from, to),
        from_user_id: from.id,
        to_user_id: to.id,
        body: data.body,
        read_by_admin: fromStaff,
        read_by_user: !fromStaff,
      }),
    });
    if (!insertRes.ok) {
      throw new Error(`Não foi possível salvar a mensagem. ${await readError(insertRes)}`.trim());
    }

    const rows = (await insertRes.json()) as Array<Record<string, string | boolean>>;
    if (!rows[0]) throw new Error("Mensagem não foi salva.");
    return { ok: true as const, row: rows[0] };
  });