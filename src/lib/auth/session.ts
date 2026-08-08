import { supabase } from "@/integrations/supabase/loose-client";
import { repo } from "@/lib/data";
import { profileToUser } from "@/lib/data/supabaseRepository";
import { translateAuthError } from "@/lib/auth/translate-error";
import { setExternalUserActive } from "@/lib/data/admin-users.functions";
import { deleteAuthUser } from "@/lib/data/auth-cleanup.functions";
import type { User, UserProfilePatch, UserType } from "@/lib/data";
import type { Session } from "@supabase/supabase-js";

let cachedUser: User | null = null;
let initialDone = false;
const listeners = new Set<() => void>();

const EXTERNAL_AUTH_STORAGE_KEY = "ext-sb-auth-token";

function isInvalidRefreshToken(error: unknown): boolean {
  const text = String(
    error instanceof Error
      ? error.message
      : error && typeof error === "object"
        ? JSON.stringify(error)
        : error ?? "",
  );
  return /refresh_token_not_found|invalid refresh token/i.test(text);
}

async function clearBrokenSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // If the auth client itself is already broken, still remove the stale token below.
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(EXTERNAL_AUTH_STORAGE_KEY);
  }
  cachedUser = null;
  notify();
}

async function getSessionSafely(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session ?? null;
  } catch (error) {
    if (isInvalidRefreshToken(error)) {
      await clearBrokenSession();
      return null;
    }
    throw error;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

async function loadProfile(authId: string, options: { fresh?: boolean } = {}): Promise<User | null> {
  // First try cache (populated by repo bootstrap)
  if (!options.fresh) {
    for (let i = 0; i < 30; i++) {
      const u = repo.getUser(authId);
      if (u) return u;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // Fallback: fetch directly
  const { data, error } = await supabase.from("profiles").select("*").eq("id", authId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return profileToUser(data as Parameters<typeof profileToUser>[0]);
}

type PgError = { code?: string; message?: string; details?: string; hint?: string };

function isDuplicateUserNumber(error: unknown): boolean {
  const e = (error ?? {}) as PgError;
  const blob = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return e.code === "23505" && blob.includes("user_number");
}

async function nextUserNumberSeq(prefix: string): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("user_number")
    .like("user_number", `${prefix}-%`);
  const nums = (data ?? [])
    .map((r: { user_number: string }) => parseInt(String(r.user_number).split("-")[1] || "0", 10))
    .filter((n: number) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/** Insere o perfil gerando o `user_number`; em caso de colisão tenta o próximo livre. */
async function insertProfileWithNumber(
  prefix: string,
  row: Record<string, unknown>,
): Promise<PgError | null> {
  let seq = await nextUserNumberSeq(prefix);
  for (let attempt = 0; attempt < 30; attempt++) {
    const user_number = `${prefix}-${String(seq).padStart(4, "0")}`;
    const { error } = await supabase.from("profiles").insert({ ...row, user_number });
    if (!error) return null;
    if (!isDuplicateUserNumber(error)) return error as PgError;
    seq += 1;
  }
  return { code: "23505", message: "Não foi possível gerar um código de usuário livre." };
}

/** Limpa todo o cache local do app (conversas, fotos, sessão). */
export function clearLocalAppCache() {
  if (typeof window === "undefined") return;
  void import("@/lib/data/idb-cache").then((m) => m.idbClearAll()).catch(() => undefined);

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith("svlogistica:") || k.startsWith("sv:") || k === EXTERNAL_AUTH_STORAGE_KEY)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // storage indisponível — segue o logout mesmo assim
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && (k.startsWith("svlogistica:") || k.startsWith("sv:"))) keys.push(k);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // storage indisponível — segue o logout mesmo assim
  }
  window.dispatchEvent(new Event("svlogistica:clear-query-cache"));
}

/** Encerra a sessão de um usuário bloqueado, apagando o cache local. */
export async function forceLogoutBlocked(): Promise<void> {
  cachedUser = null;
  clearLocalAppCache();
  try {
    await supabase.auth.signOut();
  } catch {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  clearLocalAppCache();
  notify();
}

async function applySessionProfile(profile: User | null): Promise<User | null> {
  if (profile?.active === false) {
    await forceLogoutBlocked();
    return null;
  }
  if (profile) cachedUser = profile;
  notify();
  return cachedUser;
}

function withAuthEmail(profile: User | null, session: Session | null): User | null {
  if (!profile) return null;
  return { ...profile, email: session?.user.email ?? profile.email } as User;
}

export async function refreshCurrentUser(): Promise<User | null> {
  const session = await getSessionSafely();
  if (!session) {
    cachedUser = null;
    notify();
    return null;
  }
  let profile: User | null = null;
  try {
    profile = withAuthEmail(await loadProfile(session.user.id, { fresh: true }), session);
  } catch {
    await clearBrokenSession();
    cachedUser = null;
    notify();
    return null;
  }
  if (!profile) {
    await clearBrokenSession();
    cachedUser = null;
    notify();
    return null;
  }
  return applySessionProfile(profile);
}

async function bootstrap() {
  try {
    const session = await getSessionSafely();
    if (session) {
      try {
        const profile = withAuthEmail(await loadProfile(session.user.id, { fresh: true }), session);
        await applySessionProfile(profile);
      } catch {
        await clearBrokenSession();
        cachedUser = null;
      }
    }
  } catch (error) {
    console.error("Falha ao iniciar sessão", error);
    cachedUser = null;
  }
  initialDone = true;
  notify();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      try {
        await applySessionProfile(withAuthEmail(await loadProfile(session.user.id, { fresh: true }), session));
      } catch (error) {
        if (isInvalidRefreshToken(error)) await clearBrokenSession();
        else await clearBrokenSession();
        cachedUser = null;
      }
    } else cachedUser = null;
    notify();
  });
}

