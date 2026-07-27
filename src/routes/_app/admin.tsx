import { createFileRoute } from "@tanstack/react-router";
import { StaffPanel } from "@/components/panel/StaffPanel";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin — SV Logística" }] }),
  component: AdminPanelRoute,
});

function AdminPanelRoute() {
  return <StaffPanel role="admin" />;
}
