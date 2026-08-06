// Busca tolerante: ignora acentos, pontuação, maiúsculas e ordem das palavras.
export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Remove tudo que não for letra/número (pontos, barras, traços, espaços). */
function squash(value: unknown): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
}

/**
 * Retorna true quando a consulta casa com qualquer um dos campos.
 * - cada palavra da busca precisa aparecer em algum campo (ordem livre)
 * - documentos/telefones casam só pelos dígitos
 * - pontuação é ignorada dos dois lados
 */
export function matchesSearch(query: string, fields: Array<unknown>): boolean {
  const raw = normalizeSearchText(query);
  if (!raw) return true;

  const values = fields.map(normalizeSearchText).filter(Boolean);
  const squashed = fields.map(squash).filter(Boolean);
  const digitFields = fields.map(onlyDigits).filter(Boolean);

  const qDigits = onlyDigits(query);
  if (qDigits.length >= 3 && digitFields.some((v) => v.includes(qDigits))) return true;

  const terms = raw.split(/\s+/).filter(Boolean);
  const everyTermMatches = terms.every((term) => {
    const st = squash(term);
    if (!st) return true;
    return values.some((v) => v.includes(term)) || squashed.some((v) => v.includes(st));
  });
  if (everyTermMatches) return true;

  // Última tentativa: consulta inteira sem pontuação (ex.: "35.624.695/0001-67").
  const sq = squash(query);
  return !!sq && squashed.some((v) => v.includes(sq));
}