if (typeof window !== "undefined") void bootstrap();

export function currentUser(): User | null {
  return cachedUser;
}

export async function updateCurrentProfile(patch: UserProfilePatch): Promise<User> {
  if (!cachedUser) throw new Error("Usuário não autenticado.");
  const updated = repo.updateUser(cachedUser.id, patch);
  if (!updated) throw new Error("Perfil não encontrado.");
  cachedUser = updated;
  notify();
  return updated;
}

export function isBootstrapped(): boolean {
  return initialDone;
}
export function onSessionChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(translateAuthError(error));
  if (!data.user) throw new Error("Falha no login. Tente novamente.");
  const u = withAuthEmail(await loadProfile(data.user.id, { fresh: true }), data.session);
  if (!u) throw new Error("Perfil não encontrado. Contate o administrador.");
  if (u.active === false) {
    await supabase.auth.signOut();
    throw new Error("Esta conta está desativada. Contate o administrador.");
  }
  cachedUser = u;
  notify();
  return u;
}

// ---- Colaboradores (admin only) ----------------------------------

export async function listColaboradores(): Promise<User[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("type", "colaborador")
    .order("user_number", { ascending: true });
  if (error) throw new Error(translateAuthError(error));
  return (data ?? []).map((r: unknown) => profileToUser(r as Parameters<typeof profileToUser>[0]));
}

export async function createColaborador(input: {
  name: string;
  email: string;
  password: string;
  documentoTipo?: "cpf" | "cnpj";
  documento?: string;
}): Promise<void> {
  // Preserve current admin session — signUp replaces it with the new user's session.
  const adminSession = await getSessionSafely();
  const adminUser = cachedUser;

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(translateAuthError(error));
  if (!data.user) throw new Error("Não foi possível criar o usuário.");

  const insErr = await insertProfileWithNumber("COL", {
    id: data.user.id,
    type: "colaborador",
    name: input.name,
    // email vive em auth.users
    cpf: input.documentoTipo === "cpf" ? input.documento || null : null,
    cnpj: input.documentoTipo === "cnpj" ? input.documento || null : null,
    active: true,
  });


  // Restore admin session so the current user isn't logged out and redirected.
  if (adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
    cachedUser = adminUser;
    notify();
  }

  if (insErr) throw new Error(`Perfil: ${translateAuthError(insErr)}`);
}

export async function setColaboradorActive(id: string, active: boolean): Promise<void> {
  await setExternalUserActive({ data: { userId: id, active } });
  await repo.refreshUsers().catch(() => undefined);
}

export async function deleteColaborador(id: string): Promise<void> {
  await deleteAuthUser({ data: { userId: id } });
  await repo.refreshUsers().catch(() => undefined);
}


export interface SignupInput {
  email: string;
  password: string;
  name: string;
  type: UserType;
  // documento
  documentoTipo?: "cnpj" | "cpf";
  cnpj?: string;
  cpf?: string;
  whatsapp?: string;
  // perfil
  fotoUrl?: string;
  // localização
  cidade?: string;
  estado?: string;
  // motorista
  placa?: string;
  tipoVeiculo?: string;
  rntrc?: string;
  carroceria?: string;
  peso?: string;
  // empresa
  nomeFantasia?: string;
  perfilEmpresa?: "transportador" | "embarcador" | "agenciador" | "motorista";
  siteRedeSocial?: string;
}

