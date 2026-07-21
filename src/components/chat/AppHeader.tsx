import { useNavigate, Link } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/session";
import type { User } from "@/lib/data";
import { Logo } from "@/components/brand/Logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppHeader({ user, accent }: { user: User; accent: string }) {
  const navigate = useNavigate();
  return (
    <header className={`flex items-center gap-3 pl-12 pr-4 py-2 text-white ${accent}`}>
      <Link to="/admin" className="flex items-center">
        <Logo iconClassName="h-6 w-6" textClassName="text-base" />
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <UserIcon className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">
                {user.name} · {user.number}
              </span>
              <span className="sm:hidden">{user.number}</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Perfil</SheetTitle>
              <SheetDescription>Dados da sua conta</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3 text-sm">
              <Field label="Nome" value={user.name} />
              <Field label="Número de usuário" value={user.number} />
              <Field label="Email" value={user.email || "Não informado"} />
              <Field label="Tipo" value={user.type} />
              {user.type === "empresa" && <Field label="CNPJ" value={user.cnpj} />}
              {user.type === "motorista" && (
                <>
                  <Field label="Placa" value={user.placa} />
                  {user.tipoVeiculo && <Field label="Tipo de veículo" value={user.tipoVeiculo} />}
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={async () => {
            await logout();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}
