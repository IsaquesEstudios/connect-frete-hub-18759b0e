import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        patch: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("Configuração do servidor ausente.");
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

    const currentProfileRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=type,active`,
      { headers: serviceHeaders() },
    );
    if (!currentProfileRes.ok) throw new Error("Não foi possível validar seu perfil.");
    const currentProfiles = (await currentProfileRes.json()) as Array<{ type?: string; active?: boolean | null }>;
    const currentProfile = currentProfiles[0];
    if (!currentProfile) throw new Error("Perfil não encontrado. Faça login novamente.");
    if (currentProfile.active === false) throw new Error("Sua conta está desativada.");

    // Permite editar o próprio perfil, mas edição de terceiros exige equipe.
    if (authUser.id !== data.userId) {
      const t = currentProfile.type;
      if (t !== "admin" && t !== "colaborador") throw new Error("Apenas administradores podem editar outros perfis.");
    }

    const updateRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(data.userId)}`,
      {
        method: "PATCH",
        headers: {
          ...serviceHeaders(),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(data.patch),
      },
    );
    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => "");
      throw new Error(`Não foi possível salvar o perfil. ${text}`.trim());
    }
    const rows = (await updateRes.json()) as Array<Record<string, string | number | boolean | null>>;
    if (!rows[0]) throw new Error("Perfil não encontrado.");
    return { ok: true as const, row: rows[0] };
  });