export async function signup(input: SignupInput): Promise<User> {
  // If the browser has a stale refresh token from an older attempt, clear it before creating the account.
  try {
    await getSessionSafely();
  } catch (error) {
    console.warn("Sessão anterior inválida antes do cadastro", error);
    await clearBrokenSession();
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(translateAuthError(error));
  if (!data.user) throw new Error("Não foi possível criar a conta.");

  // Generate user_number
  const prefix = input.type === "empresa" ? "EMP" : input.type === "motorista" ? "MOT" : "ADM";
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_number")
    .eq("type", input.type);
  const nums = (existing ?? []).map((r: { user_number: string }) =>
    parseInt(r.user_number.split("-")[1] || "0", 10),
  );
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  const user_number = `${prefix}-${String(next).padStart(4, "0")}`;

  if (!data.session) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw new Error(
      "Conta criada, mas ainda não é possível entrar. Confirme seu email ou contate o administrador.",
    );
  }

  const { error: insErr } = await supabase.from("profiles").insert({
    id: data.user.id,
    user_number,
    type: input.type,
    name: input.name,
    // email vive em auth.users; não replicar em profiles

    cnpj: input.cnpj ?? null,
    cpf: input.cpf ?? null,
    whatsapp: input.whatsapp ?? null,
    foto_url: input.fotoUrl ?? null,
    cidade: input.cidade ?? null,
    estado: input.estado ?? null,
    placa: input.placa ?? null,
    tipo_veiculo: input.tipoVeiculo ?? null,
    rntrc: input.rntrc ?? null,
    carroceria: input.carroceria ?? null,
    peso: input.peso ?? null,
    nome_fantasia: input.nomeFantasia ?? null,
    perfil_empresa: input.perfilEmpresa ?? null,
    site_rede_social: input.siteRedeSocial ?? null,
  });
  if (insErr) {
    // Rollback: remove the just-created auth user so the email doesn't stay orphaned.
    let rollbackNote = "";
    try {
          await deleteAuthUser({ data: { userId: data.user.id } });
      rollbackNote = "A conta foi removida — tente novamente.";
    } catch (rollbackErr) {
      console.error("Falha ao reverter conta órfã", rollbackErr);
      rollbackNote =
        "Atenção: a conta de autenticação foi criada mas o perfil falhou. Contate o administrador para liberar o email.";
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    cachedUser = null;
    notify();

    const raw = insErr as { code?: string; details?: string; hint?: string; message?: string };
    const blob = `${raw.message ?? ""} ${raw.details ?? ""} ${raw.hint ?? ""}`.toLowerCase();
    const FIELDS: Array<[RegExp, string]> = [
      [/whatsapp/, "WhatsApp"],
      [/\bcnpj\b/, "CNPJ"],
      [/\bcpf\b/, "CPF"],
      [/user_number/, "código do usuário"],
      [/\bplaca\b/, "placa"],
      [/\brntrc\b/, "RNTRC"],
      [/nome_fantasia/, "nome fantasia"],
      [/\bemail\b/, "email"],
    ];
    const field = FIELDS.find(([re]) => re.test(blob))?.[1];
    const isDuplicate = /duplicate key|23505|unique/.test(blob);
    const precise = field
      ? isDuplicate
        ? `O campo ${field} já está cadastrado em outra conta.`
        : `Problema no campo ${field}.`
      : "";
    const parts = [
      precise,
      translateAuthError(insErr),
      raw.details ? `Detalhe: ${raw.details}` : "",
      raw.hint ? `Dica: ${raw.hint}` : "",
      raw.code ? `Código: ${raw.code}` : "",
    ].filter(Boolean);
    throw new Error(`Não foi possível salvar o perfil. ${parts.join(" ")} ${rollbackNote}`.trim());

  }



  const u = withAuthEmail(await loadProfile(data.user.id, { fresh: true }), data.session);
  if (!u) throw new Error("Perfil criado mas não encontrado.");
  cachedUser = u;
  notify();
  return u;
}

export async function logout() {
  await supabase.auth.signOut();
  cachedUser = null;
  notify();
}

export function homeFor(user: User): string {
  if (user.type === "admin") return "/admin";
  if (user.type === "colaborador") return "/colaborador";
  if (user.type === "empresa") return "/empresa";
  return "/motorista";
}
