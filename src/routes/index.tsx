import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Facebook, Instagram, MessageCircle, Package, PackageSearch, Radio, ShieldCheck, Truck, Youtube, Globe } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { WHATSAPP_MOTORISTAS, WHATSAPP_EMPRESAS } from "@/lib/whatsapp-groups";
import { getWhatsappLinks, getSocialLinks, type SocialLinks } from "@/lib/data/app-settings.functions";

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
  const [links, setLinks] = useState({ motoristas: WHATSAPP_MOTORISTAS, empresas: WHATSAPP_EMPRESAS });
  const [social, setSocial] = useState<SocialLinks>({
    website: "https://svlogisticatransportes.com.br",
    instagram: "https://www.instagram.com/svlogisticatransportes",
    facebook: "https://www.facebook.com/svlogisticatransportes",
    threads: "https://www.threads.com/svlogisticatransportes",
    youtube: "https://www.youtube.com/@svlogisticatransportes",
    tiktok: "https://www.tiktok.com/@svlogisticatransportes",
  });

  useEffect(() => {
    getWhatsappLinks().then(setLinks).catch(() => {});
    getSocialLinks().then(setSocial).catch(() => {});
  }, []);

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
            <Logo iconClassName="h-11" />
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



        {/* Quadro ao vivo — disponibilidade */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-white/[0.02] to-transparent">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative grid md:grid-cols-[1fr_1.4fr] gap-8 p-8 md:p-10">
              <div className="flex flex-col justify-center">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Atualizado pela equipe
                </span>
                <h2 className="mt-4 text-2xl md:text-3xl font-bold text-white">
                  Quadro de disponibilidade
                </h2>
                <p className="mt-3 text-sm md:text-base text-slate-400">
                  Veja em tempo real quem está livre para rodar e quais cargas estão
                  abertas. Acesso livre, sem login.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  to="/motorista/disponivel"
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#070e20]/70 p-5 transition hover:-translate-y-1 hover:border-sky-400/50"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-sky-400/40 bg-sky-500/20 text-sky-300">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-white">Motoristas disponíveis</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Veículos e origens prontos para carregar.
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 group-hover:text-sky-200">
                    Ver quadro <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>

                <Link
                  to="/fretes/disponivel"
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#070e20]/70 p-5 transition hover:-translate-y-1 hover:border-blue-400/50"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-blue-400/40 bg-blue-500/20 text-blue-300">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-white">Fretes disponíveis</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Cargas abertas publicadas pelas empresas.
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-300 group-hover:text-blue-200">
                    Ver quadro <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>
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

        {/* Fretes */}
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Procure fretes</h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Acompanhe as cargas disponíveis em tempo real.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <FreteCard
              icon={<PackageSearch className="h-6 w-6" />}
              title="Buscar fretes"
              description="Painel completo de fretes em tempo real."
              href="https://freteemtemporeal.com.br/fretes"
            />
            <FreteCard
              icon={<Package className="h-6 w-6" />}
              title="Cargas ativas"
              description="Cargas com status ativo disponíveis agora."
              href="https://freteemtemporeal.com.br/index.php?page1=fretes&statusFilter=active"
            />
            <FreteCard
              icon={<Package className="h-6 w-6" />}
              title="Cargas inativas"
              description="Cargas inativas (origem PR) para consulta."
              href="https://freteemtemporeal.com.br/index.php?page1=fretes&statusFilter=inactive&estadoOrigem=PR"
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
          <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} SV Logística. Todos os direitos reservados.</span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <SocialLink href={social.website} label="Site da SV Logística" icon={<Globe className="h-4 w-4" />} text="Site" />
              <SocialLink href={social.instagram} label="Instagram da SV Logística" icon={<Instagram className="h-4 w-4" />} text="Instagram" />
              <SocialLink href={social.facebook} label="Facebook da SV Logística" icon={<Facebook className="h-4 w-4" />} text="Facebook" />
              <SocialLink href={social.threads} label="Threads da SV Logística" icon={<ThreadsIcon className="h-4 w-4" />} text="Threads" />
              <SocialLink href={social.youtube} label="YouTube da SV Logística" icon={<Youtube className="h-4 w-4" />} text="YouTube" />
              <SocialLink href={social.tiktok} label="TikTok da SV Logística" icon={<TikTokIcon className="h-4 w-4" />} text="TikTok" />
              <SocialLink href={links.motoristas} label="WhatsApp da SV Logística" icon={<MessageCircle className="h-4 w-4" />} text="WhatsApp" />
              <Link to="/auth" className="hover:text-slate-300 transition">
                Área do usuário
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SocialLink({
  href,
  label,
  icon,
  text,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex items-center gap-1.5 hover:text-slate-200 transition"
    >
      {icon} {text}
    </a>
  );
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.186 24h-.007c-3.792-.017-6.631-1.184-8.442-3.476C1.93 18.232.99 14.9.948 10.69v-.017c.042-4.21.982-7.542 2.789-9.665C5.55 1.184 8.39.017 12.183 0h.007c3.792.017 6.631 1.184 8.442 3.476 1.807 2.123 2.747 5.455 2.789 9.665v.017c-.042 4.21-.982 7.542-2.789 9.665-1.811 2.292-4.65 3.459-8.442 3.476Zm-.007-22.046C9.234 1.963 6.86 2.83 5.387 4.526 3.846 6.298 3.014 9.253 2.975 13.02c.039 3.767.871 6.722 2.412 8.494 1.473 1.696 3.847 2.563 6.792 2.572 2.945-.009 5.319-.876 6.792-2.572 1.541-1.772 2.373-4.727 2.412-8.494-.039-3.767-.871-6.722-2.412-8.494C17.397 2.83 15.023 1.963 12.18 1.954Zm.014 17.798c-3.62 0-5.627-2.628-5.627-5.764 0-3.135 2.007-5.763 5.627-5.763 1.51 0 2.6.505 3.26 1.07.66.564.967 1.156.967 1.156l-1.46 1.017s-.46-.79-1.38-1.135c-.46-.183-1.01-.243-1.38-.243-1.87 0-3.42 1.342-3.42 3.898s1.55 3.898 3.42 3.898c.37 0 .92-.06 1.38-.243.92-.346 1.38-1.135 1.38-1.135l1.46 1.017s-.307.592-.967 1.156c-.66.565-1.75 1.07-3.26 1.07Z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.37v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298.003.594.05.88.14V9.4a6.33 6.33 0 0 0-1-.05A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.6-4.43V8.66a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.78-.09Z" />
    </svg>
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
          <MessageCircle className="h-4 w-4" /> Entrar na comunidade do WhatsApp
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

function FreteCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:border-sky-400/40 hover:bg-white/[0.06]"
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-sky-400/40 bg-sky-500/20 text-sky-300">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 group-hover:text-sky-200">
        Acessar <ArrowRight className="h-4 w-4" />
      </span>
    </a>
  );
}
