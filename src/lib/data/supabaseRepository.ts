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

  return row;
}

class SupabaseRepository implements Repository {
  private users: User[] = [];
  private messages: Message[] = [];
  private tags: Tag[] = [];
  private convTags: { conversationId: string; tagId: string }[] = [];
  private broadcasts: BroadcastMessage[] = [];
  private subs = new Set<() => void>();
  private adminAuthId: string | null = null;
  private realtimeStarted = false;
  private onlineIds = new Set<string>();
  private lastSeen = new Map<string, number>();
  private heartbeatTimer: number | null = null;
  private presenceChannel: ReturnType<typeof supabase.channel> | null = null;
  private pendingTagSaves = new Map<string, Promise<boolean>>();
  private bootstrapped = false;

  constructor() {
    if (typeof window !== "undefined") {
      // Kick off boot; also reload when auth changes (RLS lets user see own rows).
      void this.bootstrap();
      supabase.auth.onAuthStateChange(() => {
        void this.bootstrap();
      });
    }
  }

  isBootstrapped(): boolean {
    return this.bootstrapped;
  }

  private notify() {
    this.subs.forEach((cb) => cb());
  }

  private async bootstrap() {
    this.bootstrapped = false;
    this.notify();
    try {
      await Promise.all([
        this.loadUsers(),
        this.loadTags(),
        this.loadConvTags(),
        this.loadMessages(),
        this.loadBroadcasts(),
      ]);
      this.normalizeMessageConversationIds();
      const { data } = await supabase.auth.getSession().catch(async (error) => {
        const message = String(error instanceof Error ? error.message : error ?? "");
        if (/refresh_token_not_found|invalid refresh token/i.test(message)) {
          window.localStorage.removeItem("ext-sb-auth-token");
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          return { data: { session: null } };
        }
        throw error;
      });
      const current = data.session?.user.id ? this.getUser(data.session.user.id) : null;
      const admin = this.users.find((u) => u.type === "admin");
      this.adminAuthId = current?.type === "admin" || current?.type === "colaborador" ? current.id : admin?.id ?? null;

      if (!this.realtimeStarted) {
        this.realtimeStarted = true;
        this.subscribeRealtime();
      }
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
      for (const r of rows) {
        if (r.last_seen_at) this.lastSeen.set(r.id, new Date(r.last_seen_at).getTime());
      }
      this.normalizeMessageConversationIds();
    }
  }
  private async loadTags() {
    const { data } = await supabase.from("tags").select("*").order("label");
    if (data) this.tags = (data as Tag[]).map((t) => ({ id: t.id, label: t.label, color: t.color }));
  }
  private async loadConvTags() {
    const { data } = await supabase.from("conversation_tags").select("*");
    if (data)
      this.convTags = (data as { conversation_id: string; tag_id: string }[]).map((c) => ({
        conversationId: c.conversation_id,
        tagId: c.tag_id,
      }));
  }
  private async loadMessages() {
    try {
      const { listVisibleMessages } = await import("./messages.functions");
      const rows = (await listVisibleMessages()) as MessageRow[];
      this.messages = rows.map((r) => this.mapMessage(r));
    } catch (error) {
      console.error("loadMessages via server failed", error);
      // Fallback para ambientes sem Server Function configurada.
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (data) {
        const rows = (data as MessageRow[]).slice().reverse();
        this.messages = rows.map((r) => this.mapMessage(r));
      }
    }
  }
  private async loadBroadcasts() {
    const { data } = await supabase
      .from("broadcast_messages")
      .select("*")
      .order("sent_at", { ascending: false });
    if (data) this.broadcasts = (data as BroadcastRow[]).map(mapBroadcast);
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
            if (!this.messages.find((x) => x.id === m.id)) this.messages.push(m);
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
    // without requiring a page reload.
    supabase
      .channel("cf-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void this.loadUsers().then(() => this.notify());
        },
      )
      .subscribe();

