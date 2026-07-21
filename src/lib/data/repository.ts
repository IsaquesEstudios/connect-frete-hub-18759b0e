import type { BroadcastMessage, Message, Tag, User, UserProfilePatch, UserType } from "./types";

export type BroadcastAudience =
  | { kind: "all" }
  | { kind: "empresas" }
  | { kind: "motoristas" }
  | { kind: "colaboradores" }
  | { kind: "tag"; tagId: string };

export type NewUserInput =
  | { type: "empresa"; name: string; password: string; cnpj: string }
  | { type: "motorista"; name: string; password: string; placa: string }
  | { type: "admin"; name: string; password: string };

export interface Repository {
  // users
  listUsers(): User[];
  getUser(id: string): User | undefined;
  createUser(u: NewUserInput): User;
  updateUser(id: string, patch: UserProfilePatch): User | undefined;
  applyLocalUserPatch(id: string, patch: UserProfilePatch): User | undefined;
  // messages
  listMessages(conversationId: string, options?: { staffInbox?: boolean }): Message[];
  refreshMessages(): Promise<void>;
  sendMessage(input: { fromUserId: string; toUserId: string; body: string }): Message;
  deleteMessage(id: string): void;
  deleteConversation(conversationId: string): void;
  markConversationRead(conversationId: string, viewer: "admin" | "user", options?: { staffInbox?: boolean }): void;
  unreadCount(conversationId: string, viewer: "admin" | "user"): number;
  // conversations
  listConversations(): {
    user: User;
    lastMessage?: Message;
    unreadForAdmin: number;
    tagIds: string[];
  }[];
  // tags
  listTags(): Tag[];
  createTag(input: { label: string; color: string }): Tag;
  updateTag(id: string, patch: { label?: string; color?: string }): Tag | undefined;
  deleteTag(id: string): void;
  getConversationTagIds(conversationId: string): string[];
  setConversationTags(conversationId: string, tagIds: string[]): void;
  // broadcasts
  resolveBroadcastRecipients(audience: BroadcastAudience): User[];
  sendBroadcast(input: { body: string; audience: BroadcastAudience; fromUserId: string }): BroadcastMessage;
  listBroadcasts(): BroadcastMessage[];
  // presence / typing (ephemeral)
  setPresence(userId: string, online: boolean): void;
  isOnline(userId: string): boolean;
  getLastSeen(userId: string): number | null;
  sendTyping(conversationId: string, fromUserId: string): void;
  // subs
  subscribe(cb: () => void): () => void;
  subscribeEphemeral(cb: (e: { type: string; payload: unknown }) => void): () => void;
  // loading
  isBootstrapped(): boolean;
  // utils
  nextNumberFor(type: UserType): string;
}
