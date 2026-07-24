import type { BroadcastAudience, NewUserInput, Repository } from "./repository";
import type {
  BroadcastMessage,
  ConversationTag,
  Message,
  Tag,
  User,
  UserProfilePatch,
  UserType,
} from "./types";
import { ADMIN_ID, seedConversationTags, seedMessages, seedTags, seedUsers } from "./seed";
import {
  broadcastEphemeral,
  readJSON,
  subscribe,
  subscribeEphemeral,
  writeJSON,
} from "./storage";

const K_USERS = "users";
const K_MSGS = "messages";
const K_TAGS = "tags";
const K_CONV_TAGS = "conversation_tags";
const K_BROADCASTS = "broadcast_messages";
const K_SEEDED = "seeded_v2";

function ensureSeed() {
  if (readJSON<boolean>(K_SEEDED, false)) return;
  writeJSON(K_USERS, seedUsers);
  writeJSON(K_MSGS, seedMessages);
  writeJSON(K_TAGS, seedTags);
  writeJSON(K_CONV_TAGS, seedConversationTags);
  writeJSON(K_SEEDED, true);
}

const presence = new Map<string, number>(); // userId -> lastSeenTs
const ONLINE_WINDOW = 15_000;

class LocalRepository implements Repository {
  constructor() {
    ensureSeed();
  }

  isBootstrapped(): boolean {
    return true;
  }
  getSyncState() {
    return { phase: "idle" as const, done: 0, total: 0 };
  }
  subscribeSync(): () => void {
    return () => {};
  }

  listUsers(): User[] {
    return readJSON<User[]>(K_USERS, []);
  }

  getUser(id: string): User | undefined {
    return this.listUsers().find((u) => u.id === id);
  }

  nextNumberFor(type: UserType): string {
    const prefix = type === "empresa" ? "EMP" : type === "motorista" ? "MOT" : "ADM";
    const nums = this.listUsers()
      .filter((u) => u.type === type)
      .map((u) => parseInt(u.number.split("-")[1] || "0", 10));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  }

  createUser(input: NewUserInput): User {
    const number = this.nextNumberFor(input.type);
    const user = { ...input, id: number, number, createdAt: Date.now() } as User;
    const users = this.listUsers();
    users.push(user);
    writeJSON(K_USERS, users);
    return user;
  }

  updateUser(id: string, patch: UserProfilePatch): User | undefined {
    const users = this.listUsers();
    const idx = users.findIndex((u) => u.id === id || u.number === id);
    if (idx < 0) return undefined;
    const updated = { ...users[idx], ...patch } as User;
    users[idx] = updated;
    writeJSON(K_USERS, users);
    return updated;
  }

  applyLocalUserPatch(id: string, patch: UserProfilePatch): User | undefined {
    return this.updateUser(id, patch);
  }

  listMessages(conversationId: string): Message[] {
    return readJSON<Message[]>(K_MSGS, [])
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async refreshMessages(): Promise<void> {
    return Promise.resolve();
  }

  sendMessage(input: { fromUserId: string; toUserId: string; body: string }): Message {
    const isStaff = (id: string) => {
      const u = this.getUser(id);
      return u?.type === "admin" || u?.type === "colaborador";
    };
    const fromStaff = isStaff(input.fromUserId);
    const from = this.getUser(input.fromUserId);
    const to = this.getUser(input.toUserId);
    const staff = fromStaff ? from : to;
    const nonStaff = fromStaff ? to : from;
    const conversationId = `${nonStaff?.number ?? ""}__${staff?.number ?? ""}`;

    const msg: Message = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      body: input.body,
      createdAt: Date.now(),
      readByAdmin: fromStaff,
      readByUser: !fromStaff,
    };
    const all = readJSON<Message[]>(K_MSGS, []);
    all.push(msg);
    writeJSON(K_MSGS, all);
    return msg;
  }

  deleteMessage(id: string): void {
    const all = readJSON<Message[]>(K_MSGS, []).filter((m) => m.id !== id);
    writeJSON(K_MSGS, all);
  }

  deleteConversation(conversationId: string): void {
    const all = readJSON<Message[]>(K_MSGS, []).filter(
      (m) => m.conversationId !== conversationId,
    );
    writeJSON(K_MSGS, all);
    writeJSON(
      K_CONV_TAGS,
      readJSON<ConversationTag[]>(K_CONV_TAGS, []).filter(
        (c) => c.conversationId !== conversationId,
      ),
    );
  }

  markConversationRead(conversationId: string, viewer: "admin" | "user") {
    const all = readJSON<Message[]>(K_MSGS, []);
    let changed = false;
    for (const m of all) {
      if (m.conversationId !== conversationId) continue;
      if (viewer === "admin" && !m.readByAdmin) {
        m.readByAdmin = true;
        changed = true;
      }
      if (viewer === "user" && !m.readByUser) {
        m.readByUser = true;
        changed = true;
      }
    }
    if (changed) writeJSON(K_MSGS, all);
  }

  unreadCount(conversationId: string, viewer: "admin" | "user"): number {
    return readJSON<Message[]>(K_MSGS, []).filter((m) => {
      if (m.conversationId !== conversationId) return false;
      if (viewer === "admin") return m.toUserId === ADMIN_ID && !m.readByAdmin;
      return m.fromUserId === ADMIN_ID && !m.readByUser;
    }).length;
  }

