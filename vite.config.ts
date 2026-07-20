// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const externalSupabaseUrl = "https://blyxvehtkkhmuqylashi.supabase.co";
const externalSupabasePublishableKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseXh2ZWh0a2tobXVxeWxhc2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTk2NDcsImV4cCI6MjA5ODU5NTY0N30.xX49Lmi0vQc3JR6ZydKK3FP_A0wM0hpYlxiIzfj8VpU";

const appVersion = process.env.APP_VERSION || String(Date.now());

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(externalSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(externalSupabasePublishableKey),
      "process.env.SUPABASE_URL": JSON.stringify(externalSupabaseUrl),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(externalSupabasePublishableKey),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Build a standalone Node server (for self-hosting on VPS / Coolify / Docker).
  // Output goes to `.output/` with `.output/server/index.mjs` as the entry.
  nitro: {
    preset: "node-server",
  },
});

