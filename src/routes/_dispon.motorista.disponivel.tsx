import { createFileRoute } from "@tanstack/react-router";
import { DisponibilidadeSection } from "@/components/disponibilidade/DisponibilidadeSection";

export const Route = createFileRoute("/_dispon/motorista/disponivel")({
  component: MotoristasPage,
  head: () => ({
    meta: [
      { title: "Motoristas disponíveis | SV Logística" },
      {
        name: "description",
        content: "Lista de motoristas disponíveis publicada pela equipe da SV Logística.",
      },
      { property: "og:title", content: "Motoristas disponíveis | SV Logística" },
      {
        property: "og:description",
        content: "Veja os motoristas disponíveis atualizados pela equipe da SV Logística.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MotoristasPage() {
  return (
    <DisponibilidadeSection
      kind="motorista"
      heading="Motoristas disponíveis"
      subtitle="Motoristas e entregadores disponíveis publicados pela equipe."
      defaultTitle="MOTORISTA DISPONÍVEL"
      placeholder={"➡️Origem: Caaporã / PB\n➡️Origem: Pitimbu / PB\nDESTINO - VÁRIAS CIDADES DO PIAUÍ"}
    />
  );
}
