import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, FileText, History, ImagePlus, Megaphone, Mic, Paperclip, Send, Square, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { repo } from "@/lib/data";
import type { BroadcastAudience } from "@/lib/data/repository";
import { useRepoVersion } from "@/lib/hooks/useRepo";
import { AudioMessage } from "./AudioMessage";
import { isAudioBody, isFileBody, isImageBody, mediaSrc, messagePreview, parseFileBody } from "@/lib/chat/messagePreview";
import { optimizeImage } from "@/lib/media/optimize";
import { uploadMedia } from "@/lib/media/upload";

type AudienceKind = "all" | "empresas" | "motoristas" | "colaboradores" | "tag";
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function audienceLabel(kind: AudienceKind, tagLabel?: string) {
  if (kind === "all") return "Todos os usuários";
  if (kind === "empresas") return "Empresas";
  if (kind === "motoristas") return "Motoristas";
  if (kind === "colaboradores") return "Colaboradores";
  return `Tag: ${tagLabel ?? "—"}`;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}


export function BroadcastDialog({
  trigger,
  adminId,
}: {
  trigger: React.ReactNode;
  adminId: string;
}) {
  const v = useRepoVersion();
  const tags = useMemo(() => repo.listTags(), [v]);
  const broadcasts = useMemo(() => repo.listBroadcasts(), [v]);
  const tagsById = useMemo(
    () => Object.fromEntries(tags.map((t) => [t.id, t] as const)),
    [tags],
  );

  const [kind, setKind] = useState<AudienceKind>("all");
  const [tagId, setTagId] = useState<string>("");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null); // data URL
  const [tab, setTab] = useState<"compose" | "history">("compose");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const audience: BroadcastAudience | null =
    kind === "tag"
      ? tagId
        ? { kind: "tag", tagId }
        : null
      : { kind };

  const recipients = audience ? repo.resolveBroadcastRecipients(audience) : [];

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Arquivo muito grande. Limite 5MB.");
      return;
    }
    try {
      const blob = file.type.startsWith("image/")
        ? await optimizeImage(file, { maxDimension: 1600, targetBytes: 400_000 })
        : file;
      const up = await uploadMedia(blob, file.name || "imagem.jpg");
      setAttachment("img:" + up.url);
    } catch {
      toast.error("Falha ao enviar o arquivo.");
    }
  }

  async function handleDocument(file: File | undefined | null) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Arquivo muito grande. Limite 5MB.");
      return;
    }
    try {
      const up = await uploadMedia(file, file.name);
      const payload = JSON.stringify({ name: up.name, url: up.url, mime: up.mime });
      setAttachment("file:" + payload);
    } catch {
      toast.error("Falha ao enviar o arquivo.");
    }
  }


  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mime || "audio/webm" });
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          toast.error("Áudio muito longo. Grave um trecho menor.");
        } else {
          try {
            const up = await uploadMedia(blob, "audio.webm");
            setAttachment("aud:" + up.url);
          } catch {
            toast.error("Falha ao enviar o áudio.");
          }
        }
        setRecordSeconds(0);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
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

  const send = () => {
    if (!audience) {
      toast.error("Selecione uma tag.");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Nenhum destinatário para essa seleção.");
      return;
    }
    const bodies: string[] = [];
    if (attachment) bodies.push(attachment);
    if (text.trim()) bodies.push(text.trim());
    if (bodies.length === 0) return;

    for (const body of bodies) {
      repo.sendBroadcast({ body, audience, fromUserId: adminId });
    }
    toast.success(`Broadcast enviado para ${recipients.length} usuário(s).`);
    setText("");
    setAttachment(null);
    setTab("history");
  };

  const attachIsImage = attachment ? isImageBody(attachment) : false;
  const attachIsAudio = attachment ? isAudioBody(attachment) : false;
  const attachIsFile = attachment ? isFileBody(attachment) : false;
  const attachFileInfo = attachment && attachIsFile ? parseFileBody(attachment) : null;
  const canSend = (!!attachment || !!text.trim()) && recipients.length > 0 && !recording;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Mensagem em massa
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b">
          <button
            className={`px-3 py-1.5 text-xs border-b-2 ${
              tab === "compose"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setTab("compose")}
          >
            Nova
          </button>
          <button
            className={`px-3 py-1.5 text-xs border-b-2 flex items-center gap-1 ${
              tab === "history"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setTab("history")}
          >
            <History className="h-3 w-3" /> Histórico ({broadcasts.length})
          </button>
        </div>

        {tab === "compose" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Destinatários</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AudienceKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent translate="no">
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="empresas">Empresas</SelectItem>
                  <SelectItem value="motoristas">Motoristas</SelectItem>
                  <SelectItem value="colaboradores">Colaboradores</SelectItem>
                  <SelectItem value="tag" disabled={tags.length === 0}>
                    Por tag
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind === "tag" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tag</Label>
                <Select value={tagId} onValueChange={setTagId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                rows={4}
                placeholder="Digite a mensagem (opcional se enviar anexo)..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {/* Attachment area */}
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
              type="file"
              accept="audio/*"
              className="hidden"
              id="broadcast-audio-file"
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

            {attachment && (
              <div className="rounded-md border p-2 relative bg-muted/40">
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 hover:bg-background flex items-center justify-center border"
                  aria-label="Remover anexo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {attachIsImage && (
                  <img
                    src={mediaSrc(attachment)}
                    alt="prévia"
                    className="max-h-40 sm:max-h-48 w-auto rounded object-contain mx-auto"
                  />
                )}
                {attachIsAudio && <AudioMessage src={mediaSrc(attachment)} mine={false} />}
                {attachIsFile && attachFileInfo && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-5 w-5 shrink-0" />
                    <span className="truncate">{attachFileInfo.name}</span>
                  </div>
                )}
              </div>
            )}

            {recording ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm tabular-nums flex-1">
                  Gravando {Math.floor(recordSeconds / 60)}:
                  {String(recordSeconds % 60).padStart(2, "0")}
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={cancelRecording}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" onClick={stopRecording}>
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!attachment}
                >
                  <ImagePlus className="h-4 w-4 mr-1" /> Imagem
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={!!attachment}
                >
                  <Camera className="h-4 w-4 mr-1" /> Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("broadcast-audio-file")?.click()}
                  disabled={!!attachment}
                >
                  <ImagePlus className="h-4 w-4 mr-1" /> Áudio (arquivo)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => docInputRef.current?.click()}
                  disabled={!!attachment}
                >
                  <Paperclip className="h-4 w-4 mr-1" /> Arquivo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startRecording}
                  disabled={!!attachment}
                >
                  <Mic className="h-4 w-4 mr-1" /> Gravar áudio
                </Button>
              </div>
            )}

            {recipients.length === 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive flex items-center gap-2 animate-pulse">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                </span>
                <strong>Selecione pelo menos 1 destinatário para enviar.</strong>
              </div>
            ) : (
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Será enviada para <strong className="text-foreground">{recipients.length}</strong>{" "}
                usuário(s).
              </div>
            )}

            <DialogFooter>
              <Button onClick={send} disabled={!canSend}>
                <Send className="h-4 w-4 mr-1" /> Enviar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto -mx-1">
            {broadcasts.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma mensagem em massa enviada ainda.
              </div>
            )}
            <ul className="divide-y">
              {broadcasts.map((b) => (
                <li key={b.id} className="px-2 py-3">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {audienceLabel(
                        b.audience as AudienceKind,
                        b.tagId ? tagsById[b.tagId]?.label : undefined,
                      )}
                    </span>
                    <span>{timeAgo(b.sentAt)}</span>
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                    {isImageBody(b.body) ? (
                      <img
                        src={mediaSrc(b.body)}
                        alt="anexo"
                        className="max-h-40 rounded object-contain"
                      />
                    ) : isAudioBody(b.body) ? (
                      <AudioMessage src={mediaSrc(b.body)} mine={false} />
                    ) : isFileBody(b.body) ? (
                      (() => {
                        const f = parseFileBody(b.body);
                        return f ? (
                          <a
                            href={f.url}
                            download={f.name}
                            className="inline-flex items-center gap-2 text-primary underline"
                          >
                            <FileText className="h-4 w-4" />
                            {f.name}
                          </a>
                        ) : null;
                      })()
                    ) : (
                      messagePreview(b.body)
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {b.recipientCount} destinatário(s)
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
