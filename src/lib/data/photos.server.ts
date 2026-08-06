import { getRequest } from "@tanstack/react-start/server";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

function apiHeaders(key: string, bearer?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else if (!isOpaque) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `Erro ${res.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string; code?: string };
    return [parsed.message, parsed.code ? `Código: ${parsed.code}` : ""].filter(Boolean).join(" ");
  } catch {
    return text;
  }
}

// A foto do perfil é um dado compartilhado: todo mundo que conversa dentro do
// sistema precisa ver a mesma imagem que está salva em profiles.foto_url.
// As políticas de acesso escondem as linhas de outros usuários, então a leitura
// das fotos passa pelo servidor (chave de serviço) e devolve SÓ id + foto.
export async function fetchProfilePhotos(): Promise<Record<string, string>> {
  const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Configuração do servidor ausente: EXT_SUPABASE_SERVICE_ROLE_KEY não está definida no ambiente.",
    );
  }

  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  // Sem sessão válida (SSR, token expirando, aba voltando do background) as
  // fotos simplesmente não carregam agora — não é motivo para quebrar a tela.
  if (!token) return {};

  const userRes = await fetch(`${EXT_SUPABASE_URL}/auth/v1/user`, {
    headers: apiHeaders(key, token),
  });
  if (!userRes.ok) return {};
  const authUser = (await userRes.json()) as { id?: string };
  if (!authUser.id) return {};

  const res = await fetch(
    `${EXT_SUPABASE_URL}/rest/v1/profiles?select=id,foto_url&foto_url=not.is.null`,
    { headers: apiHeaders(key) },
  );
  if (!res.ok) throw new Error(`Não foi possível carregar as fotos. ${await readError(res)}`.trim());

  const rows = (await res.json()) as Array<{ id: string; foto_url: string | null }>;
  const map: Record<string, string> = {};
  for (const row of rows) if (row.foto_url) map[row.id] = row.foto_url;
  return map;
}
