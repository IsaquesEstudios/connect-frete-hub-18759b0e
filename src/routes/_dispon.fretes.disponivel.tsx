import { createFileRoute } from "@tanstack/react-router";
import { DisponibilidadeSection } from "@/components/disponibilidade/DisponibilidadeSection";

export const Route = createFileRoute("/_dispon/fretes/disponivel")({
  component: FretesPage,
  head: () => ({
    meta: [
      { title: "Fretes disponíveis das empresas | SV Logística" },
      {
        name: "description",
        content: "Fretes disponíveis publicados pelas empresas na plataforma da SV Logística.",
      },
      { property: "og:title", content: "Fretes disponíveis das empresas | SV Logística" },
      {
        property: "og:description",
        content: "Veja os fretes disponíveis das empresas atualizados pela equipe da SV Logística.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://app.svlogisticatransportes.com.br/fretes/disponivel" },
      { property: "og:image", content: "https://app.svlogisticatransportes.com.br/sv-logo.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://app.svlogisticatransportes.com.br/sv-logo.png" },
    ],
  }),
});

function FretesPage() {
  return (
    <DisponibilidadeSection
      kind="frete"
      heading="Fretes disponíveis"
      subtitle="Cargas e fretes disponíveis publicados pela equipe."
      defaultTitle="FRETE DISPONÍVEL"
      placeholder={"📍PE X SP / 40 T / SAIDER / 4 EIXO\n📍PE X MS / 25 T / GRANELEIRO ALTO / TOCO"}
    />
  );
}
