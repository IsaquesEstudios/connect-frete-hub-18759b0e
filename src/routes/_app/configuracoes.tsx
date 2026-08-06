import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWhatsappLinks,
  updateWhatsappLinks,
  getSocialLinks,
  updateSocialLinks,
  type SocialLinks,
} from "@/lib/data/app-settings.functions";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — SV Logística" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [motoristas, setMotoristas] = useState("");
  const [empresas, setEmpresas] = useState("");
  const [social, setSocial] = useState<SocialLinks>({
    website: "",
    instagram: "",
    facebook: "",
    threads: "",
    youtube: "",
    tiktok: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingWpp, setSavingWpp] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);

  const isAdmin = user?.type === "admin";

  useEffect(() => {
    let alive = true;
    Promise.all([getWhatsappLinks(), getSocialLinks()])
      .then(([wpp, soc]) => {
        if (!alive) return;
        setMotoristas(wpp.motoristas);
        setEmpresas(wpp.empresas);
        setSocial(soc);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (!user) return null;

  async function handleSaveWpp(e: React.FormEvent) {
    e.preventDefault();
    setSavingWpp(true);
    try {
      await updateWhatsappLinks({ data: { motoristas, empresas } });
      toast.success("Links do WhatsApp atualizados com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSavingWpp(false);
    }
  }

  async function handleSaveSocial(e: React.FormEvent) {
    e.preventDefault();
    setSavingSocial(true);
    try {
      await updateSocialLinks({ data: social });
      toast.success("Redes sociais atualizadas com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSavingSocial(false);
    }
  }

  return (
    <div className="min-h-full bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste preferências gerais do sistema.
          </p>
        </div>

        {isAdmin ? (
          <>
            {/* WhatsApp */}
            <form onSubmit={handleSaveWpp} className="rounded-lg border bg-card p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold">Links das comunidades no WhatsApp</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Estes links são exibidos nos botões da página inicial.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motoristas">Botão de motoristas</Label>
                <Input
                  id="motoristas"
                  type="url"
                  placeholder="https://chat.whatsapp.com/..."
                  value={motoristas}
                  onChange={(e) => setMotoristas(e.target.value)}
                  disabled={loading || savingWpp}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="empresas">Botão de empresas</Label>
                <Input
                  id="empresas"
                  type="url"
                  placeholder="https://chat.whatsapp.com/..."
                  value={empresas}
                  onChange={(e) => setEmpresas(e.target.value)}
                  disabled={loading || savingWpp}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading || savingWpp}>
                  {savingWpp ? "Salvando…" : "Salvar alterações"}
                </Button>
              </div>
            </form>

            {/* Redes sociais */}
            <form onSubmit={handleSaveSocial} className="rounded-lg border bg-card p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold">Redes sociais</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exibidas no rodapé da página inicial. Deixe o link completo (com https://).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-website">Site</Label>
                <Input
                  id="social-website"
                  type="url"
                  placeholder="https://seusite.com.br"
                  value={social.website}
                  onChange={(e) => setSocial((s) => ({ ...s, website: e.target.value }))}
                  disabled={loading || savingSocial}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-instagram">Instagram</Label>
                <Input
                  id="social-instagram"
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={social.instagram}
                  onChange={(e) => setSocial((s) => ({ ...s, instagram: e.target.value }))}
                  disabled={loading || savingSocial}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-facebook">Facebook</Label>
                <Input
                  id="social-facebook"
                  type="url"
                  placeholder="https://facebook.com/..."
                  value={social.facebook}
                  onChange={(e) => setSocial((s) => ({ ...s, facebook: e.target.value }))}
                  disabled={loading || savingSocial}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-threads">Threads</Label>
                <Input
                  id="social-threads"
                  type="url"
                  placeholder="https://threads.net/..."
                  value={social.threads}
                  onChange={(e) => setSocial((s) => ({ ...s, threads: e.target.value }))}
                  disabled={loading || savingSocial}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-youtube">YouTube</Label>
                <Input
                  id="social-youtube"
                  type="url"
                  placeholder="https://youtube.com/@..."
                  value={social.youtube}
                  onChange={(e) => setSocial((s) => ({ ...s, youtube: e.target.value }))}
                  disabled={loading || savingSocial}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-tiktok">TikTok</Label>
                <Input
                  id="social-tiktok"
                  type="url"
                  placeholder="https://tiktok.com/@..."
                  value={social.tiktok}
                  onChange={(e) => setSocial((s) => ({ ...s, tiktok: e.target.value }))}
                  disabled={loading || savingSocial}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading || savingSocial}>
                  {savingSocial ? "Salvando…" : "Salvar redes sociais"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Em breve: preferências de notificação, tema e mais.
          </p>
        )}
      </div>
    </div>
  );
}
