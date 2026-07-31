import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { EXT_SUPABASE_URL, EXT_SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/external-config";

const DEFAULT_MOTORISTAS = "https://chat.whatsapp.com/";
const DEFAULT_EMPRESAS = "https://chat.whatsapp.com/";

const DEFAULT_SOCIAL: Record<string, string> = {
  social_website: "https://svlogisticatransportes.com.br",
  social_instagram: "https://www.instagram.com/svlogisticatransportes",
  social_facebook: "https://www.facebook.com/svlogisticatransportes",
  social_threads: "https://www.threads.com/svlogisticatransportes",
  social_youtube: "https://www.youtube.com/@svlogisticatransportes",
  social_tiktok: "https://www.tiktok.com/@svlogisticatransportes",
};

const SOCIAL_KEYS = Object.keys(DEFAULT_SOCIAL);

export type SocialLinks = {
  website: string;
  instagram: string;
  facebook: string;
  threads: string;
  youtube: string;
  tiktok: string;
};

function apiHeaders(key: string, bearer?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  const isNew = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  } else if (!isNew) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function pickKey(): { key: string; isService: boolean } {
  const service = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (service) return { key: service, isService: true };
  return { key: EXT_SUPABASE_PUBLISHABLE_KEY, isService: false };
}

async function fetchSetting(key: string, apiKey: string): Promise<string | null> {
  const res = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: apiHeaders(apiKey) },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ value?: string }>;
  return rows[0]?.value ?? null;
}

export const getWhatsappLinks = createServerFn({ method: "GET" }).handler(async () => {
  const { key } = pickKey();
  const [motoristas, empresas] = await Promise.all([
    fetchSetting("whatsapp_motoristas", key),
    fetchSetting("whatsapp_empresas", key),
  ]);
  return {
    motoristas: motoristas ?? DEFAULT_MOTORISTAS,
    empresas: empresas ?? DEFAULT_EMPRESAS,
  };
});

export const getSocialLinks = createServerFn({ method: "GET" }).handler(async () => {
  const { key } = pickKey();
  const results = await Promise.all(SOCIAL_KEYS.map((k) => fetchSetting(k, key)));
  const map: Record<string, string> = {};
  SOCIAL_KEYS.forEach((k, i) => {
    map[k] = results[i] ?? DEFAULT_SOCIAL[k];
  });
  return {
    website: map.social_website,
    instagram: map.social_instagram,
    facebook: map.social_facebook,
    threads: map.social_threads,
    youtube: map.social_youtube,
    tiktok: map.social_tiktok,
  } satisfies SocialLinks;
});

export const updateSocialLinks = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        website: z.string().url("Link do site inválido"),
        instagram: z.string().url("Link do Instagram inválido"),
        facebook: z.string().url("Link do Facebook inválido"),
        threads: z.string().url("Link do Threads inválido"),
        youtube: z.string().url("Link do YouTube inválido"),
        tiktok: z.string().url("Link do TikTok inválido"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { key: apiKey } = pickKey();

    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) throw new Error("Sessão inválida. Faça login novamente.");

    const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) throw new Error("Sessão inválida.");
    const authUser = (await userRes.json()) as { id?: string };
    if (!authUser.id) throw new Error("Sessão inválida.");

    const profRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=type`,
      { headers: apiHeaders(apiKey, token) },
    );
    const profs = (await profRes.json()) as Array<{ type?: string }>;
    if (profs[0]?.type !== "admin") {
      throw new Error("Apenas administradores podem alterar essas configurações.");
    }

    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error(
        "Configuração do servidor incompleta: EXT_SUPABASE_SERVICE_ROLE_KEY não definida.",
      );
    }
    const payload = [
      { key: "social_website", value: data.website },
      { key: "social_instagram", value: data.instagram },
      { key: "social_facebook", value: data.facebook },
      { key: "social_threads", value: data.threads },
      { key: "social_youtube", value: data.youtube },
      { key: "social_tiktok", value: data.tiktok },
    ];
    const upsertRes = await fetch(`${EXT_SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        ...apiHeaders(serviceKey),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!upsertRes.ok) {
      const text = await upsertRes.text().catch(() => "");
      throw new Error(`Não foi possível salvar. ${text}`.trim());
    }
    return { ok: true as const };
  });

export const updateWhatsappLinks = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        motoristas: z.string().url("Link inválido para motoristas"),
        empresas: z.string().url("Link inválido para empresas"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { key: apiKey } = pickKey();

    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) throw new Error("Sessão inválida. Faça login novamente.");

    // Verify user via auth endpoint (works with publishable key + user token)
    const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) throw new Error("Sessão inválida.");
    const authUser = (await userRes.json()) as { id?: string };
    if (!authUser.id) throw new Error("Sessão inválida.");

    // Check admin role using the user's own token (RLS lets them read own profile)
    const profRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=type`,
      { headers: apiHeaders(apiKey, token) },
    );
    const profs = (await profRes.json()) as Array<{ type?: string }>;
    if (profs[0]?.type !== "admin") {
      throw new Error("Apenas administradores podem alterar essas configurações.");
    }

    const payload = [
      { key: "whatsapp_motoristas", value: data.motoristas },
      { key: "whatsapp_empresas", value: data.empresas },
    ];

    // Upsert with service role (RLS on app_settings blocks direct writes even for admins).
    // Admin was already verified above via the user token.
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error(
        "Configuração do servidor incompleta: EXT_SUPABASE_SERVICE_ROLE_KEY não definida.",
      );
    }
    const upsertRes = await fetch(`${EXT_SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        ...apiHeaders(serviceKey),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!upsertRes.ok) {
      const text = await upsertRes.text().catch(() => "");
      throw new Error(`Não foi possível salvar. ${text}`.trim());
    }
    return { ok: true as const };
  });
