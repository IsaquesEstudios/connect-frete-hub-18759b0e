import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { runCacheBuster, APP_VERSION } from "../lib/cache-buster";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SV Logística — Conectando empresas e motoristas do Brasil" },
      {
        name: "description",
        content:
          "A central de comunicação que aproxima transportadoras, embarcadores e motoristas. Entre nas nossas comunidades no WhatsApp.",
      },
      { name: "author", content: "SV Logística" },
      { property: "og:title", content: "SV Logística — Conectando empresas e motoristas do Brasil" },
      {
        property: "og:description",
        content:
          "A central de comunicação que aproxima transportadoras, embarcadores e motoristas. Entre nas nossas comunidades no WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SV Logística — Conectando empresas e motoristas do Brasil" },
      {
        name: "twitter:description",
        content:
          "A central de comunicação que aproxima transportadoras, embarcadores e motoristas. Entre nas nossas comunidades no WhatsApp.",
      },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/1linkkC623Tk01n4cngErQTbu7G3/social-images/social-1784123556118-truck_15950558.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/1linkkC623Tk01n4cngErQTbu7G3/social-images/social-1784123556118-truck_15950558.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void runCacheBuster();
  }, []);

  useEffect(() => {
    const clear = () => queryClient.clear();
    window.addEventListener("svlogistica:clear-query-cache", clear);
    return () => window.removeEventListener("svlogistica:clear-query-cache", clear);
  }, [queryClient]);

  // Se o link de recuperação de senha cair na home (fallback do Site URL),
  // encaminha os tokens/código para a página de redefinição.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith("/reset-password")) return;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(search);
    const isRecovery =
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery" ||
      (!!hashParams.get("access_token") && !!hashParams.get("refresh_token")) ||
      (!!searchParams.get("code") && pathname === "/");
    if (isRecovery) {
      window.location.replace(`/reset-password${search}${hash}`);
    }
  }, []);

  const persister = useMemo(
    () =>
      typeof window !== "undefined"
        ? createSyncStoragePersister({
            storage: window.localStorage,
            key: "svlogistica:rq-cache",
          })
        : undefined,
    [],
  );

  const content = (
    <>
      <meta name="app-version" content={APP_VERSION} />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  );

  if (persister) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24h
          buster: APP_VERSION,
        }}
      >
        {content}
      </PersistQueryClientProvider>
    );
  }

  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
}
