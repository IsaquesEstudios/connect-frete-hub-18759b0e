import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, MessageCirclePlus, RefreshCw, Search, Trash2 } from "lucide-react";
import { MessageCircle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/loose-client";
import { deleteChatLead, listChatLeads, type ChatLead } from "@/lib/data/chat-leads.functions";
import { downloadXlsx } from "@/lib/export/xlsx";
import { matchesSearch } from "@/lib/search";

export const Route = createFileRoute("/_app/leads")({
  head: () => ({ meta: [{ title: "Contatos do chat — SV Logística" }] }),
  component: LeadsPage,
});

type KindFilter = "todos" | "motorista" | "carga";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LeadsPage() {
  const [leads, setLeads] = useState<ChatLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<KindFilter>("todos");
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<ChatLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const rows = await listChatLeads({ data: { accessToken: sessionData.session?.access_token } });
      setLeads(rows);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível carregar os contatos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (kind !== "todos" && l.kind !== kind) return false;
      if (!search.trim()) return true;
      return matchesSearch(search, [l.nome, l.whatsapp, l.origem, l.tipo_veiculo, l.carroceria, l.material]);
    });
  }, [leads, kind, search]);

  const exportXlsx = () => {
    const rows = filtered.map((l) => [
      l.kind === "motorista" ? "Motorista" : "Carga",
      l.nome,
      l.whatsapp,
      l.origem ?? "",
      l.tipo_veiculo ?? "",
      l.carroceria ?? "",
      l.peso ?? "",
      l.valor ?? "",
      l.material ?? "",
      l.forma_pagamento ?? "",
      l.info_extra ?? "",
      formatDateTime(l.created_at),
    ]);
    void downloadXlsx("contatos-chat", [
      {
        name: "Contatos",
        header: ["Tipo", "Nome", "WhatsApp", "Origem", "Veículo", "Carroceria", "Peso", "Valor", "Material", "Pagamento", "Info extra", "Data"],
        rows,
      },
    ]);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await deleteChatLead({ data: { id: toDelete.id, accessToken: sessionData.session?.access_token } });
      setLeads((prev) => prev.filter((l) => l.id !== toDelete.id));
      toast.success("Contato excluído.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível excluir.");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const waLink = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    return `https://wa.me/${digits.length === 11 || digits.length === 10 ? "55" + digits : digits}`;
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCirclePlus className="h-6 w-6 text-sky-400" />
          <h1 className="text-xl font-semibold">Contatos do chat</h1>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!filtered.length}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="motorista">Motoristas</TabsTrigger>
            <TabsTrigger value="carga">Cargas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, cidade, veículo..." className="pl-9" />
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Veículo / Carroceria</th>
              <th className="px-4 py-3">Detalhes</th>
              <th className="px-4 py-3">Data</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Carregando contatos...</td></tr>
            ) : !filtered.length ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Nenhum contato encontrado.</td></tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${l.kind === "motorista" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                      {l.kind === "motorista" ? "Motorista" : "Carga"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-black">{l.nome}</td>
                  <td className="px-4 py-3 text-black">{l.whatsapp}</td>
                  <td className="px-4 py-3 text-black">{l.origem ?? "—"}</td>
                  <td className="px-4 py-3 text-black">
                    {[l.tipo_veiculo, l.carroceria].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    <div className="truncate text-black" title={[l.peso && `Peso: ${l.peso}`, l.valor && `Valor: ${l.valor}`, l.material && `Material: ${l.material}`, l.forma_pagamento && `Pagamento: ${l.forma_pagamento}`, l.info_extra && `Extra: ${l.info_extra}`].filter(Boolean).join("\n")}>
                      {[l.peso && `Peso: ${l.peso}`, l.valor && `Valor: ${l.valor}`, l.material, l.forma_pagamento, l.info_extra].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-black">{formatDateTime(l.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={waLink(l.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                        aria-label="Falar no WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                      <button onClick={() => setToDelete(l)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contato de <strong>{toDelete?.nome}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
