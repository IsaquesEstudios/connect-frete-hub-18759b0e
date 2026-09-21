import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

const signupProfileSchema = z.object({
  accessToken: z.string().min(1),
  profile: z.object({
    id: z.string().uuid(),
    type: z.enum(["empresa", "motorista", "colaborador", "admin"]),
    name: z.string().min(1),
    cnpj: z.string().nullable().optional(),
    cpf: z.string().nullable().optional(),
    whatsapp: z.string().nullable().optional(),
    foto_url: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),
    estado: z.string().nullable().optional(),
    placa: z.string().nullable().optional(),
    tipo_veiculo: z.string().nullable().optional(),
    rntrc: z.string().nullable().optional(),
    carroceria: z.string().nullable().optional(),
    peso: z.string().nullable().optional(),
    nome_fantasia: z.string().nullable().optional(),
    perfil_empresa: z.string().nullable().optional(),
    site_rede_social: z.string().nullable().optional(),
    active: z.boolean().optional(),
  }),
});

type ProfileInsertError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

// Calcula o próximo código livre (EMP-0001, MOT-0007, ...) usando a chave de
// serviço. No navegador o RLS esconde os perfis alheios, então o cálculo
// client-side sempre começava em 0001 e colidia com códigos já existentes.
export const nextUserNumber = createServerFn({ method: "POST" })
  .inputValidator(z.object({ prefix: z.string().min(2).max(8) }))
  .handler(async ({ data }): Promise<{ seq: number | null }> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return { seq: null };

    const url =
      `${EXT_SUPABASE_URL}/rest/v1/profiles` +
      `?select=user_number&user_number=like.${encodeURIComponent(`${data.prefix}-%`)}` +
      `&order=user_number.desc&limit=1`;

    try {
      const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (!res.ok) return { seq: null };
      const rows = (await res.json()) as Array<{ user_number: string }>;
      const top = rows[0]?.user_number;
      const n = top ? parseInt(String(top).split("-")[1] || "0", 10) : 0;
      return { seq: (Number.isFinite(n) ? n : 0) + 1 };
    } catch {
      return { seq: null };
    }
  });

/**
 * Creates the profile on the server after verifying that the supplied session
 * belongs to the new account. The service key can see every existing number,
 * unlike the newly-created browser session restricted by RLS.
 */
export const createSignupProfile = createServerFn({ method: "POST" })
  .inputValidator(signupProfileSchema)
  .handler(async ({ data }): Promise<{ error: ProfileInsertError | null }> => {
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return {
        error: {
          code: "SERVER_CONFIG",
          message: "A chave EXT_SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.",
        },
      };
    }

    const userResponse = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${data.accessToken}`,
      },
    });
    if (!userResponse.ok) {
      return { error: { code: "INVALID_SESSION", message: "Sessão do novo usuário inválida." } };
    }
    const authUser = (await userResponse.json()) as { id?: string };
    if (authUser.id !== data.profile.id) {
      return { error: { code: "USER_MISMATCH", message: "A sessão não pertence ao novo usuário." } };
    }

    const prefix = data.profile.type === "empresa" ? "EMP" : data.profile.type === "motorista" ? "MOT" : data.profile.type === "colaborador" ? "COL" : "ADM";
    const serviceHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    const listResponse = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?select=user_number&user_number=like.${encodeURIComponent(`${prefix}-%`)}&order=user_number.desc&limit=1`,
      { headers: serviceHeaders },
    );
    if (!listResponse.ok) {
      const error = (await listResponse.json().catch(() => ({}))) as ProfileInsertError;
      return { error: { ...error, code: error.code ?? `HTTP_${listResponse.status}` } };
    }

    const rows = (await listResponse.json()) as Array<{ user_number?: string }>;
    const current = Number.parseInt(rows[0]?.user_number?.split("-")[1] ?? "0", 10);
    let sequence = (Number.isFinite(current) ? current : 0) + 1;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const user_number = `${prefix}-${String(sequence).padStart(4, "0")}`;
      const insertResponse = await fetch(`${EXT_SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: { ...serviceHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ ...data.profile, user_number }),
      });
      if (insertResponse.ok) return { error: null };

      const error = (await insertResponse.json().catch(() => ({}))) as ProfileInsertError;
      const duplicateNumber =
        error.code === "23505" &&
        `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase().includes("user_number");
      if (!duplicateNumber) return { error: { ...error, code: error.code ?? `HTTP_${insertResponse.status}` } };
      sequence += 1;
    }

    return {
      error: {
        code: "23505",
        message: "Não foi possível reservar um código de usuário após 20 tentativas.",
      },
    };
  });
