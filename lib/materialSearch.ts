/**
 * Busca de materiais: normalização de texto (sem diferenciar
 * maiúsculas/minúsculas nem acentos) e expansão por sinônimos.
 *
 * Os sinônimos vêm da tabela material_sinonimos — cada linha é um grupo de
 * termos equivalentes (ex.: ['bacia', 'vaso sanitário']). Quando o usuário
 * pesquisa por um termo de um grupo, a busca também considera os demais.
 */

/**
 * Busca todas as linhas de uma tabela paginando de 1000 em 1000
 * (o Supabase limita cada request a 1000 linhas — um select simples
 * trunca catálogos grandes, ex.: 19 mil materiais).
 */
export async function fetchAllRows(
    client: { from: (table: string) => any },
    table: string,
    columns: string,
    orderBy?: string
): Promise<any[]> {
    const pageSize = 1000;
    const all: any[] = [];
    let from = 0;
    for (; ;) {
        let query = client.from(table).select(columns).range(from, from + pageSize - 1);
        if (orderBy) query = query.order(orderBy, { ascending: true });
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

export function normalizeSearchText(value: string | null | undefined): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Pontuação de busca por palavras: TODAS as palavras do termo precisam
 * aparecer no texto (em qualquer ordem), sem diferenciar caixa/acentos.
 * Ex.: "Tubo 50" encontra "TUBO PVC SOLDA 50MM".
 * Retorna -1 quando não casa; quanto maior, melhor o match.
 */
export function scoreTermMatch(text: string | null | undefined, term: string | null | undefined): number {
    const name = normalizeSearchText(text);
    const normalizedTerm = normalizeSearchText(term);
    if (!name || !normalizedTerm) return -1;

    if (name === normalizedTerm) return 1000;
    if (name.startsWith(normalizedTerm)) return 900;

    const tokens = normalizedTerm.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return -1;
    const words = name.split(/[^a-z0-9]+/).filter(Boolean);

    let score = 0;
    for (const token of tokens) {
        if (words.includes(token)) {
            score += 300; // palavra exata ("tubo")
        } else if (words.some((word) => word.startsWith(token))) {
            score += 220; // prefixo de palavra ("50" → "50mm")
        } else if (name.includes(token)) {
            score += 120; // substring em qualquer posição
        } else {
            return -1; // alguma palavra do termo não existe no texto → não casa
        }
    }
    return Math.min(score, 890);
}

/**
 * Comparação por palavras (case/acento-insensitive): todas as palavras de
 * `term` aparecem em `text`?
 */
export function textIncludesTerm(text: string | null | undefined, term: string | null | undefined): boolean {
    return scoreTermMatch(text, term) >= 0;
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
