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
    if (user && user.type !== "admin" && user.type !== "colaborador") navigate({ to: homeFor(user) as "/admin" });
  }, [user, navigate]);

  const [tab, setTab] = useState<FilterTab>("todos");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileChat, setMobileChat] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { pinned, isPinned, toggle: togglePin, max: maxPinned } = usePinnedConversations(user?.id ?? "anon");

  // Admin vê a caixa unificada da equipe; colaborador vê apenas as conversas dele.
  const isAdmin = user?.type === "admin";
  const conversations = useMemo(
    () => repo.listConversations(isAdmin ? undefined : { staffId: user?.id }),
    [v, isAdmin, user?.id],
  );
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
      if (tagFilter && !c.tagIds.includes(tagFilter)) return false;
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

  // Conversas fixadas sempre no topo (mantendo a ordem de fixação).
  const ordered = useMemo(() => {
    if (pinned.length === 0) return filtered;
    const rank = (id: string) => {
      const i = pinned.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return filtered.slice().sort((a, b) => rank(a.user.id) - rank(b.user.id));
  }, [filtered, pinned]);




  if (!user || (user.type !== "admin" && user.type !== "colaborador")) return null;

  const selectedUser = selected ? repo.getUser(selected) : null;

  const toggleTagFilter = (id: string) => {
    setTagFilter((prev) => (prev === id ? null : id));
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-end gap-2 border-b bg-card px-4 py-2">
        {user.type === "admin" && <CollaboratorsDialog />}
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
                  const on = tagFilter === t.id;
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
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Limpar filtro de tag
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {ordered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa
              </div>
            )}
            {ordered.map((c) => {
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
              const pinnedHere = isPinned(c.user.id);
              return (
                <div key={c.user.id} className="relative group">
                <button
                  onClick={() => {
                    setSelected(c.user.id);
                    setMobileChat(true);
                  }}
                  className={`w-full text-left pl-3 pr-9 py-3 flex gap-3 border-b hover:bg-accent transition-colors ${
                    isActive ? "bg-accent" : ""
                  } ${pinnedHere ? "bg-accent/40" : ""}`}
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const res = togglePin(c.user.id);
                    if (!res.ok) toast.error(`Você já fixou o máximo de ${maxPinned} conversas.`);
                  }}
                  title={pinnedHere ? "Desafixar conversa" : "Fixar conversa no topo"}
                  aria-label={pinnedHere ? "Desafixar conversa" : "Fixar conversa no topo"}
                  className={`absolute right-1.5 top-2 h-7 w-7 rounded-md flex items-center justify-center transition ${
                    pinnedHere
                      ? "text-primary opacity-100"
                      : "text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100"
                  } hover:bg-background`}
                >
                  {pinnedHere ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
                </button>
                </div>
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
                          repo.deleteConversation([user.id, selectedUser.id].sort().join("__"));
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
                <ChatWindow me={user} other={selectedUser} viewer="admin" sharedInbox={isAdmin} />
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
