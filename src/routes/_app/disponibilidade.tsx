import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading";
import { useAuth } from "@/lib/auth/useAuth";
import {
  listDisponibilidades,
  saveDisponibilidades,
  type DisponibilidadeItem,
  type DisponibilidadeKind,
} from "@/lib/data/disponibilidade.functions";

export const Route = createFileRoute("/_app/disponibilidade")({
  component: DisponibilidadePage,
  head: () => ({
    meta: [
      { title: "Disponibilidade de motoristas e fretes | SV Logística" },
      {
        name: "description",
        content:
          "Painel com motoristas disponíveis e fretes disponíveis publicados pela equipe da SV Logística.",
      },
      { property: "og:title", content: "Disponibilidade de motoristas e fretes | SV Logística" },
      {
        property: "og:description",
        content: "Veja motoristas e fretes disponíveis atualizados pela equipe da SV Logística.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DisponibilidadePage() {
  const { user } = useAuth();
  const isStaff = user?.type === "admin" || user?.type === "colaborador";

  const [items, setItems] = useState<DisponibilidadeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DisponibilidadeItem | null>(null);
  const [removing, setRemoving] = useState<DisponibilidadeItem | null>(null);
  const [kind, setKind] = useState<DisponibilidadeKind>("motorista");
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState("");

  useEffect(() => {
    listDisponibilidades()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const motoristas = useMemo(() => items.filter((i) => i.kind === "motorista"), [items]);
  const fretes = useMemo(() => items.filter((i) => i.kind === "frete"), [items]);

  function openNew(k: DisponibilidadeKind) {
    setEditing(null);
    setKind(k);
    setTitle(k === "motorista" ? "MOTORISTA DISPONÍVEL" : "FRETE DISPONÍVEL");
    setLines("");
    setOpen(true);
  }

  function openEdit(item: DisponibilidadeItem) {
    setEditing(item);
    setKind(item.kind);
    setTitle(item.title);
    setLines(item.lines.join("\n"));
    setOpen(true);
  }

  async function persist(next: DisponibilidadeItem[]) {
    setSaving(true);
    try {
      await saveDisponibilidades({ data: { items: next } });
      setItems(next);
      toast.success("Disponibilidades salvas");
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    const parsedLines = lines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!title.trim() || parsedLines.length === 0) {
      toast.error("Informe o título e ao menos uma linha.");
      return;
    }
    const item: DisponibilidadeItem = {
      id: editing?.id ?? crypto.randomUUID(),
      kind,
      title: title.trim(),
      lines: parsedLines,
      createdAt: editing?.createdAt ?? Date.now(),
    };
    const next = editing ? items.map((i) => (i.id === item.id ? item : i)) : [item, ...items];
    if (await persist(next)) setOpen(false);
  }

  async function remove(item: DisponibilidadeItem) {
    await persist(items.filter((i) => i.id !== item.id));
    setRemoving(null);
  }

  const renderCard = (item: DisponibilidadeItem) => (
    <Card key={item.id} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide">{item.title}</h3>
        {isStaff && (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => setRemoving(item)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {item.lines.map((l, i) => (
          <li key={i} className="whitespace-pre-wrap break-words">
            {l}
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Disponibilidade</h1>
            <p className="text-sm text-muted-foreground">
              Motoristas e fretes disponíveis publicados pela equipe.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Truck className="h-4 w-4" /> Motoristas disponíveis
                </h2>
                {isStaff && (
                  <Button size="sm" variant="outline" onClick={() => openNew("motorista")}>
                    <Plus className="mr-1 h-4 w-4" /> Novo
                  </Button>
                )}
              </div>
              {motoristas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum registro no momento.</p>
              )}
              {motoristas.map(renderCard)}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <MapPin className="h-4 w-4" /> Fretes disponíveis
                </h2>
                {isStaff && (
                  <Button size="sm" variant="outline" onClick={() => openNew("frete")}>
                    <Plus className="mr-1 h-4 w-4" /> Novo
                  </Button>
                )}
              </div>
              {fretes.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum registro no momento.</p>
              )}
              {fretes.map(renderCard)}
            </section>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar registro" : "Novo registro"}</DialogTitle>
            <DialogDescription>
              Cada linha do campo abaixo vira um item da lista (origem, destino, rota, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as DisponibilidadeKind)}
              >
                <option value="motorista">Motorista disponível</option>
                <option value="frete">Frete disponível</option>
              </select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Linhas</Label>
              <Textarea
                rows={8}
                value={lines}
                onChange={(e) => setLines(e.target.value)}
                placeholder={
                  kind === "motorista"
                    ? "➡️Origem: Caaporã / PB\n➡️Origem: Pitimbu / PB\nDESTINO - VÁRIAS CIDADES DO PIAUÍ"
                    : "📍PE X SP / 40 T / SAIDER / 4 EIXO\n📍PE X MS / 25 T / GRANELEIRO ALTO / TOCO"
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita e o registro sairá da página imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove(removing)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
