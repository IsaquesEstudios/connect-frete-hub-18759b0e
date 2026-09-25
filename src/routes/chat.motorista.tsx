import { createFileRoute } from "@tanstack/react-router";
import { LeadChat, MOTORISTA_QUESTIONS } from "@/components/chat-lead/LeadChat";

export const Route = createFileRoute("/chat/motorista")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cadastro de Motorista — SV Logística" },
      { name: "description", content: "Converse com a SV Logística e cadastre seu veículo em poucos passos." },
      { property: "og:title", content: "Cadastro de Motorista — SV Logística" },
      { property: "og:description", content: "Cadastre seu veículo e receba fretes pelo WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LeadChat kind="motorista" questions={MOTORISTA_QUESTIONS} title="SV Logística — Motoristas" />,
});
