import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

export const setExternalUserActive = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("Configuração do servidor ausente.");
    const serviceHeaders = () => {
      const headers: Record<string, string> = { apikey: serviceKey };
      if (!serviceKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceKey}`;
      return headers;
    };

    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) throw new Error("Sessão inválida. Faça login novamente.");

    const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) throw new Error("Sessão inválida. Faça login novamente.");
    const authUser = (await userRes.json()) as { id?: string };
    if (!authUser.id) throw new Error("Sessão inválida. Faça login novamente.");

    const adminProfileRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=type`,
      { headers: serviceHeaders() },
    );
    if (!adminProfileRes.ok) throw new Error("Não foi possível validar o administrador.");
    const adminProfiles = (await adminProfileRes.json()) as Array<{ type?: string }>;
    if (adminProfiles[0]?.type !== "admin") throw new Error("Apenas administradores podem bloquear usuários.");

    const targetProfileRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(data.userId)}&select=type`,
      { headers: serviceHeaders() },
    );
    if (!targetProfileRes.ok) throw new Error("Usuário não encontrado.");
    const targetProfiles = (await targetProfileRes.json()) as Array<{ type?: string }>;
    const target = targetProfiles[0];
    if (!target) throw new Error("Usuário não encontrado.");
    if (target.type === "admin") throw new Error("Administradores não podem ser bloqueados por aqui.");

    const updateRes = await fetch(`${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(data.userId)}`, {
      method: "PATCH",
      headers: {
        ...serviceHeaders(),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ active: data.active }),
    });
    if (!updateRes.ok) throw new Error("Não foi possível atualizar o bloqueio do usuário.");

    const banRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(data.userId)}`, {
      method: "PUT",
      headers: {
        ...serviceHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ban_duration: data.active ? "none" : "876000h" }),
    });
    if (!banRes.ok) {
      console.warn("Não foi possível encerrar sessões do usuário bloqueado.");
    }

    return { ok: true };
  });
