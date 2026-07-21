import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, LockOpen, Pencil, Search, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { translateAuthError } from "@/lib/auth/translate-error";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { repo } from "@/lib/data";
import type { User } from "@/lib/data";
import { getExternalUserEmails } from "@/lib/data/emails.functions";
import { homeFor } from "@/lib/auth/session";
import { useAuth } from "@/lib/auth/useAuth";
import { useRepoVersion, useEphemeralVersion } from "@/lib/hooks/useRepo";
import { formatPhone } from "@/lib/format-phone";
import { AdminEditUserDialog } from "@/components/admin/AdminEditUserDialog";
import { setExternalUserActive } from "@/lib/data/admin-users.functions";

export const Route = createFileRoute("/_app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — SV Logística" }] }),
  component: UsuariosPage,
});

type TypeFilter = "todos" | "empresa" | "motorista" | "colaborador" | "admin";

function lastSeenLabel(ts: number | null): string {
  if (!ts) return "nunca acessou";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function typeLabel(t: string) {
  switch (t) {
    case "empresa":
      return "Empresa";
    case "motorista":
      return "Motorista";
    case "colaborador":
      return "Colaborador";
    case "admin":
      return "Admin";
    default:
      return t;
  }
}

function typeColorClass(t: string) {
  switch (t) {
    case "empresa":
      return "bg-[hsl(var(--company))]";
    case "motorista":
      return "bg-[hsl(var(--driver))]";
    case "colaborador":
      return "bg-[hsl(var(--collaborator))]";
    default:
      return "bg-muted-foreground";
  }
}

function UsuariosPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const v = useRepoVersion();
  const ev = useEphemeralVersion();
  const [tab, setTab] = useState<TypeFilter>("todos");
  const [query, setQuery] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<User | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<User | null>(null);

  const toggleActive = async (u: User, next: boolean) => {
    try {
      await setExternalUserActive({ data: { userId: u.id, active: next } });
      repo.applyLocalUserPatch(u.id, { active: next });
      toast.success(next ? "Usuário desbloqueado." : "Usuário bloqueado.");
    } catch (e) {
      toast.error(translateAuthError(e));
    } finally {
      setConfirmBlock(null);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (user && user.type !== "admin") navigate({ to: homeFor(user) as "/admin" });
  }, [user, loading, navigate]);


  useEffect(() => {
    getExternalUserEmails()
      .then((m) => setEmails(m || {}))
      .catch((error) => {
        setEmails({});
        toast.error("Não foi possível carregar os emails dos usuários", {
          description: translateAuthError(error),
          duration: 12000,
        });
      });
  }, [v]);

  const users = useMemo(() => repo.listUsers(), [v]);

  const filtered = useMemo(() => {
    const list = users.filter((u) => {
      if (tab !== "todos" && u.type !== tab) return false;
      if (query) {
        const q = query
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const name = u.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const number = u.number.toLowerCase();
        const doc = (
          (u as { cnpj?: string; cpf?: string }).cnpj ||
          (u as { cpf?: string }).cpf ||
          ""
        ).toLowerCase();
        const email = (u.email || emails[u.id] || "").toLowerCase();
        return (
          name.includes(q) ||
          number.includes(q) ||
          doc.includes(q) ||
          email.includes(q)
        );
      }
      return true;
    });
    // Ordena: online primeiro, depois por último acesso (mais recente antes).
    return [...list].sort((a, b) => {
      const oa = repo.isOnline(a.id) ? 1 : 0;
      const ob = repo.isOnline(b.id) ? 1 : 0;
      if (oa !== ob) return ob - oa;
      const la = repo.getLastSeen(a.id) ?? 0;
      const lb = repo.getLastSeen(b.id) ?? 0;
      return lb - la;
    });
  }, [users, tab, query, emails, ev]);

  // touch ephemeral version so online/lastSeen refresh
  void ev;

  if (loading) return null;
  if (!user || user.type !== "admin") return null;


  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
            <p className="text-sm text-muted-foreground">
              Todos os usuários da plataforma com status de conexão.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, número, email, CPF ou CNPJ..."
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TypeFilter)}>
            <TabsList className="h-9">
              <TabsTrigger value="todos" className="text-xs">
                Todos
              </TabsTrigger>
              <TabsTrigger value="empresa" className="text-xs">
                Empresas
              </TabsTrigger>
              <TabsTrigger value="motorista" className="text-xs">
                Motoristas
              </TabsTrigger>
              <TabsTrigger value="colaborador" className="text-xs">
                Colaboradores
              </TabsTrigger>
              <TabsTrigger value="admin" className="text-xs">
                Admins
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <section className="mt-4 rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {filtered.length} usuário{filtered.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">WhatsApp</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">CPF/CNPJ</th>
                  <th className="px-4 py-3 font-medium">Cidade/UF</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="sticky right-0 z-10 bg-card px-4 py-3 font-medium text-right shadow-[-12px_0_16px_-16px_hsl(var(--foreground))]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                )}
                {filtered.map((u) => {
                  const doc =
                    (u as { cnpj?: string }).cnpj ||
                    (u as { cpf?: string }).cpf ||
                    "—";
                  const email = u.email || emails[u.id] || "—";
                  const online = repo.isOnline(u.id);
                  const last = repo.getLastSeen(u.id);
                  const cidade = [u.cidade, u.estado].filter(Boolean).join(" / ") || "—";
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded text-white ${typeColorClass(
                            u.type,
                          )}`}
                        >
                          {typeLabel(u.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 uppercase text-xs text-muted-foreground">
                        {u.number}
                      </td>
                      <td className="px-4 py-3">
                        {u.whatsapp ? formatPhone(u.whatsapp) : "—"}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3" title={email}>{email}</td>
                      <td className="max-w-[150px] truncate px-4 py-3" title={doc}>{doc}</td>
                      <td className="max-w-[150px] truncate px-4 py-3" title={cidade}>{cidade}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.active === false ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                            <Lock className="h-3 w-3" />
                            bloqueado
                          </span>
                        ) : online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            online
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {lastSeenLabel(last)}
                          </span>
                        )}
                      </td>
                      <td className="sticky right-0 z-10 bg-card px-2 py-3 text-right whitespace-nowrap shadow-[-12px_0_16px_-16px_hsl(var(--foreground))]">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            onClick={() => setEditing(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {u.type !== "admin" && (
                            u.active === false ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Desbloquear usuário"
                                className="text-emerald-600 hover:text-emerald-700"
                                onClick={() => toggleActive(u, true)}
                              >
                                <LockOpen className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Bloquear usuário"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setConfirmBlock(u)}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )
                          )}
                        </div>
                      </td>


                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <AdminEditUserDialog
        user={editing}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <AlertDialog open={!!confirmBlock} onOpenChange={(v) => !v && setConfirmBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear {confirmBlock?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário não conseguirá acessar a plataforma até ser desbloqueado por um administrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmBlock && toggleActive(confirmBlock, false)}
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
