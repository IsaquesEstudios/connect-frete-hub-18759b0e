/**
 * Exportação padronizada de planilhas (.xlsx).
 * Sempre um dado por coluna — nada de tudo concatenado numa célula só.
 */
export type SheetData = {
  name: string;
  header: string[];
  rows: (string | number)[][];
};

function safeName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Planilha";
}

export async function downloadXlsx(fileBaseName: string, sheets: SheetData[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa = [sheet.header, ...sheet.rows.map((r) => r.map((v) => (v ?? "") as string | number))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = sheet.header.map((h, i) => {
      const width = Math.max(
        h.length,
        ...sheet.rows.map((r) => String(r[i] ?? "").length),
      );
      return { wch: Math.min(Math.max(width + 2, 10), 45) };
    });
    XLSX.utils.book_append_sheet(wb, ws, safeName(sheet.name));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fileBaseName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
