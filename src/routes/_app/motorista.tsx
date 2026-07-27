import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { UserChatPanel } from "@/components/chat/UserChatPanel";
import { homeFor } from "@/lib/auth/session";
import { useAuth } from "@/lib/auth/useAuth";

export const Route = createFileRoute("/_app/motorista")({
  head: () => ({ meta: [{ title: "Motorista — SV Logística" }] }),
  component: MotoristaPanel,
});

function MotoristaPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.type !== "motorista") navigate({ to: homeFor(user) as "/admin" });
  }, [user, navigate]);

  if (!user || user.type !== "motorista") return null;

  return <UserChatPanel me={user} />;
}
