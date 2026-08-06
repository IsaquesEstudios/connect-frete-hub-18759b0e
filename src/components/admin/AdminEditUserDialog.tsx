import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PhotoUploader } from "@/components/common/PhotoUploader";
import { repo } from "@/lib/data";
import { getExternalUserEmailsForIds } from "@/lib/data/emails.functions";
import { reportEmailsUnavailable, EMAIL_UNAVAILABLE_LABEL } from "@/lib/data/emails-client";
import { setExternalUserActive } from "@/lib/data/admin-users.functions";
import { deleteAuthUser } from "@/lib/data/auth-cleanup.functions";
import { translateAuthError } from "@/lib/auth/translate-error";
import { formatPhone } from "@/lib/format-phone";
import { formatDoc } from "@/lib/format-doc";
import type { User, UserProfilePatch, UserType } from "@/lib/data";

function perfilLabel(type: UserType, perfilEmpresa?: string) {
  if (type === "admin") return "Administrador";
  if (type === "colaborador") return "Colaborador";
  if (perfilEmpresa) {
    const map: Record<string, string> = {
      transportador: "Transportadora",
      embarcador: "Empresa",
      agenciador: "Agência de carga",
    };
    return map[perfilEmpresa] || perfilEmpresa;
  }
  if (type === "empresa") return "Empresa";
  if (type === "motorista") return "Motorista";
  return type;
}

