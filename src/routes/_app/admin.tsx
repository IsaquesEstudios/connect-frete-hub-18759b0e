import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Megaphone, Pin, PinOff, Search, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BroadcastDialog } from "@/components/chat/BroadcastDialog";
import { CollaboratorsDialog } from "@/components/admin/CollaboratorsDialog";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationTagPicker } from "@/components/chat/ConversationTagPicker";
import { TagBadges } from "@/components/chat/TagBadges";
import { TagManagerDialog } from "@/components/chat/TagManagerDialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { repo } from "@/lib/data";
import { messagePreview } from "@/lib/chat/messagePreview";
import { formatConversationTime } from "@/lib/chat/formatConversationTime";
import { homeFor } from "@/lib/auth/session";
import { useAuth } from "@/lib/auth/useAuth";
import { useRepoVersion } from "@/lib/hooks/useRepo";
import { usePinnedConversations } from "@/lib/chat/usePinnedConversations";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin — SV Logística" }] }),
  component: AdminPanel,
});

type FilterTab = "todos" | "empresas" | "motoristas" | "colaboradores";

function lastSeenLabel(ts: number | null): string {
  if (!ts) return "nunca acessou";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const v = useRepoVersion();

  useEffect(() => {
    if (user && user.type !== "admin") navigate({ to: homeFor(user) as "/admin" });
  }, [user, navigate]);

  const [tab, setTab] = useState<FilterTab>("todos");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileChat, setMobileChat] = useState(false);
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { pinned, isPinned, toggle: togglePin, max: maxPinned } = usePinnedConversations(user?.id ?? "anon");

  const conversations = useMemo(() => repo.listConversations(), [v]);
  const allTags = useMemo(() => repo.listTags(), [v]);
  const tagsById = useMemo(
    () => Object.fromEntries(allTags.map((t) => [t.id, t] as const)),
    [allTags],
  );
  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (tab === "empresas" && c.user.type !== "empresa") return false;
      if (tab === "motoristas" && c.user.type !== "motorista") return false;
      if (tab === "colaboradores" && c.user.type !== "colaborador") return false;
      if (unreadOnly && !(c.unreadForAdmin > 0)) return false;
      if (tagFilter.size > 0) {
        for (const id of tagFilter) if (!c.tagIds.includes(id)) return false;
      }
      if (query) {
        const q = normalizeSearchText(query);
        const qDigits = onlyDigits(query);
        const u = c.user as { cnpj?: string; cpf?: string; whatsapp?: string; email?: string };
        const searchableText = [c.user.name, c.user.number, u.cnpj, u.cpf, u.email, u.whatsapp]
          .map(normalizeSearchText)
          .filter(Boolean);
        if (q && searchableText.some((value) => value.includes(q))) return true;
        if (qDigits) {
          const searchableDigits = [u.cnpj, u.cpf, c.user.number, u.whatsapp]
            .map(onlyDigits)
            .filter(Boolean);
          if (searchableDigits.some((value) => value.includes(qDigits))) return true;
        }
        return false;
      }
      return true;
    });
  }, [conversations, tab, query, tagFilter, unreadOnly]);




  if (!user || user.type !== "admin") return null;

  const selectedUser = selected ? repo.getUser(selected) : null;

  const toggleTagFilter = (id: string) => {
    const next = new Set(tagFilter);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTagFilter(next);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-end gap-2 border-b bg-card px-4 py-2">
        <CollaboratorsDialog />
        <BroadcastDialog
          adminId={user.id}
          trigger={
            <Button size="sm" className="shrink-0">
              <Megaphone className="h-4 w-4 mr-1" /> Nova mensagem em massa
            </Button>
          }
        />
      </div>



      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <aside
          className={`${
            mobileChat ? "hidden" : "flex"
          } md:flex flex-col w-full md:w-96 md:min-w-96 border-r bg-card`}
        >
          <div className="p-3 space-y-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, número, CPF ou CNPJ..."
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
              <TabsList className="grid grid-cols-4 w-full h-8">
                <TabsTrigger value="todos" className="text-xs">
                  Todos
                </TabsTrigger>
                <TabsTrigger value="empresas" className="text-xs">
                  Empresas
                </TabsTrigger>
                <TabsTrigger value="motoristas" className="text-xs">
                  Motoristas
                </TabsTrigger>
                <TabsTrigger value="colaboradores" className="text-xs">
                  Colaboradores
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-start gap-2">
              <div className="flex-1 flex flex-wrap gap-1">
                <button
                  onClick={() => setUnreadOnly((v) => !v)}
                  className={`text-[10px] rounded-full px-2 py-0.5 font-medium border transition ${
                    unreadOnly
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-foreground/70 bg-transparent border-border"
                  }`}
                  title="Mostrar somente conversas não lidas"
                >
                  Não lidas
                </button>
                {allTags.length === 0 && (
                  <div className="text-[11px] text-muted-foreground py-1">
                    Nenhuma tag cadastrada.
                  </div>
                )}
                {allTags.map((t) => {
                  const on = tagFilter.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTagFilter(t.id)}
                      className={`text-[10px] rounded-full px-2 py-0.5 font-medium border transition ${
                        on ? "text-white" : "text-foreground/70 bg-transparent"
                      }`}
                      style={{
                        borderColor: t.color,
                        backgroundColor: on ? t.color : "transparent",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <TagManagerDialog
                trigger={
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Gerenciar tags">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
            {tagFilter.size > 0 && (
              <button
                onClick={() => setTagFilter(new Set())}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Limpar filtro de tags ({tagFilter.size})
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa
              </div>
            )}
            {filtered.map((c) => {
              const isActive = selected === c.user.id;
              const perfil = (c.user as { perfilEmpresa?: string }).perfilEmpresa;
              const displayType: "empresa" | "motorista" | "colaborador" | "admin" =
                c.user.type === "colaborador" || c.user.type === "admin"
                  ? c.user.type
                  : perfil === "motorista"
                    ? "motorista"
                    : perfil === "transportador" || perfil === "embarcador" || perfil === "agenciador"
                      ? "empresa"
                      : c.user.type;
              const displayLabel =
                displayType === "empresa"
                  ? perfil === "transportador"
                    ? "Transportadora"
                    : perfil === "agenciador"
                      ? "Agência de carga"
                      : "Empresa"
                  : displayType === "colaborador"
                    ? "Colaborador"
                    : displayType === "admin"
                      ? "Admin"
                      : "Motorista";
              const color =
                displayType === "empresa"
                  ? "bg-[hsl(var(--company))]"
                  : displayType === "colaborador"
                  ? "bg-[hsl(var(--collaborator))]"
                  : "bg-[hsl(var(--driver))]";
              const convTags = c.tagIds
                .map((id) => tagsById[id])
                .filter((t): t is NonNullable<typeof t> => !!t);
              return (
                <button
                  key={c.user.id}
                  onClick={() => {
                    setSelected(c.user.id);
                    setMobileChat(true);
                  }}
                  className={`w-full text-left px-3 py-3 flex gap-3 border-b hover:bg-accent transition-colors ${
                    isActive ? "bg-accent" : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white overflow-hidden ${color}`}
                    >
                      {c.user.fotoUrl ? (
                        <img src={c.user.fotoUrl} alt={c.user.name} className="h-full w-full object-cover" />
                      ) : (
                        c.user.name
                          .split(" ")
                          .slice(0, 2)
                          .map((s) => s[0])
                          .join("")
                      )}
                    </div>
                    {repo.isOnline(c.user.id) && (
                      <span
                        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                        aria-label="online"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="font-medium truncate text-sm">{c.user.name}</div>
                        <span
                          className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 text-white ${color}`}
                        >
                          {displayLabel}
                        </span>
                      </div>

                      <div className="text-[10px] text-muted-foreground shrink-0">
                        {c.lastMessage
                          ? formatConversationTime(c.lastMessage.createdAt)
                          : (repo.isOnline(c.user.id) ? "online" : lastSeenLabel(repo.getLastSeen(c.user.id)))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground truncate">
                        {c.lastMessage ? messagePreview(c.lastMessage.body) : "Sem mensagens"}
                      </div>
                      {c.unreadForAdmin > 0 && (
                        <span className="ml-auto text-[10px] rounded-full bg-primary text-primary-foreground px-2 py-0.5 shrink-0">
                          {c.unreadForAdmin}
                        </span>
                      )}
                    </div>
                    {convTags.length > 0 && (
                      <div className="mt-1">
                        <TagBadges tags={convTags} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chat */}
        <section className={`${mobileChat ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col`}>
          {selectedUser ? (
            <>
              <div className="md:hidden border-b bg-card">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileChat(false)}
                  className="m-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              </div>
              <div className="border-b bg-card px-4 py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <ConversationTagPicker conversationId={selectedUser.number} />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive shrink-0">
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir conversa
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir conversa inteira?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todas as mensagens desta conversa serão removidas permanentemente e
                        não poderão ser recuperadas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          repo.deleteConversation(`${selectedUser.number}__${user.number}`);
                          setSelected(null);
                          setMobileChat(false);
                        }}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="flex-1 min-h-0">
                <ChatWindow me={user} other={selectedUser} viewer="admin" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa para começar
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
