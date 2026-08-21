/**
 * Turma de lançamento: controle das vagas de teste gratuito.
 *
 * A landing anuncia "os 20 primeiros construtores" e fila de espera depois
 * disso. Quem garante isso é a tabela `lancamento_vagas` com a função
 * `reservar_vaga_lancamento` (migration 20260821000000), que serializa as
 * reservas — dois cadastros simultâneos não levam a mesma vaga.
 */

export type StatusTurma = {
    vagasTotal: number;
    vagasOcupadas: number;
    vagasRestantes: number;
    inscricoesAbertas: boolean;
    diasTeste: number;
    obrasPorConta: number;
};

export type VagaLancamento = {
    id: string;
    user_id: string;
    cliente_id: string | null;
    posicao: number;
    nome: string | null;
    email: string | null;
    teste_inicio: string;
    teste_fim: string;
    status: 'ativo' | 'expirado' | 'convertido' | 'cancelado';
};

/** Valores usados quando a turma ainda não foi configurada no banco. */
export const TURMA_PADRAO: StatusTurma = {
    vagasTotal: 20,
    vagasOcupadas: 0,
    vagasRestantes: 20,
    inscricoesAbertas: true,
    diasTeste: 30,
    obrasPorConta: 1,
};

type AdminClient = {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

/**
 * Situação atual da turma. Nunca lança: se a migration ainda não rodou ou o
 * banco falha, devolve o padrão com `inscricoesAbertas`, para o cadastro não
 * travar por causa do contador.
 */
export async function getStatusTurma(client: AdminClient): Promise<StatusTurma> {
    try {
        const { data, error } = await client.rpc('status_turma_lancamento');
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return TURMA_PADRAO;

        const vagasTotal = Number(row.vagas_total) || 0;
        const vagasOcupadas = Number(row.vagas_ocupadas) || 0;

        return {
            vagasTotal,
            vagasOcupadas,
            vagasRestantes: Math.max(vagasTotal - vagasOcupadas, 0),
            inscricoesAbertas: Boolean(row.inscricoes_abertas),
            diasTeste: Number(row.dias_teste) || TURMA_PADRAO.diasTeste,
            obrasPorConta: Number(row.obras_por_conta) || TURMA_PADRAO.obrasPorConta,
        };
    } catch (error) {
        console.error('[LANCAMENTO] Falha ao ler a situação da turma:', error);
        return TURMA_PADRAO;
    }
}

/**
 * Resultado da reserva.
 *
 * `sem_vaga` é uma resposta legítima do banco (turma cheia) e manda o lead
 * para a fila. `indisponivel` é falha de infraestrutura — a migration ainda
 * não rodou, o banco caiu — e aí o cadastro segue normalmente, em vez de
 * derrubar todo mundo na fila por um erro nosso.
 */
export type ResultadoReserva =
    | { ok: true; vaga: VagaLancamento }
    | { ok: false; motivo: 'sem_vaga' }
    | { ok: false; motivo: 'indisponivel' };

/** Reserva a vaga do construtor recém-cadastrado. */
export async function reservarVaga(
    client: AdminClient,
    params: { userId: string; clienteId: string | null; nome: string; email: string; conviteToken?: string | null }
): Promise<ResultadoReserva> {
    let data: any;
    let error: any;

    try {
        ({ data, error } = await client.rpc('reservar_vaga_lancamento', {
            p_user_id: params.userId,
            p_cliente_id: params.clienteId,
            p_nome: params.nome,
            p_email: params.email,
            p_convite_token: params.conviteToken || null,
        }));
    } catch (thrown) {
        console.error('[LANCAMENTO] Erro ao chamar reservar_vaga_lancamento:', thrown);
        return { ok: false, motivo: 'indisponivel' };
    }

    if (error) {
        console.error('[LANCAMENTO] Falha ao reservar vaga:', error);
        return { ok: false, motivo: 'indisponivel' };
    }

    const vaga = Array.isArray(data) ? data[0] : data;
    if (vaga?.id) return { ok: true, vaga: vaga as VagaLancamento };

    // Sem erro e sem vaga = a função rodou e disse que não há vaga
    return { ok: false, motivo: 'sem_vaga' };
}

/** Dias que faltam para o teste acabar (0 quando já venceu). */
export function diasRestantesDoTeste(testeFim: string | null | undefined): number {
    if (!testeFim) return 0;
    const fim = new Date(testeFim).getTime();
    if (!Number.isFinite(fim)) return 0;
    const restam = Math.ceil((fim - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(restam, 0);
}

/** Convite da fila de espera, quando o token ainda vale. */
export type ConviteValido = { nome: string; email: string; expiraEm: string | null };

export async function validarConvite(client: AdminClient, token: string): Promise<ConviteValido | null> {
    if (!token) return null;
    try {
        const { data, error } = await client.rpc('validar_convite_lancamento', { p_token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.email) return null;
        return { nome: row.nome || '', email: row.email, expiraEm: row.expira_em || null };
    } catch (error) {
        console.error('[LANCAMENTO] Falha ao validar convite:', error);
        return null;
    }
}

/** Validade do convite enviado ao lead da fila. */
export const CONVITE_VALIDADE_DIAS = 7;

/** Token opaco para o link do convite. */
export function gerarConviteToken(): string {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
