/**
 * Planilha de resposta da cotação — geração e leitura no servidor.
 *
 * É o mesmo layout de colunas que o fornecedor já baixa e importa no painel
 * (components/dashboard/supplier/QuotationResponseSection.tsx). Aqui ele
 * existe para o caminho pelo WhatsApp: a plataforma anexa a planilha já
 * preenchida com os itens, o fornecedor só digita o preço e devolve o arquivo
 * na conversa.
 *
 * Como o arquivo volta sabendo de qual cotação é — em ordem de confiança:
 *   1. aba oculta `_ref`, com o UUID da cotação (sobrevive a salvar no Excel);
 *   2. coluna `cotacao_item_id`, que o chamador resolve no banco;
 *   3. nome do arquivo (`cotacao-10070.xlsx`).
 *
 * Quem converte para CSV perde a aba `_ref`, e é por isso que a coluna de id
 * do item continua na planilha mesmo sendo ruído visual.
 */

import * as XLSX from "xlsx";
import type { ItemPropostaInput } from "./propostaService";
import type { WhatsAppIncomingMessage } from "./whatsappService";
import {
    getCsvRowValue,
    normalizeCsvKey,
    parseFlexibleNumber,
    parseSpreadsheetBuffer,
    sheetToRows,
    type ParsedCsvRow,
} from "./csvSpreadsheet";

export const ABA_RESPOSTA = "Resposta";
export const ABA_REF = "_ref";

/** Mesma ordem do export do painel — fornecedor que já conhece o arquivo não estranha. */
export const COLUNAS_RESPOSTA = [
    "cotacao_item_id",
    "material",
    "fabricante",
    "unidade",
    "quantidade",
    "preco_unitario",
    "disponibilidade",
    "forma_pagamento",
    "validade",
    "prazo_entrega_dias",
    "valor_frete",
    "valor_impostos",
    "valor_desconto",
    "observacoes",
] as const;

export const MIMES_PLANILHA = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "text/csv",
    "text/plain",
    "text/comma-separated-values",
    "application/csv",
];

export type Disponibilidade = "disponivel" | "sob_consulta" | "indisponivel";

export interface ItemCotacaoPlanilha {
    id: string;
    nome: string;
    fabricante?: string | null;
    unidade?: string | null;
    quantidade: number | string;
}

export interface LinhaRespostaPlanilha {
    /** UUID do cotacao_item, quando a coluna veio preenchida. */
    cotacaoItemId: string;
    /** Nome do material — usado para casar a linha quando o id some. */
    material: string;
    /** `null` = fornecedor deixou em branco (não cotou este item). */
    precoUnitario: number | null;
    /** Vazio quando o fornecedor não mexeu na coluna. */
    disponibilidade: Disponibilidade | "";
}

export interface CondicoesPlanilha {
    formaPagamento: string;
    /** Rótulo normalizado ('30-dias') ou vazio. */
    validade: string;
    prazoEntregaDias: number | null;
    valorFrete: number | null;
    valorImpostos: number | null;
    valorDesconto: number | null;
    observacoes: string;
}

export interface RefPlanilha {
    cotacaoId?: string;
    numero?: string;
}

