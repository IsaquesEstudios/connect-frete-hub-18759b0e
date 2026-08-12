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
      { property: "og:url", content: "https://app.svlogisticatransportes.com.br/motorista/disponivel" },
      { property: "og:image", content: "https://app.svlogisticatransportes.com.br/sv-logo.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://app.svlogisticatransportes.com.br/sv-logo.png" },
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
