import { Outlet, createFileRoute, useNavigate, useLocation, useRouter, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { FullscreenLoading } from "@/components/ui/loading";
import { useAuth } from "@/lib/auth/useAuth";
import { refreshCurrentUser } from "@/lib/auth/session";
import { repo } from "@/lib/data";
import { phoneDigits } from "@/lib/format-phone";
import { useRepoVersion } from "@/lib/hooks/useRepo";

function AppErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error("[_app] boundary caught:", error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold">Não foi possível carregar esta página</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message || "Ocorreu um erro inesperado."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <Link
            to="/"
            className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}

function AppNotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A rota acessada não existe dentro do painel.
        </p>
        <div className="mt-4">
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppGate,
  errorComponent: AppErrorComponent,
  notFoundComponent: AppNotFoundComponent,
});

function AppGate() {
  const { user, loading } = useAuth();
  const repoVersion = useRepoVersion();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    refreshCurrentUser()
      .then((freshUser) => {
        if (cancelled || freshUser) return;
        toast.error("Sua conta foi desativada. Entre em contato com o administrador.");
        navigate({ to: "/auth" });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname, navigate]);

  // Força usuários antigos a preencher WhatsApp (obrigatório)
  useEffect(() => {
    if (!user) return;
    const missingWhats = !user.whatsapp || phoneDigits(user.whatsapp).length < 10;
    if (missingWhats && location.pathname !== "/perfil") {
      toast.warning("Complete seu cadastro: informe seu número de WhatsApp para continuar.");
      navigate({ to: "/perfil" });
    }
  }, [user, location.pathname, navigate]);

  // Presence: keep this user marked online while mounted
  useEffect(() => {
    if (!user) return;
    repo.setPresence(user.id, true);
    return () => repo.setPresence(user.id, false);
  }, [user]);

  void repoVersion;
  if (loading) {
    return <FullscreenLoading label="Carregando..." />;
  }
  if (!user) return null;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <AppSidebar user={user} />
        <div className="flex-1 min-w-0 flex flex-col relative">
          <SyncProgressBar />
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}