interface Props {
  user: User | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export function AdminEditUserDialog({ user, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [authEmail, setAuthEmail] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const u = user as User & {
      cnpj?: string;
      cpf?: string;
      placa?: string;
      tipoVeiculo?: string;
      rntrc?: string;
      carroceria?: string;
      peso?: string;
      nomeFantasia?: string;
      perfilEmpresa?: string;
      siteRedeSocial?: string;
    };
    const splitObs = (v?: string): [string, string] => {
      if (!v) return ["", ""];
      const idx = v.indexOf(" | Obs: ");
      if (idx === -1) return [v, ""];
      return [v.slice(0, idx), v.slice(idx + " | Obs: ".length)];
    };
    const [tipoVeiculoBase, tipoVeiculoObs] = splitObs(u.tipoVeiculo);
    const [carroceriaBase, carroceriaObs] = splitObs(u.carroceria);
    setForm({
      name: u.name ?? "",
      email: u.email ?? "",
      whatsapp: formatPhone(u.whatsapp ?? ""),
      cpf: u.cpf ?? "",
      cnpj: u.cnpj ?? "",
      cidade: u.cidade ?? "",
      estado: u.estado ?? "",
      fotoUrl: u.fotoUrl ?? "",
      placa: u.placa ?? "",
      tipoVeiculo: tipoVeiculoBase,
      tipoVeiculoObs,
      rntrc: u.rntrc ?? "",
      carroceria: carroceriaBase,
      carroceriaObs,
      peso: u.peso ?? "",
      nomeFantasia: u.nomeFantasia ?? "",
      perfilEmpresa: u.perfilEmpresa || (u.type === "motorista" ? "motorista" : ""),
      siteRedeSocial: u.siteRedeSocial ?? "",
    });
    setActive(u.active !== false);
  }, [user?.id]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setAuthEmail(user.email ?? "");
    getExternalUserEmailsForIds({ data: { userIds: [user.id] } })
      .then((map) => {
        if (cancelled) return;
        const email = map[user.id] || user.email || "";
        setAuthEmail(email);
        setForm((current) => ({ ...current, email }));
      })
      .catch((err) => {
        if (cancelled) return;
        reportEmailsUnavailable(err);
        setAuthEmail(user.email || EMAIL_UNAVAILABLE_LABEL);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  if (!user) return null;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const patch: UserProfilePatch = {
        name: form.name,
        whatsapp: form.whatsapp,
        cidade: form.cidade,
        estado: form.estado,
        fotoUrl: form.fotoUrl,
      };

      // Derive target type from the perfil selection so the visible label
      // (chip in conversations / users table) updates too.
      let targetType: UserType = user.type;
      const perfil = form.perfilEmpresa || "";
      if (user.type === "empresa" || user.type === "motorista") {
        if (perfil === "motorista") targetType = "motorista";
        else if (["transportador", "embarcador", "agenciador"].includes(perfil)) targetType = "empresa";
      }
      if (targetType !== user.type) patch.type = targetType;

      const setIf = <K extends keyof UserProfilePatch>(key: K, value: UserProfilePatch[K] | undefined) => {
        if (value === undefined) return;
        if (typeof value === "string" && value.trim() === "") return;
        patch[key] = value;
      };

      setIf("cpf", form.cpf);
      setIf("cnpj", form.cnpj);

      if (targetType === "empresa") {
        setIf("nomeFantasia", form.nomeFantasia);
        setIf("perfilEmpresa", perfil);
        setIf("siteRedeSocial", form.siteRedeSocial);
      }

      if (targetType === "motorista") {
        const joinObs = (base: string, obs: string) => {
          const b = (base || "").trim();
          const o = (obs || "").trim();
          if (!b) return "";
          return o ? `${b} | Obs: ${o}` : b;
        };
        setIf("cpf", form.cpf);
        setIf("placa", form.placa);
        setIf("tipoVeiculo", joinObs(form.tipoVeiculo, form.tipoVeiculoObs));
        setIf("rntrc", form.rntrc);
        setIf("carroceria", joinObs(form.carroceria, form.carroceriaObs));
        setIf("peso", form.peso);
        setIf("perfilEmpresa", perfil);
      }
      await repo.updateUser(user.id, patch);
      if (active !== (user.active !== false)) {
        await setExternalUserActive({ data: { userId: user.id, active } });
        repo.applyLocalUserPatch(user.id, { active });
      }
      toast.success("Dados atualizados.");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(translateAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteAuthUser({ data: { userId: user.id } });
      toast.success("Conta excluída com sucesso.");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(translateAuthError(err));
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {user.name}</DialogTitle>
          <DialogDescription>
            Altere os dados do cadastro. O email é apenas visualização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">Foto do perfil</Label>
            <PhotoUploader value={form.fotoUrl || ""} onChange={(v) => set("fotoUrl", v)} />
            <Badge variant="default" className="mt-2 w-fit">
              {perfilLabel(user.type, form.perfilEmpresa)}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nome"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Email usado no cadastro">
              <div className="min-h-10 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground break-all">
                {authEmail || form.email || "Email não localizado"}
              </div>
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp || ""} onChange={(e) => set("whatsapp", formatPhone(e.target.value))} />
            </Field>
            <Field label="Cidade"><Input value={form.cidade || ""} onChange={(e) => set("cidade", e.target.value)} /></Field>
            <Field label="Estado (UF)"><Input value={form.estado || ""} onChange={(e) => set("estado", e.target.value.toUpperCase().slice(0, 2))} /></Field>
            <Field label="CPF">
              <div className="min-h-10 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground break-all">
                {form.cpf ? formatDoc(form.cpf, "cpf") : "Não informado"}
              </div>
            </Field>
            <Field label="CNPJ">
              <Input
                value={form.cnpj || ""}
                onChange={(e) => set("cnpj", formatDoc(e.target.value, "cnpj"))}
                placeholder="Não informado"
              />
            </Field>

            {user.type === "empresa" && (
              <>
                <Field label="Nome fantasia"><Input value={form.nomeFantasia || ""} onChange={(e) => set("nomeFantasia", e.target.value)} /></Field>

                <Field label="Perfil">
                  <PerfilSelect value={form.perfilEmpresa || ""} onChange={(v) => set("perfilEmpresa", v)} />
                </Field>
                <Field label="Site / Redes sociais" className="md:col-span-2">
                  <Textarea value={form.siteRedeSocial || ""} onChange={(e) => set("siteRedeSocial", e.target.value)} />
                </Field>
              </>
            )}

            {user.type === "motorista" && (
              <>
                <Field label="Perfil">
                  <PerfilSelect value={form.perfilEmpresa || ""} onChange={(v) => set("perfilEmpresa", v)} />
                </Field>
                <Field label="Placa"><Input value={form.placa || ""} onChange={(e) => set("placa", e.target.value)} /></Field>
                <Field label="RNTRC"><Input value={form.rntrc || ""} onChange={(e) => set("rntrc", e.target.value)} /></Field>
                <Field label="Tipo de veículo"><Input value={form.tipoVeiculo || ""} onChange={(e) => set("tipoVeiculo", e.target.value)} /></Field>
                <Field label="Tipo de carroceria"><Input value={form.carroceria || ""} onChange={(e) => set("carroceria", e.target.value)} /></Field>
                <Field label="Observação do veículo"><Input value={form.tipoVeiculoObs || ""} onChange={(e) => set("tipoVeiculoObs", e.target.value)} placeholder="Ex.: 2 eixos, ano 2020" /></Field>
                <Field label="Observação da carroceria"><Input value={form.carroceriaObs || ""} onChange={(e) => set("carroceriaObs", e.target.value)} /></Field>
                <Field label="Peso suportado (em kg)" className="md:col-span-2"><Input value={form.peso || ""} onChange={(e) => set("peso", e.target.value)} /></Field>
              </>
            )}
          </div>

          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label>Ativo</Label>
              <p className="text-xs text-muted-foreground">Desativado: o usuário não consegue entrar.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PerfilSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione o perfil" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="transportador">Transportadora</SelectItem>
        <SelectItem value="embarcador">Empresa</SelectItem>
        <SelectItem value="agenciador">Agência de carga</SelectItem>
        <SelectItem value="motorista">Motorista</SelectItem>
      </SelectContent>
    </Select>
  );
}
