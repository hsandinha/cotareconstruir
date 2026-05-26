import type { SupabaseClient } from '@supabase/supabase-js';

export interface SimilarMaterial {
    id: string;
    nome: string;
    unidade: string;
    descricao?: string | null;
    similarity: number;
}

const STOPWORDS = new Set([
    'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'sem', 'em', 'a', 'o',
    'um', 'uma', 'e', 'ou', 'tipo', 'modelo', 'unid', 'unidade', 'pc', 'pcs',
]);

export function normalizeName(value: string | null | undefined): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(value: string): string[] {
    return normalizeName(value)
        .split(' ')
        .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function trigrams(value: string): Set<string> {
    const padded = `  ${normalizeName(value)}  `;
    const grams = new Set<string>();
    for (let i = 0; i < padded.length - 2; i += 1) {
        const gram = padded.slice(i, i + 3);
        if (gram.trim().length > 0) grams.add(gram);
    }
    return grams;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    for (const item of a) if (b.has(item)) intersection += 1;
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Heuristic similarity score (0-1) combining trigram and token overlap.
 * Used as an in-memory fallback / re-ranker when pg_trgm is unavailable.
 */
export function similarityScore(a: string, b: string): number {
    if (!a || !b) return 0;
    const trigramScore = jaccard(trigrams(a), trigrams(b));
    const tokensA = new Set(tokenize(a));
    const tokensB = new Set(tokenize(b));
    const tokenScore = jaccard(tokensA, tokensB);
    return Math.max(trigramScore, tokenScore * 0.85);
}

/**
 * Look up similar materials. Prefers the SQL function `find_similar_materiais`
 * (pg_trgm based). Falls back to an in-memory scan if the RPC is unavailable.
 */
export async function findSimilarMateriais(
    supabase: SupabaseClient,
    nome: string,
    options: { limit?: number; threshold?: number } = {}
): Promise<SimilarMaterial[]> {
    const limit = options.limit ?? 5;
    const threshold = options.threshold ?? 0.35;
    const cleanedNome = nome.trim();
    if (!cleanedNome) return [];

    try {
        const { data, error } = await supabase.rpc('find_similar_materiais', {
            p_nome: cleanedNome,
            p_limit: limit,
            p_threshold: threshold,
        });

        if (!error && Array.isArray(data)) {
            return data.map((row: any) => ({
                id: row.id,
                nome: row.nome,
                unidade: row.unidade,
                descricao: row.descricao ?? null,
                similarity: Number(row.similarity ?? 0),
            }));
        }
    } catch {
        // Fallback below
    }

    // Fallback: load a window of materials and re-rank in memory.
    const { data, error } = await supabase
        .from('materiais')
        .select('id, nome, unidade, descricao')
        .ilike('nome', `%${cleanedNome.split(' ')[0] || cleanedNome}%`)
        .limit(200);

    if (error || !data) return [];

    return data
        .map((row: any) => ({
            id: row.id,
            nome: row.nome,
            unidade: row.unidade,
            descricao: row.descricao ?? null,
            similarity: similarityScore(cleanedNome, row.nome),
        }))
        .filter((item) => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
}

/**
 * Returns the highest-scoring similar material as a probable duplicate, if any.
 */
export function pickProbableDuplicate(
    candidates: SimilarMaterial[],
    threshold = 0.75
): SimilarMaterial | null {
    if (!candidates.length) return null;
    const top = candidates[0];
    return top.similarity >= threshold ? top : null;
}
