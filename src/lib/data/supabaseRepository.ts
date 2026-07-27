import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/loose-client";
import { translateAuthError } from "@/lib/auth/translate-error";
import type { BroadcastAudience, NewUserInput, Repository } from "./repository";
import type { BroadcastMessage, Message, Tag, User, UserProfilePatch, UserType } from "./types";

function reportError(title: string, error: unknown) {
  const raw =
    error && typeof error === "object"
      ? (error as { message?: string; details?: string; hint?: string; code?: string })
      : null;
  const translated = translateAuthError(error);
  const code = raw?.code;

  // Explicações amigáveis por código do Postgres/PostgREST
  const codeExplanations: Record<string, string> = {
    "42501": "Seu usuário não tem permissão para essa operação (RLS).",
    "23505": "Já existe um registro com esses dados (valor duplicado).",
    "23503": "Referência inválida: o item vinculado não existe.",
    "23502": "Um campo obrigatório ficou em branco.",
    "23514": "Um dos valores enviados não passou na validação do banco.",
    "PGRST301": "Sessão expirada. Faça login novamente.",
    "PGRST116": "Nenhum registro encontrado.",
    "PGRST204": "A tabela não tem a coluna esperada. Contate o suporte.",
  };

  const parts: string[] = [];
  if (translated) parts.push(translated);
  if (code && codeExplanations[code] && !parts.includes(codeExplanations[code])) {
    parts.push(codeExplanations[code]);
  }
  if (raw?.details) parts.push(`Detalhe: ${raw.details}`);
  if (raw?.hint) parts.push(`Dica: ${raw.hint}`);
  if (code) parts.push(`Código: ${code}`);

  const description = parts.filter(Boolean).join("\n");
  console.error(title, error);
  toast.error(title, { description: description || undefined, duration: 12000 });
}

type ProfileRow = {
  id: string;
  user_number: string;
  type: UserType;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  placa: string | null;
  email: string | null;
  whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
  foto_url: string | null;
  tipo_veiculo: string | null;
  rntrc: string | null;
  carroceria: string | null;
  peso: string | null;
  nome_fantasia: string | null;
  perfil_empresa: string | null;
  site_rede_social: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  active?: boolean | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  from_user_id: string;
  to_user_id: string;
  body: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_user: boolean;
};

type BroadcastRow = {
  id: string;
  body: string;
  audience: string;
  tag_id: string | null;
  sent_at: string;
  recipient_count: number;
};

export function profileToUser(p: ProfileRow): User {
  const active = p.active ?? true;
  const createdAt = p.created_at ? new Date(p.created_at).getTime() : 0;
  const base = {
    id: p.id,
    number: p.user_number,
    name: p.name,
    password: "",
    createdAt,
    active,
    email: p.email ?? undefined,
    whatsapp: p.whatsapp ?? undefined,
    cidade: p.cidade ?? undefined,
    estado: p.estado ?? undefined,
    fotoUrl: p.foto_url ?? undefined,
    cpf: p.cpf ?? undefined,
    cnpj: p.cnpj ?? undefined,
  };
  if (p.type === "empresa")
    return {
      ...base,
      type: "empresa",
      cnpj: p.cnpj ?? "",
      nomeFantasia: p.nome_fantasia ?? undefined,
      perfilEmpresa: p.perfil_empresa ?? undefined,
      siteRedeSocial: p.site_rede_social ?? undefined,
    };
  if (p.type === "motorista")
    return {
      ...base,
      type: "motorista",
      placa: p.placa ?? "",
      tipoVeiculo: p.tipo_veiculo ?? undefined,
      rntrc: p.rntrc ?? undefined,
      carroceria: p.carroceria ?? undefined,
      peso: p.peso ?? undefined,
      siteRedeSocial: p.site_rede_social ?? undefined,
    };
  if (p.type === "colaborador") return { ...base, type: "colaborador" };
  return { ...base, type: "admin" };
}


function mapMessage(r: MessageRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    body: r.body,
    createdAt: new Date(r.created_at).getTime(),
    readByAdmin: r.read_by_admin,
    readByUser: r.read_by_user,
  };
}

function mapBroadcast(r: BroadcastRow): BroadcastMessage {
  return {
    id: r.id,
    body: r.body,
    audience: r.audience as BroadcastMessage["audience"],
    tagId: r.tag_id ?? undefined,
    sentAt: new Date(r.sent_at).getTime(),
    recipientCount: r.recipient_count,
  };
}

function profilePatchToRow(patch: UserProfilePatch): Record<string, string | boolean | null> {
  const row: Record<string, string | boolean | null> = {};
  const put = (column: string, value: string | boolean | undefined) => {
    if (value === undefined) return;
    row[column] = typeof value === "string" ? value.trim() || null : value;
  };

  put("name", patch.name);
  // email vive em auth.users; a tabela profiles não tem essa coluna
  put("whatsapp", patch.whatsapp);
  put("cpf", patch.cpf);
  put("cnpj", patch.cnpj);
  put("cidade", patch.cidade);
  put("estado", patch.estado);
  put("foto_url", patch.fotoUrl);
  put("placa", patch.placa);
  put("tipo_veiculo", patch.tipoVeiculo);
  put("rntrc", patch.rntrc);
  put("carroceria", patch.carroceria);
  put("peso", patch.peso);
  put("nome_fantasia", patch.nomeFantasia);
  put("perfil_empresa", patch.perfilEmpresa);
  put("site_rede_social", patch.siteRedeSocial);
  put("active", patch.active);
  put("type", patch.type);

  return row;
}

const CACHE_PREFIX = "svlogistica:repo-cache:v1:";
const PHOTO_CACHE_KEY = "svlogistica:photo-cache:v1";

