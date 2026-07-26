import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { homeFor, updateCurrentProfile } from "@/lib/auth/session";
import { useAuth } from "@/lib/auth/useAuth";
import type { User, UserProfilePatch } from "@/lib/data";
import { formatDoc, docPlaceholder, type DocTipo } from "@/lib/format-doc";
import { formatPhone, phoneDigits } from "@/lib/format-phone";
import { PhotoUploader } from "@/components/common/PhotoUploader";


export const Route = createFileRoute("/_app/perfil")({
  head: () => ({ meta: [{ title: "Perfil — SV Logística" }] }),
  component: ProfilePage,
});

type ProfileForm = {
  name: string;
  email: string;
  whatsapp: string;
  cpf: string;
  cnpj: string;
  cidade: string;
  estado: string;
  fotoUrl: string;
  placa: string;
  tipoVeiculo: string;
  rntrc: string;
  carroceria: string;
  peso: string;
  nomeFantasia: string;
  perfilEmpresa: string;
  siteRedeSocial: string;
};

const emptyForm: ProfileForm = {
  name: "",
  email: "",
  whatsapp: "",
  cpf: "",
  cnpj: "",
  cidade: "",
  estado: "",
  fotoUrl: "",
  placa: "",
  tipoVeiculo: "",
  rntrc: "",
  carroceria: "",
  peso: "",
  nomeFantasia: "",
  perfilEmpresa: "",
  siteRedeSocial: "",
};

function toProfileForm(user: User): ProfileForm {
  return {
    ...emptyForm,
    name: user.name ?? "",
    email: user.email ?? "",
    whatsapp: formatPhone(user.whatsapp ?? ""),
    cpf: user.cpf ?? "",
    cidade: user.cidade ?? "",
    estado: user.estado ?? "",
    fotoUrl: user.fotoUrl ?? "",
    ...(user.type === "empresa"
      ? {
          cnpj: user.cnpj ?? "",
          nomeFantasia: user.nomeFantasia ?? "",
          perfilEmpresa: user.perfilEmpresa ?? "",
          siteRedeSocial: user.siteRedeSocial ?? "",
        }
      : {}),
    ...(user.type === "motorista"
      ? {
          placa: user.placa ?? "",
          tipoVeiculo: user.tipoVeiculo ?? "",
          rntrc: user.rntrc ?? "",
          carroceria: user.carroceria ?? "",
          peso: user.peso ?? "",
          siteRedeSocial: user.siteRedeSocial ?? "",
        }
      : {}),
  };
}

