import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/disponibilidade/motoristas")({
  beforeLoad: () => {
    throw redirect({ to: "/motorista/disponivel" });
  },
});
