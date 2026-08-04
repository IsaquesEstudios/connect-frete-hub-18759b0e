import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/disponibilidade")({
  component: DisponibilidadeLayout,
});

function DisponibilidadeLayout() {
  return (
    <div>
      <div className="border-b bg-background/60 px-4 pt-4 md:px-6">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Link
            to="/disponibilidade/motoristas"
            className="rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "border-b-2 border-primary text-foreground" }}
          >
            Motoristas
          </Link>
          <Link
            to="/disponibilidade/empresas"
            className="rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "border-b-2 border-primary text-foreground" }}
          >
            Empresas
          </Link>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
