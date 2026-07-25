import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

/**
 * Deletes an auth user from the external Supabase.
 * Allowed when:
 *  - the caller is deleting themselves (self-rollback after failed signup), OR
 *  - the caller is an admin/colaborador.
 * Also removes the profile row (if any) to keep the DB clean.
 */
export const deleteAuthUser = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("Configuração do servidor ausente (EXT_SUPABASE_SERVICE_ROLE_KEY).");
    const serviceHeaders = (): Record<string, string> => {
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

    if (authUser.id !== data.userId) {
      const adminRes = await fetch(
        `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=type`,
        { headers: serviceHeaders() },
      );
      if (!adminRes.ok) throw new Error("Não foi possível validar o administrador.");
      const rows = (await adminRes.json()) as Array<{ type?: string }>;
      const t = rows[0]?.type;
      if (t !== "admin" && t !== "colaborador") {
        throw new Error("Apenas administradores podem excluir outros usuários.");
      }
    }

    // Remove profile row (ignore if missing)
    await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(data.userId)}`,
      { method: "DELETE", headers: serviceHeaders() },
    ).catch(() => undefined);

    const delRes = await fetch(
      `${EXT_SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(data.userId)}`,
      { method: "DELETE", headers: serviceHeaders() },
    );
    if (!delRes.ok && delRes.status !== 404) {
      const text = await delRes.text().catch(() => "");
      throw new Error(`Não foi possível excluir a conta. ${text}`.trim());
    }
    return { ok: true as const };
  });
