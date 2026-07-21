import { createServerFn } from "@tanstack/react-start";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

type CheckInput = {
  email?: string;
  cnpj?: string;
  cpf?: string;
  whatsapp?: string;
};

type CheckResult = {
  emailTaken: boolean;
  cnpjTaken: boolean;
  cpfTaken: boolean;
  whatsappTaken: boolean;
  skipped: boolean;
};

// Checks whether email / doc / whatsapp are already registered in the
// external Supabase (blyx). Uses the service-role key when available; if not
// present in the environment, returns skipped=true so the signup flow proceeds
// and the final signUp call surfaces the appropriate error.
export const checkSignupAvailability = createServerFn({ method: "POST" })
  .inputValidator((input: CheckInput) => input)
  .handler(async ({ data }): Promise<CheckResult> => {
    const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
    const empty: CheckResult = {
      emailTaken: false,
      cnpjTaken: false,
      cpfTaken: false,
      whatsappTaken: false,
      skipped: false,
    };
    if (!key) return { ...empty, skipped: true };

    const headers = { apikey: key, Authorization: `Bearer ${key}` };

    // Email: search auth admin users
    let emailTaken = false;
    if (data.email) {
      const emailNorm = data.email.trim().toLowerCase();
      try {
        const res = await fetch(
          `${EXT_SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(
            `email.eq.${emailNorm}`,
          )}&per_page=1`,
          { headers },
        );
        if (res.ok) {
          const body = (await res.json()) as { users?: Array<{ email?: string | null }> };
          emailTaken = (body.users ?? []).some(
            (u) => (u.email ?? "").toLowerCase() === emailNorm,
          );
        }
      } catch {
        // ignore — do not block signup on transient failure
      }
    }

    const restHeaders = { ...headers, "Content-Type": "application/json" };

    async function existsIn(column: "cnpj" | "cpf" | "whatsapp", value: string): Promise<boolean> {
      try {
        const url =
          `${EXT_SUPABASE_URL}/rest/v1/profiles` +
          `?select=id&${column}=eq.${encodeURIComponent(value)}&limit=1`;
        const res = await fetch(url, { headers: restHeaders });
        if (!res.ok) return false;
        const rows = (await res.json()) as Array<{ id: string }>;
        return rows.length > 0;
      } catch {
        return false;
      }
    }

    const cnpjTaken = data.cnpj ? await existsIn("cnpj", data.cnpj) : false;
    const cpfTaken = data.cpf ? await existsIn("cpf", data.cpf) : false;
    const whatsappTaken = data.whatsapp ? await existsIn("whatsapp", data.whatsapp) : false;

    return { emailTaken, cnpjTaken, cpfTaken, whatsappTaken, skipped: false };
  });
