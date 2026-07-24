import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_ID, repo, type Message, type User } from "@/lib/data";
import { useEphemeralVersion, useRepoVersion } from "@/lib/hooks/useRepo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
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
import { Camera, CheckCheck, Clock, FileText, ImagePlus, Mic, Paperclip, Pencil, Send, Square, Trash2 } from "lucide-react";
import { AdminEditUserDialog } from "@/components/admin/AdminEditUserDialog";
import { AudioMessage } from "./AudioMessage";
import { isAudioBody, isFileBody, isImageBody, parseFileBody } from "@/lib/chat/messagePreview";
import { getExternalUserEmailsForIds } from "@/lib/data/emails.functions";
import { reportEmailsUnavailable, EMAIL_UNAVAILABLE_LABEL } from "@/lib/data/emails-client";
import { formatPhone } from "@/lib/format-phone";
import { optimizeImageToDataUrl } from "@/lib/media/optimize";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function perfilLabel(user: User) {
  const perfilEmpresa = (user as { perfilEmpresa?: string }).perfilEmpresa;
  if (user.type === "admin") return "Administrador";
  if (user.type === "colaborador") return "Colaborador";
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

function MessageTicks({ message, viewer }: { message: Message; viewer: "admin" | "user" }) {
  if (message.id.startsWith("tmp_")) return <Clock className="h-3 w-3 opacity-80" aria-label="Enviando" />;
  const read = viewer === "admin" ? message.readByUser : message.readByAdmin;
  if (read) return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Lida" />;
  return <CheckCheck className="h-3.5 w-3.5 opacity-80" aria-label="Entregue" />;
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString();
}

function isOwnMessage(message: Message, currentUserId: string, otherUserId: string) {
  // Em uma conversa aberta, a posição da bolha deve seguir o par exibido:
  // mensagens vindas do contato ficam à esquerda; mensagens enviadas ao
  // contato ficam à direita. Isso evita inverter tudo quando existem registros
  // antigos ou IDs de conversa normalizados.
  if (message.fromUserId === otherUserId) return false;
  if (message.toUserId === otherUserId) return true;
  if (message.toUserId === currentUserId) return false;
  return message.fromUserId === currentUserId;
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

interface Props {
  me: User;
  other: User;
  viewer: "admin" | "user";
}

export function ChatWindow({ me, other, viewer }: Props) {
  const v = useRepoVersion();
  const ev = useEphemeralVersion();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [otherEmail, setOtherEmail] = useState(other.email ?? "");
  const [otherEmailLoading, setOtherEmailLoading] = useState(false);

  // Cada par (eu ↔ outro) tem sua própria conversa, identificada pelos
  // IDs (UUIDs) dos usuários. O admin vê a caixa unificada com todas as
  // mensagens trocadas entre a equipe e o usuário.
  const conversationId = [me.id, other.id].sort().join("__");
  const useStaffInbox = viewer === "admin";


  // Feedback visual ao trocar de conversa
  useEffect(() => {
    setSwitching(true);
    const t = window.setTimeout(() => setSwitching(false), 250);
    return () => clearTimeout(t);
  }, [conversationId]);

  const messages = useMemo(
    () => repo.listMessages(conversationId, { staffInbox: useStaffInbox }),
    [conversationId, useStaffInbox, v],
  );
  const otherOnline = useMemo(() => repo.isOnline(other.id), [other.id, ev, v]);

  useEffect(() => {
    let cancelled = false;
    setOtherEmail(other.email ?? "");
    if (other.id === me.id) {
      setOtherEmail(me.email ?? other.email ?? "");
      setOtherEmailLoading(false);
      return;
    }
    setOtherEmailLoading(!other.email);
    getExternalUserEmailsForIds({ data: { userIds: [other.id] } })
      .then((map) => {
        if (cancelled) return;
        setOtherEmail(map[other.id] || other.email || "");
        setOtherEmailLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        reportEmailsUnavailable(err);
        setOtherEmail(other.email || EMAIL_UNAVAILABLE_LABEL);
        setOtherEmailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [other.id, other.email, me.id, me.email]);

  useEffect(() => {
    repo.markConversationRead(conversationId, viewer, { staffInbox: useStaffInbox });
  }, [conversationId, viewer, useStaffInbox, v, messages.length]);

  useEffect(() => {
    let busy = false;
    const refresh = () => {
      if (busy) return;
      busy = true;
      void repo.refreshMessages().finally(() => {
        busy = false;
      });
    };
    refresh();
    const interval = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [conversationId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        repo.markConversationRead(conversationId, viewer, { staffInbox: useStaffInbox });
      }
    };
    const onFocus = () => repo.markConversationRead(conversationId, viewer, { staffInbox: useStaffInbox });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [conversationId, viewer, useStaffInbox]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversationId]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  function sendBody(body: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    repo.sendMessage({ fromUserId: me.id, toUserId: other.id, body: trimmed });
  }

  function sendText() {
    const current = text;
    if (!current.trim()) return;
    setText("");
    sendBody(current);
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert("Arquivo muito grande. Limite 5MB.");
      return;
    }
    try {
      // Otimiza imagens antes de enviar para economizar armazenamento.
      const dataUrl = file.type.startsWith("image/")
        ? await optimizeImageToDataUrl(file, { maxDimension: 1600, targetBytes: 400_000 })
        : await fileToDataUrl(file);
      sendBody(dataUrl);
    } catch (e) {
      console.error(e);
      alert("Falha ao ler o arquivo.");
    }
  }

  async function handleDocument(file: File | undefined | null) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert("Arquivo muito grande. Limite 5MB.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const payload = JSON.stringify({ name: file.name, url: dataUrl, mime: file.type });
      sendBody("file:" + payload);
    } catch (e) {
      console.error(e);
      alert("Falha ao ler o arquivo.");
    }
  }


  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      // Bitrate baixo (~24kbps) — voz continua nítida e reduz muito o tamanho.
      const rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 24_000,
      });
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mime || "audio/webm" });
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          alert("Áudio muito longo. Grave um trecho menor.");
        } else {
          const dataUrl = await fileToDataUrl(blob);
          sendBody(dataUrl);
        }
        setRecordSeconds(0);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      alert("Não foi possível acessar o microfone.");
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  }

  function cancelRecording() {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    setRecording(false);
    setRecordSeconds(0);
  }

  const groups: { day: string; items: Message[] }[] = [];
  for (const m of messages) {
    const day = fmtDay(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }

  const otherColor =
    other.type === "empresa"
      ? "bg-[hsl(var(--company))]"
      : other.type === "motorista"
        ? "bg-[hsl(var(--driver))]"
        : "bg-primary";

  const isAdmin = viewer === "admin";

  return (
    <div className="flex h-full flex-col bg-background">
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 border-b bg-card px-4 py-3 text-left w-full hover:bg-accent transition-colors"
            aria-label={`Ver perfil de ${other.name}`}
          >
            <div className="relative shrink-0">
              {other.fotoUrl ? (
                <img
                  src={other.fotoUrl}
                  alt={other.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${otherColor}`}
                >
                  {other.name
                    .split(" ")
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")}
                </div>
              )}
              {otherOnline && (
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                  aria-label="online"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{other.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>{other.number}</span>
                <span>·</span>
                {otherOnline ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    online
                  </span>
                ) : (
                  <span>offline</span>
                )}
              </div>
            </div>

          </button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Perfil</SheetTitle>
            <SheetDescription>Dados de {other.name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex items-center gap-3">
            {other.fotoUrl ? (
              <img
                src={other.fotoUrl}
                alt={other.name}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white ${otherColor}`}
              >
                {other.name
                  .split(" ")
                  .slice(0, 2)
                  .map((s) => s[0])
                  .join("")}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold truncate">{other.name}</div>
              <div className="text-xs text-muted-foreground">
                {other.number} · {otherOnline ? "online" : "offline"}
              </div>
            </div>
          </div>
          <Badge variant="default" className="mt-3 w-fit">
            {perfilLabel(other)}
          </Badge>
          <div className="mt-6 space-y-3 text-sm max-h-[65vh] overflow-y-auto pr-1">
            <ProfileField label="Tipo" value={other.type} />
            <ProfileField
              label="Email"
              value={otherEmailLoading ? "Carregando email..." : otherEmail || other.email || "Não informado"}
            />
            {other.whatsapp && <ProfileField label="WhatsApp" value={formatPhone(other.whatsapp)} />}
            {other.cpf && <ProfileField label="CPF" value={other.cpf} />}
            {other.type === "empresa" && (
              <>
                <ProfileField label="CNPJ" value={other.cnpj} />
                {other.nomeFantasia && (
                  <ProfileField label="Nome fantasia" value={other.nomeFantasia} />
                )}
                {other.perfilEmpresa && (
                  <ProfileField label="Perfil da empresa" value={other.perfilEmpresa} />
                )}
                {other.siteRedeSocial && (
                  <ProfileField label="Site / Rede social" value={other.siteRedeSocial} />
                )}
              </>
            )}
            {other.type === "motorista" && (
              <>
                <ProfileField label="Placa" value={other.placa} />
                {other.tipoVeiculo && (
                  <ProfileField label="Tipo de veículo" value={other.tipoVeiculo} />
                )}
                {other.carroceria && (
                  <ProfileField label="Carroceria" value={other.carroceria} />
                )}
                {other.peso && <ProfileField label="Peso" value={other.peso} />}
                {other.rntrc && <ProfileField label="RNTRC" value={other.rntrc} />}
              </>
            )}
            {(other.cidade || other.estado) && (
              <ProfileField
                label="Localização"
                value={[other.cidade, other.estado].filter(Boolean).join(" - ")}
              />
            )}
            {other.createdAt > 0 && (
              <ProfileField
                label="Conta criada em"
                value={new Date(other.createdAt).toLocaleString("pt-BR")}
              />
            )}
          </div>
          {viewer === "admin" && other.type !== "admin" && (
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar dados
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AdminEditUserDialog user={other} open={editOpen} onOpenChange={setEditOpen} />



      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(switching || !repo.isBootstrapped()) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingSpinner size="md" label="Carregando conversa..." />
          </div>
        )}
        {groups.length === 0 && (
          <div className="text-center text-sm text-muted-foreground pt-10">
            Nenhuma mensagem ainda. Diga olá!
          </div>
        )}
        {groups.map((g) => (
          <div key={g.day} className="space-y-2">
            <div className="flex justify-center">
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {g.day}
              </span>
            </div>
            {g.items.map((m) => {
              const mine = isOwnMessage(m, me.id, other.id);
              const isImage = isImageBody(m.body);
              const isAudio = isAudioBody(m.body);
              const isFile = isFileBody(m.body);
              const isMedia = isImage || isAudio || isFile;
              return (
                <div
                  key={m.id}
                  className={`group flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}
                >
                  {isAdmin && mine && (
                    <DeleteMessageButton onConfirm={() => repo.deleteMessage(m.id)} />
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl text-sm shadow-sm ${
                      isImage ? "p-1" : "px-3 py-2"
                    } ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border rounded-bl-sm"
                    }`}
                  >
                    <div
                      className={`text-[11px] font-semibold mb-1 ${mine ? "text-primary-foreground/90" : "text-primary"} ${isMedia ? "px-2 pt-1" : ""}`}
                    >
                      {mine ? me.name : other.name}
                    </div>
                    {isImage ? (
                      <ImagePreview src={m.body} />
                    ) : isAudio ? (
                      <AudioMessage src={m.body} mine={mine} />
                    ) : isFile ? (
                      <FileAttachment body={m.body} mine={mine} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    )}
                    <div
                      className={`mt-1 text-[10px] flex items-center gap-1 justify-end ${mine ? "text-primary-foreground/70" : "text-muted-foreground"} ${isMedia ? "px-2 pb-1" : ""}`}
                    >
                      <span>{fmtTime(m.createdAt)}</span>
                      {mine && <MessageTicks message={m} viewer={viewer} />}
                    </div>
                  </div>
                  {isAdmin && !mine && (
                    <DeleteMessageButton onConfirm={() => repo.deleteMessage(m.id)} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <form
        className="border-t bg-card p-3 flex gap-2 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            void handleDocument(e.target.files?.[0]);
            e.target.value = "";
          }}
        />


        {recording ? (
          <>
            <div className="flex-1 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="tabular-nums">
                Gravando {Math.floor(recordSeconds / 60)}:
                {String(recordSeconds % 60).padStart(2, "0")}
              </span>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={cancelRecording}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" onClick={stopRecording}>
              <Square className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title="Enviar imagem"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => cameraInputRef.current?.click()}
              title="Tirar foto"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => docInputRef.current?.click()}
              title="Enviar arquivo (PDF, documento)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={startRecording}
              title="Gravar áudio"
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                other.id === ADMIN_ID
                  ? "Escreva uma mensagem para o Admin..."
                  : `Responder ${other.name}...`
              }
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={!text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </>
        )}
      </form>
    </div>
  );
}

function FileAttachment({ body, mine }: { body: string; mine: boolean }) {
  const f = parseFileBody(body);
  if (!f) return null;
  return (
    <a
      href={f.url}
      download={f.name}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 min-w-[180px] max-w-[280px] rounded-lg px-2 py-1 ${
        mine ? "hover:bg-primary-foreground/10" : "hover:bg-accent"
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-md shrink-0 ${
          mine ? "bg-primary-foreground/20" : "bg-muted"
        }`}
      >
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{f.name}</div>
        <div className={`text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          Toque para abrir
        </div>
      </div>
    </a>
  );
}

function DeleteMessageButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive p-1"
          aria-label="Excluir mensagem"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
          <AlertDialogDescription>
            Essa ação não pode ser desfeita. A mensagem será removida permanentemente e não
            poderá ser recuperada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ImagePreview({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block focus:outline-none"
      >
        <img
          src={src}
          alt="anexo"
          className="max-h-64 rounded-xl object-cover cursor-zoom-in"
        />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            ✕
          </button>
          <img
            src={src}
            alt="anexo ampliado"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}
