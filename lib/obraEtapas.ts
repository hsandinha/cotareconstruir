/**
 * Cronograma de etapas da obra.
 *
 * A mesma fase só pode aparecer uma vez por obra. O banco passou a garantir
 * isso (migration 20260817000000_obra_etapas_dedupe_unique), mas as telas
 * também filtram na leitura para que bases ainda não migradas não exibam a
 * etapa repetida no cronograma nem na árvore de Nova Cotação.
 *
 * O cronograma da obra segue SEMPRE a cronologia cadastrada em `fases`
 * (Instalações → Esquadrias → Revestimentos → ...), e não a ordem em que o
 * cliente foi adicionando as etapas na tela.
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

/**
 * Ordena as etapas pela cronologia da fase (coluna `fases.cronologia`),
 * não pela ordem de inclusão. Etapas sem fase conhecida vão para o fim,
 * mantendo entre si a `ordem` gravada e, em último caso, o nome.
 */
export function sortObraEtapasByCronologia<T extends EtapaLike>(
    etapas: T[] | null | undefined,
    cronologiaPorFase?: Map<string, number> | null,
): T[] {
    const SEM_CRONOLOGIA = Number.MAX_SAFE_INTEGER;

    const cronologiaDe = (etapa: T): number => {
        const faseId = String(etapa.fase_id || "").trim();
        const cronologia = faseId ? cronologiaPorFase?.get(faseId) : undefined;
        if (typeof cronologia === "number" && Number.isFinite(cronologia)) return cronologia;
        // Sem o mapa de fases (ou fase removida), cai na `ordem` gravada —
        // que a migration 20260818000000 já alinhou com a cronologia.
        return typeof etapa.ordem === "number" && Number.isFinite(etapa.ordem) ? etapa.ordem : SEM_CRONOLOGIA;
    };

    return [...(etapas || [])].sort((a, b) => {
        const diff = cronologiaDe(a) - cronologiaDe(b);
        if (diff !== 0) return diff;
        return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
}
