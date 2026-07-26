import { useMemo, useState } from "react";
import { ArrowLeft, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FullscreenLoading } from "@/components/ui/loading";
import { ChatWindow } from "./ChatWindow";
import { ADMIN_ID, repo, type User } from "@/lib/data";
import { messagePreview } from "@/lib/chat/messagePreview";
import { formatConversationTime } from "@/lib/chat/formatConversationTime";
import { usePinnedConversations } from "@/lib/chat/usePinnedConversations";
import { useEphemeralVersion, useRepoVersion } from "@/lib/hooks/useRepo";


interface Props {
  me: User;
}

function lastSeenLabel(ts: number | null): string {
  if (!ts) return "offline";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function UserChatPanel({ me }: Props) {
  const v = useRepoVersion();
  const ev = useEphemeralVersion();
  const [selectedId, setSelectedId] = useState<string | null>(ADMIN_ID);
  const [mobileChat, setMobileChat] = useState(false);

  const staff = useMemo(() => {
    void v;
    const all = repo.listUsers();
    const admin = all.find((u) => u.number === ADMIN_ID) ?? all.find((u) => u.type === "admin" || u.id === ADMIN_ID);
    const collabs = all.filter((u) => u.type === "colaborador" && u.active !== false);
    const list = admin ? [admin, ...collabs] : collabs;
    const lastTs = (uid: string) => {
      const conversationId = [me.id, uid].sort().join("__");
      const msgs = repo.listMessages(conversationId, { staffInbox: false });
      return msgs[msgs.length - 1]?.createdAt ?? 0;
    };
    return list.slice().sort((a, b) => {
      const diff = lastTs(b.id) - lastTs(a.id);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [v, me.id]);

  const selected = selectedId ? repo.getUser(selectedId) ?? null : null;

  if (!repo.isBootstrapped()) {
    return <FullscreenLoading label="Carregando central..." />;
  }

  if (staff.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Nenhum atendente ativo encontrado no momento.
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <aside
          className={`${mobileChat ? "hidden" : "flex"} md:flex flex-col w-full md:w-80 md:min-w-80 border-r bg-card`}
        >
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-semibold">Atendimento</div>
            <div className="text-xs text-muted-foreground">Fale com o administrador ou um colaborador</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {staff.map((s) => {
              const conversationId = [me.id, s.id].sort().join("__");
              const useStaffInbox = false;

              const messages = (() => {
                void v;
                return repo.listMessages(conversationId, { staffInbox: useStaffInbox });
              })();
              const last = messages[messages.length - 1];
              const unread = (() => {
                void v;
                return messages.filter((m) => m.fromUserId === s.id && !m.readByUser).length;
              })();
              const online = (() => {
                void ev;
                return repo.isOnline(s.id);
              })();
              const lastSeen = repo.getLastSeen(s.id);
              const isActive = selectedId === s.id;
              const color = s.type === "admin" ? "bg-primary" : "bg-[hsl(var(--collaborator))]";
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedId(s.id);
                    setMobileChat(true);
                  }}
                  className={`w-full text-left px-3 py-3 flex gap-3 border-b hover:bg-accent transition-colors ${
                    isActive ? "bg-accent" : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <div
                      className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white ${color}`}
                    >
                      {s.fotoUrl ? (
                        <img src={s.fotoUrl} alt={s.name} className="h-full w-full object-cover" />
                      ) : (
                        s.name
                          .split(" ")
                          .slice(0, 2)
                          .map((x) => x[0])
                          .join("")
                      )}
                    </div>
                    {online && (
                      <span
                        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                        aria-label="online"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="font-medium truncate text-sm">{s.name}</div>
                        <span
                          className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 text-white ${color}`}
                        >
                          {s.type === "admin" ? "Admin" : "Colaborador"}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground shrink-0">
                        {last ? formatConversationTime(last.createdAt) : (online ? "online" : lastSeenLabel(lastSeen))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground truncate">
                        {last ? messagePreview(last.body) : "Sem mensagens"}
                      </div>
                      {unread > 0 && (
                        <span className="ml-auto text-[10px] rounded-full bg-primary text-primary-foreground px-2 py-0.5 shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chat */}
        <section className={`${mobileChat ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col`}>
          {selected ? (
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
              <div className="flex-1 min-h-0">
                <ChatWindow me={me} other={selected} viewer="user" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione um atendente para começar
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