type SyncPhase = "idle" | "syncing";
export type SyncState = { phase: SyncPhase; done: number; total: number };

type CacheBlob = {
  users: User[];
  messages: Message[];
  tags: Tag[];
  convTags: { conversationId: string; tagId: string }[];
  broadcasts: BroadcastMessage[];
  lastSeen: [string, number][];
};

class SupabaseRepository implements Repository {
  private users: User[] = [];
  private serverPhotos: Record<string, string> = {};
  private removedPhotoIds = new Set<string>();


  private messages: Message[] = [];
  private tags: Tag[] = [];
  private convTags: { conversationId: string; tagId: string }[] = [];
  private broadcasts: BroadcastMessage[] = [];
  private subs = new Set<() => void>();
  private syncSubs = new Set<(s: SyncState) => void>();
  private sync: SyncState = { phase: "idle", done: 0, total: 0 };
  private adminAuthId: string | null = null;
  private realtimeStarted = false;
  private onlineIds = new Set<string>();
  private lastSeen = new Map<string, number>();
  private heartbeatTimer: number | null = null;
  private presenceChannel: ReturnType<typeof supabase.channel> | null = null;
  private pendingTagSaves = new Map<string, Promise<boolean>>();
  private bootstrapped = false;
  private cacheKey: string | null = null;
  private cachePersistTimer: number | null = null;
  private pendingSendKeys = new Map<string, string[]>(); // key -> fila de tempIds
  private lastSendAt = 0;

  private authUserId: string | null | undefined = undefined;

