import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/disponibilidade/")({
  beforeLoad: () => {
    throw redirect({ to: "/disponibilidade/motoristas" });
  },
});