    supabase
      .channel("cf-tags")
      .on("postgres_changes", { event: "*", schema: "public", table: "tags" }, () => {
        void this.loadTags().then(() => this.notify());
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_tags" },
        () => {
          void this.loadConvTags().then(() => this.notify());
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
    const from = this.getUser(fromUserId);
    const to = this.getUser(toUserId);
    if (!from || !to) return fallback;
    // Cada par (remetente ↔ destinatário) tem sua própria conversa,
    // então uma mensagem enviada a um colaborador não aparece na conversa
    // com o admin (ou vice-versa).
    return this.staffPairId(from.number, to.number);
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
    const from = this.getUser(fromUserId);
    const to = this.getUser(toUserId);
    if (from && to) return this.staffPairId(from.number, to.number);
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
            Object.assign(user, profileToUser(result.row as ProfileRow));
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
    const nonStaffNumber =
      parts.find((part) => {
        const user = this.getUser(part);
        return user && !this.isStaff(user);
      }) ?? (parts.length === 0 ? conversationId : "");
    if (!nonStaffNumber) return [conversationId];
    const staffNumbers = this.users.filter((u) => this.isStaff(u)).map((u) => u.number);
    return Array.from(
      new Set([
        conversationId,
        nonStaffNumber,
        ...staffNumbers.map((n) => this.staffPairId(nonStaffNumber, n)),
        ...staffNumbers.map((n) => `${nonStaffNumber}__${n}`),
      ]),
    );
  }

  private conversationLookupIds(conversationId: string, staffInbox?: boolean): string[] {
    if (staffInbox) return this.staffInboxConversationIds(conversationId);
    return [conversationId];
  }

  listMessages(conversationId: string, options?: { staffInbox?: boolean }) {
    const ids = this.conversationLookupIds(conversationId, options?.staffInbox);
    return this.messages
      .filter((m) => ids.includes(m.conversationId))
      .sort((a, b) => a.createdAt - b.createdAt);
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
    const to = this.getUser(toUserId);
    const fromStaff = this.isStaff(from);
    const conversationId =
      from && to
        ? this.staffPairId(from.number, to.number)
        : "";
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
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
    this.notify();

    void (async () => {
      try {
        const { sendChatMessage } = await import("./messages.functions");
        const result = await sendChatMessage({ data: { toUserId, body } });
        const real = this.mapMessage(result.row as MessageRow);
        const tempIdx = this.messages.findIndex((m) => m.id === tempId);
        const realIdx = this.messages.findIndex((m) => m.id === real.id);
        if (realIdx >= 0) {
          if (tempIdx >= 0) this.messages.splice(tempIdx, 1);
        } else if (tempIdx >= 0) {
          this.messages[tempIdx] = real;
        } else {
          this.messages.push(real);
        }
        this.notify();
      } catch (error) {
        this.messages = this.messages.filter((m) => m.id !== tempId);
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

  markConversationRead(conversationId: string, viewer: "admin" | "user", _options?: { staffInbox?: boolean }) {
    const field = viewer === "admin" ? "read_by_admin" : "read_by_user";
    const idsToUpdate: string[] = [];
    let changed = false;
    for (const m of this.messages) {
      if (m.conversationId !== conversationId) continue;
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

  listConversations() {
    const nonStaff = this.users.filter((u) => u.type !== "admin" && u.id !== this.adminAuthId);
    return nonStaff
      .map((user) => {
        const conv = this.messages.filter(
          (m) => m.fromUserId === user.id || m.toUserId === user.id,
        );
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
    const sender = this.getUser(fromUserId);
    const now = Date.now();
    const rows = recipients.map((r) => ({
      // Se o destinatário também for staff (colaborador), usamos o mesmo formato
      // que o ChatWindow do admin espera: `${adminNumber}__${colabNumber}`.
      // Caso contrário, o número do não-staff basta (resolveConversationId reconstrói).
      conversation_id: this.isStaff(r) && sender
        ? this.staffPairId(sender.number, r.number)
        : r.number,
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
