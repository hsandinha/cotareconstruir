/**
 * Busca de materiais: normalização de texto (sem diferenciar
 * maiúsculas/minúsculas nem acentos) e expansão por sinônimos.
 *
 * Os sinônimos vêm da tabela material_sinonimos — cada linha é um grupo de
 * termos equivalentes (ex.: ['bacia', 'vaso sanitário']). Quando o usuário
 * pesquisa por um termo de um grupo, a busca também considera os demais.
 */

export function normalizeSearchText(value: string | null | undefined): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/** Comparação case/acento-insensitive: `text` contém `term`? */
export function textIncludesTerm(text: string | null | undefined, term: string | null | undefined): boolean {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) return false;
    return normalizeSearchText(text).includes(normalizedTerm);
}

const MAX_SEARCH_VARIANTS = 8;
const MIN_TERM_LENGTH_FOR_SYNONYMS = 3;

/**
 * Expande o termo pesquisado com os sinônimos cadastrados.
 * Retorna o próprio termo (normalizado) + termos dos grupos em que ele aparece.
 */
export function expandTermWithSynonyms(term: string, synonymGroups: string[][]): string[] {
    const normalizedTerm = normalizeSearchText(term);
    const variants = new Set<string>();
    if (!normalizedTerm) return [];
    variants.add(normalizedTerm);

    if (normalizedTerm.length >= MIN_TERM_LENGTH_FOR_SYNONYMS) {
        for (const group of synonymGroups) {
            const normalizedGroup = (group || []).map(normalizeSearchText).filter(Boolean);
            const matches = normalizedGroup.some(
                (termo) => termo.includes(normalizedTerm) || normalizedTerm.includes(termo)
            );
            if (matches) {
                // Inclui a forma original (com acento) e a normalizada — a
                // busca remota (ilike) diferencia acentos, a local não.
                (group || []).forEach((termo) => {
                    const raw = String(termo || '').trim().toLowerCase();
                    if (raw) variants.add(raw);
                    const normalized = normalizeSearchText(termo);
                    if (normalized) variants.add(normalized);
                });
            }
            if (variants.size >= MAX_SEARCH_VARIANTS) break;
        }
    }

    return Array.from(variants).slice(0, MAX_SEARCH_VARIANTS);
}