export interface RespostaPlanilha {
    ref: RefPlanilha;
    linhas: LinhaRespostaPlanilha[];
    condicoes: CondicoesPlanilha;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prazo implícito por disponibilidade, igual ao do painel: disponível entrega
 * no prazo da proposta (0), sob consulta pede uma folga, indisponível é -1 —
 * o valor que o mapa comparativo lê como "não cotado".
 */
const PRAZO_POR_DISPONIBILIDADE: Record<Disponibilidade, number> = {
    disponivel: 0,
    sob_consulta: 5,
    indisponivel: -1,
};

// ============================================================
// GERAÇÃO
// ============================================================

/**
 * `cotacao-10070.xlsx`. O número também vai no nome porque é o que o
 * fornecedor vê na lista de arquivos do celular — e é o último recurso para
 * identificar a cotação se ele reconstruir a planilha do zero.
 */
export function nomeArquivoPlanilha(cotacaoNumero: string): string {
    const slug = String(cotacaoNumero || "").replace(/[^A-Za-z0-9_-]/g, "") || "nova";
    return `cotacao-${slug}.xlsx`;
}

/** Extrai o número do nome do arquivo que a plataforma mandou. */
export function numeroDoNomeArquivo(fileName: string): string {
    const match = String(fileName || "").match(/cotacao[-_ ]?([A-Za-z0-9_-]+)/i);
    return match ? match[1] : "";
}

/**
 * Monta a planilha que acompanha a notificação de nova cotação.
 *
 * Tudo já vem preenchido menos `preco_unitario`: a promessa feita ao
 * fornecedor é que ele só precisa digitar o preço. Por isso
 * `disponibilidade` já sai como "disponivel" — quem não quiser cotar um item
 * deixa o preço vazio, e a leitura marca o item como indisponível.
 */
export function gerarPlanilhaResposta(
    cotacao: { id: string; numero?: string | null },
    itens: ItemCotacaoPlanilha[],
): Buffer {
    const linhas = itens.map((item, index) => ({
        cotacao_item_id: item.id,
        material: item.nome || "",
        fabricante: item.fabricante || "",
        unidade: item.unidade || "",
        quantidade: item.quantidade ?? "",
        preco_unitario: "",
        disponibilidade: "disponivel",
        // Condições valem para a proposta inteira: só a primeira linha é lida.
        forma_pagamento: "",
        validade: index === 0 ? "30-dias" : "",
        prazo_entrega_dias: "",
        valor_frete: index === 0 ? "0" : "",
        valor_impostos: index === 0 ? "0" : "",
        valor_desconto: index === 0 ? "0" : "",
        observacoes: "",
    }));

    const matriz: unknown[][] = [
        [...COLUNAS_RESPOSTA],
        ...linhas.map((linha) => COLUNAS_RESPOSTA.map((coluna) => (linha as any)[coluna] ?? "")),
    ];

    const aba = XLSX.utils.aoa_to_sheet(matriz);
    aba["!cols"] = COLUNAS_RESPOSTA.map((coluna) => {
        const maior = Math.max(
            coluna.length,
            ...linhas.map((linha) => String((linha as any)[coluna] ?? "").length),
        );
        return { wch: Math.min(Math.max(maior + 2, 10), 50) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, aba, ABA_RESPOSTA);

    // Aba de identificação: oculta para não poluir, mas preservada pelo Excel
    // ao salvar. É o caminho mais confiável de volta até a cotação certa.
    const refSheet = XLSX.utils.aoa_to_sheet([
        ["cotacao_id", "numero"],
        [cotacao.id, cotacao.numero || ""],
    ]);
    XLSX.utils.book_append_sheet(workbook, refSheet, ABA_REF);
    workbook.Workbook = {
        Sheets: workbook.SheetNames.map((nome) => ({
            name: nome,
            Hidden: nome === ABA_REF ? 1 : 0,
        })),
    } as any;

    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

// ============================================================
// LEITURA
// ============================================================

/**
 * Converte o texto da coluna `disponibilidade` para os valores do banco.
 * Mesmas tolerâncias do import no painel ("sim", "imediata", "não"...).
 */
export function normalizarDisponibilidade(valor: string): Disponibilidade | "" {
    const normalizado = normalizeCsvKey(valor);
    if (!normalizado) return "";

    if (["disponivel", "imediata", "imediato", "sim", "yes", "ok", "1", "true"].includes(normalizado)) {
        return "disponivel";
    }
    if (["sobconsulta", "consulta", "comconsulta", "parcial", "talvez"].includes(normalizado)) {
        return "sob_consulta";
    }
    if (["indisponivel", "naodisponivel", "nao", "0", "false"].includes(normalizado)) {
        return "indisponivel";
    }
    return "";
}

/** '30 dias', '30-dias', '30' → '30-dias'. Desconhecido vira vazio. */
export function normalizarValidade(valor: string): string {
    const normalizado = normalizeCsvKey(valor);
    if (!normalizado) return "";
    if (normalizado.includes("7")) return "7-dias";
    if (normalizado.includes("15")) return "15-dias";
    if (normalizado.includes("30")) return "30-dias";
    if (normalizado.includes("60")) return "60-dias";
    return "";
}

/** '30-dias' → 30. Sem rótulo reconhecido, assume 30 dias. */
export function diasDaValidade(validade: string): number {
    const match = String(validade || "").match(/\d+/);
    const dias = match ? parseInt(match[0], 10) : NaN;
    return Number.isFinite(dias) && dias > 0 ? dias : 30;
}

function lerRef(workbook: XLSX.WorkBook): RefPlanilha {
    const aba = workbook.Sheets[ABA_REF];
    if (!aba) return {};
    const linhas = sheetToRows(aba);
    const primeira = linhas[0];
    if (!primeira) return {};

    const ref: RefPlanilha = {};
    const cotacaoId = getCsvRowValue(primeira, ["cotacao_id", "cotacaoid"]);
    const numero = getCsvRowValue(primeira, ["numero"]);
    if (UUID_RE.test(cotacaoId)) ref.cotacaoId = cotacaoId;
    if (numero) ref.numero = numero;
    return ref;
}

function lerCondicoes(linhas: ParsedCsvRow[]): CondicoesPlanilha {
    // As condições valem para a proposta inteira; o painel grava na primeira
    // linha, mas um fornecedor pode muito bem digitar na que lhe convier.
    const linha = linhas.find((l) =>
        getCsvRowValue(l, ["forma_pagamento", "pagamento"])
        || getCsvRowValue(l, ["validade", "validade_proposta"])
        || getCsvRowValue(l, ["prazo_entrega_dias", "prazo_entrega"])
        || getCsvRowValue(l, ["valor_frete", "frete"])
        || getCsvRowValue(l, ["valor_impostos", "impostos"])
        || getCsvRowValue(l, ["valor_desconto", "desconto"])
        || getCsvRowValue(l, ["observacoes", "obs"])
    ) || {};

    return {
        formaPagamento: getCsvRowValue(linha, ["forma_pagamento", "pagamento"]),
        validade: normalizarValidade(getCsvRowValue(linha, ["validade", "validade_proposta"])),
        prazoEntregaDias: parseFlexibleNumber(getCsvRowValue(linha, ["prazo_entrega_dias", "prazo_entrega"])),
        valorFrete: parseFlexibleNumber(getCsvRowValue(linha, ["valor_frete", "frete"])),
        valorImpostos: parseFlexibleNumber(getCsvRowValue(linha, ["valor_impostos", "impostos"])),
        valorDesconto: parseFlexibleNumber(getCsvRowValue(linha, ["valor_desconto", "desconto"])),
        observacoes: getCsvRowValue(linha, ["observacoes", "obs"]),
    };
}

/**
 * Lê o arquivo que o fornecedor devolveu, seja a planilha original salva por
 * cima, seja um CSV exportado dela.
 *
 * Não valida nada de negócio: só traduz bytes em linhas. Decidir se dá uma
 * proposta válida é de quem chamou.
 */
export function lerRespostaPlanilha(buffer: ArrayBuffer | Uint8Array, fileName: string): RespostaPlanilha {
    const ref: RefPlanilha = {};
    let linhas: ParsedCsvRow[] = [];

    const ehXlsx = /\.(xlsx|xlsm|xlsb|xls)$/i.test(fileName || "");
    if (ehXlsx) {
        const workbook = XLSX.read(buffer, { type: "array" });
        Object.assign(ref, lerRef(workbook));

        // A aba de resposta pode ter sido renomeada; na dúvida, a primeira
        // que não seja a de referência.
        const nomeAba = workbook.SheetNames.includes(ABA_RESPOSTA)
            ? ABA_RESPOSTA
            : workbook.SheetNames.find((nome) => nome !== ABA_REF);
        if (nomeAba) linhas = sheetToRows(workbook.Sheets[nomeAba]);
    } else {
        linhas = parseSpreadsheetBuffer(buffer, fileName);
    }

    if (!ref.numero) {
        const doNome = numeroDoNomeArquivo(fileName);
        if (doNome) ref.numero = doNome;
    }

    const linhasResposta: LinhaRespostaPlanilha[] = linhas.map((linha) => {
        const cotacaoItemId = getCsvRowValue(linha, ["cotacao_item_id", "item_id", "id_item", "id"]);
        return {
            cotacaoItemId: UUID_RE.test(cotacaoItemId) ? cotacaoItemId : "",
            material: getCsvRowValue(linha, ["material", "descricao", "item"]),
            precoUnitario: parseFlexibleNumber(
                getCsvRowValue(linha, ["preco_unitario", "preco", "valor_unitario"]),
            ),
            disponibilidade: normalizarDisponibilidade(
                getCsvRowValue(linha, ["disponibilidade", "status"]),
            ),
        };
    });

    return { ref, linhas: linhasResposta, condicoes: lerCondicoes(linhas) };
}

/**
 * O documento recebido parece a planilha de resposta?
 *
 * Checagem barata feita antes de baixar qualquer byte da Meta — foto de nota
 * fiscal e áudio não podem disparar download nem consulta ao banco.
 */
export function pareceAnexoDeCotacao(mensagem: WhatsAppIncomingMessage): boolean {
    if (mensagem.type !== "document") return false;

    const nome = (mensagem.mediaFilename || "").toLowerCase();
    const mime = (mensagem.mediaMime || "").split(";")[0].trim().toLowerCase();

    const extensaoOk = /\.(xlsx|xlsm|xlsb|xls|csv|txt)$/.test(nome);
    const mimeOk = MIMES_PLANILHA.includes(mime);
    return extensaoOk || mimeOk;
}

// ============================================================
// MONTAGEM DA PROPOSTA
// ============================================================

/**
 * Casa as linhas da planilha com os itens da cotação e devolve a proposta
 * item a item.
 *
 * Item sem preço entra como indisponível em vez de ficar de fora: o mapa
 * comparativo do cliente mostra a cotação inteira, e um item ausente é lido
 * como erro de envio, não como "não trabalho com isso".
 */
export function montarItensProposta(
    itensCotacao: Array<{ id: string; nome: string; quantidade: number | string }>,
    linhas: LinhaRespostaPlanilha[],
): ItemPropostaInput[] {
    const porId = new Map<string, LinhaRespostaPlanilha>();
    const porNome = new Map<string, LinhaRespostaPlanilha>();

    for (const linha of linhas) {
        if (linha.cotacaoItemId) porId.set(linha.cotacaoItemId, linha);
        const chave = normalizeCsvKey(linha.material);
        // Primeira ocorrência vence: material repetido na planilha não
        // sobrescreve o preço já lido.
        if (chave && !porNome.has(chave)) porNome.set(chave, linha);
    }

    return itensCotacao.map((item) => {
        const linha = porId.get(item.id) || porNome.get(normalizeCsvKey(item.nome || ""));
        const quantidade = Number(item.quantidade) || 0;
        const preco = linha?.precoUnitario !== null && linha?.precoUnitario !== undefined
            ? Math.max(linha.precoUnitario, 0)
            : 0;

        // Sem preço não há o que cotar, qualquer que seja a coluna
        // disponibilidade; com preço, a coluna só vale se o fornecedor
        // escreveu algo nela.
        const disponibilidade: Disponibilidade = preco > 0
            ? (linha?.disponibilidade && linha.disponibilidade !== "indisponivel"
                ? linha.disponibilidade
                : "disponivel")
            : "indisponivel";

        return {
            cotacao_item_id: item.id,
            preco_unitario: preco,
            quantidade,
            subtotal: preco * quantidade,
            disponibilidade,
            prazo_dias: PRAZO_POR_DISPONIBILIDADE[disponibilidade],
            observacao: null,
        };
    });
}

// ============================================================
// RESPOSTA AO FORNECEDOR
// ============================================================

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function montarConfirmacao(params: {
    cotacaoNumero: string;
    atualizada: boolean;
    itensCotados: number;
    itensTotal: number;
    total: number;
    loginUrl: string;
}): string {
    const { cotacaoNumero, atualizada, itensCotados, itensTotal, total, loginUrl } = params;

    const linhas = [
        atualizada
            ? "✅ *Proposta atualizada e reenviada ao cliente!*"
            : "✅ *Proposta registrada e enviada ao cliente!*",
        "",
        `*Cotação:* #${cotacaoNumero}`,
        `*Itens cotados:* ${itensCotados} de ${itensTotal}`,
        `*Total:* ${MOEDA.format(total)}`,
    ];

    if (itensCotados < itensTotal) {
        linhas.push("", `_${itensTotal - itensCotados} item(ns) ficaram sem preço e foram marcados como indisponíveis._`);
    }

    linhas.push(
        "",
        "Precisa corrigir algo? Reenvie a planilha com os novos valores — a proposta é substituída.",
        "",
        `Acompanhe pela plataforma: ${loginUrl}`,
    );

    return linhas.join('\n');
}