  constructor() {
    if (typeof window !== "undefined") {
      void this.bootstrap();
      supabase.auth.onAuthStateChange((event, session) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        // Ignore token refreshes / duplicate events that don't actually change
        // the logged-in identity — each bootstrap re-hits the DB heavily.
        const nextId = session?.user.id ?? null;
        if (this.authUserId !== undefined && this.authUserId === nextId) return;
        this.authUserId = nextId;
        void this.bootstrap();
      });
    }
  }


  isBootstrapped(): boolean {
    return this.bootstrapped;
  }

  getSyncState(): SyncState {
    return this.sync;
  }

  subscribeSync(cb: (s: SyncState) => void): () => void {
    this.syncSubs.add(cb);
    return () => {
      this.syncSubs.delete(cb);
    };
  }

  private setSync(next: SyncState) {
    this.sync = next;
    this.syncSubs.forEach((cb) => cb(next));
  }

  // As fotos ficam em um cache próprio: elas são pesadas (dataURL) e não podem
  // fazer o cache principal estourar a quota — assim a foto aparece na hora
  // (pré-carregada) e nunca "pisca" enquanto o perfil recarrega do banco.
  private loadPhotoCache(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(PHOTO_CACHE_KEY) || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  }

  // Nunca sobrescreve o cache com um mapa vazio/parcial: as fotos só saem do
  // cache quando são removidas de propósito (removePhotoFromCache).
  private persistPhotoCache() {
    if (typeof window === "undefined") return;
    const map: Record<string, string> = { ...this.loadPhotoCache(), ...this.serverPhotos };
    for (const u of this.users) if (u.fotoUrl) map[u.id] = u.fotoUrl;
    for (const id of this.removedPhotoIds) delete map[id];
    const ids = Object.keys(map);
    if (!ids.length) {
      try {
        window.localStorage.removeItem(PHOTO_CACHE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    // Se estourar a quota, vai descartando as fotos mais antigas do mapa em vez
    // de apagar tudo — assim as fotos usadas continuam disponíveis offline.
    let entries = ids.map((id) => [id, map[id]] as const);
    while (entries.length) {
      try {
        window.localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
        return;
      } catch {
        entries = entries.slice(Math.ceil(entries.length / 4));
      }
    }
  }

  private removePhotoFromCache(id: string) {
    this.removedPhotoIds.add(id);
    delete this.serverPhotos[id];
    this.persistPhotoCache();
  }

  private applyPhotoCache() {
    const map = { ...this.loadPhotoCache(), ...this.serverPhotos };
    if (!Object.keys(map).length) return;
    this.users = this.users.map((u) => (u.fotoUrl ? u : map[u.id] ? { ...u, fotoUrl: map[u.id] } : u));
  }

  // Fotos vêm do banco (profiles.foto_url) via servidor, então todos veem
  // exatamente a mesma imagem do perfil — e a troca aparece para todo mundo.
  // Quando o servidor não devolve a foto de alguém, a última foto conhecida é
  // mantida (a foto só some quando é removida de propósito).
  private async loadPhotos() {
    const { getProfilePhotos } = await import("./photos.functions");
    const map = await getProfilePhotos();
    this.serverPhotos = { ...this.serverPhotos, ...map };
    for (const id of Object.keys(map)) this.removedPhotoIds.delete(id);
    const fallback = { ...this.loadPhotoCache(), ...this.serverPhotos };
    this.users = this.users.map((u) => {
      const photo = fallback[u.id];
      if (photo) return u.fotoUrl === photo ? u : { ...u, fotoUrl: photo };
      return u;
    });
    this.persistPhotoCache();
    this.persistCache();
    this.notify();
  }

  // As fotos são do perfil (banco), então valem para qualquer conta que abrir o
  // sistema. Elas carregam em segundo plano — nunca seguram o carregamento das
  // conversas — e tentam de novo se a primeira busca falhar. Depois ficam no
  // cache local, então nas próximas visitas aparecem na hora.
  private photoLoadStarted = false;
  private loadPhotosInBackground() {
    if (this.photoLoadStarted) return;
    this.photoLoadStarted = true;
    const attempt = (tries: number) => {
      this.loadPhotos().catch((error) => {
        console.warn("[photos] falha ao carregar fotos dos perfis", error);
        if (tries > 0) setTimeout(() => attempt(tries - 1), 5000);
        else this.photoLoadStarted = false;
      });
    };
    attempt(3);
  }




  private hydrateFromCache(uid: string): boolean {
    if (typeof window === "undefined") return false;
    this.cacheKey = CACHE_PREFIX + uid;
    try {
      const raw = window.localStorage.getItem(this.cacheKey);
      if (!raw) return false;
      const blob = JSON.parse(raw) as CacheBlob;
      this.users = blob.users ?? [];
      this.messages = blob.messages ?? [];
      this.tags = blob.tags ?? [];
      this.convTags = blob.convTags ?? [];
      this.broadcasts = blob.broadcasts ?? [];
      this.lastSeen = new Map(blob.lastSeen ?? []);
      this.applyPhotoCache();
      return this.messages.length > 0 || this.users.length > 0;
    } catch {
      return false;
    }
  }

  private persistCache() {
    if (!this.cacheKey || typeof window === "undefined") return;
    if (this.cachePersistTimer) window.clearTimeout(this.cachePersistTimer);
    this.cachePersistTimer = window.setTimeout(() => {
      if (!this.cacheKey) return;
      this.persistPhotoCache();
      const build = (messageLimit?: number): CacheBlob => ({
        // Sem as fotos: elas vivem no cache dedicado acima.
        users: this.users.map((u) => (u.fotoUrl ? { ...u, fotoUrl: undefined } : u)),
        messages: messageLimit ? this.messages.slice(-messageLimit) : this.messages,
        tags: this.tags,
        convTags: this.convTags,
        broadcasts: this.broadcasts,
        lastSeen: Array.from(this.lastSeen.entries()),
      });
      const attempts: (number | undefined)[] = [undefined, 2000, 500];
      for (const limit of attempts) {
        try {
          window.localStorage.setItem(this.cacheKey, JSON.stringify(build(limit)));
          return;
        } catch (err) {
          console.warn("repo cache persist retry", limit, err);
        }
      }
    }, 400);
  }


  private notify() {
    this.dedupeMessages();
    this.subs.forEach((cb) => cb());
  }

  /** Remove mensagens repetidas pelo mesmo id (mantém a última versão). */
  private dedupeMessages() {
    const seen = new Set<string>();
    let dup = false;
    for (const m of this.messages) {
      if (seen.has(m.id)) {
        dup = true;
        break;
      }
      seen.add(m.id);
    }
    if (!dup) return;
    const byId = new Map<string, Message>();
    for (const m of this.messages) byId.set(m.id, { ...(byId.get(m.id) ?? {}), ...m });
    this.messages = Array.from(byId.values());
  }

  private async bootstrap() {
    // 1. Resolve session first so we know whose cache to hydrate.
    const { data: sessionData } = await supabase.auth.getSession().catch(async (error) => {
      const message = String(error instanceof Error ? error.message : error ?? "");
      if (/refresh_token_not_found|invalid refresh token/i.test(message)) {
        window.localStorage.removeItem("ext-sb-auth-token");
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        return { data: { session: null } };
      }
      throw error;
    });
    const sessionUserId = sessionData?.session?.user.id ?? null;
    this.authUserId = sessionUserId;


    // 2. Hydrate from cache immediately — UI shows conversations right away.
    const hadCache = sessionUserId ? this.hydrateFromCache(sessionUserId) : false;
    if (hadCache) {
      this.bootstrapped = true;
      this.normalizeMessageConversationIds();
      this.notify();
    }

    try {
      // 3. Cold datasets fetch in parallel with the delta sync.
      const coldLoads = Promise.all([
        this.loadUsers().then(() => {
          if (sessionUserId) this.loadPhotosInBackground();
        }),

        this.loadTags(),
        this.loadConvTags(),
        this.loadBroadcasts(),
      ]);

      const msgSync = sessionUserId ? this.syncMessages() : (this.messages = [], Promise.resolve());
      await Promise.all([coldLoads, msgSync]);
      this.normalizeMessageConversationIds();

      const current = sessionUserId ? this.getUser(sessionUserId) : null;
      const admin = this.users.find((u) => u.type === "admin");
      this.adminAuthId = current?.type === "admin" || current?.type === "colaborador" ? current.id : admin?.id ?? null;

      if (!this.realtimeStarted) {
        this.realtimeStarted = true;
        this.subscribeRealtime();
      }
      this.persistCache();
    } catch (error) {
      console.error("bootstrap failed", error);
    } finally {
      this.bootstrapped = true;
      this.notify();
    }
  }

  private async loadUsers() {
    const { data } = await supabase.from("profiles").select("*");
    if (data) {
      const rows = data as ProfileRow[];
      this.users = rows.map(profileToUser);
      // Mantém a foto já conhecida caso a linha volte sem ela (RLS/coluna nula),
      // evitando a foto aparecer e sumir a cada recarga.
      this.applyPhotoCache();
      for (const r of rows) {
        if (r.last_seen_at) this.lastSeen.set(r.id, new Date(r.last_seen_at).getTime());
      }
      this.normalizeMessageConversationIds();
      this.persistCache();
    }
  }
  private async loadTags() {
    const { data } = await supabase.from("tags").select("*").order("label");
    if (data) {
      this.tags = (data as Tag[]).map((t) => ({ id: t.id, label: t.label, color: t.color }));
      this.persistCache();
    }
  }
  private async loadConvTags() {
    const { data } = await supabase.from("conversation_tags").select("*");
    if (data) {
      this.convTags = (data as { conversation_id: string; tag_id: string }[]).map((c) => ({
        conversationId: c.conversation_id,
        tagId: c.tag_id,
      }));
      this.persistCache();
    }
  }
  private async syncMessages() {
    // Skip authenticated server call when there's no session (e.g. /auth route).
    const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    if (!sessionData?.session) {
      this.messages = [];
      return;
    }

    const { listVisibleMessages } = await import("./messages.functions");
    const cachedLastCreatedAt = this.messages.reduce(
      (max, m) => (m.createdAt > max ? m.createdAt : max),
      0,
    );

    try {
      if (cachedLastCreatedAt > 0) {
        // Delta sync: fetch only messages newer than what we already have.
        const sinceIso = new Date(cachedLastCreatedAt).toISOString();
        const pageSize = 100;
        let offset = 0;
        let total = 0;
        const seenIds = new Set(this.messages.map((m) => m.id));
        while (true) {
          const result = await listVisibleMessages({
            data: { since: sinceIso, offset, limit: pageSize },
          });
          // Only the first page returns an exact count; keep it so the
          // progress bar doesn't shrink as later pages come in.
          if (offset === 0) total = result.total || result.rows.length;

          if (offset === 0 && total > 20) {
            this.setSync({ phase: "syncing", done: 0, total });
          }
          for (const row of result.rows) {
            if (seenIds.has(row.id)) continue;
            seenIds.add(row.id);
            this.messages.push(this.mapMessage(row as MessageRow));
          }
          offset += result.rows.length;
          if (this.sync.phase === "syncing") {
            this.setSync({ phase: "syncing", done: Math.min(offset, total), total });
          }
          this.notify();
          if (result.rows.length < pageSize || offset >= total) break;
        }
      } else {
        // Cold load — one shot, the server returns the latest window.
        const result = await listVisibleMessages({ data: {} });
        this.messages = (result.rows as MessageRow[]).map((r) => this.mapMessage(r));
      }
    } catch (error) {
      console.error("syncMessages failed", error);
      if (cachedLastCreatedAt === 0) {
        // No cache and server failed — fall back to public REST read.
        const { data } = await supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (data) {
          const rows = (data as MessageRow[]).slice().reverse();
          this.messages = rows.map((r) => this.mapMessage(r));
        }
      }
    } finally {
      if (this.sync.phase === "syncing") {
        this.setSync({ phase: "idle", done: 0, total: 0 });
      }
      this.persistCache();
    }
  }
  private async loadBroadcasts() {
    const { data } = await supabase
      .from("broadcast_messages")
      .select("*")
      .order("sent_at", { ascending: false });
    if (data) {
      this.broadcasts = (data as BroadcastRow[]).map(mapBroadcast);
      this.persistCache();
    }
  }


  private subscribeRealtime() {
    supabase
      .channel("cf-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const m = this.mapMessage(payload.new as MessageRow);
            // Se já temos essa mensagem (id), ignora.
            const existingIdx = this.messages.findIndex((x) => x.id === m.id);
            if (existingIdx >= 0) {
              this.messages[existingIdx] = { ...m, conversationId: this.messages[existingIdx].conversationId, fromUserId: this.messages[existingIdx].fromUserId };
            } else {
              // Se há um temp pendente equivalente, substitui em vez de adicionar
              // (consome apenas UM da fila — envios idênticos seguidos).
              const key = this.pendingKey(m.fromUserId, m.toUserId, m.body);
              const queue = this.pendingSendKeys.get(key) ?? [];
              let tempIdx = -1;
              while (queue.length > 0 && tempIdx < 0) {
                const tempId = queue.shift() as string;
                tempIdx = this.messages.findIndex((x) => x.id === tempId);
              }
              if (queue.length === 0) this.pendingSendKeys.delete(key);
              if (tempIdx >= 0) {
                const prev = this.messages[tempIdx];
                this.messages[tempIdx] = { ...m, conversationId: prev.conversationId, fromUserId: prev.fromUserId, createdAt: prev.createdAt };
              } else {
                this.messages.push(m);
              }
            }
            // If the message references a user we haven't loaded yet
            // (fresh signup after admin logged in), refresh profiles so
            // the conversation shows up in the sidebar.
            const knownIds = new Set(this.users.map((u) => u.id));
            const needsRefresh =
              (m.fromUserId && !knownIds.has(m.fromUserId)) ||
              (m.toUserId && !knownIds.has(m.toUserId));
            if (needsRefresh) {
              void this.loadUsers().then(() => this.notify());
            }
          } else if (payload.eventType === "UPDATE") {
            const m = this.mapMessage(payload.new as MessageRow);
            const i = this.messages.findIndex((x) => x.id === m.id);
            if (i >= 0) this.messages[i] = m;
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: string }).id;
            this.messages = this.messages.filter((x) => x.id !== oldId);
          }
          this.notify();
        },
      )
      .subscribe();

    // Watch profiles so new signups appear in the admin conversation list
    // without requiring a page reload. We apply the payload row directly
    // instead of re-fetching every profile — that keeps the DB idle even
    // when presence/last_seen updates fire frequently.
    supabase
      .channel("cf-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string })?.id;
            if (!oldId) return;
            const before = this.users.length;
            this.users = this.users.filter((u) => u.id !== oldId);
            if (this.users.length !== before) {
              this.persistCache();
              this.notify();
            }
            return;
          }
          const row = payload.new as ProfileRow | undefined;
          if (!row?.id) return;
          const nextUser = profileToUser(row);
          // Mantém o mapa compartilhado de fotos em sincronia: a foto do
          // perfil é a mesma para todos os usuários do sistema.
          const hasPhotoColumn = Object.prototype.hasOwnProperty.call(row, "foto_url");
          if (row.foto_url) {
            this.removedPhotoIds.delete(row.id);
            this.serverPhotos[row.id] = row.foto_url;
            this.persistPhotoCache();
          } else if (hasPhotoColumn) {
            this.removePhotoFromCache(row.id);
          } else if (this.serverPhotos[row.id]) {
            nextUser.fotoUrl = this.serverPhotos[row.id];
          }




          const i = this.users.findIndex((u) => u.id === row.id);
          if (i >= 0) this.users[i] = nextUser;
          else this.users.push(nextUser);

          if (row.last_seen_at) {
            this.lastSeen.set(row.id, new Date(row.last_seen_at).getTime());
          }
          this.persistCache();
          this.notify();
        },
      )
      .subscribe();

    supabase
      .channel("cf-tags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tags" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string })?.id;
            if (!oldId) return;
            this.tags = this.tags.filter((t) => t.id !== oldId);
          } else {
            const row = payload.new as Tag | undefined;
            if (!row?.id) return;
            const i = this.tags.findIndex((t) => t.id === row.id);
            const next = { id: row.id, label: row.label, color: row.color };
            if (i >= 0) this.tags[i] = next;
            else this.tags.push(next);
          }
          this.persistCache();
          this.notify();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_tags" },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as
            | { conversation_id?: string; tag_id?: string }
            | undefined;
          const conversationId = row?.conversation_id;
          const tagId = row?.tag_id;
          if (!conversationId || !tagId) return;
          if (payload.eventType === "DELETE") {
            this.convTags = this.convTags.filter(
              (c) => !(c.conversationId === conversationId && c.tagId === tagId),
            );
          } else {
            const exists = this.convTags.some(
              (c) => c.conversationId === conversationId && c.tagId === tagId,
            );
            if (!exists) this.convTags.push({ conversationId, tagId });
          }
          this.persistCache();
          this.notify();
        },
      )
      .subscribe();
  }


  // ============ users ============
  listUsers() {
    return this.users;
  }
  getUser(idOrNumber: string) {
    return this.users.find((u) => u.id === idOrNumber || u.number === idOrNumber);
  }

  private isStaff(user?: User) {
    return user?.type === "admin" || user?.type === "colaborador";
  }

  private staffPairId(a: string, b: string): string {
    const [x, y] = [a, b].sort();
    return `${x}__${y}`;
  }

  private resolveConversationId(fromUserId: string, toUserId: string, fallback: string): string {
    // Cada par (remetente ↔ destinatário) tem sua própria conversa.
    // Usamos os IDs (UUIDs) dos usuários para garantir unicidade mesmo
    // quando `user_number` estiver ausente ou duplicado.
    if (fromUserId && toUserId) return this.staffPairId(fromUserId, toUserId);
    return fallback;
  }

  private mapMessage(row: MessageRow): Message {
    const msg = mapMessage(row);
    msg.conversationId = this.resolveConversationId(row.from_user_id, row.to_user_id, row.conversation_id);
    return msg;
  }

  private normalizeMessageConversationIds() {
    for (const message of this.messages) {
      message.conversationId = this.resolveConversationId(
        message.fromUserId,
        message.toUserId,
        message.conversationId,
      );
    }
  }

  private storageConversationId(fromUserId: string, toUserId: string): string {
    return this.resolveConversationId(fromUserId, toUserId, "");
  }


  nextNumberFor(_type: UserType): string {
    return "";
  }
  createUser(_: NewUserInput): User {
    throw new Error("Use Supabase Auth signUp");
  }

  updateUser(id: string, patch: UserProfilePatch): User | undefined {
    const user = this.getUser(id);
    if (!user) return undefined;
    const previous = { ...user } as User;
    Object.assign(user, patch);
    this.notify();

    const row = profilePatchToRow(patch);
    if (Object.keys(row).length > 0) {
      void (async () => {
        try {
          const { adminUpdateProfile } = await import("./admin-profile.functions");
          const result = await adminUpdateProfile({ data: { userId: user.id, patch: row } });
          if (result?.row) {
            const savedRow = result.row as ProfileRow;
            const saved = profileToUser(savedRow);
            // Se a resposta vier sem a coluna da foto, mantém a foto atual em
            // vez de apagá-la da tela.
            if (saved.fotoUrl === undefined && !("foto_url" in savedRow)) {
              saved.fotoUrl = user.fotoUrl;
            }
            Object.assign(user, saved);
            // A foto salva no banco vale para todos: atualiza o mapa
            // compartilhado para admin, colaboradores e o próprio usuário.
            if (patch.fotoUrl !== undefined) {
              if (user.fotoUrl) {
                this.removedPhotoIds.delete(user.id);
                this.serverPhotos[user.id] = user.fotoUrl;
                this.persistPhotoCache();
              } else {
                this.removePhotoFromCache(user.id);
              }
            }
            this.persistCache();
            this.notify();
          }


        } catch (error) {
          Object.assign(user, previous);
          this.notify();
          reportError("Não foi possível atualizar o perfil", error);
        }
      })();
    }

    return user;
  }


  applyLocalUserPatch(id: string, patch: UserProfilePatch): User | undefined {
    const user = this.getUser(id);
    if (!user) return undefined;
    Object.assign(user, patch);
    this.notify();
    return user;
  }

  // ============ messages ============
  private staffInboxConversationIds(conversationId: string): string[] {
    const parts = conversationId.split("__").filter(Boolean);
    const nonStaffId = parts.find((part) => {
      const user = this.getUser(part);
      return user && !this.isStaff(user);
    });
    if (!nonStaffId) return [conversationId];
    const staffIds = this.users.filter((u) => this.isStaff(u)).map((u) => u.id);
    return Array.from(
      new Set([
        conversationId,
        ...staffIds.map((sid) => this.staffPairId(nonStaffId, sid)),
      ]),
    );
  }


  private conversationLookupIds(conversationId: string, staffInbox?: boolean): string[] {
    if (staffInbox) return this.staffInboxConversationIds(conversationId);
    const parts = conversationId.split("__").filter(Boolean);
    const nonStaffId = parts.find((part) => {
      const user = this.getUser(part);
      return user && !this.isStaff(user);
    });
    const hasAdminContact = parts.some((part) => this.getUser(part)?.type === "admin");
    if (nonStaffId && hasAdminContact) {
      const adminIds = this.users.filter((u) => u.type === "admin").map((u) => u.id);
      return Array.from(new Set([conversationId, ...adminIds.map((id) => this.staffPairId(nonStaffId, id))]));
    }
    return [conversationId];
  }

  listMessages(conversationId: string, options?: { staffInbox?: boolean }) {
    const ids = this.conversationLookupIds(conversationId, options?.staffInbox);
    return this.messages
      .filter((m) => ids.includes(m.conversationId))
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        // Ordem estável: mensagens já persistidas antes de temporárias com mesmo ts.
        const aTemp = a.id.startsWith("tmp_");
        const bTemp = b.id.startsWith("tmp_");
        if (aTemp !== bTemp) return aTemp ? 1 : -1;
        return a.id < b.id ? -1 : 1;
      });
  }

  async refreshMessages(): Promise<void> {
    await this.syncMessages();
    this.normalizeMessageConversationIds();
    this.notify();
  }

  private pendingKey(fromUserId: string, toUserId: string, body: string): string {
    return `${fromUserId}\u0000${toUserId}\u0000${body}`;
  }

  /** Remove um tempId específico da fila de pendentes dessa chave. */
  private dropPending(key: string, tempId: string) {
    const queue = (this.pendingSendKeys.get(key) ?? []).filter((id) => id !== tempId);
    if (queue.length === 0) this.pendingSendKeys.delete(key);
    else this.pendingSendKeys.set(key, queue);
  }



  sendMessage({
    fromUserId,
    toUserId,
    body,
  }: {
    fromUserId: string;
    toUserId: string;
    body: string;
  }): Message {
    const from = this.getUser(fromUserId);
    const fromStaff = this.isStaff(from);
    const conversationId = this.staffPairId(fromUserId, toUserId);

    // Timestamp monotônico crescente para preservar ordem em envios rápidos
    // dentro do mesmo milissegundo.
    const now = Math.max(Date.now(), this.lastSendAt + 1);
    this.lastSendAt = now;

    const tempId = `tmp_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const msg: Message = {
      id: tempId,
      conversationId,
      fromUserId,
      toUserId,
      body,
      createdAt: now,
      readByAdmin: fromStaff,
      readByUser: !fromStaff,
    };
    this.messages.push(msg);
    const pendKey = this.pendingKey(fromUserId, toUserId, body);
    this.pendingSendKeys.set(pendKey, [...(this.pendingSendKeys.get(pendKey) ?? []), tempId]);
    this.notify();

    void (async () => {
      try {
        const { sendChatMessage } = await import("./messages.functions");
        const result = await sendChatMessage({ data: { toUserId, body } });
        const real = this.mapMessage(result.row as MessageRow);
        // Preserva conversationId/fromUserId do lado do cliente (o servidor
        // pode canonizar o remetente para ADM-0001).
        const displayReal: Message = { ...real, conversationId, fromUserId, createdAt: msg.createdAt };
        const realIdx = this.messages.findIndex((m) => m.id === real.id);
        const tempIdx = this.messages.findIndex((m) => m.id === tempId);
        if (realIdx >= 0) {
          // Realtime chegou primeiro. Mantém a real e remove o temp.
          this.messages[realIdx] = displayReal;
          if (tempIdx >= 0) this.messages.splice(tempIdx, 1);
        } else if (tempIdx >= 0) {
          this.messages[tempIdx] = displayReal;
        } else {
          this.messages.push(displayReal);
        }
        this.dropPending(pendKey, tempId);
        this.notify();
      } catch (error) {
        this.messages = this.messages.filter((m) => m.id !== tempId);
        this.dropPending(pendKey, tempId);
        this.notify();
        reportError("Não foi possível enviar a mensagem", error);
      }
    })();
    return msg;
  }


  deleteMessage(id: string): void {
    const prev = this.messages;
    this.messages = this.messages.filter((m) => m.id !== id);
    this.notify();
    void supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          this.messages = prev;
          this.notify();
          reportError("Não foi possível excluir a mensagem", error);
        }
      });
  }

  deleteConversation(conversationId: string): void {
    const prevMsgs = this.messages;
    const prevConv = this.convTags;
    const idsToDelete = this.messages
      .filter((m) => m.conversationId === conversationId && !m.id.startsWith("tmp_"))
      .map((m) => m.id);
    const tagConversationId = conversationId.split("__")[0] || conversationId;
    this.messages = this.messages.filter((m) => m.conversationId !== conversationId);
    this.convTags = this.convTags.filter(
      (c) => c.conversationId !== conversationId && c.conversationId !== tagConversationId,
    );
    this.notify();
    void (async () => {
      await supabase.from("conversation_tags").delete().eq("conversation_id", conversationId);
      if (tagConversationId !== conversationId) {
        await supabase.from("conversation_tags").delete().eq("conversation_id", tagConversationId);
      }
      const query = supabase.from("messages").delete();
      const { error } = idsToDelete.length > 0 ? await query.in("id", idsToDelete) : await query.eq("conversation_id", conversationId);
      if (error) {
        this.messages = prevMsgs;
        this.convTags = prevConv;
        this.notify();
        reportError("Não foi possível excluir a conversa", error);
      }
    })();
  }

  markConversationRead(conversationId: string, viewer: "admin" | "user", options?: { staffInbox?: boolean }) {
    const field = viewer === "admin" ? "read_by_admin" : "read_by_user";
    const ids = this.conversationLookupIds(conversationId, options?.staffInbox);
    const idsToUpdate: string[] = [];
    let changed = false;
    for (const m of this.messages) {
      if (!ids.includes(m.conversationId)) continue;
      if (viewer === "admin" && !m.readByAdmin) {
        m.readByAdmin = true;
        changed = true;
        if (!m.id.startsWith("tmp_")) idsToUpdate.push(m.id);
      }
      if (viewer === "user" && !m.readByUser) {
        m.readByUser = true;
        changed = true;
        if (!m.id.startsWith("tmp_")) idsToUpdate.push(m.id);
      }
    }
    if (changed) this.notify();
    if (idsToUpdate.length === 0) return;
    void supabase
      .from("messages")
      .update({ [field]: true })
      .in("id", idsToUpdate)
      .then(({ error }) => {
        if (error) console.error("markConversationRead failed", error);
      });
  }

  unreadCount(conversationId: string, viewer: "admin" | "user"): number {
    return this.messages.filter((m) => {
      if (m.conversationId !== conversationId) return false;
      if (viewer === "admin") return m.toUserId === this.adminAuthId && !m.readByAdmin;
      return m.fromUserId === this.adminAuthId && !m.readByUser;
    }).length;
  }

  listConversations(options?: { staffId?: string }) {
    const staffId = options?.staffId;
    // Admin: caixa unificada com os usuários (sem a equipe).
    // Colaborador: usuários + o administrador (para falar com ele), menos ele mesmo.
    const nonStaff = this.users.filter((u) => {
      if (u.id === staffId) return false;
      if (u.type === "admin" || u.id === this.adminAuthId) return !!staffId && u.active !== false;
      return true;
    });

    return nonStaff
      .map((user) => {
        const conv = this.messages.filter((m) => {
          const involvesUser = m.fromUserId === user.id || m.toUserId === user.id;
          if (!involvesUser) return false;
          // Colaboradores veem apenas a própria conversa com cada usuário.
          if (!staffId) return true;
          return m.fromUserId === staffId || m.toUserId === staffId;
        });
        const lastMessage = [...conv].sort((a, b) => b.createdAt - a.createdAt)[0];
        const unreadForAdmin = conv.filter(
          (m) => this.isStaff(this.getUser(m.toUserId)) && !m.readByAdmin,
        ).length;
        const tagIds = this.convTags
          .filter((c) => c.conversationId === user.number)
          .map((c) => c.tagId);
        return { user, lastMessage, unreadForAdmin, tagIds };
      })
      .sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));
  }


  // ============ tags ============
  listTags() {
    return this.tags;
  }
  createTag(input: { label: string; color: string }): Tag {
    const id = globalThis.crypto?.randomUUID?.() ?? `tag_${Date.now()}`;
    const tag: Tag = { id, ...input };
    this.tags.push(tag);
    this.notify();
    const save: Promise<boolean> = (async () => {
      const { data, error } = await supabase
        .from("tags")
        .insert({ id, label: input.label, color: input.color })
        .select("*")
        .single();
        if (error) {
          throw error;
        }
        const saved = data as Tag;
        const i = this.tags.findIndex((t) => t.id === id);
        if (i >= 0) this.tags[i] = saved;
        else if (!this.tags.some((t) => t.id === saved.id)) this.tags.push(saved);
        this.notify();
        return true;
      })()
      .catch((error: unknown) => {
        this.tags = this.tags.filter((t) => t.id !== id);
        this.convTags = this.convTags.filter((c) => c.tagId !== id);
        this.notify();
        reportError("Não foi possível salvar a tag", error);
        return false;
      })
      .finally(() => {
        this.pendingTagSaves.delete(id);
      });
    this.pendingTagSaves.set(id, save);
    return tag;
  }
  updateTag(id: string, patch: { label?: string; color?: string }): Tag | undefined {
    const t = this.tags.find((x) => x.id === id);
    if (!t) return undefined;
    const previous = { ...t };
    Object.assign(t, patch);
    this.notify();
    void (async () => {
      const { data, error } = await supabase
        .from("tags")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
        if (error) throw error;
        Object.assign(t, data as Tag);
        this.notify();
      })().catch((error: unknown) => {
        Object.assign(t, previous);
        this.notify();
        reportError("Não foi possível salvar as alterações da tag", error);
      });
    return t;
  }
  deleteTag(id: string): void {
    const prevTags = this.tags;
    const prevConv = this.convTags;
    this.tags = this.tags.filter((t) => t.id !== id);
    this.convTags = this.convTags.filter((c) => c.tagId !== id);
    this.notify();
    void (async () => {
      await supabase.from("conversation_tags").delete().eq("tag_id", id);
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) {
        this.tags = prevTags;
        this.convTags = prevConv;
        this.notify();
        reportError("Não foi possível excluir a tag", error);
      }
    })();
  }

  getConversationTagIds(conversationId: string) {
    return this.convTags.filter((c) => c.conversationId === conversationId).map((c) => c.tagId);
  }
  setConversationTags(conversationId: string, tagIds: string[]) {
    const uniqueTagIds = Array.from(new Set(tagIds));
    const prevConv = [...this.convTags];
    this.convTags = this.convTags.filter((c) => c.conversationId !== conversationId);
    for (const tagId of uniqueTagIds) this.convTags.push({ conversationId, tagId });

    this.notify();
    void (async () => {
      const pending = uniqueTagIds
        .map((tagId) => this.pendingTagSaves.get(tagId))
        .filter((save): save is Promise<boolean> => Boolean(save));
      if (pending.length > 0) {
        const saved = await Promise.all(pending);
        if (saved.some((ok) => !ok)) throw new Error("A tag ainda não foi salva.");
      }

      const validTagIds = uniqueTagIds.filter((tagId) => this.tags.some((t) => t.id === tagId));
      const { error: deleteError } = await supabase
        .from("conversation_tags")
        .delete()
        .eq("conversation_id", conversationId);
      if (deleteError) throw deleteError;
      if (validTagIds.length > 0) {
        const { error: insertError } = await supabase
          .from("conversation_tags")
          .insert(validTagIds.map((tag_id) => ({ conversation_id: conversationId, tag_id })));
        if (insertError) throw insertError;
      }
    })().catch((error) => {
      this.convTags = prevConv;
      this.notify();
      reportError("Não foi possível salvar as tags desta conversa", error);
    });
  }

  // ============ broadcasts ============
  resolveBroadcastRecipients(a: BroadcastAudience): User[] {
    const nonAdmins = this.users.filter((u) => u.type !== "admin");
    if (a.kind === "all") return nonAdmins;
    if (a.kind === "empresas") return nonAdmins.filter((u) => u.type === "empresa");
    if (a.kind === "motoristas") return nonAdmins.filter((u) => u.type === "motorista");
    if (a.kind === "colaboradores") return nonAdmins.filter((u) => u.type === "colaborador");
    const nums = new Set(
      this.convTags.filter((c) => c.tagId === a.tagId).map((c) => c.conversationId),
    );
    return nonAdmins.filter((u) => nums.has(u.number));
  }
  sendBroadcast({
    body,
    audience,
    fromUserId,
  }: {
    body: string;
    audience: BroadcastAudience;
    fromUserId: string;
  }): BroadcastMessage {
    const recipients = this.resolveBroadcastRecipients(audience);
    const now = Date.now();

    const rows = recipients.map((r) => ({
      // Cada par (remetente ↔ destinatário) tem sua própria conversa, usando
      // os IDs (UUIDs) dos usuários para garantir unicidade.
      conversation_id: this.staffPairId(fromUserId, r.id),
      from_user_id: fromUserId,
      to_user_id: r.id,
      body,
      read_by_admin: true,
      read_by_user: false,
    }));

    if (rows.length > 0)
      void supabase
        .from("messages")
        .insert(rows)
        .select("*")
        .then(({ data }) => {
          if (data) {
            for (const row of data as MessageRow[]) {
              const m = this.mapMessage(row);
              if (!this.messages.find((x) => x.id === m.id)) this.messages.push(m);
            }
            this.notify();
          }
        });
    const record: BroadcastMessage = {
      id: `tmp_${now}`,
      body,
      audience: audience.kind,
      tagId: audience.kind === "tag" ? audience.tagId : undefined,
      sentAt: now,
      recipientCount: recipients.length,
    };
    this.broadcasts.unshift(record);
    this.notify();
    void supabase
      .from("broadcast_messages")
      .insert({
        body,
        audience: audience.kind,
        tag_id: audience.kind === "tag" ? audience.tagId : null,
        recipient_count: recipients.length,
      })
      .select("*")
      .single()
      .then(({ data }) => {
        if (data) {
          const i = this.broadcasts.findIndex((b) => b.id === record.id);
          if (i >= 0) this.broadcasts[i] = mapBroadcast(data as BroadcastRow);
          this.notify();
        }
      });
    return record;
  }
  listBroadcasts() {
    return this.broadcasts;
  }

  // ============ presence ============
  setPresence(userId: string, online: boolean): void {
    if (!userId) return;
    if (online) {
      // Start heartbeat + join realtime presence channel
      if (this.presenceChannel && this.heartbeatTimer) return;
      this.startPresence(userId);
    } else {
      this.stopPresence(userId);
    }
  }

  private startPresence(userId: string) {
    // Join a shared presence channel
    const channel = supabase.channel("cf-presence", {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        this.onlineIds = new Set(Object.keys(state));
        this.notify();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: Date.now() });
      });
    this.presenceChannel = channel;

    const beat = async () => {
      const iso = new Date().toISOString();
      this.lastSeen.set(userId, Date.now());
      await supabase.from("profiles").update({ last_seen_at: iso }).eq("id", userId);
    };
    void beat();
    this.heartbeatTimer = window.setInterval(beat, 30_000);

    window.addEventListener("beforeunload", () => this.stopPresence(userId));
  }

  private stopPresence(userId: string) {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.presenceChannel) {
      void this.presenceChannel.untrack();
      void supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    const iso = new Date().toISOString();
    this.lastSeen.set(userId, Date.now());
    void supabase.from("profiles").update({ last_seen_at: iso }).eq("id", userId);
  }

  isOnline(userId: string): boolean {
    return this.onlineIds.has(userId);
  }
  getLastSeen(userId: string): number | null {
    return this.lastSeen.get(userId) ?? null;
  }
  sendTyping(): void {}

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }
  subscribeEphemeral(): () => void {
    return () => {};
  }
}

export const repo: Repository = new SupabaseRepository();
