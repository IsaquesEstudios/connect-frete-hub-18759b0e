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
  return uploadChatMedia({ data: form });
}
