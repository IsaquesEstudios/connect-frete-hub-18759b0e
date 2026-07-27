import { createFileRoute } from "@tanstack/react-router";
import { StaffPanel } from "@/components/panel/StaffPanel";

export const Route = createFileRoute("/_app/colaborador")({
  head: () => ({ meta: [{ title: "Atendimento — SV Logística" }] }),
  component: ColaboradorPanelRoute,
});

function ColaboradorPanelRoute() {
  return <StaffPanel role="colaborador" />;
}
