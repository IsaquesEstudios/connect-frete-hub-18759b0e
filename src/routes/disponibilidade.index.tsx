import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/disponibilidade/")({
  beforeLoad: () => {
    throw redirect({ to: "/motorista/disponível" });
  },
});
