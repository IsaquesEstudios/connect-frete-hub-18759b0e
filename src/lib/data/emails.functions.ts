import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

type ProfileEmailAccess = {
  id: string;
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

function isStaff(profile: ProfileEmailAccess): boolean {
  return profile.type === "admin" || profile.type === "colaborador";
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

async function getCurrentProfile(serviceKey: string): Promise<ProfileEmailAccess> {
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

  const profileRes = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,type,active`,
    { headers: apiHeaders(serviceKey) },
  );
  if (!profileRes.ok) {
    throw new Error(`Não foi possível validar seu perfil. ${await readError(profileRes)}`.trim());
  }
  const profiles = (await profileRes.json()) as ProfileEmailAccess[];
  const profile = profiles[0];
  if (!profile) throw new Error("Perfil do usuário não encontrado.");
  if (profile.active === false) throw new Error("Sua conta está desativada.");
  return profile;
}

async function fetchAuthEmail(serviceKey: string, userId: string): Promise<string | undefined> {
  const res = await fetch(`${EXT_SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: apiHeaders(serviceKey),
  });
  if (res.status === 404) return undefined;
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Chave de serviço rejeitada pelo banco externo (HTTP ${res.status}). Verifique EXT_SUPABASE_SERVICE_ROLE_KEY.`);
  }
  if (!res.ok) throw new Error(`Não foi possível carregar email. ${await readError(res)}`.trim());
  const body = (await res.json()) as { email?: string | null };
  return body.email ?? undefined;
}


// Busca id -> email diretamente no cadastro de autenticação.
// O email não fica em profiles; por isso as telas precisam consultar o auth.
export const getExternalUserEmails = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, string>> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Configuração do servidor ausente: EXT_SUPABASE_SERVICE_ROLE_KEY não está definida no ambiente.");
    const profile = await getCurrentProfile(key);
    if (!isStaff(profile)) throw new Error("Apenas equipe administrativa pode listar emails.");

    const map: Record<string, string> = {};
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(
        `${EXT_SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
        { headers: apiHeaders(key) },
      );
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Chave de serviço rejeitada pelo banco externo (HTTP ${res.status}). Verifique EXT_SUPABASE_SERVICE_ROLE_KEY.`);
      }
      if (!res.ok) throw new Error(`Não foi possível listar emails. ${await readError(res)}`.trim());
      const body = (await res.json()) as { users?: Array<{ id: string; email?: string | null }> };
      const users = body.users ?? [];
      if (users.length === 0) break;
      for (const u of users) if (u.email) map[u.id] = u.email;
      if (users.length < 200) break;
    }
    return map;
  },
);


export const getExternalUserEmailsForIds = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        userIds: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Configuração do servidor ausente: EXT_SUPABASE_SERVICE_ROLE_KEY não está definida no ambiente.");
    const currentProfile = await getCurrentProfile(key);
    const ids = Array.from(new Set(data.userIds));

    if (!isStaff(currentProfile)) {
      // Usuários comuns podem ver o email dos perfis que enxergam no app
      // (o perfil abre com o email visível). Limitamos apenas a perfis
      // existentes e ativos — sem bloquear conversas legítimas.
      const otherIds = ids.filter((id) => id !== currentProfile.id);
      if (otherIds.length > 0) {
        const encodedIds = otherIds.map(encodeURIComponent).join(",");
        const profileRes = await fetch(
          `${EXT_SUPABASE_URL}/rest/v1/profiles?id=in.(${encodedIds})&select=id,type,active`,
          { headers: apiHeaders(key) },
        );
        if (!profileRes.ok) {
          throw new Error(`Não foi possível validar perfis. ${await readError(profileRes)}`.trim());
        }
        const profiles = (await profileRes.json()) as ProfileEmailAccess[];
        const known = new Set(profiles.filter((p) => p.active !== false).map((p) => p.id));
        // Ignora silenciosamente ids desconhecidos em vez de falhar a tela toda.
        for (const id of otherIds) if (!known.has(id)) ids.splice(ids.indexOf(id), 1);
      }
    }


    const entries = await Promise.all(
      ids.map(async (id) => {
        const email = await fetchAuthEmail(key, id);
        return email ? ([id, email] as const) : null;
      }),
    );

    return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
  });
