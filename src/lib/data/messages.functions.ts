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

type MessageForClient = {
  id: string;
  conversation_id: string;
  from_user_id: string;
  to_user_id: string;
  body: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_user: boolean;
};

const CANONICAL_ADMIN_NUMBER = "ADM-0001";

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
  return [from.id, to.id].sort().join("__");
}

async function resolveSenderProfile(
  serviceKey: string,
  currentProfile: ProfileForMessage,
): Promise<ProfileForMessage> {
  if (currentProfile.type !== "admin") return currentProfile;
  if (currentProfile.user_number === CANONICAL_ADMIN_NUMBER) return currentProfile;

  const adminRes = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/profiles?user_number=eq.${encodeURIComponent(CANONICAL_ADMIN_NUMBER)}&select=id,user_number,type,active&limit=1`,
    { headers: apiHeaders(serviceKey) },
  );
  if (!adminRes.ok) return currentProfile;

  const admins = (await adminRes.json()) as ProfileForMessage[];
  const canonicalAdmin = admins[0];
  if (!canonicalAdmin || canonicalAdmin.type !== "admin" || canonicalAdmin.active === false) {
    return currentProfile;
  }
  return canonicalAdmin;
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

async function getCurrentProfile(serviceKey: string): Promise<ProfileForMessage | null> {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
    headers: apiHeaders(serviceKey, token),
  });
  if (!userRes.ok) return null;
  const authUser = (await userRes.json()) as { id?: string };
  if (!authUser.id) return null;

  const profileRes = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,user_number,type,active`,
    { headers: apiHeaders(serviceKey) },
  );
  if (!profileRes.ok) {
    throw new Error(`Não foi possível validar seu perfil. ${await readError(profileRes)}`.trim());
  }
  const profiles = (await profileRes.json()) as ProfileForMessage[];
  const profile = profiles[0];
  if (!profile) return null;
  if (profile.active === false) throw new Error("Sua conta está desativada.");
  return profile;
}

function requireProfile(profile: ProfileForMessage | null): ProfileForMessage {
  if (!profile) throw new Error("Sessão inválida. Faça login novamente.");
  return profile;
}

function parseTotal(res: Response, fallback: number): number {
  // Content-Range: "0-99/1234" — the value after "/" is total.
  const range = res.headers.get("content-range");
  if (!range) return fallback;
  const slash = range.lastIndexOf("/");
  if (slash < 0) return fallback;
  const totalStr = range.slice(slash + 1);
  const n = Number(totalStr);
  return Number.isFinite(n) ? n : fallback;
}

export const listVisibleMessages = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        since: z.string().optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("Configuração do servidor ausente.");

    const profile = await getCurrentProfile(serviceKey);
    if (!profile) return { rows: [] as MessageForClient[], total: 0 };

    const since = data?.since;
    const limit = data?.limit ?? (since ? 200 : 150);
    const offset = data?.offset ?? 0;
    // With `since` we paginate ascending (oldest new first). Cold load stays
    // descending so the latest messages appear immediately.
    const order = since ? "created_at.asc" : "created_at.desc";
    const sinceFilter = since ? `&created_at=gt.${encodeURIComponent(since)}` : "";
    // `count=exact` triggers a full COUNT on messages — very expensive on the
    // DB. Only request it on the first delta page (so the sync progress bar
    // can size itself). All other reads infer total from the page contents.
    const wantCount = Boolean(since) && offset === 0;

    async function fetchPage(extra: string): Promise<{ rows: MessageForClient[]; total: number }> {
      const url =
        `${EXT_SUPABASE_URL}/rest/v1/messages` +
        `?select=*&order=${order}&limit=${limit}&offset=${offset}${sinceFilter}${extra ? `&${extra}` : ""}`;
      const headers: Record<string, string> = { ...apiHeaders(serviceKey!) };
      if (wantCount) headers.Prefer = "count=exact";
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Não foi possível carregar as mensagens. ${await readError(res)}`.trim());
      }
      const rows = (await res.json()) as MessageForClient[];
      const total = wantCount
        ? parseTotal(res, rows.length + offset)
        : rows.length + offset;
      return { rows, total };
    }

    if (isStaff(profile)) {
      const { rows, total } = await fetchPage("");
      return { rows: since ? rows : rows.slice().reverse(), total };
    }

    // Non-staff: a single OR query is far cheaper than two round-trips with
    // separate count=exact scans.
    const uid = encodeURIComponent(profile.id);
    const { rows, total } = await fetchPage(
      `or=(from_user_id.eq.${uid},to_user_id.eq.${uid})`,
    );
    return { rows: since ? rows : rows.slice().reverse(), total };
  });


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

    const currentProfile = requireProfile(await getCurrentProfile(serviceKey));
    const senderProfile = await resolveSenderProfile(serviceKey, currentProfile);
    const ids = Array.from(new Set([senderProfile.id, data.toUserId])).map(encodeURIComponent).join(",");
    const profilesRes = await fetch(
      `${EXT_SUPABASE_URL}/rest/v1/profiles?id=in.(${ids})&select=id,user_number,type,active`,
      { headers: apiHeaders(serviceKey) },
    );
    if (!profilesRes.ok) {
      throw new Error(`Não foi possível validar os participantes. ${await readError(profilesRes)}`.trim());
    }

    const profiles = (await profilesRes.json()) as ProfileForMessage[];
    const from = profiles.find((p) => p.id === senderProfile.id);
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