  listConversations() {
    const users = this.listUsers().filter((u) => u.type !== "admin");
    const msgs = readJSON<Message[]>(K_MSGS, []);
    const convTags = readJSON<ConversationTag[]>(K_CONV_TAGS, []);
    return users
      .map((user) => {
        const conv = msgs.filter((m) => m.conversationId === user.id);
        const lastMessage = conv.sort((a, b) => b.createdAt - a.createdAt)[0];
        const unreadForAdmin = conv.filter(
          (m) => m.toUserId === ADMIN_ID && !m.readByAdmin,
        ).length;
        const tagIds = convTags.filter((c) => c.conversationId === user.id).map((c) => c.tagId);
        return { user, lastMessage, unreadForAdmin, tagIds };
      })
      .sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));
  }

  // ============ tags ============
  listTags(): Tag[] {
    return readJSON<Tag[]>(K_TAGS, []);
  }

  createTag(input: { label: string; color: string }): Tag {
    const tag: Tag = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: input.label,
      color: input.color,
    };
    const tags = this.listTags();
    tags.push(tag);
    writeJSON(K_TAGS, tags);
    return tag;
  }

  updateTag(id: string, patch: { label?: string; color?: string }): Tag | undefined {
    const tags = this.listTags();
    const t = tags.find((x) => x.id === id);
    if (!t) return undefined;
    if (patch.label !== undefined) t.label = patch.label;
    if (patch.color !== undefined) t.color = patch.color;
    writeJSON(K_TAGS, tags);
    return t;
  }

  deleteTag(id: string): void {
    writeJSON(
      K_TAGS,
      this.listTags().filter((t) => t.id !== id),
    );
    writeJSON(
      K_CONV_TAGS,
      readJSON<ConversationTag[]>(K_CONV_TAGS, []).filter((c) => c.tagId !== id),
    );
  }

  getConversationTagIds(conversationId: string): string[] {
    return readJSON<ConversationTag[]>(K_CONV_TAGS, [])
      .filter((c) => c.conversationId === conversationId)
      .map((c) => c.tagId);
  }

  setConversationTags(conversationId: string, tagIds: string[]): void {
    const all = readJSON<ConversationTag[]>(K_CONV_TAGS, []).filter(
      (c) => c.conversationId !== conversationId,
    );
    for (const tagId of tagIds) all.push({ conversationId, tagId });
    writeJSON(K_CONV_TAGS, all);
  }

  // ============ broadcasts ============
  resolveBroadcastRecipients(audience: BroadcastAudience): User[] {
    const users = this.listUsers().filter((u) => u.type !== "admin");
    if (audience.kind === "all") return users;
    if (audience.kind === "empresas") return users.filter((u) => u.type === "empresa");
    if (audience.kind === "motoristas") return users.filter((u) => u.type === "motorista");
    if (audience.kind === "colaboradores") return users.filter((u) => u.type === "colaborador");
    const convTags = readJSON<ConversationTag[]>(K_CONV_TAGS, []);
    const ids = new Set(
      convTags.filter((c) => c.tagId === audience.tagId).map((c) => c.conversationId),
    );
    return users.filter((u) => ids.has(u.id));
  }

  sendBroadcast(input: {
    body: string;
    audience: BroadcastAudience;
    fromUserId: string;
  }): BroadcastMessage {
    const recipients = this.resolveBroadcastRecipients(input.audience);
    const now = Date.now();
    const msgs = readJSON<Message[]>(K_MSGS, []);
    for (const r of recipients) {
      msgs.push({
        id: `m_${now}_${Math.random().toString(36).slice(2, 7)}`,
        conversationId: r.id,
        fromUserId: input.fromUserId,
        toUserId: r.id,
        body: input.body,
        createdAt: now,
        readByAdmin: true,
        readByUser: false,
      });
    }
    writeJSON(K_MSGS, msgs);

    const audienceKind = input.audience.kind;
    const record: BroadcastMessage = {
      id: `b_${now}_${Math.random().toString(36).slice(2, 7)}`,
      body: input.body,
      audience: audienceKind,
      tagId: input.audience.kind === "tag" ? input.audience.tagId : undefined,
      sentAt: now,
      recipientCount: recipients.length,
    };
    const all = readJSON<BroadcastMessage[]>(K_BROADCASTS, []);
    all.push(record);
    writeJSON(K_BROADCASTS, all);
    return record;
  }

  listBroadcasts(): BroadcastMessage[] {
    return readJSON<BroadcastMessage[]>(K_BROADCASTS, []).sort((a, b) => b.sentAt - a.sentAt);
  }

  setPresence(userId: string, online: boolean) {
    if (online) {
      presence.set(userId, Date.now());
      broadcastEphemeral("presence", { userId, ts: Date.now() });
    } else {
      presence.delete(userId);
      broadcastEphemeral("presence-off", { userId });
    }
  }

  isOnline(userId: string): boolean {
    const ts = presence.get(userId);
    return !!ts && Date.now() - ts < ONLINE_WINDOW;
  }

  getLastSeen(userId: string): number | null {
    return presence.get(userId) ?? null;
  }

  sendTyping(conversationId: string, fromUserId: string) {
    broadcastEphemeral("typing", { conversationId, fromUserId, ts: Date.now() });
  }

  subscribe(cb: () => void): () => void {
    return subscribe(() => cb());
  }

  subscribeEphemeral(cb: (e: { type: string; payload: unknown }) => void) {
    const wrap = (e: { type: string; payload: unknown }) => {
      if (e.type === "presence") {
        const p = e.payload as { userId: string; ts: number };
        presence.set(p.userId, p.ts);
      } else if (e.type === "presence-off") {
        const p = e.payload as { userId: string };
        presence.delete(p.userId);
      }
      cb(e);
    };
    return subscribeEphemeral(wrap);
  }
}

export const repo: Repository = new LocalRepository();
