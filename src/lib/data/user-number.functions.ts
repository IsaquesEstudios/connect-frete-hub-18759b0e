import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

// Calcula o próximo código livre (EMP-0001, MOT-0007, ...) usando a chave de
// serviço. No navegador o RLS esconde os perfis alheios, então o cálculo
// client-side sempre começava em 0001 e colidia com códigos já existentes.
export const nextUserNumber = createServerFn({ method: "POST" })
  .inputValidator(z.object({ prefix: z.string().min(2).max(8) }))
  .handler(async ({ data }): Promise<{ seq: number | null }> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return { seq: null };

    const url =
      `${EXT_SUPABASE_URL}/rest/v1/profiles` +
      `?select=user_number&user_number=like.${encodeURIComponent(`${data.prefix}-%`)}` +
      `&order=user_number.desc&limit=1`;

    try {
      const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (!res.ok) return { seq: null };
      const rows = (await res.json()) as Array<{ user_number: string }>;
      const top = rows[0]?.user_number;
      const n = top ? parseInt(String(top).split("-")[1] || "0", 10) : 0;
      return { seq: (Number.isFinite(n) ? n : 0) + 1 };
    } catch {
      return { seq: null };
    }
  });
