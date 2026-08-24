export function isImageBody(body: string) {
  return typeof body === "string" && (body.startsWith("data:image/") || body.startsWith("img:"));
}

export function isAudioBody(body: string) {
  return typeof body === "string" && (body.startsWith("data:audio/") || body.startsWith("aud:"));
}

export function isFileBody(body: string) {
  return typeof body === "string" && body.startsWith("file:{");
}

/** Origem exibível da mídia (data URL antiga ou URL do Storage). */
export function mediaSrc(body: string): string {
  if (typeof body !== "string") return "";
  if (body.startsWith("img:") || body.startsWith("aud:")) return body.slice(4);
  return body;
}

export function parseFileBody(body: string): { name: string; url: string; mime?: string } | null {
  if (!isFileBody(body)) return null;
  try {
    return JSON.parse(body.slice(5));
  } catch {
    return null;
  }
}

/** Texto curto para preview em lista de conversas. */
export function messagePreview(body: string): string {
  if (!body || typeof body !== "string") return "";
  if (isImageBody(body)) return "📷 Imagem";
  if (isAudioBody(body)) return "🎵 Áudio";
  if (isFileBody(body)) {
    const f = parseFileBody(body);
    return `📎 ${f?.name ?? "Arquivo"}`;
  }
  return body;
}
