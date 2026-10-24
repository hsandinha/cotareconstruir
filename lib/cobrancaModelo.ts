/**
 * Regras de cobrança e de comissão — a parte que é só conta.
 *
 * Separado de `cobranca.ts` e `afiliados.ts` de propósito: aqui não entra
 * Supabase nem fetch, então dá para testar cada arredondamento e cada virada
 * de mês sem banco e sem rede. Dinheiro errado por meio centavo é o tipo de
 * defeito que só aparece no extrato do parceiro, meses depois.
 *
 * Convenção: TODO valor monetário é INTEGER em centavos. R$ 499,00 = 49900.
 * Ponto flutuante não entra nem de passagem — 0.1 + 0.2 não é 0.3, e 20% de
 * um preço em float erra o centavo de forma que ninguém consegue auditar.
 */

export type ModeloCobranca = 'por_obra' | 'por_cliente' | 'por_conta';
export type CicloCobranca = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export const MESES_DO_CICLO: Record<CicloCobranca, number> = {
    mensal: 1,
    trimestral: 3,
    semestral: 6,
    anual: 12,
};

export const ROTULO_MODELO: Record<ModeloCobranca, string> = {
    por_obra: 'Por obra cadastrada',
    por_cliente: 'Por cliente',
    por_conta: 'Por conta de acesso',
};

export const ROTULO_CICLO: Record<CicloCobranca, string> = {
    mensal: 'Mensal',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
};

// ============================================================
// DINHEIRO
// ============================================================

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 49900 → "R$ 499,00" */
export function formatarCentavos(centavos: number): string {
    return BRL.format((Number(centavos) || 0) / 100);
}

/**
 * "R$ 499,00", "499,00", "499.00" ou "499" → 49900.
 *
 * Aceita o que o admin digita de verdade. A regra do separador é a mesma do
 * resto do sistema: a ÚLTIMA vírgula ou ponto com 1-2 dígitos depois é o
 * decimal; o resto é separador de milhar. Assim "1.499,00" e "1,499.00" caem
 * no mesmo lugar. Devolve `null` quando não dá para ler com segurança — e
 * `null` é bem melhor que um zero silencioso num campo de preço.
 */
export function centavosDeTexto(valor: unknown): number | null {
    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? Math.round(valor * 100) : null;
    }

    const texto = String(valor ?? '').replace(/[^\d.,-]/g, '').trim();
    if (!texto || !/\d/.test(texto)) return null;

    const negativo = texto.startsWith('-');
    const corpo = texto.replace(/-/g, '');

    const ultimoSeparador = Math.max(corpo.lastIndexOf(','), corpo.lastIndexOf('.'));
    let inteiros = corpo;
    let decimais = '';

    if (ultimoSeparador >= 0) {
        const depois = corpo.slice(ultimoSeparador + 1);
        // 1 ou 2 dígitos depois do separador = centavos; 3 = milhar
        if (depois.length > 0 && depois.length <= 2 && /^\d+$/.test(depois)) {
            inteiros = corpo.slice(0, ultimoSeparador);
            decimais = depois.padEnd(2, '0');
        }
    }

    const digitosInteiros = inteiros.replace(/\D/g, '');
    if (!digitosInteiros && !decimais) return null;

    const centavos = Number(digitosInteiros || '0') * 100 + Number(decimais || '0');
    if (!Number.isFinite(centavos)) return null;
    return negativo ? -centavos : centavos;
}

// ============================================================
// DATAS DE COBRANÇA
// ============================================================

