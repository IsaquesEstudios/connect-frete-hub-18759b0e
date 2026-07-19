import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, Radio, ShieldCheck, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { homeFor } from "@/lib/auth/session";
import { Logo } from "@/components/brand/Logo";
import { WHATSAPP_MOTORISTAS, WHATSAPP_EMPRESAS } from "@/lib/whatsapp-groups";
import { getWhatsappLinks } from "@/lib/data/app-settings.functions";


export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SV Logística — Conectando empresas e motoristas do Brasil" },
      {
        name: "description",
        content:
          "A central de comunicação que aproxima transportadoras, embarcadores e motoristas. Entre nas nossas comunidades no WhatsApp.",
      },
      { property: "og:title", content: "SV Logística — Conectando empresas e motoristas do Brasil" },
      {
        property: "og:description",
        content:
          "A central de comunicação que aproxima transportadoras, embarcadores e motoristas. Entre nas nossas comunidades no WhatsApp.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState({ motoristas: WHATSAPP_MOTORISTAS, empresas: WHATSAPP_EMPRESAS });

  useEffect(() => {
    getWhatsappLinks().then(setLinks).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && user) navigate({ to: homeFor(user) as "/admin" });
  }, [user, loading, navigate]);


  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050b1a] text-slate-100">
      {/* Fundo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 30%, rgba(59,130,246,0.15), transparent 60%), linear-gradient(180deg, #050b1a 0%, #04070f 100%)",
        }}
      />

      <div className="relative z-10">
        {/* Nav */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center">
            <Logo iconClassName="h-7 w-7" textClassName="text-lg" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-400 transition"
          >
            Entrar <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-12 pb-20 md:pt-20 md:pb-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
            <Radio className="h-3.5 w-3.5" /> Central de comunicação para o frete
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-white">
            Conectando quem <span className="text-sky-300">move</span> o Brasil
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-slate-300">
            O SV Logística aproxima transportadoras, embarcadores, agenciadores e
            motoristas em um só lugar. Comunicação direta, ágil e centralizada com a nossa
            equipe.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 transition"
            >
              Criar conta ou entrar <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Atalhos de cadastro */}
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Crie sua conta agora
            </h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Escolha o seu perfil e finalize o cadastro em poucos passos.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <SignupShortcut
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Sou Empresa"
              description="Transportadora, embarcador ou agência de carga. Conecte-se com motoristas e agilize seus fretes."
              to="/auth"
              search={{ signup: "empresa" as const }}
              accent="from-blue-500/20 to-transparent"
              iconRing="ring-blue-400/40 bg-blue-500/20 text-blue-300"
              cta="Cadastrar empresa"
            />
            <SignupShortcut
              icon={<Truck className="h-6 w-6" />}
              title="Sou Motorista"
              description="Cadastre seu veículo, receba oportunidades de carga e faça parte da nossa rede."
              to="/auth"
              search={{ signup: "motorista" as const }}
              accent="from-sky-500/20 to-transparent"
              iconRing="ring-sky-400/40 bg-sky-500/20 text-sky-300"
              cta="Cadastrar motorista"
            />
          </div>
        </section>




        {/* Comunidades WhatsApp */}
        <section id="comunidades" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Participe das nossas comunidades
            </h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Entre no grupo do WhatsApp certo para você e fique por dentro de tudo em
              tempo real.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <CommunityCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Comunidade de Empresas"
              description="Networking entre transportadoras, embarcadores e agenciadores. Encontre parceiros e feche fretes com confiança."
              href={links.empresas}
              accent="from-blue-500/20 to-transparent"
              iconRing="ring-blue-400/40 bg-blue-500/20 text-blue-300"
            />
            <CommunityCard
              icon={<Truck className="h-6 w-6" />}
              title="Comunidade de Motoristas"
              description="Cargas, dicas de rota, oportunidades e novidades exclusivas para caminhoneiros parceiros."
              href={links.motoristas}
              accent="from-sky-500/20 to-transparent"
              iconRing="ring-sky-400/40 bg-sky-500/20 text-sky-300"
            />
          </div>
        </section>

        <footer className="border-t border-white/5 py-8">
          <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} SV Logística. Todos os direitos reservados.</span>
            <Link to="/auth" className="hover:text-slate-300 transition">
              Área do usuário
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CommunityCard({
  icon,
  title,
  description,
  href,
  accent,
  iconRing,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  accent: string;
  iconRing: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:border-sky-400/40 hover:bg-white/[0.06]`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-60`}
      />
      <div className="relative">
        <div
          className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${iconRing}`}
        >
          {icon}
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white group-hover:bg-emerald-400 transition">
          <MessageCircle className="h-4 w-4" /> Entrar no grupo
        </span>
      </div>
    </a>
  );
}

function SignupShortcut({
  icon,
  title,
  description,
  to,
  search,
  accent,
  iconRing,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: "/auth";
  search: { signup: "empresa" | "motorista" };
  accent: string;
  iconRing: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:border-sky-400/40 hover:bg-white/[0.06]"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-60`}
      />
      <div className="relative">
        <div
          className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${iconRing}`}
        >
          {icon}
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white group-hover:bg-sky-400 transition">
          {cta} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

