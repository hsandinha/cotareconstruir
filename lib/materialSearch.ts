/**
 * Busca de materiais: normalização de texto (sem diferenciar
 * maiúsculas/minúsculas nem acentos) e expansão por sinônimos.
 *
 * Regra da busca: o termo digitado precisa INICIAR a descrição. Digitar
 * "cabo" traz "CABO FLEXÍVEL 1,5 AZUL" e todas as demais especificações que
 * começam com "cabo", mas nunca "TERMINAL PARA CABO" — a palavra no meio da
 * descrição não conta. O cliente vai refinando ("cabo flex", depois a bitola,
 * depois a cor) até chegar na especificação.
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

/** Quebra o texto normalizado em palavras (letras/dígitos). */
function splitWords(normalized: string): string[] {
    return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Pontuação de busca ANCORADA NO INÍCIO da descrição: a especificação
 * precisa COMEÇAR pelo termo digitado — nunca contê-lo no meio.
 *
 * Ex.: "cabo" e "cabo flex" encontram "CABO FLEXÍVEL 1,5 AZUL";
 * NÃO encontram "TERMINAL PARA CABO FLEXÍVEL" nem "ABRAÇADEIRA DE CABO".
 * Assim o cliente digita o produto, vê todas as variações e só então
 * escolhe a bitola e a cor.
 *
 * A primeira palavra do termo precisa iniciar a descrição; as demais podem
 * vir em qualquer posição seguinte, sempre como INÍCIO de palavra
 * (ex.: "cabo 1,5 azul" encontra "CABO FLEXÍVEL 1,5 AZUL").
 *
 * Não diferencia maiúsculas/minúsculas nem acentos.
 * Retorna -1 quando não casa; quanto maior, melhor o match.
 */
export function scoreTermMatch(text: string | null | undefined, term: string | null | undefined): number {
    const name = normalizeSearchText(text);
    const normalizedTerm = normalizeSearchText(term);
    if (!name || !normalizedTerm) return -1;

    if (name === normalizedTerm) return 1000;
    if (name.startsWith(normalizedTerm)) return 900;

    const nameWords = splitWords(name);
    const tokens = splitWords(normalizedTerm);
    if (nameWords.length === 0 || tokens.length === 0) return -1;
    if (tokens.length > nameWords.length) return -1;

    // Âncora: a descrição precisa começar pela primeira palavra do termo.
    const [firstToken, ...restTokens] = tokens;
    if (!nameWords[0].startsWith(firstToken)) return -1;

    let score = nameWords[0] === firstToken ? 600 : 500;

    // Bônus quando o termo inteiro abre a descrição na mesma ordem
    // ("cabo flex" → "CABO FLEXÍVEL ..." vence "CABO PP ... FLEX").
    const abreNaOrdem = tokens.every((token, i) => nameWords[i]?.startsWith(token));
    if (abreNaOrdem) score += 150;

    // Demais palavras: em qualquer posição seguinte, sempre como início de palavra
    const usados = new Set<number>([0]);
    for (const token of restTokens) {
        const idx = nameWords.findIndex((word, i) => i > 0 && !usados.has(i) && word.startsWith(token));
        if (idx === -1) return -1;
        usados.add(idx);
        score += nameWords[idx] === token ? 20 : 10;
    }

    return Math.min(score, 890);
}

/**
 * A descrição começa pelo termo pesquisado? (sem diferenciar caixa/acentos)
 */
export function textIncludesTerm(text: string | null | undefined, term: string | null | undefined): boolean {
    return scoreTermMatch(text, term) >= 0;
}

const MAX_SEARCH_VARIANTS = 12;
const MIN_TERM_LENGTH_FOR_SYNONYMS = 3;

/** Formas de um termo do grupo que a busca aceita: com e sem acento. */
function synonymForms(termo: string): string[] {
    const raw = String(termo || '').trim().toLowerCase();
    const normalized = normalizeSearchText(termo);
    return [raw, normalized].filter(Boolean);
}

/**
 * O termo do grupo é sinônimo do que foi digitado?
 * Só casa quando o grupo COMEÇA pelo que o usuário digitou — nunca no meio
 * da palavra, seguindo a mesma regra da busca (ver scoreTermMatch).
 */
function synonymMatches(groupTerm: string, typed: string): boolean {
    if (!groupTerm || !typed) return false;
    if (groupTerm === typed) return true;
    return typed.length >= MIN_TERM_LENGTH_FOR_SYNONYMS && groupTerm.startsWith(typed);
}

/** Sinônimos de uma única palavra (inclui a própria palavra). */
function alternativesForToken(token: string, groups: string[][]): string[] {
    const alts = new Set<string>([token]);
    for (const group of groups) {
        const normalized = group.map(normalizeSearchText).filter(Boolean);
        if (!normalized.some((termo) => synonymMatches(termo, token))) continue;
        group.forEach((termo) => synonymForms(termo).forEach((forma) => alts.add(forma)));
    }
    return Array.from(alts);
}

/**
 * Expande o termo pesquisado com os sinônimos cadastrados.
 *
 * Expande em dois níveis:
 *  - termo inteiro  ("bacia"    → "vaso sanitario")
 *  - palavra a palavra ("fio flex" → "cabo flex"), para que o sinônimo continue
 *    ancorado no início da descrição depois da troca.
 */
export function expandTermWithSynonyms(term: string, synonymGroups: string[][]): string[] {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm) return [];

    const variants = new Set<string>([normalizedTerm]);
    const groups = (synonymGroups || []).filter((group) => (group || []).length > 1);

    if (normalizedTerm.length >= MIN_TERM_LENGTH_FOR_SYNONYMS) {
        // 1) Sinônimos do termo inteiro
        for (const group of groups) {
            const normalized = group.map(normalizeSearchText).filter(Boolean);
            if (!normalized.some((termo) => synonymMatches(termo, normalizedTerm))) continue;
            group.forEach((termo) => synonymForms(termo).forEach((forma) => variants.add(forma)));
        }

        // 2) Sinônimos palavra a palavra, preservando a posição
        const tokens = normalizedTerm.split(/\s+/).filter(Boolean);
        if (tokens.length > 1) {
            const porToken = tokens.map((token) => alternativesForToken(token, groups));
            let combos: string[][] = [[]];
            for (const alternativas of porToken) {
                const proximo: string[][] = [];
                for (const combo of combos) {
                    for (const alternativa of alternativas) {
                        proximo.push([...combo, alternativa]);
                        if (proximo.length >= MAX_SEARCH_VARIANTS) break;
                    }
                    if (proximo.length >= MAX_SEARCH_VARIANTS) break;
                }
                combos = proximo;
            }
            combos.forEach((combo) => variants.add(combo.join(' ')));
        }
    }

    return Array.from(variants).slice(0, MAX_SEARCH_VARIANTS);
}
