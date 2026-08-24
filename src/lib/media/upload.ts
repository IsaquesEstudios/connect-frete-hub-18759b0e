import { uploadChatMedia } from "@/lib/data/chat-media.functions";
import { supabase } from "@/integrations/supabase/loose-client";

/**
 * Envia o arquivo por multipart para o servidor, que grava no Storage e
 * devolve uma URL pública curta para ser salva na mensagem.
 */
export async function uploadMedia(
  blob: Blob,
  name: string,
): Promise<{ url: string; name: string; mime: string }> {
  const form = new FormData();
  form.append("file", blob, name);
  form.append("name", name);
  // Token explícito como fallback caso o header de autorização não chegue.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (token) form.append("accessToken", token);
  return uploadChatMedia({ data: form });
}
