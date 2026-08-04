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
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function FretesPage() {
  return (
    <DisponibilidadeSection
      kind="frete"
      heading="Empresas / fretes disponíveis"
      subtitle="Cargas e fretes disponíveis publicados pela equipe."
      defaultTitle="FRETE DISPONÍVEL"
      placeholder={"📍PE X SP / 40 T / SAIDER / 4 EIXO\n📍PE X MS / 25 T / GRANELEIRO ALTO / TOCO"}
    />
  );
}
