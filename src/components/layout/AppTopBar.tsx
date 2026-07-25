import { Link } from "@tanstack/react-router";
import type { User } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

function perfilLabel(user: User): string {
  if (user.type === "admin") return "Administrador";
  if (user.type === "colaborador") return "Colaborador";
  const perfilEmpresa = (user as { perfilEmpresa?: string }).perfilEmpresa;
  if (perfilEmpresa) {
    const map: Record<string, string> = {
      transportador: "Transportadora",
      embarcador: "Empresa",
      agenciador: "Agência de carga",
    };
    return map[perfilEmpresa] || perfilEmpresa;
  }
  if (user.type === "empresa") return "Empresa";
  if (user.type === "motorista") return "Motorista";
  return "";
}

function avatarColor(user: User): string {
  return user.type === "empresa"
    ? "bg-[hsl(var(--company))]"
    : user.type === "motorista"
      ? "bg-[hsl(var(--driver))]"
      : "bg-primary";
}

export function AppTopBar({ user }: { user: User }) {
  const color = avatarColor(user);
  const label = perfilLabel(user);
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link to="/perfil" className="flex items-center gap-3 group">
        {user.fotoUrl ? (
          <img
            src={user.fotoUrl}
            alt={user.name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-transparent transition group-hover:ring-primary/40"
          />
        ) : (
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ${color}`}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">
            {user.name}
          </div>
          {label && (
            <Badge variant="secondary" className="mt-0.5 h-5 px-2 text-[11px] font-medium leading-none">
              {label}
            </Badge>
          )}
        </div>
      </Link>
    </header>
  );
}