function patchForUser(user: User, form: ProfileForm): UserProfilePatch {
  const patch: UserProfilePatch = {
    name: form.name,
    whatsapp: form.whatsapp,
    cpf: form.cpf,
    cidade: form.cidade,
    estado: form.estado,
    fotoUrl: form.fotoUrl,
  };

  if (user.type === "empresa") {
    patch.cnpj = form.cnpj;
    patch.nomeFantasia = form.nomeFantasia;
    patch.perfilEmpresa = form.perfilEmpresa;
    patch.siteRedeSocial = form.siteRedeSocial;
  }

  if (user.type === "motorista") {
    patch.placa = form.placa;
    patch.tipoVeiculo = form.tipoVeiculo;
    patch.rntrc = form.rntrc;
    patch.carroceria = form.carroceria;
    patch.peso = form.peso;
    patch.siteRedeSocial = form.siteRedeSocial;
  }

  return patch;
}

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [docTipo, setDocTipo] = useState<DocTipo>(user?.type === "empresa" ? "cnpj" : "cpf");


  useEffect(() => {
    if (user) {
      setForm(toProfileForm(user));
      const u = user as User & { cnpj?: string; cpf?: string };
      if (u.cnpj) setDocTipo("cnpj");
      else if (u.cpf) setDocTipo("cpf");
      else setDocTipo(user.type === "empresa" ? "cnpj" : "cpf");
    }
  }, [user]);

  // O email exibido deve ser o mesmo usado para login (auth), não o da tabela de perfis.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setAuthEmail(user.email ?? "");
    getExternalUserEmailsForIds({ data: { userIds: [user.id] } })
      .then((map) => {
        if (cancelled) return;
        setAuthEmail(map[user.id] || user.email || "");
      })
      .catch((err) => {
        if (cancelled) return;
        reportEmailsUnavailable(err);
        setAuthEmail(user.email || EMAIL_UNAVAILABLE_LABEL);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);




  if (!user) return null;

  const update = (key: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const missingWhats = !form.whatsapp || phoneDigits(form.whatsapp).length < 10;

  const save = async () => {
    if (missingWhats) {
      toast.error("Informe um número de WhatsApp válido (obrigatório).");
      return;
    }
    setSaving(true);
    try {
      await updateCurrentProfile(patchForUser(user, form));
      toast.success("Perfil atualizado com sucesso.");
      navigate({ to: homeFor(user) as "/admin" });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };


  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: homeFor(user) as "/admin" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Perfil</h1>
              <p className="text-sm text-muted-foreground">Dados cadastrados na sua conta.</p>
            </div>
          </div>
        </div>

        {missingWhats && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <strong>Complete seu cadastro:</strong> informe seu número de WhatsApp abaixo para continuar usando o sistema.
          </div>
        )}

        <section className="grid gap-4 rounded-md border bg-card p-4 md:grid-cols-3 md:p-6">

          <ReadOnly label="Número" value={user.number} />
          <ReadOnly label="Tipo" value={profileTypeLabel(user.type)} />
          <ReadOnly label="Criado em" value={formatDate(user.createdAt)} />
        </section>

        <section className="space-y-5 rounded-md border bg-card p-4 md:p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Informações principais</h2>
            <p className="text-sm text-muted-foreground">Atualize os dados exibidos no sistema.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Editable required label="Nome" value={form.name} onChange={(value) => update("name", value)} />
            <ReadOnly label="Email" value={form.email} />
            <Editable
              required
              label="Telefone / WhatsApp"
              value={form.whatsapp}
              onChange={(value) => update("whatsapp", formatPhone(value))}
              inputMode="tel"
            />

            <DocumentoField
              tipo={docTipo}
              value={docTipo === "cpf" ? form.cpf : form.cnpj}
              onTipoChange={(t) => {
                setDocTipo(t);
                if (t === "cpf") { update("cnpj", ""); } else { update("cpf", ""); }
              }}
              onValueChange={(v) => update(docTipo === "cpf" ? "cpf" : "cnpj", v)}
            />
            <Editable label="Cidade" value={form.cidade} onChange={(value) => update("cidade", value)} />
            <Editable label="Estado" value={form.estado} onChange={(value) => update("estado", value)} />
            <div className="space-y-2 md:col-span-2">
              <Label>Foto do perfil</Label>
              <PhotoUploader value={form.fotoUrl} onChange={(v) => update("fotoUrl", v)} />
            </div>
          </div>

          {user.type === "empresa" && (
            <div className="space-y-4 border-t pt-5">
              <h2 className="text-lg font-semibold text-foreground">Dados da empresa</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Editable label="Nome fantasia" value={form.nomeFantasia} onChange={(value) => update("nomeFantasia", value)} />
                <Editable label="Perfil" value={form.perfilEmpresa} onChange={(value) => update("perfilEmpresa", value)} />
                <div className="space-y-2 md:col-span-2">
                  <Label>Site / Redes sociais</Label>
                  <Textarea
                    value={form.siteRedeSocial}
                    onChange={(event) => update("siteRedeSocial", event.target.value)}
                    placeholder="Instagram, Facebook, site ou outros links"
                  />
                </div>
              </div>
            </div>
          )}


          {user.type === "motorista" && (
            <div className="space-y-4 border-t pt-5">
              <h2 className="text-lg font-semibold text-foreground">Dados do motorista</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Editable label="Placa" value={form.placa} onChange={(value) => update("placa", value)} />
                <Editable label="RNTRC" value={form.rntrc} onChange={(value) => update("rntrc", value)} />
                <Editable label="Tipo de veículo" value={form.tipoVeiculo} onChange={(value) => update("tipoVeiculo", value)} />
                <Editable label="Tipo de carroceria" value={form.carroceria} onChange={(value) => update("carroceria", value)} />
                <Editable label="Peso (kg)" value={form.peso} onChange={(value) => update("peso", value)} />
                <div className="space-y-2 md:col-span-2">
                  <Label>Site / Redes sociais</Label>
                  <Textarea
                    value={form.siteRedeSocial}
                    onChange={(event) => update("siteRedeSocial", event.target.value)}
                    placeholder="Instagram, Facebook, site ou outros links"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end border-t pt-5">
            <Button onClick={save} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Editable({
  label,
  value,
  onChange,
  required,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} />
      {required && <p className="text-[11px] text-destructive">obrigatório</p>}
    </div>
  );
}


function DocumentoField({
  tipo,
  value,
  onTipoChange,
  onValueChange,
}: {
  tipo: DocTipo;
  value: string;
  onTipoChange: (t: DocTipo) => void;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>
        Documento<span className="ml-1 text-destructive">*</span>
      </Label>

      <RadioGroup
        value={tipo}
        onValueChange={(v) => onTipoChange(v as DocTipo)}
        className="flex gap-4"
      >
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="cpf" /> CPF
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="cnpj" /> CNPJ
        </label>
      </RadioGroup>
      <Input
        value={value}
        onChange={(event) => onValueChange(formatDoc(event.target.value, tipo))}
        placeholder={docPlaceholder(tipo)}
        inputMode="numeric"
      />
      <p className="text-[11px] text-destructive">obrigatório</p>
    </div>

  );
}




function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value || "Não informado"} disabled className="bg-muted text-muted-foreground" />
    </div>
  );
}

function profileTypeLabel(type: User["type"]): string {
  if (type === "empresa") return "Empresa";
  if (type === "motorista") return "Motorista";
  if (type === "colaborador") return "Colaborador";
  return "Admin";
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}