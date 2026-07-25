import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cadastrar/empresa")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { signup: "empresa" } });
  },
});
