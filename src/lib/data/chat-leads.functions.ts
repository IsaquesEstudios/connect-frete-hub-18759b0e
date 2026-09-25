import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

const opt = z.string().trim().max(2000).optional().nullable();

const leadSchema = z.object({
  kind: z.enum(["motorista", "carga"]),
  nome: z.string().trim().min(2).max(200),
  whatsapp: z.string().trim().min(10).max(30),
  origem: opt,
  destino: opt,
  tipo_veiculo: opt,
  carroceria: opt,
  peso: opt,
  valor: opt,
  material: opt,
  forma_pagamento: opt,
  info_extra: opt,
});

export type ChatLeadInput = z.infer<typeof leadSchema>;

export const submitChatLead = createServerFn({ method: "POST" })
  .inputValidator(leadSchema)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return { ok: false, error: "Servidor não configurado." };
    try {
      const res = await fetch(`${EXT_SUPABASE_URL}/rest/v1/chat_leads`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error("chat_leads insert failed", res.status, await res.text().catch(() => ""));
        return { ok: false, error: "Não foi possível salvar agora. Tente novamente." };
      }
      return { ok: true };
    } catch (e) {
      console.error("chat_leads insert error", e);
      return { ok: false, error: "Falha de conexão. Tente novamente." };
    }
  });
