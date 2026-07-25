import { createFileRoute } from "@tanstack/react-router";
import { EXT_SUPABASE_URL } from "@/integrations/supabase/external-config";

// One-shot cleanup for orphan auth user jose05091917@gmail.com
export const Route = createFileRoute("/api/public/cleanup-jose")({
  server: {
    handlers: {
      GET: async () => {
        const serviceKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) return new Response("no key", { status: 500 });
        const headers: Record<string, string> = { apikey: serviceKey };
        if (!serviceKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceKey}`;
        const userId = "c1580668-c1e3-4e5e-93ac-bb8f70df9ac2";
        await fetch(`${EXT_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "DELETE",
          headers,
        }).catch(() => undefined);
        const del = await fetch(`${EXT_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: "DELETE",
          headers,
        });
        const text = await del.text().catch(() => "");
        return new Response(`status=${del.status} ${text}`);
      },
    },
  },
});
