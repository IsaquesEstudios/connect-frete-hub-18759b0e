import { createFileRoute } from "@tanstack/react-router";
import { LeadChat, CARGA_QUESTIONS } from "@/components/chat-lead/LeadChat";

export const Route = createFileRoute("/chat/carga")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cadastrar Carga — SV Logística" },
      { name: "description", content: "Empresas, transportadoras e agências: informe sua carga em uma conversa rápida." },
      { property: "og:title", content: "Cadastrar Carga — SV Logística" },
      { property: "og:description", content: "Informe origem, destino e detalhes da carga em poucos passos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LeadChat kind="carga" questions={CARGA_QUESTIONS} title="SV Logística — Cargas" />,
});
