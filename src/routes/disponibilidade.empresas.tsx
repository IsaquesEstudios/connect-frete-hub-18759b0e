import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/disponibilidade/empresas")({
  beforeLoad: () => {
    throw redirect({ to: "/fretes/disponivel" });
  },
});
