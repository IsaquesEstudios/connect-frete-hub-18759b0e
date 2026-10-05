import type { User } from "@/lib/data";
import { formatPhone } from "@/lib/format-phone";

const NA = "Não informado";

const PERFIL_EMPRESA: Record<string, string> = {
  transportador: "Transportador",
  embarcador: "Embarcador",
  agenciador: "Agenciador",
};

export function userTypeLabel(t: string): string {
  if (t === "empresa") return "Empresa";
  if (t === "motorista") return "Motorista";
  if (t === "colaborador") return "Colaborador";
  return "Admin";
}

/** Lista completa de dados de um usuário, usada para exibir e para copiar. */
export function userDetailFields(u: User, email?: string): { label: string; value: string }[] {
  const x = u as User & Record<string, string | undefined>;
  const fields: { label: string; value: string }[] = [
    { label: "Tipo", value: userTypeLabel(u.type) },
    { label: "Nome", value: u.name || NA },
    { label: "Código", value: u.number || NA },
    { label: "Email", value: email || u.email || NA },
    { label: "WhatsApp", value: u.whatsapp ? formatPhone(u.whatsapp) : NA },
  ];
  if (x.cpf) fields.push({ label: "CPF", value: x.cpf });
  if (x.cnpj) fields.push({ label: "CNPJ", value: x.cnpj });
  if (!x.cpf && !x.cnpj) fields.push({ label: "CPF / CNPJ", value: NA });
  if (u.type === "empresa") {
    fields.push(
      { label: "Nome fantasia", value: x.nomeFantasia || NA },
      {
        label: "Perfil da empresa",
        value: x.perfilEmpresa ? PERFIL_EMPRESA[x.perfilEmpresa] || x.perfilEmpresa : NA,
      },
      { label: "Site / Rede social", value: x.siteRedeSocial || NA },
    );
  }
  if (u.type === "motorista") {
    fields.push(
      { label: "Placa", value: x.placa || NA },
      { label: "Tipo de veículo", value: x.tipoVeiculo || NA },
      { label: "Tipo de carroceria", value: x.carroceria || NA },
      { label: "Peso suportado (kg)", value: x.peso || NA },
    );
    if (x.rntrc) fields.push({ label: "RNTRC", value: x.rntrc });
    if (x.siteRedeSocial) fields.push({ label: "Site / Rede social", value: x.siteRedeSocial });
  }
  fields.push(
    { label: "Cidade", value: u.cidade || NA },
    { label: "Estado", value: u.estado || NA },
    {
      label: "Conta criada em",
      value: u.createdAt ? new Date(u.createdAt).toLocaleString("pt-BR") : NA,
    },
    { label: "Situação", value: u.active === false ? "Bloqueado" : "Ativo" },
  );
  return fields;
}

export function userDetailsText(u: User, email?: string, extra: string[] = []): string {
  return [...userDetailFields(u, email).map((f) => `${f.label}: ${f.value}`), ...extra].join("\n");
}
