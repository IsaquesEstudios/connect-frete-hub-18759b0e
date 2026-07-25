import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Download, MessageSquare, Truck, MailWarning, Tags, FileSpreadsheet, FileText, FileType, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { repo } from "@/lib/data";
import { getExternalUserEmails } from "@/lib/data/emails.functions";
import { homeFor } from "@/lib/auth/session";
import { useAuth } from "@/lib/auth/useAuth";
import { useRepoVersion } from "@/lib/hooks/useRepo";
import { formatPhone } from "@/lib/format-phone";
import { formatDoc } from "@/lib/format-doc";

function docsOf(u: { cpf?: string; cnpj?: string }) {
  const cpf = (u.cpf || "").replace(/\D/g, "");
  const cnpj = (u.cnpj || "").replace(/\D/g, "");
  return {
    cpf: cpf ? formatDoc(cpf, "cpf") : "",
    cnpj: cnpj ? formatDoc(cnpj, "cnpj") : "",
  };
}

export const Route = createFileRoute("/_app/metricas")({
  head: () => ({ meta: [{ title: "Métricas — SV Logística" }] }),
  component: MetricsPage,
});

function MetricsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const v = useRepoVersion();

  useEffect(() => {
    if (user && user.type !== "admin") navigate({ to: homeFor(user) as "/admin" });
  }, [user, navigate]);

  const allConversations = useMemo(() => repo.listConversations(), [v]);
  const tags = useMemo(() => repo.listTags(), [v]);
  const [filterUf, setFilterUf] = useState<string>("todos");
  const [filterTag, setFilterTag] = useState<string>("todos");

  const ufOptions = useMemo(() => {
    const set = new Set<string>();
    allConversations.forEach((c) => {
      const uf = (c.user as { estado?: string }).estado;
      if (uf) set.add(uf.toUpperCase());
    });
    return Array.from(set).sort();
  }, [allConversations]);

  const conversations = useMemo(() => {
    return allConversations.filter((c) => {
      if (filterUf !== "todos") {
        const uf = ((c.user as { estado?: string }).estado || "").toUpperCase();
        if (uf !== filterUf) return false;
      }
      if (filterTag !== "todos") {
        if (!c.tagIds.includes(filterTag)) return false;
      }
      return true;
    });
  }, [allConversations, filterUf, filterTag]);

  const stats = useMemo(() => {
    const empresas = conversations.filter((c) => c.user.type === "empresa").length;
    const motoristas = conversations.filter((c) => c.user.type === "motorista").length;
    const active = conversations.filter((c) => c.lastMessage).length;
    const unread = conversations.reduce((n, c) => n + c.unreadForAdmin, 0);
    return { empresas, motoristas, active, unread, tags: tags.length };
  }, [conversations, tags]);

  const tagReport = useMemo(() => {
    const source = filterTag === "todos" ? tags : tags.filter((t) => t.id === filterTag);
    return source.map((tag) => {
      const taggedConversations = conversations.filter((c) => c.tagIds.includes(tag.id));
      return {
        tag,
        total: taggedConversations.length,
        empresas: taggedConversations.filter((c) => c.user.type === "empresa").length,
        motoristas: taggedConversations.filter((c) => c.user.type === "motorista").length,
      };
    });
  }, [conversations, tags, filterTag]);

  if (!user || user.type !== "admin") return null;

  function csvEscape(v: string | number) {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  async function downloadReport() {
    const emailMap = await getExternalUserEmails().catch(() => ({}) as Record<string, string>);
    const lines: string[] = [];
    lines.push("Relatório SV Logística");
    lines.push(`Gerado em;${new Date().toLocaleString()}`);
    lines.push("");
    lines.push("Resumo");
    lines.push("Métrica;Valor");
    lines.push(`Empresas;${stats.empresas}`);
    lines.push(`Motoristas;${stats.motoristas}`);
    lines.push(`Conversas ativas;${stats.active}`);
    lines.push(`Não lidas;${stats.unread}`);
    lines.push(`Tags cadastradas;${stats.tags}`);
    lines.push("");
    lines.push("Tags");
    lines.push("Tag;Cor;Conversas;Empresas;Motoristas");
    for (const r of tagReport) {
      lines.push(
        [r.tag.label, r.tag.color, r.total, r.empresas, r.motoristas].map(csvEscape).join(";"),
      );
    }
    lines.push("");
    lines.push("Conversas");
    lines.push("Nome;Código;CPF;CNPJ;Telefone;Email;Tipo;Não lidas admin;Última mensagem;Tags");
    const tagsById = Object.fromEntries(tags.map((t) => [t.id, t.label] as const));
    for (const c of conversations) {
      const u = c.user as { whatsapp?: string; email?: string; cpf?: string; cnpj?: string };
      const email = u.email || emailMap[c.user.id] || "";
      const d = docsOf(u);
      const tagLabels = c.tagIds.map((id) => tagsById[id] || id).join("|");
      const last = c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleString() : "";
      lines.push(
        [c.user.name, c.user.number, d.cpf, d.cnpj, formatPhone(u.whatsapp || ""), email, c.user.type, c.unreadForAdmin, last, tagLabels]
          .map(csvEscape)
          .join(";"),
      );
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-svlogistica-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const tagsById = Object.fromEntries(tags.map((t) => [t.id, t.label] as const));

    doc.setFontSize(16);
    doc.text("Relatório SV Logística", 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleString()}`, 40, 56);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 76,
      head: [["Métrica", "Valor"]],
      body: [
        ["Empresas", String(stats.empresas)],
        ["Motoristas", String(stats.motoristas)],
        ["Conversas ativas", String(stats.active)],
        ["Não lidas", String(stats.unread)],
        ["Tags", String(stats.tags)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    // jsPDF standard fonts don't support emoji/non-latin1 — strip to avoid "Ø=ÜÍ" garbage.
    const clean = (s: string) =>
      (s ?? "")
        // eslint-disable-next-line no-control-regex
        .replace(/[^\x00-\xFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    autoTable(doc, {
      head: [["Tag", "Conversas", "Empresas", "Motoristas"]],
      body: tagReport.map((r) => [clean(r.tag.label), r.total, r.empresas, r.motoristas]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    const emailMap = await getExternalUserEmails().catch(() => ({}) as Record<string, string>);
    autoTable(doc, {
      head: [["Nome", "Código", "Telefone", "Email", "Tipo", "Não lidas", "Tags"]],
      body: conversations.map((c) => {
        const u = c.user as { whatsapp?: string; email?: string };
        const email = u.email || emailMap[c.user.id] || "";
        return [
          clean(c.user.name),
          c.user.number,
          formatPhone(u.whatsapp || ""),
          email,
          c.user.type,
          c.unreadForAdmin,
          clean(c.tagIds.map((id) => tagsById[id] || id).join(", ")),
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    doc.save(`relatorio-svlogistica-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function downloadTXT() {
    const emailMap = await getExternalUserEmails().catch(() => ({}) as Record<string, string>);
    const tagsById = Object.fromEntries(tags.map((t) => [t.id, t.label] as const));
    const L: string[] = [];
    L.push("RELATÓRIO SV LOGÍSTICA");
    L.push(`Gerado em: ${new Date().toLocaleString()}`);
    L.push(`Filtros: UF=${filterUf}  Tag=${filterTag === "todos" ? "todas" : tagsById[filterTag] || filterTag}`);
    L.push("");
    L.push("RESUMO");
    L.push(`- Empresas: ${stats.empresas}`);
    L.push(`- Motoristas: ${stats.motoristas}`);
    L.push(`- Conversas ativas: ${stats.active}`);
    L.push(`- Não lidas: ${stats.unread}`);
    L.push(`- Tags: ${stats.tags}`);
    L.push("");
    L.push("USUÁRIOS");
    for (const c of conversations) {
      const u = c.user as { whatsapp?: string; email?: string; estado?: string; cidade?: string };
      const email = u.email || emailMap[c.user.id] || "";
      const tagLabels = c.tagIds.map((id) => tagsById[id] || id).join(", ");
      L.push(`• ${c.user.name} [${c.user.type}]`);
      L.push(`  Código: ${c.user.number}`);
      if (u.whatsapp) L.push(`  WhatsApp: ${formatPhone(u.whatsapp)}`);
      if (email) L.push(`  Email: ${email}`);
      if (u.cidade || u.estado) L.push(`  Local: ${[u.cidade, u.estado].filter(Boolean).join(" / ")}`);
      if (tagLabels) L.push(`  Tags: ${tagLabels}`);
      L.push(`  Não lidas: ${c.unreadForAdmin}`);
      L.push("");
    }
    const blob = new Blob([L.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-svlogistica-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadWord() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = await import("docx");
    const emailMap = await getExternalUserEmails().catch(() => ({}) as Record<string, string>);
    const tagsById = Object.fromEntries(tags.map((t) => [t.id, t.label] as const));

    const summaryRows = [
      ["Empresas", String(stats.empresas)],
      ["Motoristas", String(stats.motoristas)],
      ["Conversas ativas", String(stats.active)],
      ["Não lidas", String(stats.unread)],
      ["Tags", String(stats.tags)],
    ];

    const mkCell = (text: string, bold = false) =>
      new TableCell({
        width: { size: 4500, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
      });

    const summaryTable = new Table({
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: [4500, 4500],
      rows: summaryRows.map((r) => new TableRow({ children: [mkCell(r[0], true), mkCell(r[1])] })),
    });

    const userParas: InstanceType<typeof Paragraph>[] = [];
    for (const c of conversations) {
      const u = c.user as { whatsapp?: string; email?: string; estado?: string; cidade?: string };
      const email = u.email || emailMap[c.user.id] || "";
      const tagLabels = c.tagIds.map((id) => tagsById[id] || id).join(", ");
      userParas.push(
        new Paragraph({ children: [new TextRun({ text: `${c.user.name} `, bold: true }), new TextRun({ text: `[${c.user.type}]` })] }),
        new Paragraph(`  Código: ${c.user.number}`),
        new Paragraph(`  WhatsApp: ${u.whatsapp ? formatPhone(u.whatsapp) : "—"}`),
        new Paragraph(`  Email: ${email || "—"}`),
        new Paragraph(`  Local: ${[u.cidade, u.estado].filter(Boolean).join(" / ") || "—"}`),
        new Paragraph(`  Tags: ${tagLabels || "—"}`),
        new Paragraph(`  Não lidas admin: ${c.unreadForAdmin}`),
        new Paragraph(""),
      );
    }

    const wordDoc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Relatório SV Logística")] }),
          new Paragraph(`Gerado em ${new Date().toLocaleString()}`),
          new Paragraph(`Filtros: UF=${filterUf}  Tag=${filterTag === "todos" ? "todas" : tagsById[filterTag] || filterTag}`),
          new Paragraph(""),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Resumo")] }),
          summaryTable,
          new Paragraph(""),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Usuários")] }),
          ...userParas,
        ],
      }],
    });

    const blob = await Packer.toBlob(wordDoc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-svlogistica-${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }




  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Métricas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão geral das conversas e usuários da plataforma.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="shrink-0">
                <Download className="h-4 w-4 mr-2" /> Gerar relatório
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={downloadReport}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPDF}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadWord}>
                <FileType className="h-4 w-4 mr-2" /> Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadTXT}>
                <FileCode className="h-4 w-4 mr-2" /> Bloco de notas (.txt)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Estado:</span>
            <Select value={filterUf} onValueChange={setFilterUf}>
              <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ufOptions.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tag:</span>
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Empresas"
            value={stats.empresas}
            icon={<Building2 className="h-5 w-5" />}
            accent="bg-[hsl(var(--company))]"
          />
          <Card
            label="Motoristas"
            value={stats.motoristas}
            icon={<Truck className="h-5 w-5" />}
            accent="bg-[hsl(var(--driver))]"
          />
          <Card
            label="Conversas ativas"
            value={stats.active}
            icon={<MessageSquare className="h-5 w-5" />}
            accent="bg-primary"
          />
          <Card
            label="Não lidas"
            value={stats.unread}
            icon={<MailWarning className="h-5 w-5" />}
            accent="bg-primary"
            highlight={stats.unread > 0}
          />
          <Card
            label="Tags cadastradas"
            value={stats.tags}
            icon={<Tags className="h-5 w-5" />}
            accent="bg-primary"
          />
        </div>

        <section className="mt-6 rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Relatório de tags</h2>
          </div>
          {tagReport.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma tag cadastrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Tag</th>
                    <th className="px-4 py-3 font-medium">Cor</th>
                    <th className="px-4 py-3 font-medium">Conversas</th>
                    <th className="px-4 py-3 font-medium">Empresas</th>
                    <th className="px-4 py-3 font-medium">Motoristas</th>
                  </tr>
                </thead>
                <tbody>
                  {tagReport.map(({ tag, total, empresas, motoristas }) => (
                    <tr key={tag.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{tag.label}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className="h-4 w-4 rounded-full border"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.color}
                        </span>
                      </td>
                      <td className="px-4 py-3">{total}</td>
                      <td className="px-4 py-3">{empresas}</td>
                      <td className="px-4 py-3">{motoristas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  icon,
  accent,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md text-white ${accent}`}>
          {icon}
        </div>
      </div>
      <div className={`mt-2 text-3xl font-semibold ${highlight ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}
