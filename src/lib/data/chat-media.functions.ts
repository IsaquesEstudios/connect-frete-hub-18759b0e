import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

const BUCKET = "chat-media";

function safeExt(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (fromName && /^[a-z0-9]{1,6}$/.test(fromName)) return fromName;
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
}

/**
 * Upload de mídia do chat (imagem, áudio, documento) para o Storage.
 * Recebe FormData (multipart) — muito mais confiável que base64 no corpo JSON,
 * que estourava o limite de payload e fazia a mensagem sumir depois.
 */
export const uploadChatMedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Envio inválido.");
    return data;
  })
  .handler(async ({ data }) => {
    const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("Configuração do servidor ausente.");

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

    const file = data.get("file") as Blob | null;
    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
      throw new Error("Arquivo não recebido.");
    }
    const name = (data.get("name") as string) || (file as File).name || "arquivo";
    const mime = file.type || "application/octet-stream";
    const path = `${authUser.id}/${crypto.randomUUID()}.${safeExt(name, mime)}`;

    const uploadRes = await fetch(
      `${EXT_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": mime,
          "cache-control": "31536000",
        },
        body: await file.arrayBuffer(),
      },
    );
    if (!uploadRes.ok) {
      const detail = await uploadRes.text().catch(() => "");
      throw new Error(`Não foi possível enviar o arquivo. ${detail}`.trim());
    }

    return {
      url: `${EXT_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
      name,
      mime,
    };
  });
