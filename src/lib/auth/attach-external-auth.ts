import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/loose-client";

// Attaches the EXTERNAL Supabase (blyx) bearer token to server function calls.
// Replaces the auto-generated attachSupabaseAuth which reads the Lovable Cloud
// session — this project is 100% on the external database.
export const attachExternalSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      token = data.session?.access_token;
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error ?? "");
      if (/refresh_token_not_found|invalid refresh token/i.test(message)) {
        if (typeof window !== "undefined") window.localStorage.removeItem("ext-sb-auth-token");
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      } else {
        throw error;
      }
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
