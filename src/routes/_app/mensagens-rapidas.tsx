import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { useQuickReplies, type QuickReply } from "@/lib/chat/useQuickReplies";

export const Route = createFileRoute("/_app/mensagens-rapidas")({
  component: QuickRepliesPage,
  head: () => ({
    meta: [
      { title: "Mensagens rápidas | SV Logística" },
      {
        name: "description",
        content:
          "Crie mensagens pré-prontas com título e corpo e use no chat digitando / para inserir rapidamente.",
      },
      { property: "og:title", content: "Mensagens rápidas | SV Logística" },
      {
        property: "og:description",
        content: "Mensagens pré-prontas para responder mais rápido no chat da SV Logística.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function QuickRepliesPage() {
  const { items, loading, save } = useQuickReplies();
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [removing, setRemoving] = useState<QuickReply | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setTitle("");
    setBody("");
    setOpen(true);
  }

  function openEdit(item: QuickReply) {
    setEditing(item);
    setTitle(item.title);
    setBody(item.body);
    setOpen(true);
  }

  async function persist(next: QuickReply[]) {
    setSaving(true);
    try {
      await save(next);
      toast.success("Mensagens rápidas salvas");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      toast.error("Informe o título e a mensagem");
      return;
    }
    const next = editing
      ? items.map((i) => (i.id === editing.id ? { ...i, title: title.trim(), body: body.trim() } : i))
      : [
          ...items,
          {
            id: `qr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: title.trim(),
            body: body.trim(),
          },
        ];
    if (await persist(next)) setOpen(false);
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Mensagens rápidas</h1>
            <p className="text-sm text-muted-foreground">
              Crie mensagens pré-prontas. No chat, digite <strong>/</strong> para escolher uma delas
              pelo título.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nova
          </Button>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Você ainda não criou nenhuma mensagem rápida.
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.title}</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">
                    {item.body}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemoving(item)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar mensagem" : "Nova mensagem rápida"}</DialogTitle>
            <DialogDescription>
              O título aparece na lista quando você digitar / no chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="qr-title">Título</Label>
              <Input
                id="qr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Saudação inicial"
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qr-body">Mensagem</Label>
              <Textarea
                id="qr-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva a mensagem completa..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              “{removing?.title}” será removida e não poderá ser recuperada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const target = removing;
                setRemoving(null);
                if (target) await persist(items.filter((i) => i.id !== target.id));
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
