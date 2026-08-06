import { createFileRoute } from "@tanstack/react-router";
import { StaffPanel } from "@/components/panel/StaffPanel";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin — SV Logística" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    u: typeof search.u === "string" ? search.u : undefined,
  }),
  component: AdminPanelRoute,
});

function AdminPanelRoute() {
  return <StaffPanel role="admin" />;
}
