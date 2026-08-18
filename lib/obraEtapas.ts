/**
 * Cronograma de etapas da obra.
 *
 * A mesma fase só pode aparecer uma vez por obra. O banco passou a garantir
 * isso (migration 20260817000000_obra_etapas_dedupe_unique), mas as telas
 * também filtram na leitura para que bases ainda não migradas não exibam a
 * etapa repetida no cronograma nem na árvore de Nova Cotação.
 */

type EtapaLike = {
    id: string;
    fase_id?: string | null;
    nome?: string | null;
    ordem?: number | null;
};

/** Chave de identidade da etapa: a fase quando existir, senão o nome normalizado. */
function etapaKey(etapa: EtapaLike): string {
    const faseId = String(etapa.fase_id || "").trim();
    if (faseId) return `fase:${faseId}`;
    return `nome:${String(etapa.nome || "").trim().toLowerCase()}`;
}

/** Mantém apenas a primeira ocorrência de cada fase, preservando a ordem recebida. */
export function dedupeObraEtapas<T extends EtapaLike>(etapas: T[] | null | undefined): T[] {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const etapa of etapas || []) {
        const key = etapaKey(etapa);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(etapa);
    }

    return result;
}

/** true quando a fase já está no cronograma da obra. */
export function etapaJaNoCronograma(etapas: EtapaLike[] | null | undefined, faseId: string, nome?: string): boolean {
    const alvo = etapaKey({ id: "", fase_id: faseId, nome });
    return (etapas || []).some((etapa) => etapaKey(etapa) === alvo);
}
