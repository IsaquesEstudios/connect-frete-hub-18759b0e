import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/_dispon")({
  ssr: false,
  component: DisponibilidadeLayout,
});

function DisponibilidadeLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Entrar
          </Link>
        </div>
      </header>
      <div className="border-b bg-background/60 px-4 pt-4 md:px-6">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Link
            to="/motorista/disponível"
            className="rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "border-b-2 border-primary text-foreground" }}
          >
            Motoristas
          </Link>
          <Link
            to="/fretes/disponivel"
            className="rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "border-b-2 border-primary text-foreground" }}
          >
            Fretes
          </Link>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
