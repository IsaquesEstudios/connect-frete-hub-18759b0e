import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/disponibilidade")({
  ssr: false,
  component: () => <Outlet />,
});
