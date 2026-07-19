import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { homeFor, login } from "@/lib/auth/session";
import { useAuth } from "@/lib/auth/useAuth";
import type { User } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { SignupWizard } from "@/components/auth/SignupWizard";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { PasswordInput } from "@/components/auth/PasswordInput";



type SignupKind = "empresa" | "motorista";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { signup?: SignupKind } => {
    const s = search.signup;
    return s === "empresa" || s === "motorista" ? { signup: s } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar — SV Logística" },
      { name: "description", content: "Acesse o SV Logística com seu email e senha." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { signup } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(signup ? "signup" : "login");

  useEffect(() => {
    if (!loading && user) navigate({ to: homeFor(user) as "/admin" });
  }, [user, loading, navigate]);


  const goHome = (u: User) => navigate({ to: homeFor(u) as "/admin" });

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050b1a] text-slate-100 flex items-center justify-center p-4">
      {/* Deep space background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, #0f2447 0%, #071228 45%, #030814 100%)",
        }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(148,197,255,0.35) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      {/* Star sparkle */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-[18%] h-40 w-40 -translate-x-1/2 rounded-full bg-sky-400/30 blur-3xl" />
      </div>

      {/* Glass card */}
      <div className="relative w-full max-w-md">
        {/* Top glow line */}
        <div className="absolute -top-px left-1/2 h-px w-40 -translate-x-1/2 bg-gradient-to-r from-transparent via-sky-300 to-transparent" />
        <div className="absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-sky-300/40 blur-2xl" />

        <div
          className="relative rounded-3xl border border-white/10 bg-white/[0.04] px-7 py-8 backdrop-blur-xl shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
          }}
        >
          <div className="flex flex-col items-center text-center mb-6">
            <Logo className="mb-4" iconClassName="h-8 w-8" textClassName="text-xl" />
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {mode === "login" ? "Bem-vindo de volta" : "Criar sua conta"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "login"
                ? "Entre com seus dados para acessar."
                : "Preencha para começar no SV Logística."}
            </p>
          </div>

          {mode === "login" ? (
            <LoginForm onDone={goHome} />
          ) : (
            <SignupWizard onDone={goHome} onBackToLogin={() => setMode("login")} initialKind={signup} />
          )}


          <div className="mt-6 text-center text-sm text-slate-400">
            {mode === "login" ? (
              <>
                Não tem uma conta?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © SV Logística
        </p>
      </div>
    </div>
  );
}

const fieldWrap =
  "group rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 focus-within:border-sky-300/50 focus-within:bg-white/[0.06] transition";
const fieldLabel = "text-[11px] uppercase tracking-wider text-slate-400";
const fieldInput =
  "w-full border-0 bg-transparent p-0 text-sm text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none h-6";

function GlassField({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn(fieldWrap, "flex items-center gap-3")}>
      <div className="flex-1 min-w-0">
        <div className={fieldLabel}>{label}</div>
        {children}
      </div>
      {action}
    </div>
  );
}

function SubmitArrow({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-sky-300 to-sky-500 text-slate-900 shadow-[0_6px_20px_-6px_rgba(56,189,248,0.7)] transition hover:from-sky-200 hover:to-sky-400 disabled:opacity-60"
      aria-label="Enviar"
    >
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function LoginForm({ onDone }: { onDone: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            const u = await login(email, password);
            toast.success(`Bem-vindo, ${u.name}`);
            onDone(u);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <GlassField label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            placeholder="voce@empresa.com"
            className={fieldInput}
          />
        </GlassField>
        <GlassField label="Senha" action={<SubmitArrow loading={loading} />}>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            inputClassName={fieldInput}
          />
        </GlassField>

        <div className="text-right">
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="text-xs text-sky-300 hover:text-sky-200 underline underline-offset-4"
          >
            Esqueci a senha
          </button>
        </div>
      </form>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}
