import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createColaborador,
  deleteColaborador,
  listColaboradores,
  setColaboradorActive,
} from "@/lib/auth/session";
import type { User } from "@/lib/data";

export function CollaboratorsDialog() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setList(await listColaboradores());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function submit() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast.error("Preencha nome, email e senha (mín. 6 caracteres).");
      return;
    }
    setSaving(true);
    try {
      await createColaborador({ name: name.trim(), email: email.trim(), password });
      toast.success("Colaborador criado.");
      setName("");
      setEmail("");
      setPassword("");
      setShowCreate(false);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User, active: boolean) {
    // otimista: atualiza o switch imediatamente
    setList((prev) => prev.map((x) => (x.id === u.id ? { ...x, active } : x)));
    try {
      await setColaboradorActive(u.id, active);
      toast.success(active ? "Colaborador ativado" : "Colaborador desativado");
    } catch (e) {
      // reverte em caso de falha
      setList((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !active } : x)));
      toast.error((e as Error).message);
    }
  }


  async function remove(u: User) {
    try {
      await deleteColaborador(u.id);
      toast.success("Colaborador excluído");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Users className="h-4 w-4 mr-1" /> Colaboradores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Colaboradores</DialogTitle>
          <DialogDescription>
            Contas de suporte que também podem conversar com empresas e motoristas.
          </DialogDescription>
        </DialogHeader>

        {showCreate ? (
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Reis" />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mín. 6 caracteres"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Criando..." : "Criar colaborador"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Novo colaborador
              </Button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
              {loading && <div className="p-4 text-sm text-muted-foreground">Carregando...</div>}
              {!loading && list.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Nenhum colaborador cadastrado ainda.
                </div>
              )}
              {list.map((u) => {
                const active = u.active !== false;
                return (
                  <div key={u.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.number} · {active ? "ativo" : "desativado"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1" title={active ? "Desativar login" : "Ativar login"}>
                        <Power className={`h-3.5 w-3.5 ${active ? "text-emerald-600" : "text-muted-foreground"}`} />
                        <Switch
                          checked={active}
                          onCheckedChange={(v) => toggleActive(u, v)}
                        />
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir {u.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O perfil será removido permanentemente. Se preferir apenas impedir o
                              login, use o botão de ativar/desativar.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(u)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
