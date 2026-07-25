import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cadastrar/caminhoneiro")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { signup: "motorista" } });
  },
});