/** Data (ou ISO) → 'YYYY-MM-01'. É a chave de idempotência do mês. */
export function competenciaDe(data: Date | string = new Date()): string {
    const d = typeof data === 'string' ? new Date(data) : data;
    const ano = d.getUTCFullYear();
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}-01`;
}

/**
 * Soma meses preservando o fim de mês.
 *
 * 31/01 + 1 mês tem que dar 28/02 (ou 29), não 03/03 — que é o que o
 * `setMonth` do JS faz sozinho ao transbordar. Cobrar alguém no dia 3 porque
 * assinou dia 31 é o tipo de coisa que gera chamado no suporte todo mês.
 */
export function somarMeses(data: Date | string, meses: number): Date {
    const d = typeof data === 'string' ? new Date(data) : new Date(data);
    const dia = d.getUTCDate();
    const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
    const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    alvo.setUTCDate(Math.min(dia, ultimoDia));
    return alvo;
}

/** Quando cai a cobrança seguinte, a partir de uma data e do ciclo. */
export function proximaCobranca(apartirDe: Date | string, ciclo: CicloCobranca): Date {
    return somarMeses(apartirDe, MESES_DO_CICLO[ciclo] ?? 1);
}

/** 'YYYY-MM-DD' de um Date, em UTC. */
export function dataISO(data: Date): string {
    return data.toISOString().slice(0, 10);
}

// ============================================================
// JANELA DA COMISSÃO
// ============================================================

/**
 * Até quando o parceiro recebe por este cliente.
 *
 * `duracaoMeses` nulo = vitalício, e aí não há fim. A janela conta do
 * PRIMEIRO PAGAMENTO CONFIRMADO, nunca do cadastro: com 30 dias de teste
 * grátis, contar do cadastro queimaria o primeiro mês do parceiro num
 * período em que ninguém pagou nada.
 */
export function fimDaJanela(
    primeiroPagamento: Date | string,
    duracaoMeses: number | null | undefined,
): string | null {
    if (duracaoMeses === null || duracaoMeses === undefined) return null;
    if (!(duracaoMeses > 0)) return null;
    return dataISO(somarMeses(primeiroPagamento, duracaoMeses));
}

/**
 * Esta competência ainda rende comissão?
 *
 * Fim nulo = vitalício, sempre dentro. A comparação é por data ISO, que
 * ordena lexicograficamente — sem fuso no meio do caminho para errar o
 * último mês da janela.
 */
export function dentroDaJanela(
    competencia: string,
    inicio: string | null | undefined,
    fim: string | null | undefined,
): boolean {
    if (!competencia) return false;
    if (inicio && competencia < competenciaDe(inicio)) return false;
    if (!fim) return true;
    return competencia < fim;
}

/**
 * Quanto o parceiro ganha sobre um pagamento.
 *
 * Arredonda para o centavo mais próximo. Percentual fora de 0–100 é tratado
 * como erro de cadastro e devolve 0 — melhor não pagar e alguém reclamar do
 * que pagar 2000% e ninguém perceber.
 */
export function calcularComissao(baseCentavos: number, percentual: number): number {
    const base = Math.max(Math.round(Number(baseCentavos) || 0), 0);
    const pct = Number(percentual);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return 0;
    return Math.round((base * pct) / 100);
}

// ============================================================
// O QUE COBRAR
// ============================================================

export interface ObraCobravel {
    id: string;
    nome?: string | null;
}

/**
 * Quais assinaturas um cliente deveria ter, dado o modelo vigente.
 *
 * É a tradução de "cobro por obra" para linhas concretas: no modelo por obra,
 * uma assinatura por obra; nos outros, uma só, com `obraId` nulo. Devolver a
 * lista esperada (em vez de só um número) é o que permite ao chamador
 * comparar com o que existe e criar apenas o que falta.
 */
export function assinaturasEsperadas(
    modelo: ModeloCobranca,
    obras: ObraCobravel[],
): Array<{ obraId: string | null }> {
    if (modelo === 'por_obra') {
        return (obras || []).filter((o) => o?.id).map((o) => ({ obraId: o.id }));
    }
    return [{ obraId: null }];
}

/** Fim do teste grátis a partir do início. 0 dias = sem teste. */
export function fimDoTrial(inicio: Date | string, diasTrial: number): Date | null {
    if (!(diasTrial > 0)) return null;
    const d = typeof inicio === 'string' ? new Date(inicio) : new Date(inicio);
    d.setUTCDate(d.getUTCDate() + diasTrial);
    return d;
}

/**
 * O acesso está liberado?
 *
 * `inadimplente` continua valendo durante a tolerância: cortar no dia do
 * vencimento pune quem teve boleto atrasando no banco. Depois dela, corta.
 */
export function acessoLiberado(params: {
    cobrancaAtiva: boolean;
    status: string;
    vencimentoMaisAntigo?: string | null;
    diasTolerancia: number;
    hoje?: Date;
}): boolean {
    // Cobrança desligada: ninguém é barrado por dinheiro.
    if (!params.cobrancaAtiva) return true;

    if (params.status === 'trial' || params.status === 'ativa') return true;
    if (params.status === 'cancelada' || params.status === 'encerrada') return false;

    if (params.status === 'inadimplente') {
        if (!params.vencimentoMaisAntigo) return true;
        const limite = new Date(params.vencimentoMaisAntigo);
        limite.setUTCDate(limite.getUTCDate() + (params.diasTolerancia || 0));
        return (params.hoje || new Date()) <= limite;
    }

    return false;
}

// ============================================================
// CÓDIGO DE AFILIADO
// ============================================================

// Sem 0/O/1/I/L: o código é ditado por telefone e escrito à mão.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código aleatório para o link do parceiro. */
export function gerarCodigoAfiliado(tamanho = 6): string {
    let saida = '';
    for (let i = 0; i < tamanho; i++) {
        saida += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
    }
    return saida;
}

/**
 * Sugere um código a partir do nome do parceiro ("Marcos Vieira" → MARCOS).
 * Mais fácil de ditar que um aleatório; quem chama confere se já existe.
 */
export function codigoSugerido(nome: string): string {
    const limpo = String(nome || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    if (limpo.length >= 4) return limpo.slice(0, 10);
    return gerarCodigoAfiliado();
}

/** Normaliza o que veio na URL antes de bater no banco. */
export function normalizarCodigo(codigo: unknown): string {
    return String(codigo ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

/** O código tem a forma que a constraint do banco aceita? */
export function codigoValido(codigo: string): boolean {
    return /^[A-Z0-9]{4,20}$/.test(codigo);
}
