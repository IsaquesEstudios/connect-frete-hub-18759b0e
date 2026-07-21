import { toast } from "sonner";
import { translateAuthError } from "@/lib/auth/translate-error";

let warned = false;

// Chamado quando a server function de emails falha no cliente.
// Loga no console e mostra um único toast por sessão com o motivo real
// devolvido pelo servidor (config ausente, sessão inválida, 401/403, etc.).
export function reportEmailsUnavailable(error: unknown): void {
  const message = translateAuthError(error);
  console.warn("[emails] falha ao buscar emails", error);
  if (warned) return;
  warned = true;
  toast.error("Não foi possível carregar o email do usuário", {
    description: message,
    duration: 12000,
  });
}

export const EMAIL_UNAVAILABLE_LABEL =
  "Email indisponível (verifique EXT_SUPABASE_SERVICE_ROLE_KEY no servidor)";
